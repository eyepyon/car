/**
 * 画像サイズ最適化
 *
 * @description
 * 認識リクエスト用の画像を最適化し、
 * ネットワーク転送を効率化する。
 *
 * @see Requirements 8.3
 * @see Property 10: 画像サイズ最適化
 */

// ============================================================================
// 型定義
// ============================================================================

/**
 * 画像最適化設定
 */
export interface ImageOptimizerConfig {
  /** 最大幅（ピクセル） */
  maxWidth: number;
  /** 最大高さ（ピクセル） */
  maxHeight: number;
  /** JPEG品質（0-100） */
  quality: number;
  /** 最大ファイルサイズ（バイト） */
  maxFileSize: number;
}

/**
 * 最適化結果
 */
export interface OptimizationResult {
  /** 最適化された画像データ（Base64） */
  optimizedData: string;
  /** 元のサイズ（バイト） */
  originalSize: number;
  /** 最適化後のサイズ（バイト） */
  optimizedSize: number;
  /** 圧縮率（0-1） */
  compressionRatio: number;
  /** 最適化が適用されたかどうか */
  wasOptimized: boolean;
}

/**
 * 画像メタデータ
 */
export interface ImageMetadata {
  /** 幅（ピクセル） */
  width: number;
  /** 高さ（ピクセル） */
  height: number;
  /** MIMEタイプ */
  mimeType: string;
  /** サイズ（バイト） */
  size: number;
}

// ============================================================================
// 定数
// ============================================================================

/**
 * デフォルトの最適化設定
 * @see Requirements 8.3
 */
export const DEFAULT_OPTIMIZER_CONFIG: ImageOptimizerConfig = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 85,
  maxFileSize: 1024 * 1024, // 1MB
};

/**
 * ナンバープレート認識用の推奨設定
 * 認識精度を維持しながらサイズを最適化
 */
export const LICENSE_PLATE_OPTIMIZER_CONFIG: ImageOptimizerConfig = {
  maxWidth: 1280,
  maxHeight: 720,
  quality: 80,
  maxFileSize: 512 * 1024, // 512KB
};

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * Base64文字列からバイトサイズを計算する
 *
 * @param base64 - Base64エンコードされた文字列
 * @returns バイトサイズ
 */
export function calculateBase64Size(base64: string): number {
  // data:image/...;base64, プレフィックスを除去
  const base64Data = base64.replace(/^data:image\/[^;]+;base64,/, "");

  // Base64のパディングを考慮してサイズを計算
  const padding = (base64Data.match(/=+$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
}

/**
 * Base64文字列からMIMEタイプを抽出する
 *
 * @param base64 - Base64エンコードされた文字列
 * @returns MIMEタイプ（デフォルト: image/jpeg）
 */
export function extractMimeType(base64: string): string {
  const match = base64.match(/^data:(image\/[^;]+);base64,/);
  return match ? match[1] : "image/jpeg";
}

/**
 * Base64データURLを正規化する
 *
 * @param data - 画像データ（Base64またはデータURL）
 * @returns 正規化されたデータURL
 */
export function normalizeDataUrl(data: string): string {
  if (data.startsWith("data:")) {
    return data;
  }
  return `data:image/jpeg;base64,${data}`;
}

/**
 * データURLからBase64部分を抽出する
 *
 * @param dataUrl - データURL
 * @returns Base64文字列
 */
export function extractBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
}

/**
 * 画像のアスペクト比を維持しながらリサイズ後のサイズを計算する
 *
 * @param width - 元の幅
 * @param height - 元の高さ
 * @param maxWidth - 最大幅
 * @param maxHeight - 最大高さ
 * @returns リサイズ後のサイズ
 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  // 既に制限内の場合はそのまま返す
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // アスペクト比を計算
  const aspectRatio = width / height;

  let newWidth = width;
  let newHeight = height;

  // 幅が制限を超えている場合
  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(newWidth / aspectRatio);
  }

  // 高さが制限を超えている場合
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(newHeight * aspectRatio);
  }

  return {
    width: Math.max(1, newWidth),
    height: Math.max(1, newHeight),
  };
}

/**
 * 画像サイズに基づいて最適な品質を推定する
 *
 * @param currentSize - 現在のサイズ（バイト）
 * @param targetSize - 目標サイズ（バイト）
 * @param currentQuality - 現在の品質（0-100）
 * @returns 推定される最適な品質
 */
export function estimateOptimalQuality(
  currentSize: number,
  targetSize: number,
  currentQuality: number,
): number {
  if (currentSize <= targetSize) {
    return currentQuality;
  }

  // サイズ比率から品質を推定（線形近似）
  const ratio = targetSize / currentSize;
  const estimatedQuality = Math.round(currentQuality * ratio);

  // 品質は10-100の範囲に制限
  return Math.max(10, Math.min(100, estimatedQuality));
}

// ============================================================================
// ImageOptimizerクラス
// ============================================================================

/**
 * 画像最適化クラス
 *
 * @description
 * サーバーサイドで画像の最適化を行う。
 * Node.js環境ではsharpなどのライブラリが必要だが、
 * ここでは基本的なサイズ検証と推定のみを行う。
 *
 * @example
 * ```typescript
 * const optimizer = new ImageOptimizer();
 *
 * // 画像を最適化
 * const result = await optimizer.optimize(imageData);
 * console.log(`圧縮率: ${result.compressionRatio * 100}%`);
 * ```
 *
 * @see Requirements 8.3
 * @see Property 10: 画像サイズ最適化
 */
export class ImageOptimizer {
  private readonly config: ImageOptimizerConfig;

  constructor(config: ImageOptimizerConfig = DEFAULT_OPTIMIZER_CONFIG) {
    this.config = config;
  }

  /**
   * 画像を最適化する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns 最適化結果
   *
   * @description
   * サーバーサイドでの実際の画像処理にはsharpなどのライブラリが必要。
   * この実装では、サイズ検証と基本的な最適化判定を行う。
   */
  async optimize(imageData: string): Promise<OptimizationResult> {
    const normalizedData = normalizeDataUrl(imageData);
    const originalSize = calculateBase64Size(normalizedData);

    // サイズが制限内の場合は最適化不要
    if (originalSize <= this.config.maxFileSize) {
      return {
        optimizedData: normalizedData,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        wasOptimized: false,
      };
    }

    // 実際の画像処理はsharpなどのライブラリで行う
    // ここでは最適化が必要であることを示すのみ
    // 本番環境では以下のような処理を行う:
    // 1. 画像をデコード
    // 2. リサイズ
    // 3. 品質を下げて再エンコード
    // 4. 目標サイズに達するまで繰り返し

    // 簡易実装: 元のデータをそのまま返す（実際の圧縮は行わない）
    // 本番環境ではsharpを使用して実際に圧縮する
    return {
      optimizedData: normalizedData,
      originalSize,
      optimizedSize: originalSize,
      compressionRatio: 1,
      wasOptimized: false,
    };
  }

  /**
   * 画像が最適化が必要かどうかを判定する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns 最適化が必要かどうか
   */
  needsOptimization(imageData: string): boolean {
    const normalizedData = normalizeDataUrl(imageData);
    const size = calculateBase64Size(normalizedData);
    return size > this.config.maxFileSize;
  }

  /**
   * 画像のメタデータを取得する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns 画像メタデータ
   *
   * @description
   * 実際の幅・高さの取得にはデコードが必要。
   * この実装ではサイズとMIMEタイプのみを返す。
   */
  getMetadata(imageData: string): Partial<ImageMetadata> {
    const normalizedData = normalizeDataUrl(imageData);
    return {
      mimeType: extractMimeType(normalizedData),
      size: calculateBase64Size(normalizedData),
    };
  }

  /**
   * 設定を取得する
   *
   * @returns 現在の設定
   */
  getConfig(): ImageOptimizerConfig {
    return { ...this.config };
  }

  /**
   * 最適化後の推定サイズを計算する
   *
   * @param originalSize - 元のサイズ（バイト）
   * @param targetQuality - 目標品質（0-100）
   * @returns 推定サイズ（バイト）
   */
  estimateOptimizedSize(originalSize: number, targetQuality: number): number {
    // 品質と圧縮率の関係を線形近似
    // 実際の圧縮率は画像の内容に依存するため、これは推定値
    const qualityRatio = targetQuality / 100;
    const estimatedRatio = 0.3 + 0.7 * qualityRatio; // 30%〜100%の範囲
    return Math.round(originalSize * estimatedRatio);
  }
}

// ============================================================================
// ファクトリ関数
// ============================================================================

/**
 * ナンバープレート認識用の最適化インスタンスを作成する
 *
 * @returns ImageOptimizer インスタンス
 */
export function createLicensePlateOptimizer(): ImageOptimizer {
  return new ImageOptimizer(LICENSE_PLATE_OPTIMIZER_CONFIG);
}

/**
 * カスタム設定で最適化インスタンスを作成する
 *
 * @param config - 部分的な設定
 * @returns ImageOptimizer インスタンス
 */
export function createOptimizer(
  config: Partial<ImageOptimizerConfig> = {},
): ImageOptimizer {
  return new ImageOptimizer({
    ...DEFAULT_OPTIMIZER_CONFIG,
    ...config,
  });
}

export default ImageOptimizer;
