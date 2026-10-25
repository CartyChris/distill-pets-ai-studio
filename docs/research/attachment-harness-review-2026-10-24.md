# Supplied distillation harness review

Static inspection on 2026-10-24. The supplied HTML and scripts were read as
evidence; neither attachment was executed or added to the application source.
No training, provider support, licensing, or API behavior was inferred from a
button label alone. Line references below refer to the supplied original files.

## Source inventory

| ID | Original artifact | Type and size | SHA-256 |
| --- | --- | --- | --- |
| A1 | `VeniceAI-DistillerHarnessV4.1` | UTF-8 HTML, 1,113 lines | `3b359075fda1f4316473d4c8096a74fe393def31d53b13aabbc7444b25a58494` |
| A2 | `T3ChatAIDistiller.html` | UTF-8 HTML, 1,752 lines | `c1edfd1e031579e872be921e9c7dbc8f27b342392bb214f7adb45f3be888c64c` |

Baseline app files inspected before the upgrade:

- `src/chip-lab.js`: `509b5c96df8f68048df9ddce834e7d4c2d3a3244dcd3fc1ae9da7683f8340f00`
- `src/app.js`: `e78a35262f8e0d4756934f4532c4fbe5f81165d01e21c4fed4e2b5f21cd1ab35`
- `src/superpowers.js`: `c0cae90990c03081896f38ac6765b6e34420c5d240e3c12913f1b25a65a0949a`

No attachment-specific license was established by this inspection. Prefer
implementing the useful behavior in the studio's existing architecture; retain
the attachments separately as user-supplied investigation inputs.

## What is actually implemented

| Feature ID | Source and precise path | Observed behavior | Reuse recommendation |
| --- | --- | --- | --- |
| H1 — Teaching curriculum | A1 `buildPlan`, lines 693–745; `processInstruction`, 748–778 | Seed prompts, topic/audience grids, model-generated instructions, and progressively harder instructions feed a bounded row-generation plan. Each row records teacher, strategy, source prompt, parameters, and usage. | Add an explicit small curriculum with editable tasks, difficulty, provenance, and a visible call budget. Synthetic tasks must stay drafts until reviewed. |
| H2 — Teacher/student practice | A2 `runDistillation`, 949–1053 | Calls a teacher one to eight times, then calls a student with the same task and optionally all teacher answers. Saves the pair, latency, usage, model IDs, and lexical overlap. | Preserve the visible demonstration/practice pair, but add a distinct fresh-task transfer step that does not contain the teacher's answer. Show which stage the student saw. |
| H3 — Rubric feedback | A1 `judgeRow`, 783–791; A2 `runJudge`, 1084–1112 | A separate model request evaluates output against a rubric. A1 parses four numeric axes; A2 retains the judge's returned text. Neither performs weight training. | Useful as optional advisory feedback, with strict schema/range validation, explicit model provenance, visible costs, and separate human approval. Invalid JSON must not become a passing score. |
| H4 — Dataset workbench | A2 `renderExamples`, 1218–1288; `validateDataset`, 1306–1318; `importDataset`, 1349–1367 | Users edit examples, import JSON/JSONL or basic chat rows, and check required fields and string lengths. | Add bounded imports, per-row validation errors, normalized duplicates, train/evaluation roles, explicit approval, and review invalidation after edits. |
| H5 — Augmentation | A2 `augmentSelected`, 1395–1443; A1 `buildPlan`, 718–742 | Model-generated paraphrases or harder instructions are appended as new rows. A2 copies the original target and marks rows `augmented-needs-review`. | Retain source/parent relationships, require renewed review, and keep all variants from the same source family in one split to limit train/evaluation leakage. |
| H6 — Portable training data | A1 `FORMATS`, 856–879; `splitRows`, 892–895; A2 `exportJsonl`, 1369–1382 | Chat, instruction, raw, CSV, soft-label, and preference-shaped formats exist in A1; A2 exports instruction/output or chat JSONL. These are file exports, not hosted training jobs. | Export approved live teaching rows separately from held-out rows, with a dataset card explaining provenance, limits, and filtering. Keep Playground samples in a clearly separate demonstration export. |

## Existing studio strengths to retain

The current studio already offers several stronger controls than the attachments:

- `src/chip-lab.js`, lines 36–66 and 126–177: saved runs, frozen chip/profile
  snapshots, up to three held-out tasks, randomized A/B order, explicit human
  preferences, and checks against using an exact teaching prompt as a fresh task.
- `src/chip-lab.js`, lines 178–219: explicit approval of one to three complete,
  nontruncated examples; a distilled chip starts as an unreviewed draft, preserves
  its parent, and is not automatically equipped.
- `src/app.js`, lines 412–435, 598–623, 1059–1119, and 1167–1195: chips are prompt
  instructions and examples; approval, review, revision, and live-only training
  export are distinct operations.
- `src/superpowers.js`, lines 22–55, 76–95, 154–207, and 226–231: bounded local
  reference retrieval, public draft/review/revision layers, frozen inputs, and
  separately reviewed memory already exist. A new curriculum should reuse these
  semantics rather than introducing an incompatible recursive-learning system.

## Source claims that must not be copied as guarantees

These are source-level findings, not runtime test results:

1. **Near-duplicate control is partly decorative in A1.** A threshold control and
   Jaccard function exist (247, 586–588), but `applyFilters` (609–627) uses only a
   hash of the normalized instruction. The threshold is not called there.
2. **A1's preference ranking is not a quality ranking.** `pairRow` (792–800)
   selects answers by mean token log-probability. `judgeRow` scores only the first
   sample, so it does not establish the quality of every chosen/rejected pair.
   Higher model confidence or word overlap must not be labeled higher quality.
3. **A1's split is biased by construction.** `buildRows` sorts descending by
   score (889–891), then `splitRows` slices that order (892–895). Better-scored
   rows systematically enter training before validation/test. Use an explicit
   split or a seeded family-grouped split independent of score.
4. **A1's time cap has a concrete state mismatch.** `stopCheck` subtracts
   `Run.started` (641), while `startRun` sets that field to boolean `true` and the
   actual timestamp to `Run.startTs` (805). Do not transplant that run engine.
5. **A1's in-flight cancellation is not wired through this path.** `Run.stop`
   aborts a set of controllers (632–633), but no `ctl.add` call exists, and
   `askTeacher` invokes `callChat(body)` without its optional signal (656).
   Adopt the studio's operation-token invalidation and abort mechanisms.
6. **A2's dataset tag is not an export gate.** Augmentations receive a
   `needs-review` tag (1421–1434), but `exportJsonl` maps every example without
   filtering approvals (1369–1382). Export must enforce review in code.
7. **A2's same-prompt student result is not evidence of transfer.** The student
   normally receives the teacher's exact answer (986–991); it may summarize or
   imitate it without learning a reusable method. A fresh prompt without that
   answer is required before claiming a useful transfer result.
8. **A1's routing and soft-label labels require independent verification.**
   `buildProvider`/`buildBody` (484–509) send routing, log-probability, and reasoning
   options. Their availability, price, and meaning depend on current provider
   documentation and actual responses. Top-k token log-probabilities are partial
   distributions, not a universal cross-tokenizer distillation interface.
9. **Keep credentials transient and hidden reasoning excluded.** A2 optionally
   saves a key in localStorage (690–703). A1 stores provider reasoning and can
   concatenate it into exports (661–666, 879–880). The studio's tab-memory key
   policy and public-output-only transcripts should remain authoritative.

## Recommended integration order and acceptance cases

1. **Teaching workshop:** editable curriculum → teacher demonstration → student
   practice → optional rubric feedback. Acceptance: frozen teacher/student model
   IDs and inputs; progress reflects completed calls; cancel blocks later stages;
   partial failures retain completed outputs; changing a prompt invalidates its
   previous approval. Keep all call counts visible before starting.
2. **Reviewed examples and roles:** import a small dataset or collect completed
   workshop outputs. Acceptance: malformed/oversized rows show an actionable
   error; equivalent normalized prompts are flagged; no automatic approval;
   held-out rows never enter chip examples or training exports.
3. **Transfer and evidence:** feed approved teaching rows into an unreviewed chip
   draft, then run the existing frozen blind chip comparison on fresh tasks.
   Acceptance: same base model on both sides; no teacher answer in the held-out
   prompt; human preference stays separate from automated advisory scores.
4. **Useful exports:** reviewed live chat JSONL, separately labeled evaluation
   prompts, optional human-preference pairs, and a short dataset card. Acceptance:
   unreviewed, held-out, failed, truncated, and Playground rows cannot silently
   become live training examples; JSONL round trips without losing provenance.

Fidelity classification: the attachment behavior above is **observed in source**;
runtime/API behavior is **unobserved**. Recommendations are new design choices,
not claims that a particular library or training method has been integrated.
