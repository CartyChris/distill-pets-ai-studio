# Distill Pets AI Studio

A tiny AI team, an explorable world, and useful work worth teaching.

Distill Pets AI Studio is a responsive JavaScript PWA for OpenRouter text models. Customize pixel
pets, watch teacher–student adventures, build and preview code, compare model
chips, and create reusable Superpowers for your own workflows and reference data.

## Run it

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. Choose **Try the playground** for
labeled samples without a key. For actual inference, open **Settings**, enter
your OpenRouter key, choose model IDs, and select live mode. Keys stay in tab
memory and are sent only to the local completion route or OpenRouter streaming
endpoint. They are excluded from saved workspaces and exports.

```sh
npm run build
npm start
```

The production server serves the built app and the same API routes on port 3000
by default. Use `PORT` to change it. Run your own HTTPS reverse proxy when serving
outside localhost. Safari's Share → Add to Home Screen installs the iPhone PWA;
supported Android browsers offer their usual install action.

## Explore

| View | What you can do |
| --- | --- |
| Workspace | Complete a task, review its output, and distill an approved example. |
| Conversations | Continue bounded streamed threads with frozen model/chip settings. |
| Distillation Trail | Follow five evidence-based steps from a teaching goal to a fresh comparison. |
| Superpowers | Create custom workflows with instructions, reference data, review layers and exports. |
| Forge studio | Edit and render Mermaid diagrams; generate safe interactive UI from a component schema. |
| Wilds / Open World | Send companions on tasks, research, code and nature-walk teaching adventures. |
| Code studio | Inspect generated files, edit, search, restore snapshots and run a sandboxed browser preview. |
| Live room / Research | Watch actual output, public tutor messages, sources and activity as work arrives. |
| Model chips / Chip lab / Compare | Review portable instructions, curate approved examples and judge blind held-out comparisons. |
| Pets / Customize / Settings | Personalize species, outfits, teaching voices, colors, themes, controls and model choices. |

The open world is a seeded 6144×4096 Canvas scene with four biomes, landmarks,
workflow NPCs and scenic enemies. Walks illustrate activity. Completed requests,
returned files and citations create resources; animation timers do not complete
AI tasks. Guidance applies at the next eligible model step. Private provider
reasoning is excluded from visible and saved transcripts.

## Create a useful Superpower

Start with one narrow job: for example, turn support notes into a response using
your own approved product FAQ. Give it a name, instructions and observable success
criteria. Add reference text or import a small text/JSON/CSV file. Run a fresh task
with the chosen model and select a bounded number of critique/revision rounds.
Review each returned layer and its reference context before reusing the result.

Reference retrieval runs locally using a deterministic text-matching method.
Generation and review use the selected model. Reviewed memory is context supplied
to later calls. Markdown, JavaScript and Python exports make the workflow
inspectable and portable. They do not execute arbitrary user-supplied code in Distill Pets AI Studio.

**Model chips and workflow memory do not update hosted model weights.** A chip
stores reusable instructions and approved examples alongside a base-model ID.
Equipping it changes the context of later calls. OpenRouter does not expose a
universal model-training API. Approved live JSONL can be exported for a separate
compatible trainer; playground samples are excluded from training exports.

## Diagrams and generative UI

Mermaid source is parsed and rendered locally with the actual Mermaid library.
Invalid source shows a useful error. Source and rendered exports remain separate.
No remote diagram-rendering service receives your source.

The generative UI workbench is an original, constrained native renderer inspired
by component-catalog approaches. It is not an embedded OpenUI or JSON Render SDK.
Only allowlisted components and explicit actions are accepted; generated HTML and
scripts cannot execute in the parent app. See the dated [GitHub integration
review](docs/research/github-review-2026-10-19.md) for projects considered and the
precise integration decisions.

## Data, costs and recovery

Workspaces are saved in this browser. Export a backup in Settings before changing
devices or clearing browser data. Limits keep threads, examples, experiments and
review rounds bounded. Interrupted runs keep useful partial work and do not
automatically restart after reload. Stop prevents later steps; an already
submitted provider request may still be billed. Live costs depend on model,
tokens, retries, search and selected review rounds.

The PWA caches its public app shell, not API responses or keys. Saved work is
readable offline. Previously unused optional renderer assets and AI generation
need a connection. Mobile layouts include safe areas, 16px inputs, touch targets,
reduced motion and landscape handling.

## Verify

```sh
npm test
```

The portable runtime tests exercise real HTTP boundaries using prepared responses.
Additional regression scripts under `tests/` cover model-chip review, conversations,
world guidance, processing layers, diagram/schema validation, avatars and phone
layouts. Browser tests use Playwright and Chromium; see `docs/testing.md`.
Provider-intercepted tests verify request construction and failure handling, not
paid inference. Real OpenRouter verification requires your own key and credits.

## Source layout

`src/` contains the app and native Canvas world; `backend/index.ts` contains the
fixed OpenRouter routes. `portable/` provides the Node HTTP runtime and Vite build.
`public/` contains PWA assets. `tests/` contains regression scripts.

Download source with Code → Download ZIP, or use a source archive from Releases
when available. No saved workspace data or credentials are included. Third-party code keeps its respective
license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The pet sprite engine
comes from the supplied Pixel Pets artwork and is identified separately there.
