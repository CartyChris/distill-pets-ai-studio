# Teaching Workshop 0.3 — verification and handoff

## Delivered behavior

| Feature | Source pattern and implementation | Verified fidelity |
| --- | --- | --- |
| Student practice | Supplied harness teacher/student pairs and current GKD-inspired feedback pattern; native JavaScript attempt → targeted feedback → revision | Verified for fixed 3–12-call, frozen-profile, failure, cancellation and actual-artifact cases. Not a GPU/GKD trainer. |
| Dataset workshop | Supplied curation/export ideas, Distilabel separation of stages, and explicit human review | Verified for live/sample split, bounded atomic imports, full user-turn overlap checks, approval-gated SFT and separate validation exports. |
| Experiment feedback | Existing blind chip experiments plus GEPA-style reflection from observed failures | Verified for human feedback preparation, immutable parent chips, no automatic approval/equipment, and heldout-to-development transitions. |
| Preference records | TRL conversational preference format with explicit provenance | Verified for one ZIP, valid human choices, common task context, differing generation-context disclosure, and exclusion of ties/samples/partial/identical responses. |
| Playful observation | Existing native Canvas Wilds connected to teaching artifacts and guidance | Verified for live teacher/student transcripts, returned results, queued/applied steering, navigation and reload. Scenery is an illustration. |

Patterns were independently implemented in the existing stack. Original attached
harnesses were statically inspected, not executed or republished. Current GitHub
sources were researched; no external trainer code was vendored or executed.
See the dated attachment, research and independent review reports.

## Fresh verification

- Portable runtime: ten real HTTP/transport/static-delivery tests passed.
- Feature regressions: conversations, Chip lab, Wilds practice, Superpowers,
  portable JavaScript/Python runners, cancellation, Mermaid/generative UI,
  Teaching workshop, and preference exports passed.
- Integrated browser: teaching → live Wilds steering/messages → human-reviewed
  SFT → unreviewed chip → immutable approval → reserved comparison → preference
  ZIP → development-ledger feedback → reload and invalid-import recovery passed.
- Independent Judge: three concrete data-integrity counterexamples were fixed
  and retested; stop/restart/late-output, reload and provider-failure checks passed.
- Responsive: 306 view/profile combinations from 320px phones through laptop
  layouts, plus landscape, large text/spacing and long names passed.
- Avatars: 54 view/profile checks and 548 canvases passed native proportion,
  compact icon, wardrobe and unchanged-outfit checks.
- Production: portable build, actual Playground requests, local diagram SVG/PNG,
  safe generative UI, CSP, saved work and PWA install/offline checks passed.
- Reforge evidence: four fixed design-contract feature families matched exactly;
  repeat capture was deterministic. A separately executed mutant removing human
  approval from export was rejected. Integrity verification and final gate passed.

These checks use fixture inference and real labeled Playground responses. They
do not establish paid model quality gains, physical-device Safari behavior,
hidden provider reasoning, numeric weight training, or whole-app parity with an
attached harness. Browser profiles cover the stated mobile dimensions and input
behavior; real provider verification needs your key, chosen model and credits.

## Run and continue

Use Node 22+: `npm ci`, `npm run dev`. For a built app: `npm run build`, then
`npm start`. Run `npm test` and `npm run test:features`; browser commands are in
`docs/testing.md`. Export a workspace backup before clearing browser storage.
Keep existing chips as immutable parents when trying new teaching revisions.

The release contains standalone source, lockfile, tests, PWA assets, both Wilds
gallery images, setup and workshop guides, research, and third-party notices.
Private deployment details, credentials, saved workspaces and raw input harnesses
are excluded from this public package.
