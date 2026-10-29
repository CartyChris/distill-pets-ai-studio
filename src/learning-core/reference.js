// Version 1 deterministic analysis. Findings are review aids, never approval or truth scores.
export const CORE_VERSION = 1;
export const MAX_INPUT_BYTES = 1024 * 1024;
const utf8 = value => new TextEncoder().encode(value).length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fail(message) { throw Error(message); }
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(label);
  return value;
}
function string(value, max, label) {
  if (typeof value !== 'string' || utf8(value) > max) fail(label);
  return value;
}
function strings(value, count, size, label) {
  if (!Array.isArray(value) || value.length > count) fail(label);
  return value.map(item => string(item, size, label));
}
export const normalizeCoreText = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
function plan(input) {
  const tasks = integer(input.tasks, 1, 3, 'tasks must be an integer from 1 to 3');
  const rounds = integer(input.rounds, 1, 3, 'rounds must be an integer from 1 to 3');
  const maxTokens = integer(input.maxTokens, 1, 8000, 'maxTokens must be an integer from 1 to 8000');
  if (typeof input.reference !== 'boolean') fail('reference must be boolean');
  const teacherCalls = tasks * (rounds + Number(input.reference));
  const studentCalls = tasks * (1 + rounds);
  return { plannedCalls: teacherCalls + studentCalls, teacherCalls, studentCalls, maxOutputTokens: (teacherCalls + studentCalls) * maxTokens };
}
function diagnose(input) {
  const value = string(input.text, 120000, 'text exceeds 120000 UTF-8 bytes or is not text');
  const c = input.checks;
  if (!object(c)) fail('checks must be an object');
  const field = (name, fallback) => Object.hasOwn(c,name) ? c[name] : fallback;
  const format = field('format','text');
  if (!['text', 'json'].includes(format)) fail('format must be text or json');
  const required = strings(field('required',[]), 12, 200, 'invalid required terms');
  const forbidden = strings(field('forbidden',[]), 12, 200, 'invalid forbidden terms');
  const jsonKeys = strings(field('jsonKeys',[]), 12, 200, 'invalid JSON keys');
  if ([...required, ...forbidden, ...jsonKeys].some(item => !item.trim())) fail('checks cannot contain empty terms');
  const min = integer(field('minChars',0), 0, 120000, 'invalid minimum characters');
  const max = integer(field('maxChars',0), 0, 120000, 'invalid maximum characters');
  if (max && max < min) fail('maximum characters must be at least minimum characters');
  const characters = [...value].length, normalized = normalizeCoreText(value), checks = [], findings = [];
  const check = (code, passed, detail) => checks.push({ code, passed, detail });
  if (min) check('min_chars', characters >= min, String(min));
  if (max) check('max_chars', characters <= max, String(max));
  for (const term of required) check('required', normalized.includes(normalizeCoreText(term)), term);
  for (const term of forbidden) check('forbidden', !normalized.includes(normalizeCoreText(term)), term);
  if (format === 'json' || jsonKeys.length) {
    let parsed, valid = true;
    try {
      parsed = JSON.parse(value);
      const pending = [[parsed,0]];
      while(pending.length) {
        const [item,depth] = pending.pop();
        if(depth>64 || typeof item==='number'&&!Number.isFinite(item)) {valid=false;break;}
        if(item && typeof item==='object') for(const child of Object.values(item)) pending.push([child,depth+1]);
      }
    } catch { valid = false; }
    check('json', valid, 'Valid JSON');
    if (valid) for (const k of jsonKeys) check('json_key', object(parsed) && Object.hasOwn(parsed, k), k);
  }
  if (!normalized) findings.push({ code:'empty', count:1 });
  if (characters > 0 && characters < 24) findings.push({ code:'short', count:characters });
  const placeholders = ['[insert', '[todo', 'todo:', 'lorem ipsum'].filter(marker => normalized.includes(marker)).length;
  if (placeholders) findings.push({ code:'placeholder', count:placeholders });
  const lines = value.split('\n').map(normalizeCoreText).filter(line => [...line].length >= 20);
  const repeated = lines.length - new Set(lines).size;
  if (repeated) findings.push({ code:'repeated_lines', count:repeated });
  return { characters, utf8Bytes:utf8(value), estimatedTokens:Math.ceil(characters / 4), checkCount:checks.length, failedChecks:checks.filter(c => !c.passed).length, checks, findings };
}
function audit(input) {
  if (!Array.isArray(input.rows) || input.rows.length > 60) fail('rows must contain at most 60 examples');
  const validation = strings(input.validation, 12, 32000, 'invalid validation prompts').map(normalizeCoreText);
  const exposures = strings(input.exposures, 500, 32000, 'invalid exposure prompts').map(normalizeCoreText);
  const ids = new Set();
  const rows = input.rows.map(row => {
    if (!object(row)) fail('each row must be an object');
    string(row.id, 80, 'invalid row id');
    if (!row.id || ids.has(row.id)) fail('row ids must be unique and nonempty');
    ids.add(row.id);
    const prompts = strings(row.prompts, 12, 32000, 'invalid row prompts').map(normalizeCoreText);
    const completion = string(row.completion, 48000, 'invalid completion');
    if (['approved','demo','truncated'].some(k => typeof row[k] !== 'boolean') || !['train','validation'].includes(row.split)) fail('invalid row eligibility metadata');
    return { ...row, prompts, completion };
  });
  const overlaps = [], duplicates = [], nearDuplicates = [], eligibleIds = [], excluded = [], seen = new Map();
  for (const [validationIndex, prompt] of validation.entries()) {
    if (!prompt) continue;
    if (exposures.includes(prompt)) overlaps.push({ validationIndex, rowId:'history' });
    for (const row of rows) if (row.split === 'train' && row.prompts.includes(prompt)) overlaps.push({ validationIndex, rowId:row.id });
  }
  const tokens = rows.map(row => new Set((row.prompts[0] || '').split(' ').filter(Boolean)));
  for (const [n, row] of rows.entries()) {
    const reasons = [], prompt = row.prompts[0] || '';
    if (!row.approved) reasons.push('unreviewed');
    if (row.demo) reasons.push('playground');
    if (row.split !== 'train') reasons.push('validation');
    if (row.truncated) reasons.push('truncated');
    if (!prompt || !row.completion.trim()) reasons.push('empty');
    if (overlaps.some(o => o.rowId === row.id)) reasons.push('validation_overlap');
    if (prompt && seen.has(prompt)) { reasons.push('duplicate'); duplicates.push({ first:seen.get(prompt), second:row.id }); }
    // Only otherwise eligible examples occupy a training prompt; an unreviewed import cannot hide a reviewed answer.
    if (!reasons.length) { eligibleIds.push(row.id); seen.set(prompt, row.id); }
    else excluded.push({ id:row.id, reasons });
    for (let j = 0; j < n && nearDuplicates.length < 100; j++) {
      if (prompt === rows[j].prompts[0] || tokens[n].size < 5 || tokens[j].size < 5) continue;
      const intersection = [...tokens[n]].filter(token => tokens[j].has(token)).length;
      const union = tokens[n].size + tokens[j].size - intersection;
      if (intersection * 100 >= union * 80) nearDuplicates.push({ first:rows[j].id, second:row.id, similarityPercent:Math.floor(100 * intersection / union) });
    }
  }
  return { total:rows.length, eligibleIds, excluded, overlaps, duplicates, nearDuplicates };
}
export function evaluateCore(input) {
  try {
    if (!object(input)) fail('request must be an object');
    if (utf8(JSON.stringify(input)) > MAX_INPUT_BYTES) return { version:1, ok:false, error:{code:'INPUT_TOO_LARGE',message:'Input exceeds 1 MiB'} };
    if (input.version !== 1) return { version:1, ok:false, error:{code:'UNSUPPORTED_VERSION',message:'Expected version 1'} };
    const operation = { plan_session:plan, diagnose_output:diagnose, audit_examples:audit }[input.operation];
    if (typeof operation !== 'function' || !Object.hasOwn({plan_session:1,diagnose_output:1,audit_examples:1}, input.operation)) return { version:1, ok:false, error:{code:'UNKNOWN_OPERATION',message:'Unknown core operation'} };
    return { version:1, ok:true, result:operation(input) };
  } catch (error) { return { version:1, ok:false, error:{code:'INVALID_INPUT',message:String(error.message || 'Invalid input')} }; }
}
