/**
 * 画像最適化のプロパティテスト
 *
 * @description
 * Property 10: 画像サイズ最適化
 * 任意の認識リクエストに対して、APIに送信される画像サイズは
 * 元の画像サイズ以下であること。
 *
 * **Validates: Requirements 8.3**
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  ImageOptimizer,
  calculateBase64Size,
  extractMimeType,
  normalizeDataUrl,
  extractBase64,
  calculateResizedDimensions,
  estimateOptimalQuality,
  DEFAULT_OPTIMIZER_CONFIG,
  LICENSE_PLATE_OPTIMIZER_CONFIG,
  createLicensePlateOptimizer,
  createOptimizer,
  type ImageOptimizerConfig,
} from "./image-optimizer";

// ============================================================================
// テストデータ生成（Arbitraries）
// ============================================================================

/**
 * Base64文字を生成
 */
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * 有効なBase64文字列を生成
 */
const base64StringArbitrary = (
  minLength = 100,
  maxLength = 1000,
): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...BASE64_CHARS.split("")), { minLength, maxLength })
    .map((chars) => {
      // Base64は4の倍数の長さが必要
      const len = chars.length;
      const paddingNeeded = (4 - (len % 4)) % 4;
      return chars.join("") + "=".repeat(paddingNeeded);
    });

/**
 * 有効なMIMEタイプを生成
 */
const mimeTypeArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom("image/jpeg", "image/png", "image/gif", "image/webp");

/**
 * 有効なデータURLを生成
 */
const dataUrlArbitrary = (
  minLength = 100,
  maxLength = 1000,
): fc.Arbitrary<string> =>
  fc
    .record({
      mimeType: mimeTypeArbitrary(),
      base64: base64StringArbitrary(minLength, maxLength),
    })
    .map(({ mimeType, base64 }) => `data:${mimeType};base64,${base64}`);

/**
 * 有効な画像サイズを生成
 */
const imageDimensionsArbitrary = (): fc.Arbitrary<{
  width: number;
  height: number;
}> =>
  fc.record({
    width: fc.integer({ min: 1, max: 4000 }),
    height: fc.integer({ min: 1, max: 4000 }),
  });

/**
 * 有効な品質値を生成
 */
const qualityArbitrary = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 100 });

/**
 * 有効なファイルサイズを生成
 */
const fileSizeArbitrary = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 10 * 1024 * 1024 }); // 1B - 10MB

/**
 * 有効な最適化設定を生成
 */
const optimizerConfigArbitrary = (): fc.Arbitrary<ImageOptimizerConfig> =>
  fc.record({
    maxWidth: fc.integer({ min: 100, max: 4000 }),
    maxHeight: fc.integer({ min: 100, max: 4000 }),
    quality: qualityArbitrary(),
    maxFileSize: fc.integer({ min: 1024, max: 10 * 1024 * 1024 }),
  });

// ============================================================================
// プロパティテスト
// ============================================================================

describe("Image Optimizer Property Tests", () => {
  let optimizer: ImageOptimizer;

  beforeEach(() => {
    optimizer = new ImageOptimizer();
  });

  /**
   * Property 10: 画像サイズ最適化
   *
   * **Validates: Requirements 8.3**
   */
  describe("Property 10: 画像サイズ最適化", () => {
    it("最適化後の画像サイズは元のサイズ以下である", async () => {
      await fc.assert(
        fc.asyncProperty(dataUrlArbitrary(), async (imageData) => {
          const result = await optimizer.optimize(imageData);

          return result.optimizedSize <= result.originalSize;
        }),
        { numRuns: 100 },
      );
    });

    it("圧縮率は0より大きく1以下である", async () => {
      await fc.assert(
        fc.asyncProperty(dataUrlArbitrary(), async (imageData) => {
          const result = await optimizer.optimize(imageData);

          return result.compressionRatio > 0 && result.compressionRatio <= 1;
        }),
        { numRuns: 100 },
      );
    });

    it("最適化結果は常に有効なデータURLを返す", async () => {
      await fc.assert(
        fc.asyncProperty(dataUrlArbitrary(), async (imageData) => {
          const result = await optimizer.optimize(imageData);

          return (
            result.optimizedData.startsWith("data:image/") &&
            result.optimizedData.includes(";base64,")
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Base64サイズ計算のプロパティテスト
   */
  describe("Base64サイズ計算", () => {
    it("サイズは常に非負の整数である", () => {
      fc.assert(
        fc.property(dataUrlArbitrary(), (dataUrl) => {
          const size = calculateBase64Size(dataUrl);
          return Number.isInteger(size) && size >= 0;
        }),
        { numRuns: 100 },
      );
    });

    it("同じデータは常に同じサイズを返す", () => {
      fc.assert(
        fc.property(dataUrlArbitrary(), (dataUrl) => {
          const size1 = calculateBase64Size(dataUrl);
          const size2 = calculateBase64Size(dataUrl);
          return size1 === size2;
        }),
        { numRuns: 100 },
      );
    });

    it("長いBase64文字列はより大きなサイズを持つ", () => {
      fc.assert(
        fc.property(
          base64StringArbitrary(100, 200),
          base64StringArbitrary(500, 1000),
          (short, long) => {
            const shortUrl = `data:image/jpeg;base64,${short}`;
            const longUrl = `data:image/jpeg;base64,${long}`;

            const shortSize = calculateBase64Size(shortUrl);
            const longSize = calculateBase64Size(longUrl);

            return longSize >= shortSize;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * MIMEタイプ抽出のプロパティテスト
   */
  describe("MIMEタイプ抽出", () => {
    it("有効なデータURLからMIMEタイプを正しく抽出する", () => {
      fc.assert(
        fc.property(
          mimeTypeArbitrary(),
          base64StringArbitrary(),
          (mimeType, base64) => {
            const dataUrl = `data:${mimeType};base64,${base64}`;
            const extracted = extractMimeType(dataUrl);
            return extracted === mimeType;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("無効なデータURLはデフォルトのMIMEタイプを返す", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidData) => {
            // data:で始まらない文字列
            if (invalidData.startsWith("data:")) {
              return true; // スキップ
            }
            const extracted = extractMimeType(invalidData);
            return extracted === "image/jpeg";
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * データURL正規化のプロパティテスト
   */
  describe("データURL正規化", () => {
    it("既にデータURLの場合はそのまま返す", () => {
      fc.assert(
        fc.property(dataUrlArbitrary(), (dataUrl) => {
          const normalized = normalizeDataUrl(dataUrl);
          return normalized === dataUrl;
        }),
        { numRuns: 100 },
      );
    });

    it("Base64文字列はデータURLに変換される", () => {
      fc.assert(
        fc.property(base64StringArbitrary(), (base64) => {
          const normalized = normalizeDataUrl(base64);
          return (
            normalized.startsWith("data:image/jpeg;base64,") &&
            normalized.endsWith(base64)
          );
        }),
        { numRuns: 100 },
      );
    });

    it("正規化後は常にdata:で始まる", () => {
      fc.assert(
        fc.property(
          fc.oneof(dataUrlArbitrary(), base64StringArbitrary()),
          (input) => {
            const normalized = normalizeDataUrl(input);
            return normalized.startsWith("data:");
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * リサイズ計算のプロパティテスト
   */
  describe("リサイズ計算", () => {
    it("リサイズ後のサイズは制限以下である", () => {
      fc.assert(
        fc.property(
          imageDimensionsArbitrary(),
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 2000 }),
          ({ width, height }, maxWidth, maxHeight) => {
            const result = calculateResizedDimensions(
              width,
              height,
              maxWidth,
              maxHeight,
            );
            return result.width <= maxWidth && result.height <= maxHeight;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("制限内のサイズは変更されない", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 500, max: 2000 }),
          fc.integer({ min: 500, max: 2000 }),
          (width, height, maxWidth, maxHeight) => {
            const result = calculateResizedDimensions(
              width,
              height,
              maxWidth,
              maxHeight,
            );
            return result.width === width && result.height === height;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("リサイズ後のサイズは常に正の整数である", () => {
      fc.assert(
        fc.property(
          imageDimensionsArbitrary(),
          fc.integer({ min: 1, max: 2000 }),
          fc.integer({ min: 1, max: 2000 }),
          ({ width, height }, maxWidth, maxHeight) => {
            const result = calculateResizedDimensions(
              width,
              height,
              maxWidth,
              maxHeight,
            );
            return (
              Number.isInteger(result.width) &&
              Number.isInteger(result.height) &&
              result.width >= 1 &&
              result.height >= 1
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("アスペクト比は概ね維持される", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 200, max: 2000 }),
          fc.integer({ min: 200, max: 2000 }),
          (width, height, maxWidth, maxHeight) => {
            // 極端なアスペクト比を避けるため、比率を制限
            if (width / height > 10 || height / width > 10) {
              return true; // スキップ
            }

            const originalRatio = width / height;
            const result = calculateResizedDimensions(
              width,
              height,
              maxWidth,
              maxHeight,
            );
            const newRatio = result.width / result.height;

            // アスペクト比の差が15%以内であることを確認（丸め誤差を考慮）
            const ratioDiff =
              Math.abs(originalRatio - newRatio) / originalRatio;
            return ratioDiff < 0.15;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * 品質推定のプロパティテスト
   */
  describe("品質推定", () => {
    it("推定品質は10-100の範囲内である", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000000 }), // より現実的なファイルサイズ
          fc.integer({ min: 100, max: 10000000 }), // より現実的な目標サイズ
          fc.integer({ min: 10, max: 100 }), // 有効な品質範囲
          (currentSize, targetSize, currentQuality) => {
            const estimated = estimateOptimalQuality(
              currentSize,
              targetSize,
              currentQuality,
            );
            return estimated >= 10 && estimated <= 100;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("目標サイズが現在サイズ以上の場合、品質は変わらない", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          qualityArbitrary(),
          (currentSize, currentQuality) => {
            const targetSize = currentSize + 1000; // 目標サイズを大きく
            const estimated = estimateOptimalQuality(
              currentSize,
              targetSize,
              currentQuality,
            );
            return estimated === currentQuality;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * 最適化判定のプロパティテスト
   */
  describe("最適化判定", () => {
    it("最大ファイルサイズを超える画像は最適化が必要と判定される", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1024, max: 100000 }), (maxFileSize) => {
          const testOptimizer = new ImageOptimizer({
            ...DEFAULT_OPTIMIZER_CONFIG,
            maxFileSize,
          });

          // 最大サイズより大きいBase64を生成
          const largeBase64Length = Math.ceil((maxFileSize * 4) / 3) + 100;
          const largeBase64 = "A".repeat(largeBase64Length);
          const largeDataUrl = `data:image/jpeg;base64,${largeBase64}`;

          return testOptimizer.needsOptimization(largeDataUrl);
        }),
        { numRuns: 50 },
      );
    });

    it("最大ファイルサイズ以下の画像は最適化不要と判定される", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100000, max: 1000000 }),
          (maxFileSize) => {
            const testOptimizer = new ImageOptimizer({
              ...DEFAULT_OPTIMIZER_CONFIG,
              maxFileSize,
            });

            // 最大サイズより小さいBase64を生成
            const smallBase64Length = Math.floor((maxFileSize * 3) / 4) - 1000;
            const smallBase64 = "A".repeat(Math.max(100, smallBase64Length));
            const smallDataUrl = `data:image/jpeg;base64,${smallBase64}`;

            return !testOptimizer.needsOptimization(smallDataUrl);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * 設定のプロパティテスト
   */
  describe("設定", () => {
    it("設定は正しく保持される", () => {
      fc.assert(
        fc.property(optimizerConfigArbitrary(), (config) => {
          const testOptimizer = new ImageOptimizer(config);
          const retrievedConfig = testOptimizer.getConfig();

          return (
            retrievedConfig.maxWidth === config.maxWidth &&
            retrievedConfig.maxHeight === config.maxHeight &&
            retrievedConfig.quality === config.quality &&
            retrievedConfig.maxFileSize === config.maxFileSize
          );
        }),
        { numRuns: 100 },
      );
    });

    it("デフォルト設定は有効な値を持つ", () => {
      expect(DEFAULT_OPTIMIZER_CONFIG.maxWidth).toBeGreaterThan(0);
      expect(DEFAULT_OPTIMIZER_CONFIG.maxHeight).toBeGreaterThan(0);
      expect(DEFAULT_OPTIMIZER_CONFIG.quality).toBeGreaterThan(0);
      expect(DEFAULT_OPTIMIZER_CONFIG.quality).toBeLessThanOrEqual(100);
      expect(DEFAULT_OPTIMIZER_CONFIG.maxFileSize).toBeGreaterThan(0);
    });

    it("ナンバープレート用設定は有効な値を持つ", () => {
      expect(LICENSE_PLATE_OPTIMIZER_CONFIG.maxWidth).toBeGreaterThan(0);
      expect(LICENSE_PLATE_OPTIMIZER_CONFIG.maxHeight).toBeGreaterThan(0);
      expect(LICENSE_PLATE_OPTIMIZER_CONFIG.quality).toBeGreaterThan(0);
      expect(LICENSE_PLATE_OPTIMIZER_CONFIG.quality).toBeLessThanOrEqual(100);
      expect(LICENSE_PLATE_OPTIMIZER_CONFIG.maxFileSize).toBeGreaterThan(0);
    });
  });

  /**
   * ファクトリ関数のプロパティテスト
   */
  describe("ファクトリ関数", () => {
    it("createLicensePlateOptimizerは正しい設定を持つ", () => {
      const lpOptimizer = createLicensePlateOptimizer();
      const config = lpOptimizer.getConfig();

      expect(config).toEqual(LICENSE_PLATE_OPTIMIZER_CONFIG);
    });

    it("createOptimizerはカスタム設定をマージする", () => {
      fc.assert(
        fc.property(
          fc.record({
            maxWidth: fc.integer({ min: 100, max: 4000 }),
            quality: qualityArbitrary(),
          }),
          (partialConfig) => {
            const customOptimizer = createOptimizer({
              maxWidth: partialConfig.maxWidth,
              quality: partialConfig.quality,
            });
            const config = customOptimizer.getConfig();

            return (
              config.maxWidth === partialConfig.maxWidth &&
              config.quality === partialConfig.quality &&
              config.maxHeight === DEFAULT_OPTIMIZER_CONFIG.maxHeight &&
              config.maxFileSize === DEFAULT_OPTIMIZER_CONFIG.maxFileSize
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * サイズ推定のプロパティテスト
   */
  describe("サイズ推定", () => {
    it("推定サイズは常に非負の整数である", () => {
      fc.assert(
        fc.property(
          fileSizeArbitrary(),
          qualityArbitrary(),
          (originalSize, quality) => {
            const estimated = optimizer.estimateOptimizedSize(
              originalSize,
              quality,
            );
            return Number.isInteger(estimated) && estimated >= 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("品質100%の推定サイズは元のサイズに近い", () => {
      fc.assert(
        fc.property(fileSizeArbitrary(), (originalSize) => {
          const estimated = optimizer.estimateOptimizedSize(originalSize, 100);
          // 100%品質では元のサイズと同じか近い値
          return estimated <= originalSize * 1.1;
        }),
        { numRuns: 100 },
      );
    });

    it("低品質の推定サイズは高品質より小さい", () => {
      fc.assert(
        fc.property(
          fileSizeArbitrary(),
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 60, max: 100 }),
          (originalSize, lowQuality, highQuality) => {
            const lowEstimate = optimizer.estimateOptimizedSize(
              originalSize,
              lowQuality,
            );
            const highEstimate = optimizer.estimateOptimizedSize(
              originalSize,
              highQuality,
            );
            return lowEstimate <= highEstimate;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
