#!/usr/bin/env python3
"""Explicit offline SFT/LoRA runner. --dry-run audits and plans without ML imports/downloads."""
import argparse
import json
import math
import os
from pathlib import Path
import sys
from audit_bundle import audit_bundle, AuditError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--model", required=True, help="Trainable local or Hugging Face causal model ID, not an OpenRouter ID")
    parser.add_argument("--revision", default="main", help="Pin a model commit for reproducibility")
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=1, choices=range(1, 6))
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--rank", type=int, default=8, choices=[4, 8, 16, 32])
    parser.add_argument("--learning-rate", type=float, default=0.0001)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 128 <= args.max_length <= 8192 or not math.isfinite(args.learning_rate) or not 0 < args.learning_rate <= .01 or not 0 <= args.seed < 2**32:
        parser.error("Use max-length 128–8192, learning-rate (0, .01], and seed 0–2^32-1")
    report, records = audit_bundle(args.bundle)
    plan = {"status": "dry_run" if args.dry_run else "preparing", "audit": report, "model": args.model, "revision": args.revision, "epochs": args.epochs, "maxLength": args.max_length, "loraRank": args.rank, "seed": args.seed, "loss": "final assistant completion only", "truncation": "reject oversized rows", "validation": "prompts remain separate; no fabricated labels", "output": args.output}
    if args.dry_run:
        print(json.dumps(plan, indent=2))
        return 0
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise AuditError("Choose an empty output directory; existing adapters will not be overwritten")
    # Imported only after dry-run; no hosted API calls, telemetry, uploads or key handling.
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    import torch
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer, set_seed
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer
    set_seed(args.seed)
    tokenizer = AutoTokenizer.from_pretrained(args.model, revision=args.revision, trust_remote_code=False)
    if not tokenizer.chat_template:
        raise AuditError("This tokenizer needs a compatible chat template. Choose an instruction/chat model")
    if tokenizer.pad_token is None:
        if tokenizer.eos_token is None:
            raise AuditError("Tokenizer requires a pad or EOS token")
        tokenizer.pad_token = tokenizer.eos_token
    dataset = []
    for index, record in enumerate(records):
        # TRL prompt/completion format masks earlier turns and supervises the final response only.
        tokens = tokenizer.apply_chat_template(record["messages"], tokenize=True, add_generation_prompt=False)
        if len(tokens) > args.max_length:
            raise AuditError(f"Example {index+1} needs {len(tokens)} tokens; raise max-length or curate the example. No silent truncation")
        dataset.append({"prompt": record["messages"][:-1], "completion": record["messages"][-1:]})
    output.mkdir(parents=True, exist_ok=True)
    (output / "training-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    model = AutoModelForCausalLM.from_pretrained(args.model, revision=args.revision, trust_remote_code=False,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float32)
    model.config.use_cache = False
    config = SFTConfig(output_dir=str(output), num_train_epochs=args.epochs,
        max_length=args.max_length, per_device_train_batch_size=1, gradient_accumulation_steps=4,
        learning_rate=args.learning_rate, seed=args.seed, data_seed=args.seed, packing=False,
        completion_only_loss=True, report_to="none", save_strategy="epoch", save_total_limit=2,
        logging_steps=1, bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(), fp16=False)
    trainer = SFTTrainer(model=model, args=config, train_dataset=Dataset.from_list(dataset), processing_class=tokenizer,
        peft_config=LoraConfig(r=args.rank, lora_alpha=2*args.rank, lora_dropout=.05, bias="none", task_type="CAUSAL_LM", target_modules="all-linear"))
    try:
        result = trainer.train()
        trainer.save_model(str(output / "adapter"))
        tokenizer.save_pretrained(str(output / "adapter"))
        plan.update(status="complete", metrics=result.metrics)
    except KeyboardInterrupt:
        plan.update(status="interrupted", note="Only completed checkpoints are recoverable. No complete adapter is claimed.")
        raise
    except Exception:
        plan.update(status="failed", note="Training failed; completed checkpoints and the original dataset remain available.")
        raise
    finally:
        (output / "training-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AuditError, OSError, ImportError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1)
