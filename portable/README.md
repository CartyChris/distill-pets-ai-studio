# Run Distill Pets AI Studio yourself

Distill Pets AI Studio is a playful OpenRouter workspace for agent tasks, model chips, live coding, research, and pixel pet companions. This runtime runs the frontend and API together on your own machine or Node.js server.

## Quick start

Install **Node.js 22 or later** and npm, then run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Choose **Try the playground** to explore prepared examples without a key. To use live models, add your own OpenRouter key in Settings and choose models for your companions.

Changes to frontend files reload automatically. Changes in `backend/index.ts` and `portable/runtime.js` also reload the local API; compilation errors leave the previous working handler running until you fix the source.

## Build and run

```sh
npm run build
npm start
```

The build produces browser files in `dist/` and a bundled API handler in `build/backend.mjs`. The production server listens on `127.0.0.1:3000` by default. Keep `dist/`, `build/`, `portable/`, and `package.json` together when moving the built application to a Node.js host.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Network interface to bind. Use `0.0.0.0` when your hosting service requires it. |
| `PORT` | `3000` | HTTP port. |
| `PUBLIC_ORIGIN` | Same host as the request | Full browser origin, such as `https://pip.example`, when running behind a reverse proxy. |

For an HTTPS reverse proxy, point its upstream at this Node.js server and set `PUBLIC_ORIGIN` to the exact public origin. Serve this app at the domain root so its API, preview, icons, and installable app shell share one origin. The server handles shutdown signals so a hosting service can stop it cleanly.

## Source map

| File | What it does |
| --- | --- |
| `src/api.js` | Browser JSON transport for the same-origin `/api/` routes. |
| `backend/index.ts` | OpenRouter model catalog, task validation, prepared playground answers, and non-streaming completions. |
| `portable/runtime.js` | Small `router`, `json`, and `error` helpers for the backend. |
| `portable/http.mjs` | Request parsing, body limits, origin checks, static files, and cache headers. |
| `portable/vite.config.mjs` | Development API middleware and frontend build settings. |
| `portable/build.mjs` | Vite frontend build plus esbuild API bundle. |
| `portable/server.mjs` | Production Node.js HTTP server. |

Streaming code and research requests go from the browser directly to OpenRouter. Other model requests go through `/api/complete`. The server always uses the OpenRouter endpoint defined in the backend; API keys do not choose a destination URL.

## Keys and saved work

A key stays in the current browser tab’s memory and is sent only for the requests that need it. This runtime does not persist keys or log request bodies. Browser workspace exports omit keys. Saved tasks, chips, appearances, conversations, and companion preferences remain in browser storage; export backups from Settings when you want a portable copy.

The service worker caches the public interface and assets. API requests and model responses use `no-store` and are excluded from the app-shell cache. Offline mode can show saved work, but live models and web research require a connection.

A model chip combines a base model with instructions and approved examples. Equipping a chip changes the prompt context. It does not change the hosted model’s weights. Approved live examples can be exported for a separate training workflow where a model provider supports it.

## Checks

```sh
npm test
npm run build
npm start
```

The portable tests cover the actual backend’s prepared answers and input validation, a mocked provider protocol, JSON transport, real HTTP parsing, cross-origin rejection, request size limits, path traversal, symlink escapes, cache behavior, and service-worker delivery. They use no provider credits or real API keys. Fixture provider responses test integration logic; they are not a substitute for trying your chosen live models with your own key.

Open `http://127.0.0.1:3000/api/_healthcheck` to check the running production API. Its response is:

```json
{"message":"Success"}
```

If a build fails, fix the reported source error and run `npm run build` again. If the server cannot start, check that both build directories exist and that its port is available.
