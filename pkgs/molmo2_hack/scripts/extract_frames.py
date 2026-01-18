import argparse
import subprocess
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", type=str, required=True)
    p.add_argument("--out", type=str, default="frames")
    p.add_argument("--fps", type=float, default=2.0)
    p.add_argument("--max_frames", type=int, default=12)
    p.add_argument("--scale", type=int, default=640, help="resize width, keep aspect")
    args = p.parse_args()

    video = Path(args.video)
    if not video.exists():
        raise FileNotFoundError(f"Video not found: {video}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Extract at fps, resize, and cap frames by extracting into numbered files then truncating
    # Requires ffmpeg on PATH.
    # Windows: install via winget/choco or conda-forge.
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video),
        "-vf", f"fps={args.fps},scale={args.scale}:-1",
        str(out_dir / "%04d.jpg"),
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    frames = sorted(out_dir.glob("*.jpg"))
    if not frames:
        raise RuntimeError("No frames extracted. Check ffmpeg install / input video.")

    # Keep only max_frames
    for f in frames[args.max_frames:]:
        f.unlink()

    kept = sorted(out_dir.glob("*.jpg"))
    print(f"Extracted {len(kept)} frames into {out_dir}")

if __name__ == "__main__":
    main()
