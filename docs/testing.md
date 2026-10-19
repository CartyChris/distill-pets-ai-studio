# Testing Distill Pets AI Studio

Use Node.js 22+ and install dependencies with `npm ci`. The portable brain export
regression also needs Python 3.9+; the web app itself runs on Node.js.

```sh
npm test
npm run test:features
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

PWA caching checks require a production build on localhost or HTTPS. The app's
service worker is not installed during Vite development. Provider fixtures use
fake test keys and intercepted responses; no test requires a real paid API call.
Tests may write screenshots and reports under `tests/`; generated artifacts are
excluded from source control.
