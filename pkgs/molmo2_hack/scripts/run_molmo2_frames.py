import argparse
from pathlib import Path
from PIL import Image
import torch
from transformers import AutoProcessor, AutoModelForImageTextToText

MODEL_ID = "allenai/Molmo2-8B"

SAFETY_PROMPT = """You are a safety-aware video summarizer.
Do NOT output any personal details, license plates, exact locations, names, timestamps, or any numbers seen on screen.
Do NOT guess demographics or identities.
Describe only abstract events in sequence. If unsure, say "uncertain".

Task: Summarize what happens in this traffic incident video in 5-8 bullet points.
"""

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--frames", type=str, default="frames")
    p.add_argument("--max_frames", type=int, default=12)
    p.add_argument("--max_new_tokens", type=int, default=256)
    args = p.parse_args()

    frame_dir = Path(args.frames)
    frames = sorted(frame_dir.glob("*.jpg"))[: args.max_frames]
    if not frames:
        raise RuntimeError(f"No frames found in: {frame_dir} (expected .jpg)")

    images = [Image.open(fp).convert("RGB") for fp in frames]

    processor = AutoProcessor.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        dtype="auto",
        device_map="auto",
    )
    model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        dtype="auto",
        device_map="auto",
    )

    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": SAFETY_PROMPT},
            *[{"type": "image", "image": img} for img in images],
        ],
    }]

    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
        return_dict=True,
    )
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=args.max_new_tokens)

    gen = out[0, inputs["input_ids"].size(1):]
    text = processor.tokenizer.decode(gen, skip_special_tokens=True)
    print(text)

if __name__ == "__main__":
    main()
