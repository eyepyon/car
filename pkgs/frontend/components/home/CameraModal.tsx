"use client";

/**
 * カメラモーダルコンポーネント
 *
 * @description
 * フルスクリーンモーダルでカメラキャプチャ機能を表示。
 * 既存のCameraCaptureコンポーネントをシングルショットモードで統合。
 *
 * @see Requirements 2.1, 2.2, 2.3, 2.4
 */

import { CameraCapture } from "@/components/license-plate/CameraCapture";
import { RecognitionResultDisplay } from "@/components/license-plate/RecognitionResult";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CapturedImage,
  CaptureError,
  LicensePlateData,
  RecognitionError,
} from "@/types/license-plate";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ============================================================================
// 型定義
// ============================================================================

export interface CameraModalProps {
  /** モーダルの開閉状態 */
  isOpen: boolean;
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /** 認識完了時のコールバック */
  onRecognitionComplete?: (result: LicensePlateData) => void;
}

type ModalState = "camera" | "recognizing" | "result";

// ============================================================================
// コンポーネント
// ============================================================================

/**
 * カメラモーダルコンポーネント
 *
 * @example
 * ```tsx
 * <CameraModal
 *   isOpen={isModalOpen}
 *   onClose={() => setModalOpen(false)}
 *   onRecognitionComplete={(result) => console.log(result)}
 * />
 * ```
 */
export function CameraModal({
  isOpen,
  onClose,
  onRecognitionComplete,
}: CameraModalProps) {
  const [state, setState] = useState<ModalState>("camera");
  const [recognitionResult, setRecognitionResult] =
    useState<LicensePlateData | null>(null);
  const [recognitionError, setRecognitionError] =
    useState<RecognitionError | null>(null);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setState("camera");
      setRecognitionResult(null);
      setRecognitionError(null);
      setCaptureError(null);
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 背景スクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /**
   * 画像キャプチャ時の処理
   */
  const handleCapture = useCallback(
    async (image: CapturedImage) => {
      setState("recognizing");
      setCaptureError(null);
      setRecognitionError(null);

      try {
        // TODO: 実際のAPI呼び出しに置き換える
        // 現在はモック認識結果を返す
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const mockResult: LicensePlateData = {
          region: "品川",
          classificationNumber: "302",
          hiragana: "ほ",
          serialNumber: "3184",
          fullText: "品川302ほ3184",
          confidence: 95,
          plateType: "REGULAR",
          recognizedAt: Date.now(),
        };

        setRecognitionResult(mockResult);
        setState("result");
        onRecognitionComplete?.(mockResult);
      } catch (error) {
        console.error("Recognition error:", error);
        setRecognitionError({
          code: "API_CONNECTION_FAILED",
          message: "サービスに接続できません",
          suggestion: "しばらく待ってから再試行してください",
        });
        setState("result");
      }
    },
    [onRecognitionComplete],
  );

  /**
   * キャプチャエラー時の処理
   */
  const handleCaptureError = useCallback((error: CaptureError) => {
    setCaptureError(error);
  }, []);

  /**
   * 再試行
   */
  const handleRetry = useCallback(() => {
    setState("camera");
    setRecognitionResult(null);
    setRecognitionError(null);
    setCaptureError(null);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn("fixed inset-0 z-50", "flex flex-col", "bg-black")}
      role="dialog"
      aria-modal="true"
      aria-label="カメラモーダル"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <h2 className="text-lg font-semibold text-white">
          ナンバープレート撮影
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex items-center justify-center",
            "w-10 h-10 rounded-full",
            "text-white",
            "hover:bg-white/20",
            "transition-colors duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
          )}
          aria-label="閉じる"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
        {state === "camera" && (
          <div className="w-full max-w-2xl">
            <CameraCapture
              mode="single"
              onCapture={handleCapture}
              onError={handleCaptureError}
            />
            {captureError && (
              <div className="mt-4 p-4 bg-red-900/50 rounded-lg text-white text-center">
                <p>{captureError.message}</p>
              </div>
            )}
          </div>
        )}

        {state === "recognizing" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
            <p className="text-white text-lg">認識中...</p>
          </div>
        )}

        {state === "result" && (
          <div className="w-full max-w-md">
            <RecognitionResultDisplay
              result={recognitionResult}
              isLoading={false}
              error={recognitionError}
              onRetry={handleRetry}
            />
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleRetry}
                className="flex-1 py-6 text-base"
              >
                再撮影
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={onClose}
                className="flex-1 py-6 text-base"
              >
                完了
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraModal;
