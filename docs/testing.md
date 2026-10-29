# Testing Distill Pets AI Studio

Use Node.js 22+ and install dependencies with `npm ci`. The portable brain export
regression also needs Python 3.9+; the web app itself runs on Node.js.

```sh
npm test
npm run test:features
npm run test:core
npm run build
```

The first command exercises the portable HTTP runtime and actual backend with
in-memory provider fixtures. The feature command checks bounded model workflows,
imports, retrieval, cancellation, generated code exports, and safe UI schemas.

For browser checks, install Playwright's Chromium once:

```sh
npx playwright install chromium
npm run dev -- --port 5190
```

In another terminal, run these scripts against that development server:

```sh
node tests/superpowers-browser.mjs
node tests/forge-browser.mjs
node tests/conversations-browser.mjs
node tests/chip-lab-browser.mjs
node tests/chip-approval.mjs
node tests/practice-integrated.mjs
node tests/avatar-proportions.mjs
```

The default browser is Playwright's downloaded Chromium. To use an existing
executable, set `CHROMIUM_PATH` to its path. `APP_URL` overrides a script's target
URL. Some older regression scripts have different default ports; set `APP_URL`
explicitly when running them. Module harness tests require the development server.

To check the production server and its PWA:

```sh
npm run build
npm start
APP_URL=http://localhost:3000 node tests/fable-production.mjs
APP_URL=http://localhost:3000 node tests/pwa.mjs
APP_URL=http://localhost:3000 node tests/responsive.mjs
```

PWA caching checks require a production build in a secure context (HTTPS or loopback). The app's
service worker is not installed during Vite development. Provider fixtures use
fake test keys and intercepted responses; no test requires a real paid API call.
Tests may write screenshots and reports under `tests/`; generated artifacts are
excluded from source control.


## Teaching Workshop 0.3

`npm run test:features` includes the bounded teacher/student pipeline and
preference-export checks. `APP_URL=http://localhost:3000 CHROMIUM_PATH=/path/to/chromium node tests/teaching-browser.mjs` exercises the
integrated real UI using intercepted provider fixtures: live steering and
returned transcripts, explicit example review, SFT download, immutable chip
approval, held-out comparisons, single-ZIP preference/provenance export, shared
development history, reload and key exclusion. It also checks small phone,
iPhone Air-sized, landscape and desktop layouts. Browser profiles emulate
viewports; they do not establish physical iOS Safari verification.

The dated independent review records three reproduced and corrected data
integrity issues. Reforge contract replay covered four new feature families
with fixed inputs, exact comparisons, deterministic repeat and an executed
approval-guard mutant that was correctly rejected. This proves the listed
new design cases, not original-harness whole-app parity. No paid inference
or hosted model weight training was used for release verification.

`APP_URL=http://localhost:3000 node tests/teaching-playground.mjs` checks the
actual prepared Playground backend end to end, with no provider interception:
four distinct stages, no sample training exports, the same public Wilds messages,
phone fit, and saved state after reload.

## Learning core and recursive teaching 0.4

`npm run test:core` compares JavaScript with the actual compiled WASM and verifies
artifact/source hashes, Unicode, malformed input, memory-buffer lifetime,
worker timeout/fallback and isolated cancellation. `npm run test:core:native`
needs Rust 1.90.0. `npm run core:build` reproduces the committed browser artifact.

`tests/teaching-recursive.mjs` verifies the 24-call ceiling, frozen checks,
latest-answer feedback, early stopping, all saved rounds, review gates,
interrupted runs and curriculum selection. `tests/training-bundle.mjs` runs the
Python audit/dry run on a real generated ZIP and checks checksum tampering,
approval bypasses, context preservation and validation overlap.

For the production browser integration:

```sh
APP_URL=http://127.0.0.1:3000 npm run test:browser:core
```

This uses fixture provider responses, the real compiled Rust worker under the
production CSP, reviewed ZIP downloads, Python auditing, seven viewport sizes,
Wilds dialogue, saved-state recovery, offline analysis and invalid-WASM fallback.
The optional `python3 training/smoke_test.py` (after installing the training
requirements) builds a tiny random model locally and performs one real CPU LoRA
optimizer step, verifies changed adapter tensors and rejects overwriting results.
It does not download a model, use hosted credits or test model quality.
