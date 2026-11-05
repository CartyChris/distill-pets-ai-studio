# Current source and compatibility map

Historical baseline: Distill Pets AI Studio 0.3.0, commit
7234e06aaa7c258ffb4d345c60c2efa53aa403eb. The source-manifest.json hashes
identify historical baseline files, not current 0.5.0 content. The current
application includes the implemented learning-core upgrade described below.

| Area | Existing entry points | Preserve / migrate |
| --- | --- | --- |
| Startup and UI | src/main.ts, src/app.js, src/styles.css | Vite startup and imperative rendering today; replace incrementally with React components, not another imperative page rebuild inside every React update. |
| HTTP / models | src/api.js, backend/index.ts | Same-origin transport; GET /api/models, POST /api/complete, GET /api/_healthcheck. Backend currently uses portable runtime helpers. |
| Portable hosting | portable/runtime.js, portable/http.mjs, portable/server.mjs, portable/build.mjs, portable/vite.config.mjs | Local Node hosting and Vite build. These are not existing Vercel/Next route handlers. |
| Teaching | src/teaching.js, src/teaching.css | Frozen 3–24-call sessions with up to 3 review rounds and output diagnostics, returned attempt/feedback/revision, reviewed basket, imports/exports, validation handoff, exposure ledger. |
| Learning core | src/learning-core/, core/rust/, core/fixtures.json, core/wasm-manifest.json | Actual Rust/WASM worker, JS fallback, bounded planner/diagnostics/audit contract, source/artifact integrity. |
| Training tools | src/training-bundle.js, training/ | Reviewed ZIP/provenance, Python offline audit and optional tested LoRA trainer. |
| Chips / evaluation | src/chip-lab.js, src/chip-lab.css, chip methods in src/app.js | Blind fixed-model comparisons, preferences, one-ZIP provenance exports, development roles and immutable drafts. |
| Conversations | src/conversations.js | Bounded streaming threads, compatible chip/model context, reading position and safe rendering. |
| Education | src/academy.js | Five-step trail tied to actual workspace evidence; no cosmetic completion flags. |
| Superpowers | src/superpowers.js, src/superpowers.css | Workflows, local reference retrieval, bounded review layers, reviewed memory, Markdown and runnable JS/Python exports. |
| Forge | src/forge.js, src/forge.css | Actual Mermaid parsing and sanitized SVG/PNG; constrained generative UI schema/actions. |
| Studios | src/studio.js, src/studio-evolution.css | Coding, generated files, editable workspace, sandboxed preview, research, observer/tutor context, partial recovery. |
| Wilds | src/wilds.js, src/adventure.js, src/adventure-state.js, src/world-engine.js, src/adventure.css | Original expedition view plus expanded procedural Canvas world, public dialogue/results and guidance. |
| Play / passport / photos | src/world-play.js, src/playbook.js, src/play-panel.js, src/world-play.css | Six interruptible activities, walking-route restoration, bounded cosmetic memories, arrival-only stamps, real PNG camera and mobile controls. |
| Pets / appearance | src/pixels.js, src/field-kit.js, src/customize.js, src/avatar-proportions.css, src/brand.css | Native 36×48 sprites, outfits, personality, emotes, palettes, scale, density, radius, fonts and motion. |
| PWA | src/pwa.js, public/sw.js, public/manifest.webmanifest, public/icons/, index.html | Stable installation metadata, safe areas, offline saved work, update/install guidance; API requests excluded from cache. |
| Provenance / help | THIRD_PARTY_NOTICES.md, README.md, docs/ | Preserve licenses and accurate capability descriptions; retain Wilds images. |

## State boundaries

The current main workspace lives under localStorage key **pip-studio-v1**, version
1. Important subtrees include agents, tasks, lessons, comparisons, conversations,
generation, studio, academy, wilds, adventure, appearance, chipLab, superpowers,
forge, teaching and drafts. Inspect DEFAULTS and validateBackup in src/app.js,
plus each module’s cleaner, before changing schemas.

Version 0.5 adds `adventure.playbook`. `cleanPlaybook` accepts only known scenic
IDs, bounds its journal to 32 entries and counters to 9,999. Activities in progress
and postcard image blobs are ephemeral. No model prompts or responses enter the
field journal. Older workspaces receive an empty passport automatically.

Keep legacy pet/outfit/theme IDs and chip parent/revision references compatible.
Keys are deliberately held outside saved state. A new hosting origin will have
separate browser storage: guide the user through backup export/import. Do not
promise automatic access to another origin’s localStorage or service worker.

## Useful regression entry points

```sh
npm ci
npm test
npm run test:features
npm run build
```

Browser scripts accept APP_URL; set CHROMIUM_PATH when required by the host.
Read docs/testing.md before running them. Important cases include:

- tests/teaching-browser.mjs — actual UI with provider interception; Wilds steering,
  review/SFT, chip approval, validation, preference ZIP and development ledger.
- tests/teaching-playground.mjs — real prepared backend, no provider interception.
- tests/teaching-unit.mjs and tests/preference-export.mjs — integrity and bounds.
- tests/chip-lab-unit.mjs and tests/chip-lab-browser.mjs — frozen experiments/review.
- tests/conversations-unit.mjs / conversations-browser.mjs — streaming threads.
- tests/responsive.mjs and tests/avatar-proportions.mjs — old shell’s layout and
  avatar checks; migrate selectors to new accessible navigation without dropping
  view coverage or weakening constraints.
- tests/pwa.mjs — install metadata, icons, offline saved work and cache exclusion.
- tests/portable-brain.mjs / superpowers-cli-cancel.mjs — actual JS/Python exports.
- tests/forge-unit.mjs / forge-browser.mjs — diagrams, exports and safe UI schema.
- portable/tests/ — real transport, HTTP boundaries and static delivery.

Some existing browser selectors assume the old navigation. Preserve their
behavioral expectations, adapt selectors to the React shell, and add a complete
view catalog check so a shorter bottom dock does not accidentally reduce testing.

## Engine reality check

Rust source and a real compiled WASM artifact are included, along with native/JS/WASM
fixtures, a worker and fallback. Python Superpower exports remain in src/superpowers.js;
training/ adds an offline auditor and optional LoRA training job. No Go runtime or
Python web server is required. Deterministic local analysis is distinct from hosted
model inference and separate weight training. See docs/learning-core.md.
