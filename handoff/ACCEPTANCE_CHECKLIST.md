<!-- 0.5.0 includes the learning core, Python training tools and Wilds play/postcard system. This checklist remains for the next migration; rerun checks on its final source. -->
# Completion checklist for Astra

Check these against the upgraded v0 app. This file does not claim the future
upgrade or Vercel deployment has already passed.

## Preservation and migration

- [ ] Inventory all 17 original views and preserve their useful actions.
- [ ] Open a valid legacy pip-studio-v1 backup with tasks, chips, conversations,
  example rows, development history, themes, outfits and drafts intact.
- [ ] Keep existing v0 project functions, authentication and unrelated data.
- [ ] Preserve full role context and chip lineage; no draft is equipped automatically.
- [ ] Navigation/back/sheets do not remount a running job, lose a draft, or submit
  another request. Failures and stopped output remain inspectable after reload.

## Mobile app feel and accessibility

- [ ] Test 320–430px phone widths, representative Android/iPhone profiles,
  landscape, tablet and laptop; verify real device dimensions when available.
- [ ] Test an open software keyboard, standalone display, notches/safe areas,
  browser chrome, long names, large text and maximum appearance scale.
- [ ] Composer, dock, stop action and primary buttons remain visible/reachable.
- [ ] Mobile editable text is at least 16px; touch targets at least 44px.
- [ ] Sheet/dialog focus trap, Escape/dismiss, focus restoration, labels and
  screen-reader announcements work. Pinch zoom remains available.
- [ ] No accidental horizontal overflow; intentional code/map scrolling is clear.
- [ ] All themes/custom colors, reduced motion and original outfits remain usable.
- [ ] Pixel sprites preserve 36×48 proportions; no squash/stretch sizing bug.
- [ ] Streaming respects reader position; skeleton/empty/error/offline states are useful.
- [ ] Measure render/input performance and world frame time on stated hardware.
  Use practical targets such as low layout shift and responsive input; report
  actual scores/conditions rather than fabricated universal 60fps claims.

## Teaching, exports and recovery

- [ ] Frozen teacher/student/models/profiles; actual attempt → feedback → revision.
- [ ] Visible 3–24-call ceiling with the default three-call flow; reference and distillation costs are explicit.
- [ ] Teacher critiques the actual student answer; revisions use returned feedback.
- [ ] Stop/reload/late output cannot create further calls, approvals or chips.
- [ ] Full earlier-user-turn and inherited-chip leakage checks survive deletion
  and reload. Consumed evaluation prompts become development data.
- [ ] Invalid imports are atomic; samples and imported approval flags cannot
  bypass human review. Partial outputs cannot become training examples.
- [ ] One preference archive contains eligible chosen/rejected pairs plus
  provenance and the different-generation-context caveat.
- [ ] Wilds output/chat reflects real returned public artifacts, including
  applied or unused steering. Scenery never certifies completion or training.
- [ ] Heuristic diagnostics show reasons; they do not automatically certify truth.

## Engines and scripts

- [ ] One explicit versioned contract and shared fixtures across implemented cores.
- [ ] Real Rust source, native tests, compiled WASM, worker integration and fallback.
- [ ] Existing Python/JS runnable exports still work, including dry run and Ctrl-C
  partial-result recovery; no embedded secrets or reference-code execution.
- [ ] Go source/toolchain/build/test instructions are reproducible; pure core
  and thin CLI preserve bounds, errors and cancellation.
- [ ] Unicode, boundary inputs, size limits, deterministic outputs and broken
  predicate controls are exercised. Missing engines are labeled unbuilt.

## Full Vercel/PWA release

- [ ] Correct connected team/project/root/commit/environment established.
- [ ] Framework build and working API route adapters, not just dist/ deployed.
- [ ] HTTPS production URL is READY and actually returns useful API results.
- [ ] Valid manifest/icons/worker and Home Screen behavior; old worker migration.
- [ ] Saved work readable offline; APIs/keys never cached; update preserves drafts.
- [ ] New-origin backup/import instructions; no false promise of cross-origin storage.
- [ ] Deployed error/cancel/retry and key exclusion tested; logs contain no keys.
- [ ] Real-provider checks, if authorized/run, distinguished from fixtures/samples.
- [ ] Physical-device checks distinguished from browser emulation.
- [ ] Complete ZIP, source, lockfile, tests, core artifacts, licenses, setup,
  migration notes and verified deployment result delivered.
