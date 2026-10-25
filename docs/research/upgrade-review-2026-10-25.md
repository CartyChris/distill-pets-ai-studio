# Independent upgrade review — 2026-10-25

Judge: a separate review agent, not the Teaching Workshop or Chip lab module
author. No production changes were made by this reviewer. Review scope came
from the user's upgrade request, `SCOPE.md`, both supplied-harness analyses,
the repository research, changed source, and runnable tests.

**Verdict for the cases below: three material defects were reproduced, corrected
by the implementation owners, and freshly retested successfully. No unresolved
material defect was established in this review.** This is verification of the
listed new behaviors, not whole-app parity with either HTML attachment.

## Confirmed findings and resolution

### R1 — Earlier chat turns could leak reserved validation into training

Severity: material data-integrity defect, resolved.

Reproduction before correction: import a four-turn conversation whose first
user turn is a reserved validation prompt, followed by its answer and an unrelated
final user/assistant pair. The importer accepted the row because only its final
`prompt` was compared to the reserved task. After human approval, SFT JSONL
included the reserved question and answer in its history.

Resolution: `teachingRowPrompts` now extracts all user tasks, including supported
role-tagged chip context. Import and split checks use that complete task set;
the import fails atomically. Relevant current paths: `src/teaching.js`,
`teachingPromptParts` / `teachingRowPrompts` (112–127),
`teachingSplitConflicts` (129–142), and `importData` (477–496).

Retest: the independent context runner confirms rejection and an unchanged
basket. Teaching unit tests also cover this boundary.

### R2 — Chip drafting lost necessary system and assistant context

Severity: material teaching-correctness defect, resolved.

Reproduction before correction: import an approved conversation with a system
reference naming Lisbon, an assistant turn confirming Lisbon, and the final user
question “Which country is that city in?” with target “Portugal.” Chip drafting
flattened only user messages. Both the teacher request and saved chip example
lost the city needed to interpret the answer.

Resolution: `distill` now serializes the complete role-tagged supervised context
into each chip example and supplies it to the distillation teacher. System,
user, and assistant content stays data, with the existing request and example
size limits. Current path: `src/teaching.js`, `distill` (419–461). The app's chip
adapter preserves workshop source prompts and row/run identifiers.

Retest: the independent context runner confirms Lisbon and its system/assistant
roles appear in both the teacher payload and chip example. The chip remains
unreviewed and is not automatically equipped.

### R3 — Deleting a basket row could erase inherited-chip exposure

Severity: material evaluation-lineage defect, resolved.

Reproduction before correction: practice task R using a reviewed student chip
containing example Q. Q is sent in the learner's profile. Delete the returned R
basket row, disable chip practice, and reserve Q as validation. The exporter
accepted Q because the persistent development ledger recorded only R; the
inherited Q lived in the deleted row and saved profile.

Resolution: session start records inherited profile and chip tasks in the
persistent development ledger before submitting calls. Restoration reconstructs
exposure from saved run profiles and rows. Current paths: `src/teaching.js`,
`cleanTeaching` (84–111) and `runSession` inherited prompts / `allKeys` (358–370).
Deleting a row no longer resets the task's history. Capacity is bounded and does
not silently discard older exposure to clear a validation check.

Retest: the independent context runner confirms Q cannot be exported as reserved
validation after both row deletion and `cleanTeaching` restoration.

## Fresh executed checks

| Check | Result and actual scope |
| --- | --- |
| `node tests/teaching-unit.mjs` | Passed: frozen 3–12-call flows, actual attempt/feedback/revision, review gates, held-out isolation, bounded atomic imports, stop/late output, partial failure, draft chips, validation handoff, sanitization. |
| `node tests/preference-export.mjs` | Passed: eligible human choices, common-context export and provenance, one-ZIP download, ties/partial/demo exclusions, lineage, immutable chips, busy guards, duplicate normalization, safe rendering. |
| `node tests/teaching-browser.mjs` | Passed against the local app in an isolated Chromium profile: teacher/student requests; live Wilds guidance, transcripts, and results; reviewed SFT; chip approval; frozen comparison; preference ZIP; shared development history; reload/key exclusion; atomic import failure; phone/landscape/desktop layouts. |
| Independent `judge-context-regressions.mjs` | Passed the three counterexamples R1–R3 against corrected code, including deletion/reload lineage. |
| Independent `judge-recovery.mjs` | Passed stop → start another session → late old response; reload during first call without automatic restart; teacher failure after first attempt, preserving that attempt across reload. |

Independent runners and raw outputs are retained in the verification workspace's
`artifacts/` as `judge-context-regressions.mjs`, `judge-context-output.txt`,
`judge-recovery.mjs`, and `judge-recovery-output.json`. They use fixtures, not a
real provider key or paid inference.

The recovery runner observed a reload-canceled request saved as `failed`, rather
than `stopped`, when the browser delivered its canceled-fetch error before
unloading. That preserves the interrupted state and work; it submitted one call,
saved no completed example, and did not restart after reload. The acceptance
check therefore verifies a nonrunning interrupted state and no extra submission,
not one timing-dependent status word.

An earlier browser test expected the supervised task in the second-last message.
Applied Wilds steering is now legitimately retained after that task. The stale
test was corrected to find the task among user messages and independently require
the applied steering; the fresh integrated browser run passed.

## Source identities at the final review check

| File | SHA-256 |
| --- | --- |
| `src/teaching.js` | `ac5e4765f8602c6598dacf2c19d7a7d78e6b445168201f48607bfe039388753c` |
| `src/chip-lab.js` | `caa9d8fea131ad02f746c4d7fe953d06d656f36a1dde6f80e34b75d0b19c4b9b` |
| `src/app.js` | `d174b36ca812270aaafa2c2c3e60ca23e0122e9c63f2ad828b364d19dd5e9041` |
| `src/adventure.js` | `d94c7c2ed5d521edf23c1c3082765275b0fdec010563eb42b6f0a95dae2b2f1e` |
| `backend/index.ts` | `2e493310ceef55c5d6a4db14e0b659da77ea211e91e8671bdbfb493fdcda0e55` |
| `tests/teaching-browser.mjs` | `845280216a82969fab6a01ec82ac7c51e9193428549fbef5be9bf9fced0f039e` |
| `tests/teaching-unit.mjs` | `ade9885a547ac9ccad10b52b07d6dddae74330cd3833f7671370cfcf81f3aeea` |
| `tests/preference-export.mjs` | `4a89bc2254388edcf4d379d69c25529df62a7fda4cf19c33721f2212cb6b4b2a` |

Changes after these hashes require affected checks to run again. This list binds
the reviewed files, not every dependency or an unbuilt deployment.

## Limits and release ownership

- Exact normalized duplicate checks do not establish semantic independence of
  paraphrases; users still review overlap and answer quality.
- The attachments were analyzed statically; their API behavior was not used as a
  trusted runtime oracle. Current workshop behavior is an intentional native
  implementation of useful patterns.
- No paid model inference, hosted weight training, physical iPhone/Android test,
  or post-deployment verification was performed by this reviewer.
- The Reforge document was still a draft when checked: structural `verify`
  passed, while completion `gate` correctly failed on empty requested features.
  The integration owner must populate actual F1–F4 evidence and run the final
  gate on the packaged candidate. This review does not count the draft as a
  completed release gate.
- Root owns the final full regression/build, public-package privacy audit,
  source publication, deployment, and live smoke checks.
