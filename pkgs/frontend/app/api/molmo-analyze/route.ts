import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

import {
  envOr,
  repoRoot,
  scriptsDir,
  makeWorkDir,
  runCmd,
  extractFrames,
  postRedact,
} from "@/lib/molmo-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const jobId = crypto.randomBytes(8).toString("hex");

  try {
    const form = await req.formData();
    const file = form.get("video");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "video file is required" },
        { status: 400 },
      );
    }

    const dir = makeWorkDir(jobId);
    const videoDir = path.join(dir, "videos");
    const framesDir = path.join(dir, "frames");
    await fs.mkdir(videoDir, { recursive: true });
    await fs.mkdir(framesDir, { recursive: true });

    // 保存
    const buf = Buffer.from(await file.arrayBuffer());
    const videoPath = path.join(videoDir, "input.mp4");
    await fs.writeFile(videoPath, buf);

    // env
    const PYTHON = envOr("PYTHON_BIN", "python");
    const FFMPEG = envOr("FFMPEG_BIN", "ffmpeg");
    const MAX_FRAMES = Number(envOr("MAX_FRAMES", "12"));
    const FPS = Number(envOr("FPS", "2"));
    const SCALE = Number(envOr("SCALE", "640"));

    // 1) フレーム抽出
    await extractFrames({
      ffmpegBin: FFMPEG,
      videoPath,
      outDir: framesDir,
      fps: FPS,
      scale: SCALE,
      maxFrames: MAX_FRAMES,
    });

    // 2) Molmo2 推論（Python）
    const pyScript = path.join(scriptsDir, "run_molmo2_frames.py");
    const r = await runCmd(
      PYTHON,
      [pyScript, "--frames", framesDir, "--max_frames", String(MAX_FRAMES)],
      { cwd: repoRoot, timeoutMs: 10 * 60 * 1000 },
    );

    const logs = (r.stderr || "").slice(-4000);

    if (r.code !== 0) {
      return NextResponse.json(
        {
          ok: false,
          jobId,
          error: `Molmo2 failed.\n${r.stderr || r.stdout}`,
          logs,
        },
        { status: 500 },
      );
    }

    const summary = postRedact((r.stdout || "").trim());
    return NextResponse.json(
      { ok: true, jobId, summary, logs },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, jobId, error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
