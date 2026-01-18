/**
 * Qwen-VL クライアント
 *
 * @description
 * DashScope APIを使用してQwen-VLモデルと通信し、
 * ナンバープレート画像の認識を行うクライアント。
 *
 * @see Requirements 3.1, 3.4, 5.1-5.5, 6.1, 6.2
 */

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
 * Qwen-VL認識結果
 */
export interface QwenRecognitionResult {
  /** AIからの生のテキスト応答 */
  rawText: string;
  /** パースされたナンバープレートデータ（認識成功時） */
  parsedData: LicensePlateData | null;
  /** 認識信頼度（0-100） */
  confidence: number;
  /** 処理時間（ミリ秒） */
  processingTime: number;
}

/**
 * Qwen-VLクライアント設定
 */
export interface QwenVLConfig {
  /** DashScope APIキー */
  apiKey: string;
  /** 使用するモデル */
  model: "qwen-vl-plus" | "qwen-vl-max";
  /** タイムアウト時間（ミリ秒） */
  timeout: number;
  /** 最大リトライ回数 */
  maxRetries: number;
}

/**
 * リトライ設定
 */
export interface RetryConfig {
  /** 最大リトライ回数 */
  maxRetries: number;
  /** 初期遅延（ミリ秒） */
  initialDelay: number;
  /** 最大遅延（ミリ秒） */
  maxDelay: number;
  /** バックオフ乗数 */
  backoffMultiplier: number;
}

/**
 * DashScope APIレスポンス
 */
interface DashScopeResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  request_id?: string;
}

/**
 * Qwen-VLからのパース済み認識結果
 */
interface ParsedQwenResponse {
  detected: boolean;
  region?: string;
  classificationNumber?: string;
  hiragana?: string;
  serialNumber?: string;
  plateType?: string;
  confidence?: number;
}

// ============================================================================
// 定数
// ============================================================================

/**
 * デフォルトのリトライ設定
 * @see Requirements 6.1
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 100, // ms
  maxDelay: 1000, // ms
  backoffMultiplier: 2,
};

/**
 * デフォルトのタイムアウト設定
 * @see Requirements 6.2
 */
export const DEFAULT_TIMEOUT = 5000; // 5秒

/**
 * DashScope APIエンドポイント
 */
const DASHSCOPE_API_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

/**
 * ナンバープレート認識用プロンプト
 */
const RECOGNITION_PROMPT = `
この画像に写っている日本のナンバープレートを認識してください。
以下の形式でJSONを返してください：

{
  "detected": true/false,
  "region": "地名（例：品川）",
  "classificationNumber": "分類番号（例：330）",
  "hiragana": "ひらがな（例：あ）",
  "serialNumber": "一連番号（例：1234）",
  "plateType": "REGULAR/LIGHT/COMMERCIAL/RENTAL/DIPLOMATIC",
  "confidence": 0-100の数値
}

ナンバープレートが検出できない場合は {"detected": false} を返してください。
JSONのみを返し、他のテキストは含めないでください。
`;

// ============================================================================
// エラークラス
// ============================================================================

/**
 * Qwen-VLクライアントエラー
 */
export class QwenVLError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "API_CONNECTION_FAILED"
      | "TIMEOUT"
      | "INVALID_RESPONSE"
      | "NO_PLATE_DETECTED"
      | "PARSE_ERROR",
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "QwenVLError";
  }
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 指定時間待機する
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * タイムアウト付きでPromiseを実行する
 *
 * @param promise - 実行するPromise
 * @param timeoutMs - タイムアウト時間（ミリ秒）
 * @returns Promise結果
 * @throws QwenVLError タイムアウト時
 *
 * @see Requirements 6.2
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new QwenVLError("認識処理がタイムアウトしました", "TIMEOUT", true),
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * 指数バックオフによるリトライを実行する
 *
 * @param fn - 実行する関数
 * @param config - リトライ設定
 * @returns 関数の実行結果
 * @throws 全てのリトライが失敗した場合
 *
 * @see Requirements 6.1
 * @see Property 8: リトライ動作
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // リトライ不可能なエラーの場合は即座に投げる
      if (error instanceof QwenVLError && !error.retryable) {
        throw error;
      }

      // 最後の試行の場合はリトライしない
      if (attempt < config.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  // 全てのリトライが失敗した場合
  if (lastError instanceof QwenVLError) {
    throw lastError;
  }

  throw new QwenVLError(
    lastError?.message || "サービスに接続できません",
    "API_CONNECTION_FAILED",
    false,
  );
}

/**
 * プレートタイプを判定する
 *
 * @param hiragana - ひらがな文字
 * @param rawPlateType - AIが返したプレートタイプ
 * @returns 判定されたプレートタイプ
 *
 * @see Requirements 5.1-5.5
 */
export function determinePlateType(
  hiragana: string,
  rawPlateType?: string,
): PlateType {
  // レンタカー判定（わ、れナンバー）
  if (hiragana === "わ" || hiragana === "れ") {
    return "RENTAL";
  }

  // AIが返したプレートタイプを検証
  const validPlateTypes: PlateType[] = [
    "REGULAR",
    "LIGHT",
    "COMMERCIAL",
    "RENTAL",
    "DIPLOMATIC",
  ];
  if (rawPlateType && validPlateTypes.includes(rawPlateType as PlateType)) {
    return rawPlateType as PlateType;
  }

  // デフォルトは普通自動車
  return "REGULAR";
}

/**
 * Qwen-VLのレスポンスをパースする
 *
 * @param rawText - AIからの生のテキスト応答
 * @returns パースされた認識結果
 */
export function parseQwenResponse(rawText: string): ParsedQwenResponse | null {
  try {
    // JSONを抽出（テキストに余分な文字が含まれている場合に対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedQwenResponse;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * パースされたレスポンスをLicensePlateDataに変換する
 *
 * @param parsed - パースされたQwenレスポンス
 * @returns LicensePlateData または null
 */
export function convertToLicensePlateData(
  parsed: ParsedQwenResponse,
): LicensePlateData | null {
  if (!parsed.detected) {
    return null;
  }

  // 必須フィールドの検証
  if (
    !parsed.region ||
    !parsed.classificationNumber ||
    !parsed.hiragana ||
    !parsed.serialNumber
  ) {
    return null;
  }

  const plateType = determinePlateType(parsed.hiragana, parsed.plateType);
  const confidence = Math.max(0, Math.min(100, parsed.confidence ?? 0));

  return {
    region: parsed.region,
    classificationNumber: parsed.classificationNumber,
    hiragana: parsed.hiragana,
    serialNumber: parsed.serialNumber,
    fullText: `${parsed.region}${parsed.classificationNumber}${parsed.hiragana}${parsed.serialNumber}`,
    confidence,
    plateType,
    recognizedAt: Date.now(),
  };
}

// ============================================================================
// Qwen-VLクライアントクラス
// ============================================================================

/**
 * Qwen-VLクライアント
 *
 * @description
 * DashScope APIを使用してQwen-VLモデルと通信し、
 * ナンバープレート画像の認識を行う。
 *
 * @example
 * ```typescript
 * const client = new QwenVLClient({
 *   apiKey: process.env.DASHSCOPE_API_KEY!,
 *   model: 'qwen-vl-plus',
 *   timeout: 5000,
 *   maxRetries: 3,
 * });
 *
 * const result = await client.recognize(base64Image);
 * if (result.parsedData) {
 *   console.log('認識成功:', result.parsedData.fullText);
 * }
 * ```
 *
 * @see Requirements 3.1, 3.4, 5.1-5.5, 6.1, 6.2
 */
export class QwenVLClient {
  private readonly config: QwenVLConfig;
  private readonly retryConfig: RetryConfig;

  constructor(
    config: QwenVLConfig,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ) {
    this.config = config;
    this.retryConfig = retryConfig;
  }

  /**
   * 画像からナンバープレートを認識する
   *
   * @param image - Base64エンコードされた画像データ
   * @returns 認識結果
   * @throws QwenVLError 認識に失敗した場合
   *
   * @see Requirements 3.1, 3.4
   */
  async recognize(image: string): Promise<QwenRecognitionResult> {
    const startTime = Date.now();

    try {
      const result = await withRetry(
        () => withTimeout(this.callDashScopeAPI(image), this.config.timeout),
        this.retryConfig,
      );

      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (error instanceof QwenVLError) {
        throw error;
      }

      throw new QwenVLError(
        (error as Error).message || "サービスに接続できません",
        "API_CONNECTION_FAILED",
        false,
      );
    }
  }

  /**
   * DashScope APIを呼び出す
   *
   * @param image - Base64エンコードされた画像データ
   * @returns 認識結果（処理時間を除く）
   */
  private async callDashScopeAPI(
    image: string,
  ): Promise<Omit<QwenRecognitionResult, "processingTime">> {
    // 画像データの形式を整える
    const imageUrl = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const requestBody = {
      model: this.config.model,
      input: {
        messages: [
          {
            role: "user",
            content: [
              {
                image: imageUrl,
              },
              {
                text: RECOGNITION_PROMPT,
              },
            ],
          },
        ],
      },
      parameters: {
        result_format: "message",
      },
    };

    let response: Response;
    try {
      response = await fetch(DASHSCOPE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      throw new QwenVLError(
        `API接続エラー: ${(error as Error).message}`,
        "API_CONNECTION_FAILED",
        true,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new QwenVLError(
        `API エラー (${response.status}): ${errorText}`,
        "API_CONNECTION_FAILED",
        response.status >= 500, // 5xxエラーはリトライ可能
      );
    }

    let data: DashScopeResponse;
    try {
      data = (await response.json()) as DashScopeResponse;
    } catch {
      throw new QwenVLError(
        "APIレスポンスのパースに失敗しました",
        "INVALID_RESPONSE",
        false,
      );
    }

    // レスポンスからテキストを抽出
    const rawText =
      data.output?.choices?.[0]?.message?.content?.[0]?.text || "";

    if (!rawText) {
      throw new QwenVLError("AIからの応答が空です", "INVALID_RESPONSE", true);
    }

    // レスポンスをパース
    const parsed = parseQwenResponse(rawText);

    if (!parsed) {
      throw new QwenVLError(
        "AIの応答をパースできませんでした",
        "PARSE_ERROR",
        false,
      );
    }

    // LicensePlateDataに変換
    const parsedData = convertToLicensePlateData(parsed);

    return {
      rawText,
      parsedData,
      confidence: parsedData?.confidence ?? 0,
    };
  }
}

// ============================================================================
// ファクトリ関数
// ============================================================================

/**
 * 環境変数からQwenVLClientを作成する
 *
 * @returns QwenVLClient インスタンス
 * @throws Error 必要な環境変数が設定されていない場合
 */
export function createQwenVLClientFromEnv(): QwenVLClient {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY environment variable is not set");
  }

  const model =
    (process.env.QWEN_MODEL as "qwen-vl-plus" | "qwen-vl-max") ||
    "qwen-vl-plus";
  const timeout = Number(process.env.QWEN_TIMEOUT) || DEFAULT_TIMEOUT;
  const maxRetries =
    Number(process.env.QWEN_MAX_RETRIES) || DEFAULT_RETRY_CONFIG.maxRetries;

  return new QwenVLClient({
    apiKey,
    model,
    timeout,
    maxRetries,
  });
}

export default QwenVLClient;
