# A little lesson, carefully passed on

The Teaching workshop makes a model’s public work inspectable: a student attempts
a task, a teacher reviews that actual answer, and the student revises. Your review
decides what becomes reusable teaching material. Pets are interfaces; model chips
carry instructions and examples for a chosen base model.

## Take your first teaching walk

1. Try the Playground, or connect OpenRouter and choose both models in Settings.
2. Open Teaching workshop. Write a narrow goal and observable success checks.
3. Select one to three practice tasks. Reserve different validation tasks before starting.
4. Read the call plan, then start. A task uses three calls: attempt, feedback, revision.
   A teacher reference is optional and adds one call per task. A session uses at most twelve calls.
5. Read every returned stage. You can watch the same work in Open World’s Results
   and Team chat. Guidance is queued for the next eligible teacher or student step.
6. Review the revised example and explicitly approve it. Select up to three
   approved examples, name a chip, and request a draft for one additional call.
7. Review its rules in the chip library. Approval creates an immutable revision;
   equipment is your separate choice. Existing chips and outfits are preserved.
8. Select the reviewed chip and send reserved tasks to Chip lab. The same frozen
   learner answers each task with and without the chip. Judge the returned work.

Scenery illustrates activity; returned responses establish the actual work.
Playground stages are prepared samples and are labeled throughout. They do not
search the web, train weights, or establish that a chip improves a real model.

## Keep examples and evaluation apart

Practice prompts, imported conversation user turns, and inherited chip examples
are tracked as development material. Validation prompts are kept out of teacher
practice and chip drafting. The app checks normalized duplicate prompts,
including earlier turns in imported conversations and role-tagged chip examples.
It does not detect every semantic paraphrase; choose substantively fresh tasks.

Sending a test’s results into revision feedback or preference-training material
consumes that test: its role becomes development. The workshop then asks for a
fresh validation task. A bounded exposure ledger survives deleted basket rows
and reloads. At its limit, validation is blocked rather than silently forgetting
old exposures. Export a backup and use a separate workspace for a new project.

## Import and export your data

JSON and JSONL imports accept one to sixty examples, up to 512 KiB. For example:

```json
{"prompt":"Write a welcome using only the supplied facts.","completion":"Welcome! Tell us what you would like to learn first."}
```

Text chat `messages` ending in a user/assistant pair are also supported. Imports
preserve bounded conversation context, begin unreviewed, and use the current
workspace mode. Imported metadata cannot grant approval. Invalid rows reject
the import; duplicate prompts are counted and skipped. Read the context, answer,
source, and reuse permissions yourself before approving supplied data.

- **Training JSONL:** only human-approved, complete live practice rows; preserves
  the supervised task context. Playground, validation, and partial rows are excluded.
- **Validation JSONL:** reserved prompts and rubrics, without invented answers.
- **Session report:** returned artifacts, frozen models/profiles/settings, applied
  guidance, and call counts. This report also works in Playground.
- **Preference ZIP:** Chip lab’s reviewed live chosen/rejected response pairs and
  a separate provenance manifest. Ties, identical answers, samples, missing
  frozen setups, and failed/truncated outputs are excluded.

Chip lab responses were generated with different instruction contexts. The
preference JSONL uses a common baseline task context and records both original
generation contexts in the manifest. Review that difference before using it
with a compatible external trainer; this is not an identical-context DPO run.

## Stop, recover, and understand the limits

Stop prevents subsequent model steps and ignores late results. A provider request
already submitted can still use credits. Reloading never restarts a charged run;
returned work stays in the report. Export browser backups before changing devices
or clearing storage. Keys stay in tab memory and are excluded from exports.

Generation, feedback, chip drafting, and evaluation are explicit bounded actions.
Teacher feedback can be wrong; no automatic score certifies quality. The app does
not request hidden reasoning. OpenRouter text completions do not expose teacher
logits or a universal fine-tuning API. For numeric weight updates, use reviewed
exports with a separate trainer and a model you can train.
