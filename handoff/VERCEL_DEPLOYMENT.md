# Full Vercel deployment — instructions for Astra

This document is a migration/release plan. No Vercel project was created,
modified or deployed while preparing this handoff.

## Target and architecture

Inspect the existing v0 app first. Reuse its connected Vercel project/team when
the target is unambiguous. Do not create a duplicate project or replace unrelated
routes, auth, storage or environment configuration. Ask for a specific missing
target/access detail only when it actually blocks the release.

For the expected React/Next.js App Router target, use TypeScript UI components,
client-only browser/Canvas code where appropriate, and Node-runtime API route
handlers. Do not statically export the app if it needs server routes. Keep
browser-only storage, document/window APIs, workers and WASM initialization out
of server module evaluation and server-component render paths.

## Backend migration is required

The supplied source has a long-lived portable Node HTTP server. Vercel should
not be expected to run npm start as that persistent server. Adapt the existing
handler’s behavior into the target framework instead of deploying only dist/.

| Contract to preserve | Next.js App Router destination |
| --- | --- |
| GET /api/models | app/api/models/route.ts |
| POST /api/complete | app/api/complete/route.ts |
| GET /api/_healthcheck | app/api/_healthcheck/route.ts |

Share domain/provider logic behind a small server adapter. Keep the fixed
OpenRouter provider origin, request validation, bounded bodies/outputs,
structured errors and redacted operational logs. Do not implement arbitrary
user-provided proxy URLs. Preserve same-origin protections with correctly
validated production/preview origins, not an unchecked forwarded-host reflection.

Use the Node runtime unless a specific dependency has been validated for another
runtime. Set provider timeouts and function duration from the chosen Vercel plan
and current platform limits. Each teaching stage should be a bounded request;
do not move an entire indefinite agent loop into one serverless invocation.
Propagate cancellation where supported, and retain the current warning that an
already submitted provider call can still be billed.

For SSE/direct browser streaming, inspect src/studio.js and retain its actual
framing, cancellation, partial-output and error semantics. If changing transport,
test the entire path rather than assuming a JSON completion adapter also streams.
No automatic retry may submit another charged model request invisibly.

## Keys, state and serverless boundaries

Retain BYOK OpenRouter behavior: user keys stay in tab memory, cross HTTPS only
for the intended completion request, and never enter localStorage, IndexedDB,
URLs, build output, exports, logs or analytics. If an optional server-owned key
is added later, place it in Vercel server environment configuration with an
explicit usage/access policy. Never use NEXT_PUBLIC_ for a secret. Do not ask
the user to paste keys or deployment tokens into chat.

The client can orchestrate the existing bounded workflow. A server job service,
database or queue is optional future architecture with real persistence and
ownership contracts, not a prerequisite for the existing local workspace. Do
not imply a background job continues after function timeout or browser closure
unless a real durable service has been implemented and tested.

Do not spawn persistent Python/Go/Rust processes inside ordinary serverless
functions. Prefer compiled browser WASM and portable offline CLIs. For a genuine
server-language requirement, check the current supported Vercel runtime or use
an explicitly configured external service and document that dependency.

## PWA assets and caching

- Retain one active manifest, its identity, icon sizes/purposes, scope and start
  URL unless a deliberate migration is needed. Serve it with the correct MIME.
- Keep Home Screen and Apple metadata, touch icons, theme color and viewport-fit.
- Keep the service worker in the correct public scope with an update strategy
  appropriate to the target framework. Audit any existing worker before adding
  another. Old root-scope workers must not intercept new routes indefinitely.
- Do not blindly precache framework server/RSC responses as if they were a Vite
  static shell. Use a framework-compatible strategy and an explicit offline view.
- Exclude /api, provider URLs, keys and private responses from service-worker and
  CDN caching. Use no-store for sensitive API responses; ensure catalog caching
  is separately and deliberately bounded if introduced.
- Serve the worker with revalidation/no-cache update behavior and hashed public
  assets with appropriate immutable caching. Actual .wasm files need a correct
  MIME, cache/version strategy and any required narrowly scoped CSP permissions.
- A new origin has separate storage. Offer backup/import; do not claim a new
  Vercel origin can read the previous site’s saved workspace.

## Preview verification

1. Verify intended project/team, root directory, commit and Node/framework
   versions. Keep the lockfile consistent. Use the existing package manager.
2. Run type/build checks, domain/core parity tests, affected regressions and
   meaningful browser workflows. Inspect the actual result of every command.
3. Create a preview using the connected v0/Vercel workflow. Do not treat a
   configuration file or queued build as a working deployment.
4. Test the preview over HTTPS: home, every migrated view, direct links/back,
   three API contracts, actual Playground stages, error/retry/cancel, and reload.
5. Test manifest, icons, worker scope/update, offline saved data, API cache
   exclusion and worker/WASM fallback. Test install guidance and standalone UI.
6. Check runtime/network logs with keys/prompts redacted. Fix material failures.

If using Vercel CLI instead of the connected UI, authenticate through its normal
secure workflow, link the correct target and use current official documentation.
Do not run illustrative commands with invented project IDs. A CLI production
workflow can build with production settings, stage without domain assignment,
test the staged production artifact, then promote that tested artifact. Preview
promotion may rebuild with production settings; verify the artifact that will
actually be served. Pin reviewed CLI versions in automation.

## Production and final handoff

Publish/promote to the verified production target after checks pass. Confirm
READY status, actual production URL, deployed commit, successful backend requests
and static/PWA asset responses. Check the production origin independently of the
preview, including environment-dependent behavior. Record rollback capability.

Report concrete URL, target, status, commit, framework, executed checks and
material remaining limitations. If deployment is blocked by access, do not
fabricate a URL or claim the static UI is a full release. Provide the completed
project/build and the exact remaining connection action.

Official references to check at implementation time:

- https://vercel.com/docs/deployments
- https://vercel.com/docs/functions
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- https://nextjs.org/docs/app/guides/progressive-web-apps
