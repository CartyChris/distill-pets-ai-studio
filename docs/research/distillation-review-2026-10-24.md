# Distillation research — 2026-10-24

Scope: browser-first OpenRouter teaching, prompt-context model chips, curated data,
and verifiable student outcomes. This review uses live GitHub metadata and primary
README/trainer documentation. Stars indicate visibility, not demonstrated quality
or an independently verified “trending” rank. Repository benchmark claims were
not reproduced. No trainer package or external script was installed or executed.

## Observed projects

Metadata was read from `https://api.github.com/repos/{owner}/{repo}` on
2026-10-24. Push dates describe repository activity, not release maturity.

| Project | Stars observed | Last pushed UTC | License | Inspected source / useful pattern |
| --- | ---: | --- | --- | --- |
| [Hugging Face TRL](https://github.com/huggingface/trl) | 19,597 | 2026-10-24 08:35 | Apache-2.0 | [GKD trainer](https://github.com/huggingface/trl/blob/1117c3b9c1632ee9814c30f6c9fc884b792a54e5/docs/source/gkd_trainer.md), [DPO trainer](https://github.com/huggingface/trl/blob/1117c3b9c1632ee9814c30f6c9fc884b792a54e5/docs/source/dpo_trainer.md): student-generated attempts, teacher feedback; explicit prompt/chosen/rejected preference records. |
| [DSPy](https://github.com/stanfordnlp/dspy) | 38,773 | 2026-10-23 19:55 | MIT | [README](https://github.com/stanfordnlp/dspy/blob/98830391be6fbf81523757271432bba1c6c4eb80/README.md): modular programs and optimization driven by explicit metrics. |
| [GEPA](https://github.com/gepa-ai/gepa) | 7,130 | 2026-10-22 22:25 | MIT | [README](https://github.com/gepa-ai/gepa/blob/7af5f0c5c79fcc16b2d5248b187d0864683edd4d/README.md): reflection from actual failures; separate train/validation inputs; explicit metric-call budgets. |
| [Distilabel](https://github.com/argilla-io/distilabel) | 3,435 | 2026-10-19 23:11 | Apache-2.0 | [README](https://github.com/argilla-io/distilabel/blob/313fac85b1a2472dd88db1a31c2b754599f46476/README.md): generation, feedback, filtering, and exporting curated datasets as distinct stages. |
| [OpenPipe ART](https://github.com/OpenPipe/ART) | 10,818 | 2026-10-22 16:48 | Apache-2.0 | [README](https://github.com/OpenPipe/ART/blob/5f0c1fbfd1a25bda9b106d50be8a903df34ab466/README.md): complete trajectories, explicit reward ownership, and a separate training server. |
| [Agent Lightning](https://github.com/microsoft/agent-lightning) | 18,801 | 2026-10-20 02:25 | MIT | [README](https://github.com/microsoft/agent-lightning/blob/05c7fe133175653e48c990546a3509e52dc56512/README.md): trace capture is separate from rollout control and weight optimization. |

## What applies to this app

The app already has frozen same-model A/B chip experiments, human preferences,
review notes, bounded review rounds, explicit chip approval, and JSONL exports.
Those are useful foundations. The high-value upgrade is to connect actual student
mistakes and human reviews back into teaching, with a clearer dataset boundary.

1. **Student-led practice.** Freeze a task, student model, teacher model, chip
   context, and rubric. Ask the student to attempt it; ask the teacher to review
   that actual answer; let the student revise using the public feedback. Preserve
   all three artifacts, call statuses, limits, and provenance. This follows the
   useful feedback idea from GKD without claiming a GKD trainer is running.
2. **Train/development/holdout separation.** Reserve evaluation tasks before
   teaching. Reject normalized duplicates across splits and chip examples. A
   prompt used in teacher reflection or chip optimization becomes development
   data; do not keep calling it a pristine final holdout. Exact duplicate checks
   cannot detect every paraphrase, so users still review semantic overlap.
3. **Evidence-based revisions.** Distill a new unreviewed chip from approved
   teaching examples, observed student mistakes, and explicit human feedback.
   Preserve the parent revision. Never equip a revision or call it better merely
   because the teacher prefers its own wording.
4. **Curated preference data.** Offer explicit prompt/chosen/rejected JSONL only
   after a human selects and approves two complete live responses. Exclude ties,
   identical responses, demo data, failed/partial output, and malformed role
   histories. Keep run IDs, model IDs, chip revision, rubric, and the two actual
   generation contexts in a separate manifest. Different system contexts must be
   disclosed; do not silently present them as an identical-context experiment.
5. **Small measurable loops.** Show planned calls and token limits before launch;
   require each next step to recheck cancellation; preserve completed artifacts on
   failure/reload. Human rubric reviews and heldout preferences are observations,
   not statistically established benchmark gains.
6. **Visible stage provenance.** Link the Wilds' teacher/student speech and result
   panels to returned public artifacts. Scenery illustrates progress; it cannot
   establish that training, web retrieval, code execution, or evaluation occurred.

## What does not fit a browser-only model-chip release

TRL GKD uses model access, student sampling and teacher token-distribution losses.
ART and Agent Lightning have distinct training/inference infrastructures and
weight updates. GEPA/DSPy are Python optimization frameworks. Their presence in
this research does not mean those SDKs are embedded in the app. Heavy GPU
training should remain a separate compatible trainer consuming reviewed exports.
OpenRouter completion access alone is not a universal model-training endpoint.
No teacher probabilities, gradients, or hidden provider reasoning should be
invented. A model chip supplies instructions and examples to future requests.

No source code from these repositories was copied into production during this
review. Patterns can be implemented in the app's existing JavaScript stack;
actual future vendoring must retain the relevant license and notices.

## Suggested acceptance cases

- Student review quotes the saved actual attempt, uses the frozen rubric, and
  preserves the original even if revision fails.
- Stop during feedback prevents revision and later curation; reload never
  automatically restarts charged calls.
- Training/development and holdout duplicates are refused after whitespace and
  case normalization; mode boundaries survive save/load and imports.
- A proposed chip stays unreviewed; prior chips and pet equipment stay intact.
- Preference export refuses ties, incomplete records, identical responses, and
  Playground examples; valid conversational records contain an explicit prompt,
  chosen assistant response, and rejected assistant response.
- Every reported quality review points to real returned text and a user decision;
  a deliberately wrong choice or corrupted provenance fails validation.

## Research capture integrity

Primary source documents were saved outside application source for inspection.
SHA-256 of selected captures:

| Capture | SHA-256 |
| --- | --- |
| TRL GKD docs | `e0776c98d13249f2a7f96943f70415b5e55230bdcfaa9717ba2f05768b6ef0f4` |
| TRL DPO docs | `30ada5876faf1a2bf52b9fe4f0928036c1807d32e1b42887842f3df47dd5ec4c` |
| GEPA README | `10d7f30035b21bb38fde51fb3ccc0fc64d5e8b64ab51c09731606132782a57b2` |
| Distilabel README | `f69c2e49527588ee013624892d47237f1995b48fb1b85efc3075ca1ee69c07a8` |
| ART README | `ea7684d222767b85b9392dbf3dff6f9972bed7802aee7352daad33c0cd9d7773` |
| Agent Lightning README | `aabd3c1ff7dbf32f717cc98b6cbcaece27bf13de52f46d46acde9108c8f61edf` |

## Additional recent-discovery search

GitHub repository search was also run with `distillation language:Python
stars:>100 pushed:>=2026-10-01` (24 matches) and `knowledge-distillation
language:Python created:>=2026-01-01 stars:>100` (8 matches), sorted by update time,
first eight results per query. This is a bounded discovery search, not an
exhaustive survey or GitHub Trending capture. Vision/video-only distillation
projects were excluded from app implementation because their training interfaces
do not improve a hosted text-model workflow directly.

| Newly inspected candidate | Observed metadata | Decision |
| --- | --- | --- |
| [KDFlow](https://github.com/songmzhang/KDFlow) | Created 2026-02-27; 254 stars; pushed 2026-10-21; MIT | README lines 69–80 describe SGLang/FSDP2, student-generated rollouts, multi-teacher routing, hidden-state/logit training, and LoRA. Per-example teacher provenance is useful; the training engine requires separate infrastructure. No SDK embedded or training claim made here. |
| [Distilly](https://github.com/titanwings/distilly) | Created 2026-03-30; 25,983 stars; pushed 2026-10-13; MIT | README describes source-grounded, portable Person Profiles packaged as skills. Source-backed workflow cards are relevant to Superpowers; person modeling itself is outside this app upgrade. No profile-extraction or impersonation feature copied. |
| [Tessera](https://github.com/zengxiao-he/tessera) | Created 2026-06-05; 558 stars; pushed 2026-10-09; API license `NOASSERTION` although README displays Apache 2.0 | Demonstrates an integrated training/serving stack with checkpoints, GPU kernels, quantization, and an independent model oracle. No code adopted: wrong runtime boundary and license identification needs closer verification before vendoring. |
| [Lineage Skill](https://github.com/JuneYaooo/lineage-skill) | Created 2026-06-01; 463 stars; pushed 2026-07-23; Apache-2.0 | README describes source-preserving lessons, attempts/errors/revisions, and independent transfer checks. Useful human-readable teaching progression; it is a skill workflow, not model-weight distillation. |

Observed/inferred distinction: the repository capabilities above were observed in
README text, not runtime-tested. Their applicability to a JavaScript teaching
workbench is an engineering inference. Any implemented feature needs its own app
regression evidence and must not be described as a native integration with these
projects.
