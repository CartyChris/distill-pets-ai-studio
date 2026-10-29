# Learning core, recursive teaching and training portability (0.4)

The new learning core performs deterministic local analysis. It does not run a
neural model, call a provider, certify answers, approve rows or update hosted
weights. Teacher/student model calls and human reviews remain in the app.

## Real Rust in the browser

`core/rust` builds a native JSON CLI and the committed
`src/learning-core/distill_pets_core.wasm` artifact. The browser loads it lazily
inside a Web Worker. No Rust installation is required to run the app. If WASM
fails, the worker uses JavaScript; if workers fail, bounded JavaScript analysis
remains available. The workshop shows the engine actually used. Local analysis
works offline after the worker/assets have been cached.

The artifact manifest binds the WASM hash to its source files. The build uses
Rust/Cargo 1.90.0, a locked dependency graph, path remapping and a 64 MiB maximum
WASM memory. The ABI uses allocated UTF-8 input/output buffers; the JavaScript
adapter frees both after every synchronous call. Requests are capped at 1 MiB,
worker concurrency at four requests and worker startup/analysis at bounded
timeouts. Cancellation terminates the worker and drops late results. These
operations never retry a model call.

```sh
rustup toolchain install 1.90.0 --profile minimal --target wasm32-unknown-unknown
rustup default 1.90.0
npm run core:build
npm run test:core:native
npm run test:core
echo '{"version":1,"operation":"plan_session","tasks":2,"rounds":2,"reference":false,"maxTokens":2048}' \
  | cargo run --quiet --locked --manifest-path core/rust/Cargo.toml
```

## Version 1 contract

Every request is `{version:1, operation:..., ...}`. The reply is
`{version:1, ok:true, result:...}` or a structured error. Error codes are
`INVALID_INPUT`, `INPUT_TOO_LARGE`, `UNSUPPORTED_VERSION`, `UNKNOWN_OPERATION`.
The worker client converts unsuccessful replies into visible errors. No secrets,
source execution, transport or approval authority enter this contract.

| Operation | Input | Result and limits |
| --- | --- | --- |
| `plan_session` | `tasks` 1–3, `rounds` 1–3, boolean `reference`, `maxTokens` 1–8000 | `tasks × (1 + 2×rounds + reference)` calls, teacher/student totals and requested output-token ceiling. At most 24 calls. A chip draft remains a separate explicit call. |
| `diagnose_output` | `text`, `checks` object | Code-point count, UTF-8 bytes, rough tokens (ceil(characters/4)), check outcomes, short/empty/placeholder/repeated-line hints. Text ≤120,000 UTF-8 bytes. |
| `audit_examples` | ≤60 rows, ≤12 validation prompts, ≤500 exposure prompts | Eligible IDs, explicit exclusion reasons, exact overlap, duplicate and near-duplicate pairs. This is advisory; existing review and exposure gates remain authoritative. |

Checks: `format: "text" | "json"`, `required`, `forbidden`, `jsonKeys` (up to
12 terms each, 200 UTF-8 bytes per term), `minChars`, `maxChars` (0 = off).
JSON checks accept finite JSON values up to 64 nesting levels. Key checks inspect
the top-level object. Phrase checks are literal normalized substring checks,
not semantic similarity. Required phrases can be present in a wrong answer.

Audit rows explicitly carry `id`, `prompts` (original task and all earlier user
turns), `completion`, strict boolean `approved/demo/truncated`, and `split`.
Prompt strings are bounded to 32,000 UTF-8 bytes, completions to 48,000 bytes.
Normalization is NFKC, ECMAScript whitespace collapse and Unicode lowercase.
Wrapper extraction stays in the app before core calls. The hashed development
ledger remains in the app and still blocks stale validation after row deletion;
it cannot be reverse-translated into plaintext exposure prompts for the core.

Similarity uses set overlap of whitespace-separated normalized tokens, at least
five distinct tokens and 80% Jaccard overlap; at most 100 pairs are returned.
It is an advisory lexical signal, not an embedding or guarantee against leaks.
An unreviewed/sample row never hides an otherwise eligible reviewed row.

## Teacher/student behavior

The default remains one attempt, one feedback call and one revision. Users can
choose up to three feedback/revision rounds. Each teacher call receives the
latest actual answer and its deterministic check outcomes; the next student call
receives that feedback. Configuration, checks, profiles and models are frozen.
All rounds remain in reports and Wilds dialogue, including partial failed runs.

Optional early stopping skips later rounds when the answer stops changing, or
when explicitly configured checks pass after at least one revision. Neither
condition grants approval. The final revision enters the basket unreviewed.
No operation silently resumes after reload. Stop retains completed stages and
prevents further submissions. Already submitted requests may still be billed.

Three curriculum starters add tasks without replacing saved work. Task selection
prioritizes interrupted work, failed configured checks and untried tasks; it
does not start generation or infer factual correctness. Reserved tasks are
never selected for practice.

## Portable training

The reviewed ZIP contains `train.jsonl`, `validation.jsonl`, `provenance.json`,
`manifest.json` and a guide. Only reviewed complete live rows enter training.
Full supervised conversation roles, original prompts, model IDs and source IDs
remain attached. File and row SHA-256 digests bind the report to the data.

See [training/README.md](../training/README.md) for the standard-library Python
audit, no-download dry run and optional SFT/LoRA trainer. The real training path
was checked with one CPU optimizer step on a tiny random model built locally,
including nonzero adapter updates and overwrite rejection. That check does not
establish quality, generalization, performance, or compatibility with every model.

These additions retain the current Vite frontend and portable Node backend.
React/Next migration and full Vercel deployment remain separate future work.
