/**
 * ナンバープレート認識APIルート
 *
 * @description
 * POST /api/license-plate/recognize エンドポイントを提供
 * 画像からナンバープレートを認識し、構造化データを返す
 *
 * @see Requirements 3.1, 3.4
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Context } from 'hono';
import { rateLimiter, type RateLimitConfig } from '../middleware/rate-limiter';

// ============================================================================
// 型定義
// ============================================================================

/**
 * ナンバープレートの種類
 */
export type PlateType =
  | 'REGULAR' // 普通自動車（白地に緑文字）
  | 'LIGHT' // 軽自動車（黄色地に黒文字）
  | 'COMMERCIAL' // 事業用（緑地に白文字）
  | 'RENTAL' // レンタカー（わ、れナンバー）
  | 'DIPLOMATIC'; // 外交官（青地に白文字）

/**
 * 認識エラーコード
 */
export type RecognitionErrorCode =
  | 'NO_PLATE_DETECTED'
  | 'PARTIAL_RECOGNITION'
  | 'API_CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_IMAGE';

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
    message: 'ナンバープレートが検出されませんでした',
    suggestion: 'カメラをナンバープレートに向けてください',
  },
  PARTIAL_RECOGNITION: {
    message: '部分的な認識のみ成功しました',
    suggestion: 'より鮮明な画像で再試行してください',
  },
  API_CONNECTION_FAILED: {
    message: 'サービスに接続できません',
    suggestion: 'しばらく待ってから再試行してください',
  },
  TIMEOUT: {
    message: '認識処理がタイムアウトしました',
    suggestion: 'ネットワーク接続を確認してください',
  },
  RATE_LIMITED: {
    message: 'リクエスト数が制限を超えました',
    suggestion: 'しばらく待ってから再試行してください',
  },
  INVALID_IMAGE: {
    message: '無効な画像形式です',
    suggestion: '有効な画像ファイルを使用してください',
  },
};

/**
 * RecognitionErrorを作成する
 */
export function createRecognitionError(
  code: RecognitionErrorCode,
  partialData?: Partial<LicensePlateData>
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
    .min(1, { message: '画像データは必須です' })
    .refine(
      (val) => {
        // Base64形式のチェック（data:image/...;base64, プレフィックス付きまたはなし）
        const base64Regex = /^(?:data:image\/[a-zA-Z+]+;base64,)?[A-Za-z0-9+/]+=*$/;
        return base64Regex.test(val.replace(/\s/g, ''));
      },
      { message: '無効な画像形式です。Base64エンコードされた画像を送信してください' }
    ),
  mode: z.enum(['single', 'realtime'], {
    errorMap: () => ({ message: 'モードは "single" または "realtime" を指定してください' }),
  }),
});

export type RecognizeRequest = z.infer<typeof recognizeRequestSchema>;

// ============================================================================
// ルート定義
// ============================================================================

/**
 * ナンバープレート認識APIルーター
 */
export function createLicensePlateRouter(config?: { rateLimitConfig?: RateLimitConfig }) {
  const app = new Hono();

  // レート制限ミドルウェアを適用
  const rateLimitConfig: RateLimitConfig = config?.rateLimitConfig ?? {
    maxConcurrent: 100,
    windowMs: 60000, // 1分
    maxRequests: 100,
  };

  app.use('/*', rateLimiter(rateLimitConfig));

  /**
   * POST /recognize
   * ナンバープレート認識エンドポイント
   *
   * @see Requirements 3.1, 3.4
   */
  app.post(
    '/recognize',
    zValidator('json', recognizeRequestSchema, (result, c) => {
      if (!result.success) {
        const errors = result.error.errors.map((e) => e.message).join(', ');
        return c.json<RecognizeResponse>(
          {
            success: false,
            error: {
              code: 'INVALID_IMAGE',
              message: errors,
              suggestion: '有効な画像ファイルを使用してください',
            },
            processingTime: 0,
          },
          400
        );
      }
    }),
    async (c: Context) => {
      const startTime = Date.now();

      try {
        const body = await c.req.json<RecognizeRequest>();
        const { image, mode } = body;

        // TODO: タスク6でQwen-VLクライアントを実装後、実際の認識処理を追加
        // 現在はモック実装

        // 画像データの基本検証
        if (!image || image.length === 0) {
          const processingTime = Date.now() - startTime;
          return c.json<RecognizeResponse>(
            {
              success: false,
              error: createRecognitionError('INVALID_IMAGE'),
              processingTime,
            },
            400
          );
        }

        // モック認識結果（タスク6で実際のAI認識に置き換え）
        const mockResult: LicensePlateData = {
          region: '品川',
          classificationNumber: '330',
          hiragana: 'あ',
          serialNumber: '1234',
          fullText: '品川330あ1234',
          confidence: 98,
          plateType: 'REGULAR',
          recognizedAt: Date.now(),
        };

        const processingTime = Date.now() - startTime;

        return c.json<RecognizeResponse>({
          success: true,
          data: mockResult,
          processingTime,
        });
      } catch (error) {
        const processingTime = Date.now() - startTime;

        // エラーログ記録
        console.error('[LicensePlate] Recognition error:', error);

        return c.json<RecognizeResponse>(
          {
            success: false,
            error: createRecognitionError('API_CONNECTION_FAILED'),
            processingTime,
          },
          500
        );
      }
    }
  );

  return app;
}

export default createLicensePlateRouter;
