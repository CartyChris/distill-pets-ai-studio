# Paste this into Astra inside my existing Vercel v0 project

You are upgrading **Distill Pets AI Studio** using the complete 0.5.0
source and handoff in this imported repository. Work inside my existing v0 project, use its available
Astra/vmax configuration, and carry the work through implementation, verification,
and full-stack production deployment to my connected Vercel project. Do not stop
at a mockup, static frontend, or plan. These are instructions for the next migration;
the repository already contains the working 0.5.0 app.

First read START_HERE.md and all handoff documents. Inspect the existing v0
project’s framework, routes, auth, storage, dependencies and design conventions.
Use that project as the integration target; preserve its useful functionality,
branding, configuration and data. Prefer its supported React/Next.js App Router
stack with TypeScript and accessible composable UI. If no framework is established,
use a current supported React/Next.js version and pin dependencies. Do not invent
vmax APIs, installed plugins, credentials, engine binaries or deployment status.

## Product and feel

Make this feel like a polished, touch-first app saved to the iPhone Home Screen,
while also working on Android and laptops. Keep the cute pet-school identity,
soft customizable palette, Milo/Nova personalities and large explorable Wilds.
Use a refined contemporary design with deliberate hierarchy and restrained motion.
Treat theme variables, spacing, geometry, typography and motion as a coherent
design system, not scattered hard-coded decoration.

Preserve the Wilds Play panel, six coordinated pet activities, four trails,
arrival-only stamps, bounded field journal and landscape/square/portrait PNG
postcards. Keep scenic play independent from real AI output and evaluation.
Keep sprite proportions during animation and reduced-motion alternatives.
Read docs/wilds-play.md and run tests/world-play-browser.mjs after integrating.

Build a persistent React application shell: a compact mobile top bar, a small
set of primary bottom tabs, a searchable More/command surface exposing every
feature, desktop navigation, meaningful back/history behavior, run status, and
draft/scroll retention. Organize views into clear workspaces without deleting
any original view. Use accessible sheets/dialogs, focus restoration, grouped
settings, contextual actions, empty/error/retry/offline states, and progressive
disclosure. Keep generation and teaching controls easy to understand.

Make composer controls usable above the software keyboard. Respect safe areas,
standalone mode, orientation and visual viewport changes. Use at least 44px
touch targets and 16px editable text on mobile. Keep pinch zoom available. Avoid
fixed-height layouts that clip content, tiny desktop controls on phones, and
unnecessary full-page rerenders. Preserve reading position during streaming;
offer explicit follow-latest behavior rather than dragging readers downward.
Honor reduced motion. Haptics are optional feature-detected enhancements, never
the only feedback. Do not claim browser features work where unsupported.

Preserve the pixel pets’ native 36×48 proportions, pixelated rendering and
outfits. Use containment or intentional head crops for compact icons. Expand
expressive poses, blinking, curiosity, celebration and teacher/student interaction
without stretching the sprites. Keep animation separate from proof of AI work.

## Preserve all current functionality

Inventory every original view and action before migrating: Workspace,
Conversations, Distillation Trail, Teaching workshop, Superpowers, Forge studio,
Wilds, Open World, Code studio, Live room, Research, Model chips, Chip lab,
Compare, Pets, Customize and Settings. Preserve file editing/previews, downloads,
search, history, research sources, Mermaid rendering, safe generative UI,
accessories, themes, imports/exports and recovery paths. Migrate view by view
behind stable adapters; do not substitute decorative buttons or fake data for
existing working behavior.

Keep the full-screen open world, biomes, seeded assets, atlas, NPCs, walking
teacher/student, public response panels and steering. Make its controls comfortable
on phones and its rendering responsive to device performance and visibility.
Pause/reduce scenic work when hidden; never silently restart a paid model run.

## Improve the actual teaching pipeline

Preserve the bounded student attempt → targeted teacher feedback → student
revision sequence, with optional teacher reference, frozen configuration and
the current default three-call flow and configurable 3–24-call session ceiling. Planned calls must be visible before launch.
Preserve each returned artifact and exact useful context. Student questions,
practice, critique/revision, human reviews and chip revisions should form a
clear, inspectable workflow with bounded user-controlled continuation.

Retain explicit human approval, unreviewed chip drafts, immutable parents,
detachable model chips and separate equipment actions. Keep teacher/student
model choice distinct from pet appearance. Support OpenRouter text models by
catalog and manual model ID; show model capability/provider errors honestly.

Strengthen heuristics and guiding functions: task/rubric planning, context-budget
planning, Unicode-aware duplicate and exposure checks, coverage across example
types, provenance, explicit excerpt/truncation flags, actionable quality hints,
and human-readable reasons for acceptance/rejection. Keep practice/development
and reserved validation separate across all user turns, inherited examples,
deleted basket rows, exports and reloads. Do not relabel consumed evaluation
data as fresh validation. Preserve Playground/live boundaries and review gates.

Use seed-stable split assignments before quality filtering. Teacher scores and
heuristic warnings are advisory, not evidence of model improvement. Measure
transfer on fresh tasks with frozen comparisons and explicit human decisions.
Preference exports must retain the current generation-context caveat and ship
their provenance with the data. No ties, samples, partial output or automatically
approved imports may enter training exports.

Do not expose or fabricate private chain of thought, logits, gradients, weight
updates or executed external actions. Distill reusable instructions/examples
into chips here. Offer explicit export to a separate compatible trainer for
real weight training; do not invent a universal OpenRouter training endpoint.

## Rust/WASM, Python and Go

Version 0.4 already includes a compiled Rust/WASM core, a worker with JavaScript
fallback, shared fixtures, multi-round teaching, reviewed ZIP exports, a Python
audit and an optional LoRA trainer. Read docs/learning-core.md and training/README.md
and preserve these working paths. Go is still optional future work. Extend the
existing contract only when there is a concrete benefit:

- Extend the existing versioned JSON contract and shared fixtures before adding
  operations or languages; do not discard tested core behavior.
- Preserve and extend the pure Rust analysis core and real compiled browser WASM
  artifact. Planning, eligibility diagnostics and output checks already work.
  Keep Unicode/task semantics
  consistent with the existing implementation or explicitly version changes.
- Preserve heavier analysis in the existing Web Worker with its JavaScript fallback.
  WASM failure must not prevent chat, review, exports or teaching. Keep secrets,
  network calls and authoritative human approval outside the core.
- Improve the existing Python runner/export path and add tested offline dataset
  audit/curation tools with dry runs, bounded inputs, deterministic reports,
  cancellation and preserved partial results. Never execute imported reference
  text or arbitrary model-produced code in the app/server.
- Add a small Go module/CLI for portable dataset validation and planning if it
  shares that contract and provides a real workflow benefit. Keep its domain
  logic independent of HTTP/process startup. Bound reads, propagate context
  cancellation, produce useful errors and structured reports, and test with the
  race detector where supported. Avoid a duplicate unused orchestration server.
- Cross-check Rust native/WASM and JavaScript using the shared fixtures. Keep
  Python bundle/trainer integration tests; add parity tests for any new Go work.
  Include build scripts, actual WASM output, licenses and reproducible instructions.
  A README mentioning an engine is not an implementation. Never label these
  deterministic heuristics a trained local neural network.

Use the existing safe portable runners and tests as compatibility references.
Do not impose Docker, a GPU or a second server for ordinary browser/Playground use.
Do not assume persistent Python/Go processes can run inside Vercel Functions.

## PWA and full Vercel deployment

Finish the backend as well as the UI. Adapt the existing /api/models,
/api/complete and healthcheck contracts to the target framework’s server routes.
Retain validation, structured errors, fixed provider endpoints, sensible timeouts,
same-origin protections and no-store responses. Preserve direct streaming only
where its security/error/cancellation behavior is understood. Never bundle server
secrets into client code or log user keys/prompts. User OpenRouter keys stay in
tab memory and are excluded from persistence/exports.

Preserve manifest identity, Home Screen metadata, icons, safe areas, and offline
saved-work access. Ensure the new service worker and any old worker cannot serve
stale navigation or swallow /api requests. New PWA update UX must not discard
drafts or resume charged calls. Changing deployment origins cannot transfer browser
storage automatically; provide the existing backup export/import path.

Use handoff/VERCEL_DEPLOYMENT.md. Verify the connected team/project and environment,
build and test a preview, then publish/promote a tested production build. Confirm
the real HTTPS production URL and exercise deployed backend calls and PWA assets.
If target access is missing, finish the code and reviewable build first, then
ask only for the specific missing project/access detail. Do not deploy to an
unrelated guessed project. Never report success from a queued build or a static
page that has no functioning API.

## Completion evidence

Use handoff/ACCEPTANCE_CHECKLIST.md. Preserve existing regressions and add meaningful
coverage for migration, keyboard/safe areas, cancellation, no duplicate billing
on reload/reconnect, offline state, dataset boundaries, core parity and imports.
Test at 320, 375, 390/393, 402, 412, 420, and 430 CSS-pixel widths, landscape,
tablet, and laptop; treat 420×912 as an iPhone Air-sized test profile and verify
actual device dimensions when available. Report emulation versus physical-device
testing honestly. Measure responsive performance; do not fabricate Lighthouse scores.

Deliver the upgraded complete project, source ZIP, tests, core/build artifacts,
README, change log, migration notes, actual deployment URL/status and remaining
limitations. State what was preserved, implemented and tested. Keep working
autonomously within this scope; ask only for information that blocks a consequential
decision. Do not remove features, weaken data-integrity gates, or stop at a design.
