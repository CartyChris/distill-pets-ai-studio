# Learning core release verification — 0.4.0

Baseline: `d2a013bef1c077bfd467ff9b2a61c454eb914b0b` (0.3.0 with v0 handoff).
Scope: actual Rust/WASM analysis, bounded recursive teaching, local diagnostics,
curriculum helpers, reviewed training ZIPs and Python audit/LoRA operability.

## Evidence

| Requirement | Fresh verification | Result |
| --- | --- | --- |
| Existing backend and feature contracts | `npm test`, `npm run test:features` | Passed, including existing conversation, chip lab, Wilds, Superpower, Forge, teaching and preference regressions. |
| Frozen recursive teaching | `tests/teaching-recursive.mjs` | 24-call ceiling; latest answer fed into later feedback; frozen models/checks; no-change/check-based stops; no automatic approval; later failure/cancel retention; reload; task suggestions; full conversation import. |
| Real Rust/WASM and JavaScript agreement | `npm run test:core`, Rust native tests | Shared golden fixtures, Unicode, malformed and oversized inputs, bounded JSON, approval/split/earlier-turn overlap; real compiled WASM executed. |
| Rust build quality | `cargo fmt --check`, native and wasm32 `cargo clippy ... -- -D warnings` | Passed. Rust 1.90.0, locked dependencies, valid wasm32 artifact. |
| Reproducible compiled output | Same build from a separate temporary checkout path | Byte-for-byte match; 298,367 bytes, SHA-256 `12d0a78b90919648a19bf8a493a3c38d1883d0417fc6c34afc3928fcaf317217`. |
| Failure isolation | `tests/learning-core-parity.mjs` | Missing worker, timeout, cancellation, late results, concurrent cancellation and repeated ABI allocation/free. |
| Actual browser integration | `tests/learning-core-browser.mjs` against production Node server | Real Rust/WASM under CSP; seven-call fixture run; reviewed ZIP and Python audit; all Wilds dialogue; restore; offline analysis; intentionally corrupt WASM falls back. |
| Original teaching/Playground | `tests/teaching-browser.mjs`, `tests/teaching-playground.mjs` | Steering, response/context preservation, immutable chip approval, validation lab handoff, export and actual prepared backend stages passed. |
| Mobile/desktop behavior | `tests/responsive.mjs` | 306 view/viewport combinations, 320px phones through laptops; touch targets, editable text, previews and long-name/large-text layouts. New-core test also covers 402px width. |
| PWA / production UI | `tests/pwa.mjs`, `tests/fable-production.mjs` | Manifest/icons, install guide, offline saved work, service worker, API-cache exclusion, Mermaid/UI exports and CSP passed. |
| Export integrity | `tests/training-bundle.mjs` | Full roles, file/row hashes, Python audit and dry run, modified archive rejection, approval-bypass mutation rejection and validation overlap rejection. |
| Actual optional weight-training machinery | `training/smoke_test.py` in isolated pinned CPU environment | One optimizer step on a tiny random model created locally; 8 saved adapter tensors, finite weights and changed LoRA B weights; existing output overwrite rejected. |
| Build | `npm run build` | Vite production frontend + portable Node backend passed; actual WASM emitted as a static hashed asset. Existing large lazy Mermaid chunks still produce size advisories. |

## Verification boundaries

Browser profiles emulate screen sizes; physical iOS Safari/Android device testing
was not performed. Provider fixture tests and prepared Playground runs used no
paid hosted inference. No external model weights were downloaded. The local CPU
training smoke test establishes that the optional trainer updates and saves an
adapter; it does not establish useful model quality or compatibility with every
user-selected model/hardware platform. GPU training was not tested.

The core is deterministic analysis, not local neural inference. JSON/phrase/length
checks and lexical similarity are advisory; human review, full role context and
the existing persistent exposure ledger remain the authority for app exports.
The Python auditor checks integrity and recorded decisions, not reviewer identity,
facts, rights or semantic paraphrase leakage. Export hashes are not signatures.

The app remains a Vite PWA with a portable Node backend. Full React/Next migration
and Vercel serverless route adaptation remain in the updated Astra handoff.

## Implementation references

- Rust WebAssembly target: https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html
- Hugging Face TRL SFTTrainer v0.23.1 implementation, including conversational
  prompt/completion masking: https://github.com/huggingface/trl/blob/v0.23.1/trl/trainer/sft_trainer.py
- PEFT LoRA: https://huggingface.co/docs/peft/developer_guides/lora
- Pinned Python dependency versions were checked against their published PyPI
  metadata and installed in an isolated environment for the local CPU smoke test.

Source/artifact identity and licensing are recorded in `core/wasm-manifest.json`,
`core/rust/Cargo.lock` and `core/THIRD_PARTY_NOTICES.txt`. No model weights or API
keys are included in the source distribution.
