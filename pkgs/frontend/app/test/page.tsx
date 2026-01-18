"use client";

import { useMemo, useState } from "react";

type ApiOk = { ok: true; jobId: string; summary: string; logs?: string };
type ApiErr = { ok: false; jobId?: string; error: string; logs?: string };
type ApiResp = ApiOk | ApiErr;

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);

  const canSubmit = useMemo(() => !!file && !busy, [file, busy]);

  async function run() {
    if (!file) return;
    setBusy(true);
    setResp(null);

    try {
      const fd = new FormData();
      fd.append("video", file);

      const r = await fetch("/api/molmo-analyze", { method: "POST", body: fd });
      const j = (await r.json()) as ApiResp;
      setResp(j);
    } catch (e: any) {
      setResp({ ok: false, error: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Molmo2-8B 事故動画の安全要約（ローカル）
      </h1>
      <p style={{ marginTop: 0, color: "#444", lineHeight: 1.6 }}>
        動画をアップロードすると、サーバ側でフレーム抽出 → Molmo2-8B 推論 →
        安全制約付き要約を返します。
      </p>

      <section
        style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              動画ファイル（mp4推奨）
            </div>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={run}
            disabled={!canSubmit}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: canSubmit ? "#111" : "#888",
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
              width: 240,
            }}
          >
            {busy ? "解析中…" : "要約を生成"}
          </button>

          <div style={{ color: "#666", fontSize: 13 }}>
            ※大きい動画は時間がかかることがあります。短め（〜20秒）だと安定します。
          </div>
        </div>
      </section>

      {resp && (
        <section style={{ marginTop: 18 }}>
          {resp.ok ? (
            <>
              <h2 style={{ fontSize: 20 }}>出力（Safety Summary）</h2>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#f6f6f6",
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #e5e5e5",
                  lineHeight: 1.6,
                }}
              >
                {resp.summary}
              </pre>

              {resp.logs && (
                <>
                  <h3 style={{ fontSize: 16, marginTop: 12 }}>ログ（末尾）</h3>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#fafafa",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #eee",
                      color: "#555",
                      lineHeight: 1.5,
                    }}
                  >
                    {resp.logs}
                  </pre>
                </>
              )}
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20, color: "#b00020" }}>エラー</h2>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#fff5f5",
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #ffd5d5",
                  color: "#7a0011",
                  lineHeight: 1.6,
                }}
              >
                {resp.error}
              </pre>

              {resp.logs && (
                <>
                  <h3 style={{ fontSize: 16, marginTop: 12 }}>ログ</h3>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#fff7f7",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #ffe3e3",
                      lineHeight: 1.5,
                    }}
                  >
                    {resp.logs}
                  </pre>
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
