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
import { useLicensePlateRecognition } from "@/lib/license-plate/use-license-plate-recognition";
import { usePlateWalletCreation } from "@/lib/wallet/use-plate-wallet";
import type {
  CapturedImage,
  CaptureError,
  LicensePlateData,
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
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);

  const {
    state: recognitionState,
    result: recognitionResult,
    error: recognitionError,
    recognizeImage,
    reset: resetRecognition,
  } = useLicensePlateRecognition({
    mode: "single",
    onSuccess: (result) => {
      setState("result");
      onRecognitionComplete?.(result);
    },
    onError: () => {
      setState("result");
    },
  });

  const {
    status: walletStatus,
    owner,
    txHash,
    commitment,
    error: walletError,
    connect,
    createWallet,
  } = usePlateWalletCreation();

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setState("camera");
      setCaptureError(null);
      resetRecognition();
    }
  }, [isOpen, resetRecognition]);

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
      resetRecognition();
      await recognizeImage(image);
    },
    [recognizeImage, resetRecognition],
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
    setCaptureError(null);
    resetRecognition();
  }, [resetRecognition]);

  const handleCreateWallet = useCallback(async () => {
    if (!recognitionResult) {
      return;
    }
    await createWallet(recognitionResult);
  }, [recognitionResult, createWallet]);

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
            <p className="text-white text-lg">
              {recognitionState === "validating"
                ? "画像を検証中..."
                : "認識中..."}
            </p>
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
            {recognitionResult && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-white">
                <p className="text-sm text-white/70">ウォレット作成</p>
                <p className="mt-1 text-base font-semibold">
                  {owner ? "接続済み" : "MetaMaskを接続してください"}
                </p>
                {owner && (
                  <p className="mt-1 text-xs text-white/60 break-all">
                    {owner}
                  </p>
                )}
                {commitment && (
                  <p className="mt-2 text-xs text-white/60 break-all">
                    Commitment: {commitment}
                  </p>
                )}
                {txHash && (
                  <p className="mt-2 text-xs text-white/60 break-all">
                    Tx Hash: {txHash}
                  </p>
                )}
                {walletError && (
                  <p className="mt-2 text-xs text-red-200 break-all">
                    {walletError}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={connect}
                    disabled={walletStatus === "connecting"}
                  >
                    {walletStatus === "connecting"
                      ? "接続中..."
                      : "MetaMaskを接続"}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleCreateWallet}
                    disabled={
                      walletStatus === "proving" ||
                      walletStatus === "submitting"
                    }
                  >
                    {walletStatus === "proving" && "ZK証明を生成中..."}
                    {walletStatus === "submitting" && "送信中..."}
                    {walletStatus === "success" && "作成完了"}
                    {walletStatus === "idle" && "ウォレットを作成"}
                    {walletStatus === "error" && "再試行する"}
                  </Button>
                </div>
              </div>
            )}
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
