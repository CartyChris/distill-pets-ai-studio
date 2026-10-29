# Implemented learning-core contract (0.4.0)

The core is now implemented. Read [docs/learning-core.md](../docs/learning-core.md)
for the version 1 operations, bounds, normalization, ABI and worker behavior.
Source: `core/rust/`, `src/learning-core/`. Shared fixtures: `core/fixtures.json`.
The committed WASM is real; `core/wasm-manifest.json` binds it to source hashes.

A future migration must preserve these boundaries:

- Default three-call teaching; optional 1–3 feedback/revision rounds, up to 24
  calls across 1–3 tasks. Reference calls are explicit; chip distillation is a
  separate action. No silent retry/resume, no automatic approval.
- Frozen profiles/models/checks, all returned rounds, latest-answer feedback,
  late-response rejection and partial recovery. No-change/check-based stopping
  is bounded workflow control, not evidence of correctness or neural learning.
- Explicit human approval of complete live training examples. Playground,
  validation and truncated data never become eligible just because checks pass.
- Existing full-role exposure/validation ledger remains authoritative. Core
  similarity is advisory and cannot grant eligibility or erase prior exposure.
- The core is pure analysis: no provider calls, keys, code execution or mutable
  workspace access. Browser workers use an actual compiled WASM engine, with
  bounded JavaScript fallback if unavailable. No second server is needed.
- Test native/WASM/JS parity, malformed inputs, Unicode, memory bounds,
  cancellation, concurrent analyses and fallback before replacing the core.
- Python ZIP auditing verifies checksums and training decisions independently;
  the optional trainer has a no-download dry run and an actual tiny CPU training
  smoke test. It runs separately from the app/serverless request lifecycle.
- Go remains optional. Add it only for a concrete workflow; do not introduce an
  unused duplicate orchestrator or pretend one already exists.

Run `npm run test:core`, `npm run test:core:native`,
`npm run test:browser:core` against the built app, and the training checks
listed in `training/README.md`. Do not claim that the optional LoRA smoke test
proves generalization or compatibility with an arbitrary selected base model.
