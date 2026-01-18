import path from "path";
import os from "os";
import fs from "fs/promises";
import { spawn } from "child_process";

export function envOr(name: string, fallback: string) {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

/**
 * web/ は molmo2_hack/web/ に置かれる想定。
 * scripts は 1つ上の階層（molmo2_hack/scripts）にある。
 */
export const repoRoot = path.resolve(process.cwd(), "..");
export const scriptsDir = path.join(repoRoot, "scripts");

export function makeWorkDir(jobId: string) {
  return path.join(os.tmpdir(), "molmo2_hack", jobId);
}

export async function runCmd(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: { ...process.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));

    const timeout =
      opts?.timeoutMs != null
        ? setTimeout(() => {
            p.kill("SIGKILL");
          }, opts.timeoutMs)
        : null;

    p.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: code ?? -1, stdout, stderr });
    });

    p.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * ffmpegで動画をフレーム抽出（Windowsのdecord系不安定回避のため）
 */
export async function extractFrames(opts: {
  ffmpegBin: string;
  videoPath: string;
  outDir: string;
  fps: number;
  scale: number;
  maxFrames: number;
}) {
  await fs.mkdir(opts.outDir, { recursive: true });

  const pattern = path.join(opts.outDir, "%04d.jpg");
  const args = [
    "-y",
    "-i",
    opts.videoPath,
    "-vf",
    `fps=${opts.fps},scale=${opts.scale}:-1`,
    pattern,
  ];

  const r = await runCmd(opts.ffmpegBin, args, { timeoutMs: 5 * 60 * 1000 });
  if (r.code !== 0) {
    throw new Error(`ffmpeg failed:\n${r.stderr || r.stdout}`);
  }

  // maxFrames 以降を削除
  const files = (await fs.readdir(opts.outDir))
    .filter((f) => f.toLowerCase().endsWith(".jpg"))
    .sort();

  const extra = files.slice(opts.maxFrames);
  await Promise.all(extra.map((f) => fs.unlink(path.join(opts.outDir, f))));
}

/**
 * 最低限の後処理（数字列・URLっぽいものを雑に潰す）
 * ※本格的な匿名化は「映像側のマスク」が推奨
 */
export function postRedact(text: string) {
  let t = text;

  // 数字列（時刻/速度/プレート等）を雑に潰す
  t = t.replace(/\b\d[\d:.\-\/ ]{2,}\b/g, "[REDACTED]");

  // URL
  t = t.replace(/https?:\/\/\S+/g, "[REDACTED]");

  // 空行整理
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}
