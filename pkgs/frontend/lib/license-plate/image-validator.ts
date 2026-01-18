/**
 * 画像検証モジュール
 *
 * @description
 * ナンバープレート認識前の画像品質検証を行う。
 * ぼやけ検出、角度検出、照明検出を実装し、
 * 品質基準を満たさない画像に対して適切なエラーを返す。
 *
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import {
  type CapturedImage,
  type ValidationResult,
  type ValidationError,
  type ValidationErrorCode,
  createValidationError,
} from "@/types/license-plate";

// ============================================================================
// 定数定義
// ============================================================================

/**
 * 画像検証の閾値設定
 */
export const VALIDATION_THRESHOLDS = {
  /** 最小解像度（幅） */
  MIN_WIDTH: 640,
  /** 最小解像度（高さ） */
  MIN_HEIGHT: 480,
  /** ぼやけ検出の閾値（ラプラシアン分散） */
  BLUR_THRESHOLD: 100,
  /** 最大許容角度（度） */
  MAX_ANGLE: 45,
  /** 暗すぎる閾値（平均輝度） */
  DARK_THRESHOLD: 50,
  /** 明るすぎる閾値（平均輝度） */
  BRIGHT_THRESHOLD: 200,
} as const;

// ============================================================================
// 画像解析ユーティリティ
// ============================================================================

/**
 * Base64画像データからImageDataを取得する
 *
 * @param base64 - Base64エンコードされた画像データ
 * @returns ImageDataまたはnull
 */
export async function getImageDataFromBase64(
  base64: string,
): Promise<ImageData | null> {
  return new Promise((resolve) => {
    // ブラウザ環境でない場合はnullを返す
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => resolve(null);

    // Base64データにdata:image/...プレフィックスがない場合は追加
    if (base64.startsWith("data:")) {
      img.src = base64;
    } else {
      img.src = `data:image/jpeg;base64,${base64}`;
    }
  });
}

/**
 * 画像の平均輝度を計算する
 *
 * @param imageData - ImageData
 * @returns 平均輝度（0-255）
 */
export function calculateAverageBrightness(imageData: ImageData): number {
  const data = imageData.data;
  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    // RGB to grayscale using luminosity method
    const brightness =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalBrightness += brightness;
  }

  return totalBrightness / pixelCount;
}

/**
 * ラプラシアン分散を計算してぼやけを検出する
 *
 * @description
 * ラプラシアンフィルタを適用し、その分散を計算する。
 * 分散が小さいほど画像がぼやけている。
 *
 * @param imageData - ImageData
 * @returns ラプラシアン分散値
 */
export function calculateLaplacianVariance(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // グレースケール変換
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // ラプラシアンカーネル
  // [0, 1, 0]
  // [1, -4, 1]
  // [0, 1, 0]
  const laplacian: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const value =
        gray[idx - width] + // 上
        gray[idx - 1] + // 左
        -4 * gray[idx] + // 中央
        gray[idx + 1] + // 右
        gray[idx + width]; // 下
      laplacian.push(value);
    }
  }

  // 分散を計算
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
  const variance =
    laplacian.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    laplacian.length;

  return variance;
}

/**
 * エッジ検出を使用して角度を推定する
 *
 * @description
 * Sobelフィルタを使用してエッジを検出し、
 * 主要なエッジの角度を推定する。
 * ナンバープレートは通常水平なので、
 * 主要なエッジが水平から大きく外れている場合は角度が急すぎると判断。
 *
 * @param imageData - ImageData
 * @returns 推定角度（度）
 */
export function estimateAngle(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // グレースケール変換
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Sobelフィルタでエッジ検出
  const angles: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Sobel X
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] +
        -2 * gray[idx - 1] +
        2 * gray[idx + 1] +
        -gray[idx + width - 1] +
        gray[idx + width + 1];

      // Sobel Y
      const gy =
        -gray[idx - width - 1] +
        -2 * gray[idx - width] +
        -gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1];

      // エッジの強度が一定以上の場合のみ角度を計算
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude > 50) {
        const angle = Math.atan2(gy, gx) * (180 / Math.PI);
        angles.push(Math.abs(angle));
      }
    }
  }

  if (angles.length === 0) {
    return 0;
  }

  // 角度のヒストグラムを作成して最頻値を求める
  const histogram: Record<number, number> = {};
  for (const angle of angles) {
    const bucket = Math.round(angle / 5) * 5; // 5度単位でバケット化
    histogram[bucket] = (histogram[bucket] || 0) + 1;
  }

  // 最頻値を取得
  let maxCount = 0;
  let dominantAngle = 0;
  for (const [angle, count] of Object.entries(histogram)) {
    if (count > maxCount) {
      maxCount = count;
      dominantAngle = Number(angle);
    }
  }

  // 水平（0度または180度）からの偏差を計算
  // 90度に近いほど垂直エッジが多い（正常）
  // 0度や180度に近いほど水平エッジが多い（正常）
  // 45度付近は斜めのエッジが多い（角度が急）
  const deviation = Math.min(
    dominantAngle,
    Math.abs(90 - dominantAngle),
    Math.abs(180 - dominantAngle),
  );

  return deviation;
}

// ============================================================================
// 検証関数
// ============================================================================

/**
 * 解像度を検証する
 *
 * @param image - キャプチャされた画像
 * @returns 検証エラー（問題がない場合はnull）
 */
export function validateResolution(
  image: CapturedImage,
): ValidationError | null {
  if (
    image.width < VALIDATION_THRESHOLDS.MIN_WIDTH ||
    image.height < VALIDATION_THRESHOLDS.MIN_HEIGHT
  ) {
    return createValidationError("RESOLUTION");
  }
  return null;
}

/**
 * ぼやけを検証する
 *
 * @param laplacianVariance - ラプラシアン分散値
 * @returns 検証エラー（問題がない場合はnull）
 */
export function validateBlur(
  laplacianVariance: number,
): ValidationError | null {
  if (laplacianVariance < VALIDATION_THRESHOLDS.BLUR_THRESHOLD) {
    return createValidationError("BLUR");
  }
  return null;
}

/**
 * 角度を検証する
 *
 * @param angle - 推定角度（度）
 * @returns 検証エラー（問題がない場合はnull）
 */
export function validateAngle(angle: number): ValidationError | null {
  if (angle > VALIDATION_THRESHOLDS.MAX_ANGLE) {
    return createValidationError("ANGLE");
  }
  return null;
}

/**
 * 照明を検証する
 *
 * @param brightness - 平均輝度
 * @returns 検証エラー（問題がない場合はnull）
 */
export function validateLighting(brightness: number): ValidationError | null {
  if (brightness < VALIDATION_THRESHOLDS.DARK_THRESHOLD) {
    return createValidationError("LIGHTING_DARK");
  }
  if (brightness > VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD) {
    return createValidationError("LIGHTING_BRIGHT");
  }
  return null;
}

// ============================================================================
// メイン検証関数
// ============================================================================

/**
 * 画像品質メトリクス
 */
export interface ImageQualityMetrics {
  /** ラプラシアン分散（ぼやけ指標） */
  laplacianVariance: number;
  /** 推定角度（度） */
  estimatedAngle: number;
  /** 平均輝度 */
  averageBrightness: number;
}

/**
 * 画像品質メトリクスを計算する
 *
 * @param imageData - ImageData
 * @returns 画像品質メトリクス
 */
export function calculateImageQualityMetrics(
  imageData: ImageData,
): ImageQualityMetrics {
  return {
    laplacianVariance: calculateLaplacianVariance(imageData),
    estimatedAngle: estimateAngle(imageData),
    averageBrightness: calculateAverageBrightness(imageData),
  };
}

/**
 * 画像品質メトリクスから検証結果を生成する
 *
 * @param image - キャプチャされた画像
 * @param metrics - 画像品質メトリクス
 * @returns 検証結果
 */
export function validateImageWithMetrics(
  image: CapturedImage,
  metrics: ImageQualityMetrics,
): ValidationResult {
  const errors: ValidationError[] = [];

  // 解像度チェック
  const resolutionError = validateResolution(image);
  if (resolutionError) {
    errors.push(resolutionError);
  }

  // ぼやけチェック
  const blurError = validateBlur(metrics.laplacianVariance);
  if (blurError) {
    errors.push(blurError);
  }

  // 角度チェック
  const angleError = validateAngle(metrics.estimatedAngle);
  if (angleError) {
    errors.push(angleError);
  }

  // 照明チェック
  const lightingError = validateLighting(metrics.averageBrightness);
  if (lightingError) {
    errors.push(lightingError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 画像を検証する（メイン関数）
 *
 * @description
 * キャプチャされた画像の品質を検証する。
 * ぼやけ、角度、照明の3つの品質チェックを実行し、
 * ValidationResultを返す。
 *
 * @param image - キャプチャされた画像
 * @returns 検証結果
 *
 * @example
 * ```typescript
 * const result = await validateImage(capturedImage);
 * if (!result.isValid) {
 *   console.log('検証エラー:', result.errors);
 * }
 * ```
 *
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
export async function validateImage(
  image: CapturedImage,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // 解像度チェック（ImageDataなしで実行可能）
  const resolutionError = validateResolution(image);
  if (resolutionError) {
    errors.push(resolutionError);
  }

  // ImageDataを取得
  const imageData = await getImageDataFromBase64(image.base64);

  // ImageDataが取得できない場合（サーバーサイドなど）は解像度チェックのみ
  if (!imageData) {
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 画像品質メトリクスを計算
  const metrics = calculateImageQualityMetrics(imageData);

  // ぼやけチェック
  const blurError = validateBlur(metrics.laplacianVariance);
  if (blurError) {
    errors.push(blurError);
  }

  // 角度チェック
  const angleError = validateAngle(metrics.estimatedAngle);
  if (angleError) {
    errors.push(angleError);
  }

  // 照明チェック
  const lightingError = validateLighting(metrics.averageBrightness);
  if (lightingError) {
    errors.push(lightingError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 同期版の画像検証（テスト用）
 *
 * @description
 * ImageDataを直接受け取って検証を行う同期版。
 * 主にテストで使用する。
 *
 * @param image - キャプチャされた画像
 * @param imageData - ImageData（オプション）
 * @returns 検証結果
 */
export function validateImageSync(
  image: CapturedImage,
  imageData?: ImageData,
): ValidationResult {
  const errors: ValidationError[] = [];

  // 解像度チェック
  const resolutionError = validateResolution(image);
  if (resolutionError) {
    errors.push(resolutionError);
  }

  // ImageDataがない場合は解像度チェックのみ
  if (!imageData) {
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 画像品質メトリクスを計算
  const metrics = calculateImageQualityMetrics(imageData);

  // ぼやけチェック
  const blurError = validateBlur(metrics.laplacianVariance);
  if (blurError) {
    errors.push(blurError);
  }

  // 角度チェック
  const angleError = validateAngle(metrics.estimatedAngle);
  if (angleError) {
    errors.push(angleError);
  }

  // 照明チェック
  const lightingError = validateLighting(metrics.averageBrightness);
  if (lightingError) {
    errors.push(lightingError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 検証エラーコードの一覧
 */
export const ALL_VALIDATION_ERROR_CODES: ValidationErrorCode[] = [
  "BLUR",
  "ANGLE",
  "LIGHTING_DARK",
  "LIGHTING_BRIGHT",
  "RESOLUTION",
];

/**
 * 検証エラーコードが有効かチェックする
 *
 * @param code - チェック対象のコード
 * @returns 有効な場合true
 */
export function isValidValidationErrorCode(
  code: string,
): code is ValidationErrorCode {
  return ALL_VALIDATION_ERROR_CODES.includes(code as ValidationErrorCode);
}
