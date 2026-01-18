/**
 * ナンバープレート認識APIルート
 *
 * @description
 * POST /api/license-plate/recognize エンドポイントを提供
 * 画像からナンバープレートを認識し、構造化データを返す
 *
 * @see Requirements 3.1, 3.4
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Context } from "hono";
import { rateLimiter, type RateLimitConfig } from "../middleware/rate-limiter";
import {
  QwenVLClient,
  QwenVLError,
  createQwenVLClientFromEnv,
  type QwenVLConfig,
} from "../lib/qwen-vl-client";
import {
  RecognitionLogger,
  recognitionLogger,
} from "../lib/recognition-logger";

// ============================================================================
// 型定義
// ============================================================================

/**
 * ナンバープレートの種類
 */
export type PlateType =
  | "REGULAR" // 普通自動車（白地に緑文字）
  | "LIGHT" // 軽自動車（黄色地に黒文字）
  | "COMMERCIAL" // 事業用（緑地に白文字）
  | "RENTAL" // レンタカー（わ、れナンバー）
  | "DIPLOMATIC"; // 外交官（青地に白文字）

/**
 * 認識エラーコード
 */
export type RecognitionErrorCode =
  | "NO_PLATE_DETECTED"
  | "PARTIAL_RECOGNITION"
  | "API_CONNECTION_FAILED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_IMAGE";

/**
 * ナンバープレート認識結果データ
 */
export interface LicensePlateData {
  region: string;
  classificationNumber: string;
  hiragana: string;
  serialNumber: string;
  fullText: string;
  confidence: number;
  plateType: PlateType;
  recognizedAt: number;
}

/**
 * 認識エラー
 */
export interface RecognitionError {
  code: RecognitionErrorCode;
  message: string;
  suggestion: string;
  partialData?: Partial<LicensePlateData>;
}

/**
 * 認識レスポンス
 */
export interface RecognizeResponse {
  success: boolean;
  data?: LicensePlateData;
  error?: RecognitionError;
  processingTime: number;
}

// ============================================================================
// エラーメッセージ定義
// ============================================================================

export const RECOGNITION_ERROR_MESSAGES: Record<
  RecognitionErrorCode,
  { message: string; suggestion: string }
> = {
  NO_PLATE_DETECTED: {
    message: "ナンバープレートが検出されませんでした",
    suggestion: "カメラをナンバープレートに向けてください",
  },
  PARTIAL_RECOGNITION: {
    message: "部分的な認識のみ成功しました",
    suggestion: "より鮮明な画像で再試行してください",
  },
  API_CONNECTION_FAILED: {
    message: "サービスに接続できません",
    suggestion: "しばらく待ってから再試行してください",
  },
  TIMEOUT: {
    message: "認識処理がタイムアウトしました",
    suggestion: "ネットワーク接続を確認してください",
  },
  RATE_LIMITED: {
    message: "リクエスト数が制限を超えました",
    suggestion: "しばらく待ってから再試行してください",
  },
  INVALID_IMAGE: {
    message: "無効な画像形式です",
    suggestion: "有効な画像ファイルを使用してください",
  },
};

/**
 * RecognitionErrorを作成する
 */
export function createRecognitionError(
  code: RecognitionErrorCode,
  partialData?: Partial<LicensePlateData>,
): RecognitionError {
  const { message, suggestion } = RECOGNITION_ERROR_MESSAGES[code];
  return {
    code,
    message,
    suggestion,
    ...(partialData && { partialData }),
  };
}

// ============================================================================
// バリデーションスキーマ
// ============================================================================

/**
 * 認識リクエストのバリデーションスキーマ
 */
export const recognizeRequestSchema = z.object({
  image: z
    .string()
    .min(1, { message: "画像データは必須です" })
    .refine(
      (val) => {
        // Base64形式のチェック（data:image/...;base64, プレフィックス付きまたはなし）
        const base64Regex =
          /^(?:data:image\/[a-zA-Z+]+;base64,)?[A-Za-z0-9+/]+=*$/;
        return base64Regex.test(val.replace(/\s/g, ""));
      },
      {
        message:
          "無効な画像形式です。Base64エンコードされた画像を送信してください",
      },
    ),
  mode: z.enum(["single", "realtime"], {
    errorMap: () => ({
      message: 'モードは "single" または "realtime" を指定してください',
    }),
  }),
});

export type RecognizeRequest = z.infer<typeof recognizeRequestSchema>;

// ============================================================================
// ルート定義
// ============================================================================

/**
 * ナンバープレート認識APIルーター
 */
export function createLicensePlateRouter(config?: {
  rateLimitConfig?: RateLimitConfig;
  qwenClient?: QwenVLClient;
  logger?: RecognitionLogger;
  useMock?: boolean;
}) {
  const app = new Hono();

  // レート制限ミドルウェアを適用
  const rateLimitConfig: RateLimitConfig = config?.rateLimitConfig ?? {
    maxConcurrent: 100,
    windowMs: 60000, // 1分
    maxRequests: 100,
  };

  // Qwen-VLクライアントの初期化（環境変数から、またはモック使用）
  const useMock = config?.useMock ?? !process.env.DASHSCOPE_API_KEY;
  let qwenClient: QwenVLClient | null = null;

  if (!useMock) {
    try {
      qwenClient = config?.qwenClient ?? createQwenVLClientFromEnv();
    } catch (error) {
      console.warn(
        "[LicensePlate] Qwen-VL client initialization failed, using mock:",
        error,
      );
    }
  }

  // ロガーの初期化
  const logger = config?.logger ?? recognitionLogger;

  app.use("/*", rateLimiter(rateLimitConfig));

  /**
   * POST /recognize
   * ナンバープレート認識エンドポイント
   *
   * @see Requirements 3.1, 3.4
   */
  app.post(
    "/recognize",
    zValidator("json", recognizeRequestSchema, (result, c) => {
      if (!result.success) {
        const errors = result.error.errors.map((e) => e.message).join(", ");
        return c.json<RecognizeResponse>(
          {
            success: false,
            error: {
              code: "INVALID_IMAGE",
              message: errors,
              suggestion: "有効な画像ファイルを使用してください",
            },
            processingTime: 0,
          },
          400,
        );
      }
    }),
    async (c: Context) => {
      const startTime = Date.now();
      const clientIp =
        c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip") ||
        "unknown";

      try {
        const body = await c.req.json<RecognizeRequest>();
        const { image } = body;

        // 画像データの基本検証
        if (!image || image.length === 0) {
          const processingTime = Date.now() - startTime;
          const imageHash = RecognitionLogger.hashImage(image || "");

          logger.logError({
            imageHash,
            processingTime,
            errorCode: "INVALID_IMAGE",
            mode,
            clientIp,
          });

          return c.json<RecognizeResponse>(
            {
              success: false,
              error: createRecognitionError("INVALID_IMAGE"),
              processingTime,
            },
            400,
          );
        }

        const imageHash = RecognitionLogger.hashImage(image);

        // Qwen-VLクライアントが利用可能な場合は実際の認識を実行
        if (qwenClient) {
          try {
            const result = await qwenClient.recognize(image);
            const processingTime = Date.now() - startTime;

            if (result.parsedData) {
              // 認識成功
              logger.logSuccess({
                imageHash,
                processingTime,
                confidence: result.parsedData.confidence,
                mode,
                clientIp,
              });

              return c.json<RecognizeResponse>({
                success: true,
                data: result.parsedData,
                processingTime,
              });
            } else {
              // ナンバープレートが検出されなかった
              logger.logError({
                imageHash,
                processingTime,
                errorCode: "NO_PLATE_DETECTED",
                mode,
                clientIp,
              });

              return c.json<RecognizeResponse>(
                {
                  success: false,
                  error: createRecognitionError("NO_PLATE_DETECTED"),
                  processingTime,
                },
                400,
              );
            }
          } catch (error) {
            const processingTime = Date.now() - startTime;

            // QwenVLErrorの場合はエラーコードをマッピング
            if (error instanceof QwenVLError) {
              const errorCode = mapQwenErrorCode(error.code);

              logger.logError({
                imageHash,
                processingTime,
                errorCode,
                mode,
                clientIp,
                errorMessage: error.message,
              });

              return c.json<RecognizeResponse>(
                {
                  success: false,
                  error: createRecognitionError(errorCode),
                  processingTime,
                },
                errorCode === "TIMEOUT" ? 504 : 500,
              );
            }

            throw error;
          }
        }

        // モック認識結果（Qwen-VLクライアントが利用不可の場合）
        const mockResult: LicensePlateData = {
          region: "品川",
          classificationNumber: "330",
          hiragana: "あ",
          serialNumber: "1234",
          fullText: "品川330あ1234",
          confidence: 98,
          plateType: "REGULAR",
          recognizedAt: Date.now(),
        };

        const processingTime = Date.now() - startTime;

        logger.logSuccess({
          imageHash,
          processingTime,
          confidence: mockResult.confidence,
          mode,
          clientIp,
        });

        return c.json<RecognizeResponse>({
          success: true,
          data: mockResult,
          processingTime,
        });
      } catch (error) {
        const processingTime = Date.now() - startTime;

        // エラーログ記録
        console.error("[LicensePlate] Recognition error:", error);

        logger.logError({
          imageHash: "unknown",
          processingTime,
          errorCode: "API_CONNECTION_FAILED",
          mode: "single",
          clientIp,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });

        return c.json<RecognizeResponse>(
          {
            success: false,
            error: createRecognitionError("API_CONNECTION_FAILED"),
            processingTime,
          },
          500,
        );
      }
    },
  );

  return app;
}

/**
 * QwenVLErrorのコードをRecognitionErrorCodeにマッピングする
 */
function mapQwenErrorCode(
  qwenCode:
    | "API_CONNECTION_FAILED"
    | "TIMEOUT"
    | "INVALID_RESPONSE"
    | "NO_PLATE_DETECTED"
    | "PARSE_ERROR",
): RecognitionErrorCode {
  switch (qwenCode) {
    case "TIMEOUT":
      return "TIMEOUT";
    case "NO_PLATE_DETECTED":
      return "NO_PLATE_DETECTED";
    case "INVALID_RESPONSE":
    case "PARSE_ERROR":
      return "PARTIAL_RECOGNITION";
    case "API_CONNECTION_FAILED":
    default:
      return "API_CONNECTION_FAILED";
  }
}

export default createLicensePlateRouter;
