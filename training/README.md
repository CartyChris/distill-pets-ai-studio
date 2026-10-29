# Reviewed examples → an optional trainable adapter

The browser creates **context chips**. They change instructions/examples sent to a
hosted model. This separate Python tool can train a real LoRA adapter for a
compatible local/Hugging Face causal language model using reviewed examples.
OpenRouter is an inference gateway; an OpenRouter ID does not grant trainable
weights or a universal fine-tuning API.

1. Practice in live mode or import data you have permission to use.
2. Read and approve each complete example in Teaching Workshop.
3. Reserve different validation prompts. Download the reviewed training bundle.
4. Audit it locally (Python 3.10+, no third-party packages):

   ```sh
   python3 training/audit_bundle.py distill-pets-training-bundle.zip
   python3 training/train_lora.py --bundle distill-pets-training-bundle.zip \
     --model YOUR_TRAINABLE_CHAT_MODEL --output training/output/my-adapter --dry-run
   ```

5. For actual training, create a virtual environment, install
   `training/requirements.txt`, choose a model whose license/access permits your
   use, pin its `--revision` to a commit, and repeat without `--dry-run`.
   Dependencies are a pinned reference stack; select a PyTorch build suitable for
   your compute platform. A small model can run on CPU, with much slower training.
   Release verification performed one real CPU optimizer step on a tiny random
   model built locally, including changed adapter tensors and overwrite rejection.
   No external model was downloaded and no model-quality improvement is claimed.
   Repeat that integration check with `python3 training/smoke_test.py`.

The runner uses the model's own chat template, applies loss only to the final
assistant completion, refuses silently truncated examples, uses deterministic
seeds where supported, disables remote model code and automatic experiment
uploads, and preserves the bundle fingerprint in its training plan. Model and
hardware compatibility still need verification with your selected model.

Training is supervised distillation from outputs, **not logit/KL distillation**:
OpenRouter does not expose every teacher's logits. The optional trainer does not
automatically serve the resulting adapter or replace an OpenRouter model. Host
the trained model with a compatible service before using its resulting model ID.
GPU training belongs in a separate compute job, not in a Vercel request handler.

The ZIP audit verifies file hashes, row provenance, explicit approval/mode flags,
full message roles, repeated prompts and exact normalized training/validation
overlap (including earlier conversation turns). It does not prove factual quality,
rights, identity of the reviewer, or absence of paraphrase leakage. Checksums are
integrity checks, not signatures. Small datasets need fresh, sufficiently broad
evaluation before claiming improvements. Validation prompts have no fabricated
answers and are never used as training labels.

Saved artifacts: `training-plan.json`, epoch checkpoints and `adapter/` after
successful training. Existing nonempty output folders are never overwritten.
Interrupting training preserves completed checkpoints; automatic resumption is
intentionally absent. Current CLI trains SFT only; Chip lab preference exports
remain available for a separately configured preference trainer.
