# Distill Pets AI Studio — Astra / v0 handoff

This repository contains the complete current **0.3.0 application source**, its lockfile,
tests, PWA assets, pet artwork, Wilds gallery, existing research and documentation,
plus the instruction-only handoff below. The working application is included at the repository root. The proposed React,
mobile UX and core upgrades remain future work for Astra; they are not claimed
as implemented in this handoff.

## Import this repository in v0

Use the repository settings shown in your v0 import screen:

- **Repository:** `CartyChris/distill-pets-ai-studio`
- **Branch:** `main`
- **Root Directory:** the repository root; leave it blank if v0 uses blank for root.
  Do not select `src/`, `handoff/`, or `portable/`. `package.json` is at the top level.

After importing, start the chat with:

> Read START_HERE.md and handoff/ASTRA_PROMPT.md in this repository. Use those
> instructions to upgrade this imported app within v0, preserve every working
> feature, verify the result, and complete the full-stack Vercel deployment.

Use the Astra/vmax settings available in your own v0 environment. This repository
supplies source and instructions; it does not configure a model subscription or
claim unavailable model integrations. v0 may sync edits to a working branch;
keep track of that branch when continuing the upgrade.

The prompt is also ready to copy from **handoff/ASTRA_PROMPT.md**. All files are
already in the repository, so you do not need to attach a separate ZIP. A complete
source archive is available through GitHub's Code → Download ZIP action.

## Read in this order

- **handoff/ASTRA_PROMPT.md** — ready-to-paste execution prompt.
- **handoff/UPGRADE_PLAN.md** — React, mobile UX, engine and pipeline work packages.
- **handoff/VERCEL_DEPLOYMENT.md** — full-stack migration and release checks.
- **handoff/SOURCE_MAP.md** — existing files, compatibility rules and tests.
- **handoff/ACCEPTANCE_CHECKLIST.md** — evidence required before calling it done.
- **handoff/source-manifest.json** — original commit and SHA-256 of every app file.

## What exists today

The app is a Vite JavaScript/TypeScript PWA with a portable Node backend, not a
React/Next.js app yet. It includes teacher/student practice, reviewed model chips,
curated datasets, blind comparisons, a procedural Canvas world, conversations,
coding/research studios, Mermaid/generative UI, customization, and runnable
JavaScript/Python Superpower exports.

**There is no Rust/WASM or Go core in this source version.** Those are proposed
additions in the handoff, not binaries or implemented capabilities. The hosted
AI models do neural computation. Chips, memory and visible review layers organize
context and workflow; they do not update hosted model weights.

## Run the unchanged source locally

Requires Node.js 22 or newer:

```sh
npm ci
npm run dev
```

For production-style local serving:

```sh
npm run build
npm start
```

Try Playground without a key. Live model work uses your OpenRouter key and
credits. Keys, saved workspaces, node_modules, machine-specific binaries and
private deployment configuration are excluded from this repository. Dependencies
are restored from package-lock.json. See THIRD_PARTY_NOTICES.md for provenance.

The current Node server is a local/portable host, not a ready-made Vercel
serverless adapter. Uploading only dist/ would leave the backend incomplete;
Astra must complete the route migration described in the Vercel guide.
