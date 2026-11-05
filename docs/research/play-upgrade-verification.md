# Wilds play upgrade verification — 0.5.0

Date: 2026-11-05. This release extends the existing app; it does not replace its
framework or deploy a new hosting service.

## Delivered

- Six coordinated, interruptible scenic activities with gathering, shared props,
  expressions and restored walking routes.
- Four nature trails and arrival-only stamps, with sanitized local history and
  a JSON journal download.
- A real Canvas postcard camera: three aspect ratios, duo framing, a wave pose,
  caption, PNG preview/download and live-output exclusion.
- Mobile and keyboard controls, reduced-motion poses, improved tree occlusion,
  readable pet name tags and proportional wardrobe animations.
- Pets-page entry point, public guide, current handoff and an actual app postcard.

## Verification performed

| Check | Result |
| --- | --- |
| Portable HTTP/backend tests | 10 passed; input/origin/path boundaries preserved. |
| Existing feature suite | Conversations, chips, workflows, export/cancellation, Forge, teaching, preferences and training-bundle checks passed. |
| New play state/director tests | Bounds, known IDs, all six lifecycles, deduplicated arrival, route restore, pause/cancel, PNG crop geometry passed. |
| Existing Wilds browser suite | Practice options, accurate call plans, atlas, guided walking, actual dialogue, mobile controls and loop cleanup passed. |
| New actual-app browser suite | Completion/cancel, passport, reload, downloadable journal and three real PNG formats passed with zero inference requests; delayed PNG cancellation and keyboard capture are also covered. |
| Avatar regressions | 54 view/profile checks covering 548 sprite canvases, with normal and enlarged text passed. |
| Responsive regression | 306 view/viewport combinations, 320×568 through 1440×900, including landscape, long names and enlarged spacing passed. |
| Rust/WASM parity | Committed binary/source integrity, actual WASM vs JS results, fallback and cancellation passed. |
| Production learning browser | Actual WASM worker under CSP, fixture seven-call teaching, reviewed ZIP/Python audit, dialogue, offline analysis and bad-WASM fallback passed. |
| Production build and diff hygiene | Build and whitespace checks passed. |

The browser checks use Chromium and emulated viewports/touch. They do not claim
physical iPhone/Safari testing. Provider-dependent tests use intercepted fixtures
or the labeled Playground; no paid inference or new weight-training job was run
for this UI release. Existing Mermaid dependency chunk-size notices remain in
the build; this release adds no runtime dependency.

Remote checks exposed a postcard preview failure: the panel entrance animation
tried to commit styles after the camera had hidden the panel. The world panel
now owns a cancellable native animation, only animates visible elements, and
never commits retained animation styles. Capture also decodes the PNG before
opening its preview, provides intrinsic image sizes, dispatches button capture
explicitly, and discards results if the user closes the camera while encoding.
The regression retains real PNG encoding, delays its callback to test cancellation,
and checks repeated button and keyboard capture while the Play panel is hidden.

## Preserved boundaries

Play, stamps and photos never approve examples, mutate chips, train weights or
create AI resources. The model pipeline continues independently. Photo PNGs
include pet names and the user caption but omit returned resource cards and
model speech bubbles. The field journal stores known scenic IDs and timestamps,
not generated image bytes, prompts, outputs or API keys.

The existing storage key/schema remains compatible; older workspaces receive
an empty `adventure.playbook`. Photo previews are temporary object URLs and the
most recent image must be downloaded before leaving or taking another photo.
