

## scripts/download_sample_video.py

import os
from pathlib import Path
from huggingface_hub import hf_hub_download
from dotenv import load_dotenv

"""
Downloads a sample traffic/accident-ish video from a public HF dataset tar,
then extracts ONE mp4 from it.
This keeps the demo self-contained when users don't have their own videos.
"""

DATASET_ID = "smart-dashcam/motorcycle-accident-driving-datasets"
TAR_NAME = "train.tar"

def main():
    load_dotenv()

    token = os.getenv("HF_TOKEN") or None

    out_dir = Path("videos")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {TAR_NAME} from {DATASET_ID} ...")
    tar_path = hf_hub_download(
        repo_id=DATASET_ID,
        filename=TAR_NAME,
        repo_type="dataset",
        token=token,
    )

    # Copy tar into local folder for convenience
    local_tar = out_dir / TAR_NAME
    if not local_tar.exists():
        local_tar.write_bytes(Path(tar_path).read_bytes())
    print(f"Saved: {local_tar}")

    # Find an mp4 inside tar and extract the first match
    import tarfile

    with tarfile.open(local_tar, "r") as tf:
        members = [m for m in tf.getmembers() if m.name.lower().endswith(".mp4")]
        if not members:
            raise RuntimeError("No .mp4 files found in the tar.")
        # Prefer accident-like names if present
        preferred = None
        for m in members:
            n = m.name.lower()
            if "accident" in n or "crash" in n or "collision" in n:
                preferred = m
                break
        target = preferred or members[0]
        print(f"Extracting sample video: {target.name}")

        tf.extract(target, path=out_dir)

    # Normalize to a stable path: videos/sample.mp4
    extracted_path = out_dir / target.name
    # If it extracted into subfolders, resolve it
    extracted_path = extracted_path.resolve()

    sample_path = out_dir / "sample.mp4"
    sample_path.write_bytes(Path(extracted_path).read_bytes())
    print(f"Ready: {sample_path}")

if __name__ == "__main__":
    main()
