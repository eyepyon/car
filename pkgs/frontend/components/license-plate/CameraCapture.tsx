"use client";

/**
 * カメラキャプチャコンポーネント
 *
 * @description
 * USBカメラまたはスマートフォンカメラからナンバープレートの画像をキャプチャするコンポーネント。
 * シングルショットモードとリアルタイムモードをサポート。
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 7.1
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { cn } from "@/lib/utils";
import {
  type CapturedImage,
  type CaptureError,
  type CaptureErrorCode,
  createCaptureError,
  CAPTURE_ERROR_MESSAGES,
} from "@/types/license-plate";

// ============================================================================
// 定数
// ============================================================================

/**
 * 最小解像度要件
 * @see Requirements 1.5
 */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

/**
 * デフォルトのビデオ制約
 */
const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { min: MIN_WIDTH, ideal: 1280 },
  height: { min: MIN_HEIGHT, ideal: 720 },
  facingMode: "environment", // 背面カメラを優先
};

/**
 * リアルタイムモードのキャプチャ間隔（ミリ秒）
 * @see Requirements 7.3
 */
const REALTIME_CAPTURE_INTERVAL = 500;

// ============================================================================
// 型定義
// ============================================================================

/**
 * カメラキャプチャコンポーネントのプロパティ
 */
export interface CameraCaptureProps {
  /**
   * キャプチャモード
   * - single: シングルショットキャプチャ
   * - realtime: リアルタイムキャプチャ
   * @see Requirements 1.4, 7.1
   */
  mode: "single" | "realtime";

  /**
   * 画像キャプチャ成功時のコールバック
   * @see Requirements 1.1
   */
  onCapture: (image: CapturedImage) => void;

  /**
   * エラー発生時のコールバック
   * @see Requirements 1.2, 1.3
   */
  onError: (error: CaptureError) => void;

  /**
   * カメラの準備完了時のコールバック
   */
  onReady?: () => void;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * リアルタイムモードの有効/無効
   * @default true (mode === 'realtime' の場合)
   */
  realtimeEnabled?: boolean;

  /**
   * ミラー表示（フロントカメラ用）
   * @default false
   */
  mirrored?: boolean;
}

/**
 * カメラの状態
 */
type CameraStatus = "initializing" | "ready" | "error" | "permission_denied";

// ============================================================================
// コンポーネント
// ============================================================================

/**
 * カメラキャプチャコンポーネント
 *
 * @example
 * ```tsx
 * <CameraCapture
 *   mode="single"
 *   onCapture={(image) => console.log('Captured:', image)}
 *   onError={(error) => console.error('Error:', error)}
 * />
 * ```
 */
export function CameraCapture({
  mode,
  onCapture,
  onError,
  onReady,
  className,
  realtimeEnabled = true,
  mirrored = false,
}: CameraCaptureProps) {
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [status, setStatus] = useState<CameraStatus>("initializing");
  const [isCapturing, setIsCapturing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // ============================================================================
  // 再試行機能
  // ============================================================================

  /**
   * カメラを再初期化する
   */
  const handleRetry = useCallback(() => {
    setStatus("initializing");
    setRetryKey((prev) => prev + 1);
  }, []);

  // ============================================================================
  // カメラ権限チェック
  // ============================================================================

  /**
   * カメラ権限をチェックする
   * @see Requirements 1.2
   */
  const checkCameraPermission = useCallback(async () => {
    try {
      // navigator.permissions APIが利用可能な場合
      if (navigator.permissions) {
        const result = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (result.state === "denied") {
          setStatus("permission_denied");
          onError(createCaptureError("PERMISSION_DENIED"));
          return false;
        }
      }
      return true;
    } catch {
      // permissions APIが利用できない場合は、getUserMediaで直接確認
      return true;
    }
  }, [onError]);

  // ============================================================================
  // 画像キャプチャ
  // ============================================================================

  /**
   * 画像をキャプチャする
   * @see Requirements 1.1, 1.5
   */
  const captureImage = useCallback((): CapturedImage | null => {
    if (!webcamRef.current) {
      return null;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      return null;
    }

    // Webcamコンポーネントから実際のビデオサイズを取得
    const video = webcamRef.current.video;
    const width = video?.videoWidth ?? MIN_WIDTH;
    const height = video?.videoHeight ?? MIN_HEIGHT;

    // 最小解像度チェック
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      console.warn(`解像度が不足しています: ${width}x${height}`);
    }

    const capturedImage: CapturedImage = {
      base64: imageSrc,
      width,
      height,
      timestamp: Date.now(),
    };

    return capturedImage;
  }, []);

  /**
   * シングルショットキャプチャを実行する
   * @see Requirements 1.1
   */
  const handleSingleCapture = useCallback(() => {
    if (status !== "ready" || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      const image = captureImage();
      if (image) {
        onCapture(image);
      } else {
        onError(createCaptureError("CAPTURE_FAILED"));
      }
    } catch (error) {
      console.error("キャプチャエラー:", error);
      onError(createCaptureError("CAPTURE_FAILED"));
    } finally {
      setIsCapturing(false);
    }
  }, [status, isCapturing, captureImage, onCapture, onError]);

  // ============================================================================
  // リアルタイムモード
  // ============================================================================

  /**
   * リアルタイムキャプチャを開始する
   * @see Requirements 7.1
   */
  const startRealtimeCapture = useCallback(() => {
    if (realtimeIntervalRef.current) {
      return;
    }

    realtimeIntervalRef.current = setInterval(() => {
      const image = captureImage();
      if (image) {
        onCapture(image);
      }
    }, REALTIME_CAPTURE_INTERVAL);
  }, [captureImage, onCapture]);

  /**
   * リアルタイムキャプチャを停止する
   */
  const stopRealtimeCapture = useCallback(() => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
  }, []);

  // ============================================================================
  // Webcamイベントハンドラ
  // ============================================================================

  /**
   * カメラの準備完了時
   */
  const handleUserMedia = useCallback(() => {
    setStatus("ready");
    onReady?.();

    // リアルタイムモードの場合、自動的にキャプチャを開始
    if (mode === "realtime" && realtimeEnabled) {
      startRealtimeCapture();
    }
  }, [mode, realtimeEnabled, onReady, startRealtimeCapture]);

  /**
   * カメラエラー時
   * @see Requirements 1.2, 1.3
   */
  const handleUserMediaError = useCallback(
    (error: string | DOMException) => {
      console.error("カメラエラー:", error);

      let errorCode: CaptureErrorCode = "CAPTURE_FAILED";

      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
          case "PermissionDeniedError":
            errorCode = "PERMISSION_DENIED";
            setStatus("permission_denied");
            break;
          case "NotFoundError":
          case "DevicesNotFoundError":
            errorCode = "DEVICE_NOT_FOUND";
            setStatus("error");
            break;
          default:
            setStatus("error");
        }
      } else {
        setStatus("error");
      }

      onError(createCaptureError(errorCode));
    },
    [onError],
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // 初期化時に権限をチェック
  useEffect(() => {
    checkCameraPermission();
  }, [checkCameraPermission]);

  // リアルタイムモードの切り替え
  useEffect(() => {
    if (mode === "realtime" && realtimeEnabled && status === "ready") {
      startRealtimeCapture();
    } else {
      stopRealtimeCapture();
    }

    return () => {
      stopRealtimeCapture();
    };
  }, [
    mode,
    realtimeEnabled,
    status,
    startRealtimeCapture,
    stopRealtimeCapture,
  ]);

  // ============================================================================
  // レンダリング
  // ============================================================================

  return (
    <div className={cn("relative flex flex-col items-center gap-4", className)}>
      {/* カメラプレビュー */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-gray-900">
        {status === "permission_denied" ? (
          <PermissionDeniedMessage onRetry={handleRetry} />
        ) : status === "error" ? (
          <ErrorMessage
            message={CAPTURE_ERROR_MESSAGES.DEVICE_NOT_FOUND}
            suggestion="USBカメラを接続するか、スマートフォンのカメラを使用してください"
            onRetry={handleRetry}
          />
        ) : (
          <>
            <Webcam
              key={retryKey}
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={DEFAULT_VIDEO_CONSTRAINTS}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              mirrored={mirrored}
              className="w-full"
            />

            {/* ローディングオーバーレイ */}
            {status === "initializing" && <LoadingOverlay />}

            {/* リアルタイムモードインジケーター */}
            {mode === "realtime" && status === "ready" && realtimeEnabled && (
              <RealtimeIndicator />
            )}
          </>
        )}
      </div>

      {/* キャプチャボタン（シングルショットモード） */}
      {mode === "single" && status === "ready" && (
        <CaptureButton onClick={handleSingleCapture} disabled={isCapturing} />
      )}

      {/* リアルタイムモードコントロール */}
      {mode === "realtime" && status === "ready" && (
        <RealtimeControls
          enabled={realtimeEnabled}
          onCapture={handleSingleCapture}
          isCapturing={isCapturing}
        />
      )}
    </div>
  );
}

// ============================================================================
// サブコンポーネント
// ============================================================================

/**
 * 権限拒否メッセージ
 * @see Requirements 1.2
 */
function PermissionDeniedMessage({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl">🔒</div>
      <div className="text-lg font-semibold text-white">
        カメラへのアクセスが許可されていません
      </div>
      <div className="text-sm text-gray-400">
        ナンバープレートを認識するにはカメラへのアクセスが必要です。
        <br />
        ブラウザの設定からカメラへのアクセスを許可してください。
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <p>【設定方法】</p>
        <p>アドレスバー左のカメラアイコンをクリック → 「許可」を選択</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-4 rounded-lg px-4 py-2 text-sm font-medium",
            "bg-blue-600 text-white",
            "hover:bg-blue-700",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
          )}
        >
          再試行
        </button>
      )}
    </div>
  );
}

/**
 * エラーメッセージ
 * @see Requirements 1.3
 */
function ErrorMessage({
  message,
  suggestion,
  onRetry,
}: {
  message: string;
  suggestion?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="text-lg font-semibold text-white">{message}</div>
      <div className="text-sm text-gray-400">
        {suggestion || "カメラが正しく接続されているか確認してください"}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-4 rounded-lg px-4 py-2 text-sm font-medium",
            "bg-blue-600 text-white",
            "hover:bg-blue-700",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
          )}
        >
          再試行
        </button>
      )}
    </div>
  );
}

/**
 * ローディングオーバーレイ
 */
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
        <div className="text-sm text-white">カメラを起動中...</div>
      </div>
    </div>
  );
}

/**
 * リアルタイムモードインジケーター
 */
function RealtimeIndicator() {
  return (
    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1">
      <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
      <span className="text-xs font-medium text-white">リアルタイム</span>
    </div>
  );
}

/**
 * キャプチャボタン
 */
function CaptureButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full",
        "bg-white shadow-lg transition-all",
        "hover:scale-105 hover:bg-gray-100",
        "active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus:outline-none focus:ring-4 focus:ring-blue-500/50",
      )}
      aria-label="写真を撮影"
    >
      <div className="h-12 w-12 rounded-full border-4 border-gray-800" />
    </button>
  );
}

/**
 * リアルタイムモードコントロール
 */
function RealtimeControls({
  enabled,
  onCapture,
  isCapturing,
}: {
  enabled: boolean;
  onCapture: () => void;
  isCapturing: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-gray-600">
        {enabled ? "自動認識中..." : "自動認識停止中"}
      </div>
      <button
        type="button"
        onClick={onCapture}
        disabled={isCapturing}
        className={cn(
          "rounded-lg px-4 py-2 text-sm font-medium",
          "bg-blue-600 text-white",
          "hover:bg-blue-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        )}
      >
        手動キャプチャ
      </button>
    </div>
  );
}

// ============================================================================
// エクスポート
// ============================================================================

export default CameraCapture;
