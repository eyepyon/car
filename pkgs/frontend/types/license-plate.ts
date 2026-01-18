/**
 * ナンバープレート認識機能の型定義
 *
 * @description
 * 日本のナンバープレート認識システムで使用される型定義。
 * 認識結果のデータ構造、エラー型、カメラキャプチャ関連の型を含む。
 *
 * @see Requirements 4.1-4.6
 */

// ============================================================================
// ナンバープレートの種類
// ============================================================================

/**
 * ナンバープレートの種類
 *
 * @description
 * 日本の全ナンバープレート形式に対応
 *
 * @see Requirements 5.1-5.5
 */
export type PlateType =
  | "REGULAR" // 普通自動車（白地に緑文字）
  | "LIGHT" // 軽自動車（黄色地に黒文字）
  | "COMMERCIAL" // 事業用（緑地に白文字）
  | "RENTAL" // レンタカー（わ、れナンバー）
  | "DIPLOMATIC"; // 外交官（青地に白文字）

// ============================================================================
// 認識結果データ構造
// ============================================================================

/**
 * ナンバープレート認識結果データ
 *
 * @description
 * 認識されたナンバープレートの構造化データ。
 * 地名、分類番号、ひらがな、一連番号の各要素と、
 * 完全な文字列、信頼度スコア、プレートタイプを含む。
 *
 * @example
 * ```typescript
 * const data: LicensePlateData = {
 *   region: '品川',
 *   classificationNumber: '330',
 *   hiragana: 'あ',
 *   serialNumber: '1234',
 *   fullText: '品川330あ1234',
 *   confidence: 98,
 *   plateType: 'REGULAR',
 *   recognizedAt: Date.now(),
 * };
 * ```
 *
 * @see Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export interface LicensePlateData {
  /**
   * 地名（例：品川、横浜、名古屋）
   * @see Requirements 4.1
   */
  region: string;

  /**
   * 分類番号（例：300、330、500）
   * @see Requirements 4.2
   */
  classificationNumber: string;

  /**
   * ひらがな（例：あ、か、さ、わ、れ）
   * @see Requirements 4.3
   */
  hiragana: string;

  /**
   * 一連番号（例：1234、・・12）
   * @see Requirements 4.4
   */
  serialNumber: string;

  /**
   * 完全なナンバープレート文字列
   * region + classificationNumber + hiragana + serialNumber の連結
   * @example "品川330あ1234"
   * @see Requirements 4.5
   */
  fullText: string;

  /**
   * 認識信頼度スコア（0-100）
   * @see Requirements 4.6
   */
  confidence: number;

  /**
   * ナンバープレートの種類
   * @see Requirements 5.1-5.5
   */
  plateType: PlateType;

  /**
   * 認識完了時刻（Unix timestamp in milliseconds）
   */
  recognizedAt: number;
}

// ============================================================================
// エラー関連の型定義
// ============================================================================

/**
 * 認識エラーコード
 *
 * @description
 * ナンバープレート認識処理で発生する可能性のあるエラーコード
 *
 * @see Requirements 6.1-6.5
 */
export type RecognitionErrorCode =
  | "NO_PLATE_DETECTED" // ナンバープレートが検出されない
  | "PARTIAL_RECOGNITION" // 部分的な認識のみ成功
  | "API_CONNECTION_FAILED" // AI APIへの接続失敗
  | "TIMEOUT" // 認識処理タイムアウト
  | "RATE_LIMITED" // レート制限超過
  | "INVALID_IMAGE"; // 無効な画像形式

/**
 * 認識エラー
 *
 * @description
 * 認識処理で発生したエラーの詳細情報。
 * エラーコード、メッセージ、推奨アクション、部分的な認識結果を含む。
 *
 * @example
 * ```typescript
 * const error: RecognitionError = {
 *   code: 'NO_PLATE_DETECTED',
 *   message: 'ナンバープレートが検出されませんでした',
 *   suggestion: 'カメラをナンバープレートに向けてください',
 * };
 * ```
 *
 * @see Requirements 6.3, 6.4, 6.5
 */
export interface RecognitionError {
  /**
   * エラーコード
   * @see Requirements 6.3
   */
  code: RecognitionErrorCode;

  /**
   * エラーメッセージ（日本語）
   * @see Requirements 6.3
   */
  message: string;

  /**
   * 推奨アクション（日本語）
   * @see Requirements 6.3
   */
  suggestion: string;

  /**
   * 部分的な認識結果（部分認識成功時のみ）
   * @see Requirements 6.5
   */
  partialData?: Partial<LicensePlateData>;
}

// ============================================================================
// カメラキャプチャ関連の型定義
// ============================================================================

/**
 * キャプチャエラーコード
 *
 * @description
 * カメラキャプチャ処理で発生する可能性のあるエラーコード
 *
 * @see Requirements 1.2, 1.3
 */
export type CaptureErrorCode =
  | "PERMISSION_DENIED" // カメラ権限なし
  | "DEVICE_NOT_FOUND" // カメラデバイスなし
  | "CAPTURE_FAILED"; // キャプチャ失敗

/**
 * キャプチャエラー
 *
 * @description
 * カメラキャプチャ処理で発生したエラーの詳細情報
 *
 * @see Requirements 1.2, 1.3
 */
export interface CaptureError {
  /**
   * エラーコード
   */
  code: CaptureErrorCode;

  /**
   * エラーメッセージ（日本語）
   */
  message: string;
}

/**
 * キャプチャされた画像データ
 *
 * @description
 * カメラからキャプチャされた画像の情報
 *
 * @see Requirements 1.1, 1.5
 */
export interface CapturedImage {
  /**
   * Base64エンコードされた画像データ
   */
  base64: string;

  /**
   * 画像の幅（ピクセル）
   * 最小640ピクセル
   */
  width: number;

  /**
   * 画像の高さ（ピクセル）
   * 最小480ピクセル
   */
  height: number;

  /**
   * キャプチャ時刻（Unix timestamp in milliseconds）
   */
  timestamp: number;
}

// ============================================================================
// 画像検証関連の型定義
// ============================================================================

/**
 * 画像検証エラーコード
 *
 * @description
 * 画像品質検証で検出される問題のコード
 *
 * @see Requirements 2.1-2.4
 */
export type ValidationErrorCode =
  | "BLUR" // ぼやけ
  | "ANGLE" // 角度が急すぎる
  | "LIGHTING_DARK" // 暗すぎる
  | "LIGHTING_BRIGHT" // 明るすぎる
  | "RESOLUTION"; // 解像度不足

/**
 * 画像検証エラー
 *
 * @description
 * 画像品質検証で検出された問題の詳細情報
 *
 * @see Requirements 2.2, 2.3, 2.4
 */
export interface ValidationError {
  /**
   * エラーコード
   */
  code: ValidationErrorCode;

  /**
   * エラーメッセージ（日本語）
   */
  message: string;

  /**
   * 改善のための提案（日本語）
   */
  suggestion: string;
}

/**
 * 画像検証結果
 *
 * @description
 * 画像品質検証の結果。有効性フラグと検出されたエラーのリストを含む。
 *
 * @see Requirements 2.1, 2.5
 */
export interface ValidationResult {
  /**
   * 画像が有効かどうか
   */
  isValid: boolean;

  /**
   * 検出されたエラーのリスト
   */
  errors: ValidationError[];
}

// ============================================================================
// API関連の型定義
// ============================================================================

/**
 * 認識リクエスト
 *
 * @description
 * Recognition APIへのリクエストボディ
 *
 * @see Requirements 3.1
 */
export interface RecognizeRequest {
  /**
   * Base64エンコードされた画像データ
   */
  image: string;

  /**
   * 認識モード
   * - single: シングルショット認識
   * - realtime: リアルタイム認識
   */
  mode: "single" | "realtime";
}

/**
 * 認識レスポンス
 *
 * @description
 * Recognition APIからのレスポンス
 *
 * @see Requirements 3.4
 */
export interface RecognizeResponse {
  /**
   * 認識成功フラグ
   */
  success: boolean;

  /**
   * 認識結果データ（成功時のみ）
   */
  data?: LicensePlateData;

  /**
   * エラー情報（失敗時のみ）
   */
  error?: RecognitionError;

  /**
   * 処理時間（ミリ秒）
   */
  processingTime: number;
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * LicensePlateDataのfullTextを生成する
 *
 * @param data - 部分的なLicensePlateData
 * @returns 連結されたfullText
 *
 * @example
 * ```typescript
 * const fullText = generateFullText({
 *   region: '品川',
 *   classificationNumber: '330',
 *   hiragana: 'あ',
 *   serialNumber: '1234',
 * });
 * // => '品川330あ1234'
 * ```
 */
export function generateFullText(
  data: Pick<
    LicensePlateData,
    "region" | "classificationNumber" | "hiragana" | "serialNumber"
  >,
): string {
  return `${data.region}${data.classificationNumber}${data.hiragana}${data.serialNumber}`;
}

/**
 * LicensePlateDataを作成する
 *
 * @param params - 必須フィールド
 * @returns 完全なLicensePlateData
 *
 * @example
 * ```typescript
 * const data = createLicensePlateData({
 *   region: '品川',
 *   classificationNumber: '330',
 *   hiragana: 'あ',
 *   serialNumber: '1234',
 *   confidence: 98,
 *   plateType: 'REGULAR',
 * });
 * ```
 */
export function createLicensePlateData(
  params: Omit<LicensePlateData, "fullText" | "recognizedAt">,
): LicensePlateData {
  return {
    ...params,
    fullText: generateFullText(params),
    recognizedAt: Date.now(),
  };
}

/**
 * 信頼度スコアが有効な範囲内かチェックする
 *
 * @param confidence - 信頼度スコア
 * @returns 有効な場合true
 */
export function isValidConfidence(confidence: number): boolean {
  return confidence >= 0 && confidence <= 100;
}

/**
 * LicensePlateDataが完全かチェックする
 *
 * @param data - チェック対象のデータ
 * @returns 全フィールドが存在する場合true
 */
export function isCompleteLicensePlateData(
  data: unknown,
): data is LicensePlateData {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.region === "string" &&
    typeof obj.classificationNumber === "string" &&
    typeof obj.hiragana === "string" &&
    typeof obj.serialNumber === "string" &&
    typeof obj.fullText === "string" &&
    typeof obj.confidence === "number" &&
    typeof obj.plateType === "string" &&
    typeof obj.recognizedAt === "number"
  );
}

/**
 * fullTextが各コンポーネントの連結と一致するかチェックする
 *
 * @param data - チェック対象のデータ
 * @returns 一致する場合true
 */
export function isFullTextConsistent(data: LicensePlateData): boolean {
  const expected = generateFullText(data);
  return data.fullText === expected;
}

// ============================================================================
// エラーメッセージ定義
// ============================================================================

/**
 * 認識エラーメッセージのマッピング
 */
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
 * キャプチャエラーメッセージのマッピング
 */
export const CAPTURE_ERROR_MESSAGES: Record<CaptureErrorCode, string> = {
  PERMISSION_DENIED: "カメラへのアクセスが許可されていません",
  DEVICE_NOT_FOUND: "カメラデバイスが見つかりません",
  CAPTURE_FAILED: "画像のキャプチャに失敗しました",
};

/**
 * 画像検証エラーメッセージのマッピング
 */
export const VALIDATION_ERROR_MESSAGES: Record<
  ValidationErrorCode,
  { message: string; suggestion: string }
> = {
  BLUR: {
    message: "画像がぼやけています",
    suggestion: "再撮影してください",
  },
  ANGLE: {
    message: "角度が急すぎます",
    suggestion: "正面から撮影してください",
  },
  LIGHTING_DARK: {
    message: "画像が暗すぎます",
    suggestion: "明るい場所で撮影してください",
  },
  LIGHTING_BRIGHT: {
    message: "画像が明るすぎます",
    suggestion: "直射日光を避けて撮影してください",
  },
  RESOLUTION: {
    message: "解像度が不足しています",
    suggestion: "より近くで撮影してください",
  },
};

/**
 * RecognitionErrorを作成する
 *
 * @param code - エラーコード
 * @param partialData - 部分的な認識結果（オプション）
 * @returns RecognitionError
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

/**
 * CaptureErrorを作成する
 *
 * @param code - エラーコード
 * @returns CaptureError
 */
export function createCaptureError(code: CaptureErrorCode): CaptureError {
  return {
    code,
    message: CAPTURE_ERROR_MESSAGES[code],
  };
}

/**
 * ValidationErrorを作成する
 *
 * @param code - エラーコード
 * @returns ValidationError
 */
export function createValidationError(
  code: ValidationErrorCode,
): ValidationError {
  const { message, suggestion } = VALIDATION_ERROR_MESSAGES[code];
  return {
    code,
    message,
    suggestion,
  };
}
