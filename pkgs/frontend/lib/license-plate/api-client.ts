/**
 * ナンバープレート認識APIクライアント
 *
 * @description
 * バックエンドのRecognition APIと通信するためのクライアント。
 * フロントエンドコンポーネントから使用される。
 *
 * @see Requirements 3.1
 */

import type {
  LicensePlateData,
  RecognitionError,
  RecognizeRequest,
  RecognizeResponse,
} from "@/types/license-plate";

// ============================================================================
// 定数
// ============================================================================

/**
 * デフォルトのAPIベースURL
 */
const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

/**
 * デフォルトのタイムアウト（ミリ秒）
 */
const DEFAULT_TIMEOUT = 10000;

// ============================================================================
// 型定義
// ============================================================================

/**
 * APIクライアントの設定
 */
export interface LicensePlateApiClientConfig {
  /**
   * APIのベースURL
   * @default process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'
   */
  baseUrl?: string;

  /**
   * リクエストタイムアウト（ミリ秒）
   * @default 10000
   */
  timeout?: number;

  /**
   * 追加のヘッダー
   */
  headers?: Record<string, string>;
}

/**
 * 認識リクエストのオプション
 */
export interface RecognizeOptions {
  /**
   * 認識モード
   */
  mode: "single" | "realtime";

  /**
   * AbortSignal（キャンセル用）
   */
  signal?: AbortSignal;
}

/**
 * APIエラー
 */
export class LicensePlateApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = "LicensePlateApiError";
  }
}

// ============================================================================
// APIクライアントクラス
// ============================================================================

/**
 * ナンバープレート認識APIクライアント
 *
 * @example
 * ```typescript
 * const client = new LicensePlateApiClient({
 *   baseUrl: 'http://localhost:3001',
 * });
 *
 * const result = await client.recognize(imageBase64, { mode: 'single' });
 * if (result.success) {
 *   console.log('認識結果:', result.data);
 * } else {
 *   console.error('エラー:', result.error);
 * }
 * ```
 */
export class LicensePlateApiClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: LicensePlateApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_API_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * ナンバープレートを認識する
   *
   * @param image - Base64エンコードされた画像データ
   * @param options - 認識オプション
   * @returns 認識結果
   *
   * @see Requirements 3.1
   */
  async recognize(
    image: string,
    options: RecognizeOptions,
  ): Promise<RecognizeResponse> {
    const { mode, signal } = options;

    // タイムアウト用のAbortController
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, this.timeout);

    // 外部シグナルとタイムアウトシグナルを組み合わせる
    const combinedSignal = signal
      ? this.combineAbortSignals(signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const requestBody: RecognizeRequest = {
        image,
        mode,
      };

      const response = await fetch(
        `${this.baseUrl}/api/license-plate/recognize`,
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(requestBody),
          signal: combinedSignal,
        },
      );

      clearTimeout(timeoutId);

      const data = (await response.json()) as RecognizeResponse;

      // HTTPエラーの場合でもレスポンスボディにエラー情報が含まれる
      if (!response.ok && !data.error) {
        throw new LicensePlateApiError(
          `HTTP error: ${response.status}`,
          "API_CONNECTION_FAILED",
          response.status,
          "しばらく待ってから再試行してください",
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LicensePlateApiError) {
        throw error;
      }

      // AbortErrorの場合
      if (error instanceof Error && error.name === "AbortError") {
        // 外部シグナルによるキャンセルかタイムアウトかを判定
        if (signal?.aborted) {
          throw new LicensePlateApiError(
            "リクエストがキャンセルされました",
            "REQUEST_CANCELLED",
          );
        }
        throw new LicensePlateApiError(
          "認識処理がタイムアウトしました",
          "TIMEOUT",
          undefined,
          "ネットワーク接続を確認してください",
        );
      }

      // ネットワークエラー
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new LicensePlateApiError(
          "サービスに接続できません",
          "API_CONNECTION_FAILED",
          undefined,
          "ネットワーク接続を確認してください",
        );
      }

      // その他のエラー
      throw new LicensePlateApiError(
        error instanceof Error ? error.message : "Unknown error",
        "API_CONNECTION_FAILED",
        undefined,
        "しばらく待ってから再試行してください",
      );
    }
  }

  /**
   * ヘルスチェック
   *
   * @returns サーバーが正常な場合true
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 複数のAbortSignalを組み合わせる
   */
  private combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }

      signal.addEventListener("abort", () => {
        controller.abort(signal.reason);
      });
    }

    return controller.signal;
  }
}

// ============================================================================
// シングルトンインスタンス
// ============================================================================

let defaultClient: LicensePlateApiClient | null = null;

/**
 * デフォルトのAPIクライアントを取得する
 *
 * @param config - 設定（初回呼び出し時のみ有効）
 * @returns APIクライアント
 */
export function getLicensePlateApiClient(
  config?: LicensePlateApiClientConfig,
): LicensePlateApiClient {
  if (!defaultClient) {
    defaultClient = new LicensePlateApiClient(config);
  }
  return defaultClient;
}

/**
 * デフォルトのAPIクライアントをリセットする（テスト用）
 */
export function resetLicensePlateApiClient(): void {
  defaultClient = null;
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 画像をBase64に変換する
 *
 * @param file - 画像ファイル
 * @returns Base64エンコードされた画像データ
 */
export function imageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Blob/CanvasをBase64に変換する
 *
 * @param blob - Blobデータ
 * @returns Base64エンコードされた画像データ
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read blob as base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read blob"));
    };
    reader.readAsDataURL(blob);
  });
}
