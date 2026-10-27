# Proposed learning-core contract and cross-language checks

This is a design specification for Astra, not an existing API or implementation.
Keep the browser app and its JavaScript fallback fully functional while adding it.

## Contract boundaries

Define a versioned UTF-8 JSON input/output contract. Separate operations with
explicit names such as plan_session, audit_examples, compare_exposure and
diagnose_output. Use structured result/error objects; preserve stable error
codes, units, input limits and schema versions across languages.

The core is pure deterministic analysis. It has no API keys, provider transport,
file execution, network requests, hidden model reasoning or approval authority.
Human review and the app’s job controller remain authoritative. A core failure
must not convert a rejected row into an eligible one or bypass a review gate.

## Initial exact rules

- A session accepts 1–3 selected practice tasks. Each uses 3 calls; a teacher
  reference adds 1 per task. Valid examples: (1,false)→3, (1,true)→4,
  (3,false)→9, (3,true)→12. Zero, four, fractional or malformed counts fail.
  A chip distillation call is a separate explicit action, not hidden in that sum.
- Training eligibility requires an approved, complete, nontruncated live train
  example with valid nonempty task/answer/context. Samples, validation rows and
  imported approval flags never grant eligibility automatically.
- Preference eligibility additionally requires an explicit non-tie human choice,
  two distinct complete outputs, a compatible frozen setup and provenance.
  Preserve the original generation-context caveat and one-archive delivery.
- Exposure checks cover all user turns, role-tagged chip examples, inherited
  profiles, applied steering, deletion/reload history and evaluation reused for
  optimization. Reserve validation before teaching. At ledger capacity, surface
  the limit rather than silently forgetting exposures.
- Normalization must have explicit semantics. Current JavaScript uses Unicode
  NFKC, case/whitespace treatment and known wrapper extraction. Match it on
  supported inputs, including non-ASCII cases, or version/migrate deliberately.
  Do not quietly replace it with ASCII lowercase. Exact normalized overlap
  checks are not a semantic guarantee against paraphrase leakage.
- Avoid silent numeric wrapping, NaN acceptance, oversized allocation and
  unbounded nested traversal. Specify bytes versus characters, size budgets,
  truncation flags and recovery before implementation.

## Advisory diagnostics

Examples: character/token estimates with a stated estimator, excessive repeated
phrases, placeholder markers, missing schema fields, citation syntax counts,
coverage gaps and near-duplicate candidates. Each finding needs a reason and
evidence span/count when possible. These are review hints, not calibrated truth
probabilities, correctness scores or evidence of neural learning.

## Shared fixture families

Use the same fixtures in JS/TS, Rust native/WASM, Python and Go:

1. Ordinary and boundary call plans, invalid numeric types and maximum budgets.
2. Every ineligible training/preference reason independently, plus eligible rows.
3. Nested conversation heldout leakage and role-tagged inherited chip examples.
4. Full-width letters, combining marks, emoji, mixed scripts and whitespace.
5. Empty/oversized/malformed JSON, long context and incomplete UTF-8 boundaries.
6. Deterministic reports under a fixed seed and stable ordering.
7. Cancellation during optional analysis, worker startup failure and fallback.
8. Native/WASM integer and encoding parity; deliberately broken approval or split
   predicates must fail meaningful regression/mutation checks.

Only benchmark real compiled artifacts on representative bounded inputs. Record
versions, fixture hashes, commands and results. If no Rust/Go toolchain is available,
finish the supported path, label that core unbuilt, and provide a reproducible
build instruction; never ship an empty file as a working WASM engine.
