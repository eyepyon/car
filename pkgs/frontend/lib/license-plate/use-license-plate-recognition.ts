/**
 * ナンバープレート認識カスタムフック
 *
 * @description
 * カメラキャプチャ、画像検証、API呼び出し、重複抑制を統合したカスタムフック。
 * フロントエンドコンポーネントから簡単に認識機能を使用できる。
 *
 * @see Requirements 1.1, 2.1, 3.1, 3.4, 7.4
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type {
  LicensePlateData,
  RecognitionError,
  CapturedImage,
  CaptureError,
} from "@/types/license-plate";
import { validateImage } from "./image-validator";
import {
  LicensePlateApiClient,
  getLicensePlateApiClient,
  LicensePlateApiError,
} from "./api-client";
import { useDuplicateSuppression } from "./use-duplicate-suppression";
import type { DuplicateSuppressionConfig } from "./duplicate-suppression";

// ============================================================================
// 型定義
// ============================================================================

/**
 * 認識状態
 */
export type RecognitionState =
  | "idle" // 待機中
  | "validating" // 画像検証中
  | "recognizing" // 認識中
  | "success" // 成功
  | "error"; // エラー

/**
 * フックの設定
 */
export interface UseLicensePlateRecognitionConfig {
  /**
   * 認識モード
   * @default 'single'
   */
  mode?: "single" | "realtime";

  /**
   * 画像検証をスキップするか
   * @default false
   */
  skipValidation?: boolean;

  /**
   * 重複抑制の設定
   */
  duplicateSuppressionConfig?: DuplicateSuppressionConfig;

  /**
   * APIクライアント（カスタム設定用）
   */
  apiClient?: LicensePlateApiClient;

  /**
   * 認識成功時のコールバック
   */
  onSuccess?: (data: LicensePlateData) => void;

  /**
   * エラー発生時のコールバック
   */
  onError?: (error: RecognitionError | CaptureError) => void;

  /**
   * 重複認識時のコールバック
   */
  onDuplicate?: (data: LicensePlateData) => void;
}

/**
 * フックの戻り値
 */
export interface UseLicensePlateRecognitionReturn {
  /**
   * 現在の認識状態
   */
  state: RecognitionState;

  /**
   * 認識中かどうか
   */
  isLoading: boolean;

  /**
   * 最新の認識結果
   */
  result: LicensePlateData | null;

  /**
   * 最新のエラー
   */
  error: RecognitionError | null;

  /**
   * 処理時間（ミリ秒）
   */
  processingTime: number | null;

  /**
   * 画像をキャプチャして認識する
   */
  recognizeImage: (image: CapturedImage) => Promise<void>;

  /**
   * 状態をリセットする
   */
  reset: () => void;

  /**
   * 認識をキャンセルする
   */
  cancel: () => void;

  /**
   * 重複抑制の履歴をクリアする
   */
  clearDuplicateHistory: () => void;
}

// ============================================================================
// カスタムフック
// ============================================================================

/**
 * ナンバープレート認識カスタムフック
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     state,
 *     isLoading,
 *     result,
 *     error,
 *     recognizeImage,
 *     reset,
 *   } = useLicensePlateRecognition({
 *     mode: 'single',
 *     onSuccess: (data) => console.log('認識成功:', data),
 *     onError: (error) => console.error('エラー:', error),
 *   });
 *
 *   const handleCapture = (image: CapturedImage) => {
 *     recognizeImage(image);
 *   };
 *
 *   return (
 *     <div>
 *       <CameraCapture mode="single" onCapture={handleCapture} onError={console.error} />
 *       <RecognitionResultDisplay result={result} isLoading={isLoading} error={error} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useLicensePlateRecognition(
  config: UseLicensePlateRecognitionConfig = {},
): UseLicensePlateRecognitionReturn {
  const {
    mode = "single",
    skipValidation = false,
    duplicateSuppressionConfig,
    apiClient,
    onSuccess,
    onError,
    onDuplicate,
  } = config;

  // State
  const [state, setState] = useState<RecognitionState>("idle");
  const [result, setResult] = useState<LicensePlateData | null>(null);
  const [error, setError] = useState<RecognitionError | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<LicensePlateApiClient | null>(null);

  // 重複抑制フック
  const { processRecognition, clearHistory } = useDuplicateSuppression(
    duplicateSuppressionConfig,
  );

  // APIクライアントの取得
  const getClient = useCallback((): LicensePlateApiClient => {
    if (apiClient) {
      return apiClient;
    }
    if (!clientRef.current) {
      clientRef.current = getLicensePlateApiClient();
    }
    return clientRef.current;
  }, [apiClient]);

  /**
   * 画像をキャプチャして認識する
   */
  const recognizeImage = useCallback(
    async (image: CapturedImage): Promise<void> => {
      // 前のリクエストをキャンセル
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // 画像検証
        if (!skipValidation) {
          setState("validating");
          const validationResult = await validateImage(image);

          if (!validationResult.isValid) {
            const validationError: RecognitionError = {
              code: "INVALID_IMAGE",
              message: validationResult.errors[0]?.message || "画像が無効です",
              suggestion:
                validationResult.errors[0]?.suggestion ||
                "有効な画像を使用してください",
            };
            setError(validationError);
            setState("error");
            onError?.(validationError);
            return;
          }
        }

        // 認識開始
        setState("recognizing");
        setError(null);

        const client = getClient();
        const response = await client.recognize(image.base64, {
          mode,
          signal: abortController.signal,
        });

        // キャンセルされた場合は何もしない
        if (abortController.signal.aborted) {
          return;
        }

        setProcessingTime(response.processingTime);

        if (response.success && response.data) {
          // リアルタイムモードの場合は重複チェック
          if (mode === "realtime") {
            const duplicateResult = processRecognition(
              response.data,
              (validData) => {
                setResult(validData);
                setState("success");
                onSuccess?.(validData);
              },
            );

            if (duplicateResult.isDuplicate) {
              // 重複の場合は状態を更新しない
              onDuplicate?.(response.data);
              setState("idle");
              return;
            }
          } else {
            // シングルモードの場合はそのまま結果を設定
            setResult(response.data);
            setState("success");
            onSuccess?.(response.data);
          }
        } else if (response.error) {
          setError(response.error);
          setState("error");
          onError?.(response.error);
        }
      } catch (err) {
        // キャンセルされた場合は何もしない
        if (abortController.signal.aborted) {
          return;
        }

        let recognitionError: RecognitionError;

        if (err instanceof LicensePlateApiError) {
          recognitionError = {
            code: err.code as RecognitionError["code"],
            message: err.message,
            suggestion:
              err.suggestion || "しばらく待ってから再試行してください",
          };
        } else {
          recognitionError = {
            code: "API_CONNECTION_FAILED",
            message: err instanceof Error ? err.message : "Unknown error",
            suggestion: "しばらく待ってから再試行してください",
          };
        }

        setError(recognitionError);
        setState("error");
        onError?.(recognitionError);
      }
    },
    [
      mode,
      skipValidation,
      getClient,
      processRecognition,
      onSuccess,
      onError,
      onDuplicate,
    ],
  );

  /**
   * 状態をリセットする
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState("idle");
    setResult(null);
    setError(null);
    setProcessingTime(null);
  }, []);

  /**
   * 認識をキャンセルする
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState("idle");
  }, []);

  /**
   * 重複抑制の履歴をクリアする
   */
  const clearDuplicateHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  return {
    state,
    isLoading: state === "validating" || state === "recognizing",
    result,
    error,
    processingTime,
    recognizeImage,
    reset,
    cancel,
    clearDuplicateHistory,
  };
}

export default useLicensePlateRecognition;
