#!/usr/bin/env python3
"""Offline, bounded audit of Distill Pets training ZIPs. Python standard library only."""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

MAX_BYTES = 8 * 1024 * 1024
JS_SPACE = re.compile(r"[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+")
REQUIRED = {"manifest.json", "train.jsonl", "validation.jsonl", "provenance.json", "README.md"}


class AuditError(ValueError):
    pass


def normalize(text):
    source = unicodedata.normalize("NFKC", text)
    wrapped = re.match(r"^Teaching goal:[\s\S]*?\nSuccess checks:[\s\S]*?\n\nTask:\n([\s\S]*)$", source.strip())
    if wrapped:
        source = re.split(r"\n\nUser steering supplied to the (?:teacher|student):\n", wrapped[1])[0]
    return JS_SPACE.sub(" ", source).strip(" ").lower()


def user_prompts(messages):
    # Match role-tagged chip context as well as every ordinary conversation user turn.
    result = []
    for message in messages:
        if message.get("role") != "user":
            continue
        content = message["content"]
        prefix = "Supervised context (role-tagged data):\n"
        if content.startswith(prefix):
            try:
                embedded = json.loads(content[len(prefix):])
            except (ValueError, RecursionError) as exc:
                raise AuditError("Malformed role-tagged supervised context") from exc
            if not isinstance(embedded, list) or len(embedded) > 12 or any(not isinstance(m, dict) or not isinstance(m.get("content"), str) for m in embedded):
                raise AuditError("Invalid role-tagged supervised context")
            result.extend(m["content"] for m in embedded if m.get("role") == "user")
        else:
            result.append(content)
    return result


def load_json(raw, label):
    try:
        return json.loads(raw.decode("utf-8"), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite number")))
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise AuditError(f"{label}: invalid UTF-8 JSON") from exc


def read_rows(raw, label, maximum):
    lines = raw.splitlines()
    if len(lines) > maximum:
        raise AuditError(f"{label}: too many rows")
    return [load_json(line, f"{label} line {i+1}") for i, line in enumerate(lines) if line.strip()]


def audit_bundle(path):
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise AuditError("ZIP exceeds 8 MiB")
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) != len(REQUIRED) or {e.filename for e in entries} != REQUIRED:
                raise AuditError("ZIP must contain exactly the five bundle files, without duplicates")
            if any(e.file_size > MAX_BYTES or e.flag_bits & 1 for e in entries) or sum(e.file_size for e in entries) > MAX_BYTES:
                raise AuditError("ZIP contents exceed 8 MiB or are encrypted")
            data = {e.filename: archive.read(e) for e in entries}
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise AuditError("Invalid or unsupported ZIP archive") from exc
    manifest = load_json(data["manifest.json"], "manifest")
    if not isinstance(manifest, dict) or manifest.get("format") != "distill-pets-training-bundle-v1":
        raise AuditError("Unsupported bundle version")
    checksums = manifest.get("files")
    if not isinstance(checksums, dict) or set(checksums) != REQUIRED - {"manifest.json"}:
        raise AuditError("Manifest file inventory is incomplete")
    for name, meta in checksums.items():
        if not isinstance(meta, dict) or meta.get("bytes") != len(data[name]) or meta.get("sha256") != hashlib.sha256(data[name]).hexdigest():
            raise AuditError(f"Checksum or byte count mismatch: {name}")
    train = read_rows(data["train.jsonl"], "training", 60)
    validation = read_rows(data["validation.jsonl"], "validation", 12)
    provenance = load_json(data["provenance.json"], "provenance")
    if not train or not isinstance(provenance, dict) or provenance.get("format") != "distill-pets-provenance-v1" or not isinstance(provenance.get("rows"), list) or len(provenance["rows"]) != len(train):
        raise AuditError("Training data requires matching review provenance")
    if manifest.get("trainingRows") != len(train) or manifest.get("validationRows") != len(validation):
        raise AuditError("Manifest row count mismatch")
    validation_keys = set()
    for row in validation:
        if not isinstance(row, dict) or row.get("split") != "validation" or not isinstance(row.get("prompt"), str) or not row["prompt"].strip():
            raise AuditError("Invalid validation prompt")
        validation_keys.add(normalize(row["prompt"]))
    prompts, seen, warnings = set(), set(), []
    # Hash the exact JS-produced line, not Python's different whitespace/escaping serialization.
    lines = [line for line in data["train.jsonl"].splitlines() if line.strip()]
    for index, (row, source) in enumerate(zip(train, provenance["rows"])):
        if not isinstance(row, dict) or not isinstance(source, dict):
            raise AuditError(f"Example {index+1}: expected objects")
        if source.get("index") != index or source.get("approved") is not True or source.get("demo") is not False or source.get("truncated") is not False or source.get("split") != "train":
            raise AuditError(f"Example {index+1}: not approved, complete live training data")
        if source.get("recordSha256") != hashlib.sha256(lines[index]).hexdigest():
            raise AuditError(f"Example {index+1}: provenance does not match the record")
        messages = row.get("messages")
        if not isinstance(messages, list) or not 2 <= len(messages) <= 13:
            raise AuditError(f"Example {index+1}: expected 2–13 conversation messages")
        for message in messages:
            if not isinstance(message, dict) or message.get("role") not in ("system", "user", "assistant") or not isinstance(message.get("content"), str) or not message["content"].strip():
                raise AuditError(f"Example {index+1}: invalid message")
        if messages[-1]["role"] != "assistant" or not any(m["role"] == "user" for m in messages[:-1]):
            raise AuditError(f"Example {index+1}: missing supervised task/answer")
        if sum(len(m["content"].encode("utf-8")) for m in messages[:-1]) > 96000 or len(messages[-1]["content"].encode("utf-8")) > 48000:
            raise AuditError(f"Example {index+1}: context exceeds the supported limits")
        user_keys = {normalize(p) for p in user_prompts(messages[:-1])}
        source_prompts = source.get("prompts")
        if not isinstance(source_prompts, list) or not source_prompts or any(not isinstance(p, str) for p in source_prompts):
            raise AuditError(f"Example {index+1}: missing original prompt provenance")
        user_keys.update(normalize(p) for p in source_prompts)
        if user_keys & validation_keys:
            raise AuditError(f"Example {index+1}: training/validation overlap")
        # The original task identifies the row; a final user turn may be shared steering.
        final_user = normalize(source_prompts[0])
        if final_user in seen:
            raise AuditError(f"Example {index+1}: duplicate supervised prompt")
        seen.add(final_user)
        prompts.update(user_keys)
        if source.get("origin") == "imported":
            warnings.append(f"Example {index+1}: imported provenance is user-supplied")
    if len(train) < 10:
        warnings.append("Small dataset: useful for a smoke test, insufficient evidence of generalization")
    if not validation:
        warnings.append("No reserved validation prompts; add a fresh evaluation set before claiming improvement")
    return {"ok": True, "format": manifest["format"], "trainingRows": len(train), "validationRows": len(validation), "distinctUserPrompts": len(prompts), "bundleSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "warnings": warnings}, train


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    args = parser.parse_args()
    try:
        report, _ = audit_bundle(args.bundle)
        print(json.dumps(report, indent=2, ensure_ascii=False))
    except (AuditError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
