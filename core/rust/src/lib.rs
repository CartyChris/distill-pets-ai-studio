//! Bounded, deterministic advisory analysis. No transport, secrets, or approval authority.
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use unicode_normalization::UnicodeNormalization;
pub const MAX_INPUT: usize = 1024 * 1024;
type Outcome = Result<Value, String>;

fn string<'a>(v: &'a Value, max: usize, label: &str) -> Result<&'a str, String> {
    v.as_str()
        .filter(|s| s.len() <= max)
        .ok_or_else(|| label.into())
}
fn integer(v: &Value, min: u64, max: u64, label: &str) -> Result<u64, String> {
    v.as_f64()
        .filter(|n| n.is_finite() && n.fract() == 0.0 && *n >= min as f64 && *n <= max as f64)
        .map(|n| n as u64)
        .ok_or_else(|| label.into())
}
fn strings(v: &Value, count: usize, size: usize, label: &str) -> Result<Vec<String>, String> {
    let arr = v
        .as_array()
        .filter(|a| a.len() <= count)
        .ok_or_else(|| label.to_string())?;
    arr.iter()
        .map(|s| string(s, size, label).map(str::to_owned))
        .collect()
}
fn js_space(c: char) -> bool {
    matches!(c, '\u{0009}'..='\u{000d}' | ' ' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}
pub fn normalize(s: &str) -> String {
    s.nfkc()
        .collect::<String>()
        .split(js_space)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn plan(v: &Value) -> Outcome {
    let tasks = integer(&v["tasks"], 1, 3, "tasks must be an integer from 1 to 3")?;
    let rounds = integer(&v["rounds"], 1, 3, "rounds must be an integer from 1 to 3")?;
    let tokens = integer(
        &v["maxTokens"],
        1,
        8000,
        "maxTokens must be an integer from 1 to 8000",
    )?;
    let reference = v["reference"]
        .as_bool()
        .ok_or("reference must be boolean")?;
    let teacher = tasks * (rounds + u64::from(reference));
    let student = tasks * (1 + rounds);
    Ok(
        json!({"plannedCalls":teacher+student,"teacherCalls":teacher,"studentCalls":student,"maxOutputTokens":(teacher+student)*tokens}),
    )
}
fn bounded_json(v: &Value, depth: usize) -> bool {
    if depth > 64 {
        return false;
    }
    match v {
        Value::Array(items) => items.iter().all(|item| bounded_json(item, depth + 1)),
        Value::Object(items) => items.values().all(|item| bounded_json(item, depth + 1)),
        _ => true,
    }
}
fn diagnose(v: &Value) -> Outcome {
    let text = string(
        &v["text"],
        120000,
        "text exceeds 120000 UTF-8 bytes or is not text",
    )?;
    let c = v["checks"].as_object().ok_or("checks must be an object")?;
    let empty = json!([]);
    let zero = json!(0);
    let plain = json!("text");
    let format = c.get("format").unwrap_or(&plain);
    if format != "text" && format != "json" {
        return Err("format must be text or json".into());
    }
    let required = strings(
        c.get("required").unwrap_or(&empty),
        12,
        200,
        "invalid required terms",
    )?;
    let forbidden = strings(
        c.get("forbidden").unwrap_or(&empty),
        12,
        200,
        "invalid forbidden terms",
    )?;
    let keys = strings(
        c.get("jsonKeys").unwrap_or(&empty),
        12,
        200,
        "invalid JSON keys",
    )?;
    if required
        .iter()
        .chain(&forbidden)
        .chain(&keys)
        .any(|s| s.trim_matches(js_space).is_empty())
    {
        return Err("checks cannot contain empty terms".into());
    }
    let min = integer(
        c.get("minChars").unwrap_or(&zero),
        0,
        120000,
        "invalid minimum characters",
    )?;
    let max = integer(
        c.get("maxChars").unwrap_or(&zero),
        0,
        120000,
        "invalid maximum characters",
    )?;
    if max > 0 && max < min {
        return Err("maximum characters must be at least minimum characters".into());
    }
    let chars = text.chars().count() as u64;
    let norm = normalize(text);
    let mut checks = vec![];
    let mut findings = vec![];
    let mut check = |code: &str, passed: bool, detail: String| {
        checks.push(json!({"code":code,"passed":passed,"detail":detail}))
    };
    if min > 0 {
        check("min_chars", chars >= min, min.to_string());
    }
    if max > 0 {
        check("max_chars", chars <= max, max.to_string());
    }
    for term in required {
        check("required", norm.contains(&normalize(&term)), term);
    }
    for term in forbidden {
        check("forbidden", !norm.contains(&normalize(&term)), term);
    }
    if format == "json" || !keys.is_empty() {
        let parsed = serde_json::from_str::<Value>(text)
            .ok()
            .filter(|value| bounded_json(value, 0));
        check("json", parsed.is_some(), "Valid JSON".into());
        if let Some(obj) = parsed {
            for key in keys {
                check(
                    "json_key",
                    obj.as_object().is_some_and(|o| o.contains_key(&key)),
                    key,
                );
            }
        }
    }
    if norm.is_empty() {
        findings.push(json!({"code":"empty","count":1}));
    }
    if chars > 0 && chars < 24 {
        findings.push(json!({"code":"short","count":chars}));
    }
    let placeholders = ["[insert", "[todo", "todo:", "lorem ipsum"]
        .iter()
        .filter(|p| norm.contains(*p))
        .count();
    if placeholders > 0 {
        findings.push(json!({"code":"placeholder","count":placeholders}));
    }
    let lines: Vec<_> = text
        .split('\n')
        .map(normalize)
        .filter(|s| s.chars().count() >= 20)
        .collect();
    let unique: HashSet<_> = lines.iter().collect();
    let repeated = lines.len() - unique.len();
    if repeated > 0 {
        findings.push(json!({"code":"repeated_lines","count":repeated}));
    }
    Ok(
        json!({"characters":chars,"utf8Bytes":text.len(),"estimatedTokens":chars.div_ceil(4),"checkCount":checks.len(),"failedChecks":checks.iter().filter(|c| c["passed"] == false).count(),"checks":checks,"findings":findings}),
    )
}
fn audit(v: &Value) -> Outcome {
    let raw = v["rows"]
        .as_array()
        .filter(|a| a.len() <= 60)
        .ok_or("rows must contain at most 60 examples")?;
    let validation: Vec<_> = strings(&v["validation"], 12, 32000, "invalid validation prompts")?
        .iter()
        .map(|s| normalize(s))
        .collect();
    let exposures: Vec<_> = strings(&v["exposures"], 500, 32000, "invalid exposure prompts")?
        .iter()
        .map(|s| normalize(s))
        .collect();
    let mut ids = HashSet::new();
    let mut prompts = vec![];
    for row in raw {
        if !row.is_object() {
            return Err("each row must be an object".into());
        }
        let id = string(&row["id"], 80, "invalid row id")?;
        if id.is_empty() || !ids.insert(id) {
            return Err("row ids must be unique and nonempty".into());
        }
        prompts.push(
            strings(&row["prompts"], 12, 32000, "invalid row prompts")?
                .iter()
                .map(|s| normalize(s))
                .collect::<Vec<_>>(),
        );
        string(&row["completion"], 48000, "invalid completion")?;
        if ["approved", "demo", "truncated"]
            .iter()
            .any(|k| !row[k].is_boolean())
            || (row["split"] != "train" && row["split"] != "validation")
        {
            return Err("invalid row eligibility metadata".into());
        }
    }
    let mut overlaps = vec![];
    let mut duplicates = vec![];
    let mut near = vec![];
    let mut eligible = vec![];
    let mut excluded = vec![];
    let mut seen = HashMap::new();
    for (i, prompt) in validation.iter().enumerate() {
        if prompt.is_empty() {
            continue;
        }
        if exposures.contains(prompt) {
            overlaps.push(json!({"validationIndex":i,"rowId":"history"}));
        }
        for (j, row) in raw.iter().enumerate() {
            if row["split"] == "train" && prompts[j].contains(prompt) {
                overlaps.push(json!({"validationIndex":i,"rowId":row["id"]}));
            }
        }
    }
    let tokens: Vec<HashSet<&str>> = prompts
        .iter()
        .map(|p| {
            p.first()
                .map_or("", |s| s.as_str())
                .split(' ')
                .filter(|s| !s.is_empty())
                .collect()
        })
        .collect();
    for (i, row) in raw.iter().enumerate() {
        let prompt = prompts[i].first().map_or("", |s| s.as_str());
        let mut reasons = vec![];
        if row["approved"] != true {
            reasons.push("unreviewed");
        }
        if row["demo"] == true {
            reasons.push("playground");
        }
        if row["split"] != "train" {
            reasons.push("validation");
        }
        if row["truncated"] == true {
            reasons.push("truncated");
        }
        if prompt.is_empty()
            || row["completion"]
                .as_str()
                .unwrap()
                .trim_matches(js_space)
                .is_empty()
        {
            reasons.push("empty");
        }
        if overlaps.iter().any(|o| o["rowId"] == row["id"]) {
            reasons.push("validation_overlap");
        }
        if !prompt.is_empty() {
            if let Some(first) = seen.get(prompt) {
                reasons.push("duplicate");
                duplicates.push(json!({"first":first,"second":row["id"]}));
            }
        }
        if reasons.is_empty() {
            eligible.push(row["id"].clone());
            seen.insert(prompt, row["id"].clone());
        } else {
            excluded.push(json!({"id":row["id"],"reasons":reasons}));
        }
        for j in 0..i {
            if near.len() >= 100
                || Some(prompt) == prompts[j].first().map(|s| s.as_str())
                || tokens[i].len() < 5
                || tokens[j].len() < 5
            {
                continue;
            }
            let intersection = tokens[i].intersection(&tokens[j]).count();
            let union = tokens[i].len() + tokens[j].len() - intersection;
            if intersection * 100 >= union * 80 {
                near.push(json!({"first":raw[j]["id"],"second":row["id"],"similarityPercent":100*intersection/union}));
            }
        }
    }
    Ok(
        json!({"total":raw.len(),"eligibleIds":eligible,"excluded":excluded,"overlaps":overlaps,"duplicates":duplicates,"nearDuplicates":near}),
    )
}
fn error(code: &str, message: &str) -> Value {
    json!({"version":1,"ok":false,"error":{"code":code,"message":message}})
}
pub fn evaluate(input: &[u8]) -> Value {
    if input.len() > MAX_INPUT {
        return error("INPUT_TOO_LARGE", "Input exceeds 1 MiB");
    }
    let v: Value = match serde_json::from_slice(input) {
        Ok(v) => v,
        Err(_) => return error("INVALID_INPUT", "Invalid JSON"),
    };
    if !v.is_object() {
        return error("INVALID_INPUT", "request must be an object");
    }
    if v["version"].as_f64() != Some(1.0) {
        return error("UNSUPPORTED_VERSION", "Expected version 1");
    }
    let result = match v["operation"].as_str() {
        Some("plan_session") => plan(&v),
        Some("diagnose_output") => diagnose(&v),
        Some("audit_examples") => audit(&v),
        _ => return error("UNKNOWN_OPERATION", "Unknown core operation"),
    };
    match result {
        Ok(result) => json!({"version":1,"ok":true,"result":result}),
        Err(message) => error("INVALID_INPUT", &message),
    }
}

// Narrow owned-buffer ABI. The adapter owns each allocation and always frees it.
// Input/output never alias; every evaluate call is synchronous inside one worker.
#[cfg(target_arch = "wasm32")]
mod abi {
    use super::*;
    #[no_mangle]
    pub extern "C" fn core_alloc(len: usize) -> *mut u8 {
        if len == 0 || len > MAX_INPUT + 4 {
            return std::ptr::null_mut();
        }
        Box::into_raw(vec![0u8; len].into_boxed_slice()) as *mut u8
    }
    #[no_mangle]
    pub unsafe extern "C" fn core_free(ptr: *mut u8, len: usize) {
        if !ptr.is_null() && len > 0 && len <= MAX_INPUT + 4 {
            drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
        }
    }
    #[no_mangle]
    pub unsafe extern "C" fn core_evaluate(ptr: *const u8, len: usize) -> *mut u8 {
        if ptr.is_null() || len == 0 || len > MAX_INPUT {
            return std::ptr::null_mut();
        }
        let result = evaluate(std::slice::from_raw_parts(ptr, len))
            .to_string()
            .into_bytes();
        if result.len() > MAX_INPUT {
            return std::ptr::null_mut();
        }
        let mut output = Vec::with_capacity(result.len() + 4);
        output.extend_from_slice(&(result.len() as u32).to_le_bytes());
        output.extend_from_slice(&result);
        Box::into_raw(output.into_boxed_slice()) as *mut u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_goldens() {
        let fixtures: Value = serde_json::from_str(include_str!("../../fixtures.json")).unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let result = evaluate(fixture["input"].to_string().as_bytes());
            if fixture["error"].is_string() {
                assert_eq!(
                    result["error"]["code"], fixture["error"],
                    "{}",
                    fixture["name"]
                );
            } else {
                assert_eq!(result["ok"], true, "{}", fixture["name"]);
                for (key, expected) in fixture["expect"].as_object().unwrap() {
                    assert_eq!(
                        &result["result"][key], expected,
                        "{}: {}",
                        fixture["name"], key
                    );
                }
            }
        }
    }
    #[test]
    fn rejects_bytes_and_boundaries() {
        assert_eq!(evaluate(&[255])["error"]["code"], "INVALID_INPUT");
        assert_eq!(
            evaluate(&vec![b' '; MAX_INPUT + 1])["error"]["code"],
            "INPUT_TOO_LARGE"
        );
        assert_eq!(normalize("\u{feff} ＣＡＦE\u{301}\n"), "café");
    }
}
