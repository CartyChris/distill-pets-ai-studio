#!/usr/bin/env python3
"""Optional integration check: create a tiny random model locally and train one LoRA step.

Requires requirements.txt. No model download, hosted inference, or GPU required.
This checks machinery, never model quality.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


def main():
    os.environ.update(HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", TOKENIZERS_PARALLELISM="false")
    import torch
    from tokenizers import Tokenizer
    from tokenizers.models import WordLevel
    from tokenizers.pre_tokenizers import Whitespace
    from transformers import GPT2Config, GPT2LMHeadModel, PreTrainedTokenizerFast
    from safetensors.torch import load_file
    torch.set_num_threads(1)
    with tempfile.TemporaryDirectory(prefix="distill-pets-lora-smoke-") as temp:
        root = Path(temp)
        vocabulary = {word: i for i, word in enumerate(["<unk>", "<pad>", "<eos>", "system", "user", "assistant", "Ada", "lives", "in", "Lisbon", ".", "Who", "?", "Use", "facts", ":"])}
        raw = Tokenizer(WordLevel(vocabulary, unk_token="<unk>"))
        raw.pre_tokenizer = Whitespace()
        tokenizer = PreTrainedTokenizerFast(tokenizer_object=raw, unk_token="<unk>", pad_token="<pad>", eos_token="<eos>")
        tokenizer.chat_template = "{% for message in messages %}{{ message['role'] + ': ' + message['content'] + eos_token }}{% endfor %}{% if add_generation_prompt %}{{ 'assistant: ' }}{% endif %}"
        model_dir = root / "tiny-model"
        tokenizer.save_pretrained(model_dir)
        GPT2LMHeadModel(GPT2Config(vocab_size=len(tokenizer), n_positions=128, n_ctx=128, n_embd=32, n_layer=1, n_head=2, eos_token_id=tokenizer.eos_token_id, pad_token_id=tokenizer.pad_token_id)).save_pretrained(model_dir)
        records = [{"messages": [{"role": "system", "content": "Use facts."}, {"role": "user", "content": "Ada lives in Lisbon. Who lives in Lisbon?"}, {"role": "assistant", "content": "Ada lives in Lisbon."}]}]
        line = json.dumps(records[0], separators=(",", ":")).encode()
        files = {"train.jsonl": line + b"\n", "validation.jsonl": b"", "README.md": b"Local integration fixture, not useful training data.\n"}
        provenance = {"format": "distill-pets-provenance-v1", "rows": [{"index": 0, "approved": True, "demo": False, "truncated": False, "split": "train", "prompts": [records[0]["messages"][1]["content"]], "recordSha256": hashlib.sha256(line).hexdigest()}]}
        files["provenance.json"] = json.dumps(provenance).encode()
        manifest = {"format": "distill-pets-training-bundle-v1", "trainingRows": 1, "validationRows": 0, "files": {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files.items()}}
        files["manifest.json"] = json.dumps(manifest).encode()
        bundle = root / "fixture.zip"
        with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        output = root / "trained"
        command = [sys.executable, str(Path(__file__).with_name("train_lora.py")), "--bundle", str(bundle), "--model", str(model_dir), "--output", str(output), "--max-length", "128"]
        result = subprocess.run(command, capture_output=True, text=True, timeout=120, env={**os.environ, "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"})
        if result.returncode:
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
            return result.returncode
        plan = json.loads((output / "training-plan.json").read_text())
        assert plan["status"] == "complete"
        tensors = load_file(output / "adapter" / "adapter_model.safetensors")
        assert tensors and all(torch.isfinite(t).all() for t in tensors.values())
        assert any(t.abs().sum() > 0 for k, t in tensors.items() if "lora_B" in k), "The adapter must actually update from its zero initial B weights"
        assert plan["metrics"]["train_loss"] > 0
        print(json.dumps({"ok": True, "training": "one real CPU optimizer step on a tiny random local model", "adapterTensors": len(tensors), "trainLoss": plan["metrics"]["train_loss"], "modelQualityEvaluated": False}))
        # It must reject a second run targeting existing artifacts.
        repeat = subprocess.run(command + ["--epochs", "1"], capture_output=True, text=True, timeout=30)
        assert repeat.returncode != 0 and "not be overwritten" in repeat.stderr
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
