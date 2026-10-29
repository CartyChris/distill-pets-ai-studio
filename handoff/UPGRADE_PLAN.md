# Further upgrade plan for Astra

Status: 0.4.0 already implements the Rust/WASM worker, JS fallback, recursive
teaching, diagnostics, curriculum starters, reviewed ZIPs and Python audit/LoRA
tools. Preserve them and extend from docs/learning-core.md. React/mobile framework
migration and Vercel hosting are still future work. The items below are a roadmap,
not a claim that every proposed component has been built.

## 1. Establish the integration baseline

Inventory the target v0 project and this source. Record a feature-to-test matrix,
framework/lockfile versions, storage schemas, API contracts and deployment target.
Keep a recoverable baseline and use an isolated branch. Reconcile differences
with the existing v0 app before moving code. Do not overwrite auth, routes or
theme providers already serving useful functions.

Acceptance: original data opens; original feature inventory is complete; one
bounded Playground task works in the target framework without fake responses
outside the labeled Playground contract.

## 2. Introduce a persistent React shell and state boundaries

Prefer the target’s React/Next.js stack. Keep expensive Canvas/editor modules
behind adapters initially, then migrate views in small working slices. A full
rewrite of all logic at once is unnecessary and risks lost behavior.

- Separate pure domain state, provider transport, job control and rendering.
- Keep operation IDs, frozen run snapshots and stale-result rejection outside
  individual screen component lifetimes. Navigation must not start another call.
- Use a typed route/view catalog; preserve every original view through primary
  tabs, More/search, desktop navigation and contextual links.
- Preserve unsent drafts, selected chip/task, reading position and per-view scroll.
- Use semantic component tokens tied to the existing appearance schema.
- Keep heavy diagrams, editors and world code in demand-loaded chunks; avoid
  remounting the world canvas during every streamed token or status update.

Acceptance: navigate during generation and return without lost output, duplicated
requests or frozen controls; browser Back works; keyboard focus stays coherent.

## 3. Build the app-like mobile experience

Layout archetype: layered workspace with a persistent mobile dock and contextual
inspector sheets; retain a comfortable desktop rail/canvas arrangement. Palette
roles should map to the original --bg/--paper/--ink/--muted/--line and semantic
accent/success/error values. Keep every theme/custom color usable.

Use system/rounded typography with a clear type scale, generous main content and
quiet utility labels. Geometry should be consistent and honor user radius/density
settings. Use springs or short easing for deliberate transitions; reduced-motion
mode should replace travel/bounce effects with immediate changes or simple fades.

Add comfortable navigation, searchable view switching, contextual toolbars,
readable run status, keyboard-aware composers, accessible bottom sheets and
visible saved/offline/update states. Keep large touch targets, safe-area offsets,
contrast and long-text wrapping. Use CSS dvh with suitable fallback, not a fixed
phone screenshot height. Test text scaling, landscape and an open keyboard.

Retain pixel aspect ratios and existing outfit IDs. Let pets react to observable
workflow events; do not make a timer pretend that a model finished learning.

Acceptance: 320px through tablet/laptop works without accidental page overflow;
navigation/composer are reachable above safe areas, hosting UI and keyboard;
screen-reader users can open/close sheets and regain focus.

## 4. Strengthen teacher/student guidance and curation

Keep the current workflow and explicit budgets. Improve the way users specify a
skill, audience, rubric, constraints and examples. Offer small useful curriculum
starters and identify missing checks before a run. Preserve original attempts,
teacher feedback, revised answers, model IDs, profile settings, applied steering
and human decisions in each report.

Provide advisory diagnostics with understandable evidence: empty/very short
answers, repeated passages, malformed structured output, missing requested fields,
obvious placeholders, near-duplicate examples and context-budget pressure.
Do not equate an advisory score with correctness or learning.

Use deterministic split and exposure policies, retain all role context, track
evaluation use as development, and keep JSONL/provenance portable. Maintain
atomic imports, review gates and exclusion of samples/partial data. Preserve
immutable chip lineage and do not silently equip a draft.

Acceptance: fresh validation never enters teacher practice, even through earlier
chat turns or inherited chips; canceled work never submits a next stage; failed
feedback keeps the useful first attempt. See CORE_CONTRACT.md.

## 5. Add measured portable cores

Start with one pure reference contract in TypeScript and shared golden fixtures.
Extend the existing Rust/WASM and JavaScript contract with shared fixtures.
Python has a separate verified dataset/training contract. Add Go only when useful.

- Rust: pure bounded planner/diagnostics library; native tests; actual WASM
  compilation; browser smoke test; worker adapter; memory/input bounds.
- Browser: lazy worker initialization, capability probe, JS fallback and explicit
  engine status in technical settings. Ordinary use must not require WASM.
- Python: improve the current exported runner and add offline data audit/curation
  helpers. Keep standard-library portability where practical, UTF-8 correctness,
  dry runs, cancellation and partial report recovery. Never embed keys in exports.
- Go: coherent module, small pure packages, thin CLI, useful zero values or clear
  constructors, bounded stdin/files, context-aware work, stable JSON errors and
  signal handling. Tests and cross-language fixtures before runtime integration.
- Avoid long-lived child processes or Python/Go daemons in serverless requests.
  Use supported runtimes or explicit separate services only when required.

Acceptance: equivalent supported inputs produce equivalent decisions; malformed,
oversized and boundary inputs fail usefully; WASM failure preserves the app; no
unused engines or platform-specific binaries masquerade as a portable solution.

## 6. Complete full-stack hosting and verify the release

Follow VERCEL_DEPLOYMENT.md, preserve stable backend contracts and finish the
PWA update path. Run existing regressions, new migration/browser/core tests,
production build, hosted Playground tests and a controlled real-provider smoke
test only when a key and authorized credits are available. Label fixtures and
emulation accurately. Deliver the complete source/build artifacts and a real
production URL with verified backend behavior.

Do not stop after new styles, generated screens, a preview URL, or an API-free
static upload. If a real access blocker remains, finish everything independent
of it and state the exact remaining action.
