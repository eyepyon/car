"use client";

/**
 * ナンバープレート認識デモコンポーネント
 *
 * @description
 * カメラキャプチャ → 検証 → API呼び出し → 結果表示の
 * エンドツーエンドフローを確認するためのデモコンポーネント。
 *
 * @see Requirements 1.1, 2.1, 3.1, 3.4
 */

import { useState, useCallback } from "react";
import { CameraCapture } from "./CameraCapture";
import { RecognitionResultDisplay } from "./RecognitionResult";
import { useLicensePlateRecognition } from "@/lib/license-plate";
import type { CapturedImage, CaptureError } from "@/types/license-plate";
import { cn } from "@/lib/utils";

// ============================================================================
// 型定義
// ============================================================================

export interface LicensePlateRecognitionDemoProps {
  /**
   * 追加のCSSクラス
   */
  className?: string;
}

// ============================================================================
// メインコンポーネント
// ============================================================================

/**
 * ナンバープレート認識デモコンポーネント
 *
 * @example
 * ```tsx
 * <LicensePlateRecognitionDemo />
 * ```
 */
export function LicensePlateRecognitionDemo({
  className,
}: LicensePlateRecognitionDemoProps) {
  // 認識モード
  const [mode, setMode] = useState<"single" | "realtime">("single");

  // リアルタイムモードの有効/無効
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  // カメラエラー
  const [cameraError, setCameraError] = useState<CaptureError | null>(null);

  // 認識フック
  const {
    state,
    isLoading,
    result,
    error,
    processingTime,
    recognizeImage,
    reset,
    clearDuplicateHistory,
  } = useLicensePlateRecognition({
    mode,
    onSuccess: (data) => {
      console.log("[Demo] 認識成功:", data);
    },
    onError: (err) => {
      console.error("[Demo] エラー:", err);
    },
    onDuplicate: (data) => {
      console.log("[Demo] 重複認識を抑制:", data.fullText);
    },
  });

  /**
   * 画像キャプチャ時のハンドラ
   */
  const handleCapture = useCallback(
    (image: CapturedImage) => {
      setCameraError(null);
      recognizeImage(image);
    },
    [recognizeImage],
  );

  /**
   * カメラエラー時のハンドラ
   */
  const handleCameraError = useCallback((err: CaptureError) => {
    setCameraError(err);
    console.error("[Demo] カメラエラー:", err);
  }, []);

  /**
   * モード切り替え
   */
  const handleModeChange = useCallback(
    (newMode: "single" | "realtime") => {
      setMode(newMode);
      reset();
      clearDuplicateHistory();
    },
    [reset, clearDuplicateHistory],
  );

  /**
   * リセット
   */
  const handleReset = useCallback(() => {
    reset();
    setCameraError(null);
  }, [reset]);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* ヘッダー */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">
          ナンバープレート認識デモ
        </h1>
        <p className="text-sm text-gray-600">
          カメラでナンバープレートを撮影すると、AIが自動認識します。
        </p>
      </div>

      {/* モード切り替え */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">認識モード:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("single")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              mode === "single"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            シングルショット
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("realtime")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              mode === "realtime"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            リアルタイム
          </button>
        </div>

        {/* リアルタイムモードのトグル */}
        {mode === "realtime" && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={realtimeEnabled}
              onChange={(e) => setRealtimeEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">自動認識</span>
          </label>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* カメラ */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-800">カメラ</h2>
          <CameraCapture
            mode={mode}
            onCapture={handleCapture}
            onError={handleCameraError}
            realtimeEnabled={realtimeEnabled}
          />

          {/* カメラエラー表示 */}
          {cameraError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                {cameraError.message}
              </p>
            </div>
          )}
        </div>

        {/* 認識結果 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">認識結果</h2>
            {(result || error) && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                リセット
              </button>
            )}
          </div>

          <RecognitionResultDisplay
            result={result}
            isLoading={isLoading}
            error={error}
            processingTime={processingTime ?? undefined}
            onRetry={() => {
              reset();
            }}
          />

          {/* 状態表示 */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              デバッグ情報
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-gray-500">状態:</dt>
              <dd className="font-mono text-gray-900">{state}</dd>
              <dt className="text-gray-500">モード:</dt>
              <dd className="font-mono text-gray-900">{mode}</dd>
              <dt className="text-gray-500">処理時間:</dt>
              <dd className="font-mono text-gray-900">
                {processingTime !== null ? `${processingTime}ms` : "-"}
              </dd>
            </dl>
          </div>
        </div>
      </div>

      {/* 使い方 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-700">使い方</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
          <li>
            <strong>シングルショット:</strong>{" "}
            キャプチャボタンをクリックして撮影
          </li>
          <li>
            <strong>リアルタイム:</strong>{" "}
            自動的に500ms間隔で認識（同一ナンバーは5秒間抑制）
          </li>
          <li>
            カメラをナンバープレートに向けて、鮮明に映るようにしてください
          </li>
        </ul>
      </div>
    </div>
  );
}

export default LicensePlateRecognitionDemo;
