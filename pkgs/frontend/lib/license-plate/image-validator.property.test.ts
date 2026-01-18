/**
 * ImageValidator プロパティベーステスト
 *
 * @description
 * 画像検証モジュールのプロパティベーステスト。
 * fast-checkを使用してランダムに生成された入力に対して
 * 普遍的なプロパティを検証する。
 *
 * **Property 2: 画像検証の完全性**
 * **Property 3: 画像品質エラーの適切性**
 *
 * @see Requirements 2.1-2.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  validateImageWithMetrics,
  validateImageSync,
  validateResolution,
  validateBlur,
  validateAngle,
  validateLighting,
  VALIDATION_THRESHOLDS,
  ALL_VALIDATION_ERROR_CODES,
  isValidValidationErrorCode,
  type ImageQualityMetrics,
} from "./image-validator";
import type { CapturedImage, ValidationErrorCode } from "@/types/license-plate";

// ============================================================================
// Arbitraries（テストデータ生成器）
// ============================================================================

/**
 * 有効なCapturedImageを生成するArbitrary
 */
const validCapturedImageArbitrary = (): fc.Arbitrary<CapturedImage> =>
  fc.record({
    base64: fc.base64String({ minLength: 100, maxLength: 1000 }),
    width: fc.integer({ min: VALIDATION_THRESHOLDS.MIN_WIDTH, max: 4000 }),
    height: fc.integer({ min: VALIDATION_THRESHOLDS.MIN_HEIGHT, max: 3000 }),
    timestamp: fc.integer({ min: 0, max: Date.now() + 1000000 }),
  });

/**
 * 任意のCapturedImageを生成するArbitrary（無効な値も含む）
 */
const anyCapturedImageArbitrary = (): fc.Arbitrary<CapturedImage> =>
  fc.record({
    base64: fc.base64String({ minLength: 10, maxLength: 1000 }),
    width: fc.integer({ min: 1, max: 4000 }),
    height: fc.integer({ min: 1, max: 3000 }),
    timestamp: fc.integer({ min: 0, max: Date.now() + 1000000 }),
  });

/**
 * 画像品質メトリクスを生成するArbitrary
 */
const imageQualityMetricsArbitrary = (): fc.Arbitrary<ImageQualityMetrics> =>
  fc.record({
    laplacianVariance: fc.double({ min: 0, max: 10000, noNaN: true }),
    estimatedAngle: fc.double({ min: 0, max: 90, noNaN: true }),
    averageBrightness: fc.double({ min: 0, max: 255, noNaN: true }),
  });

/**
 * 有効な画像品質メトリクスを生成するArbitrary
 */
const validImageQualityMetricsArbitrary =
  (): fc.Arbitrary<ImageQualityMetrics> =>
    fc.record({
      laplacianVariance: fc.double({
        min: VALIDATION_THRESHOLDS.BLUR_THRESHOLD,
        max: 10000,
        noNaN: true,
      }),
      estimatedAngle: fc.double({
        min: 0,
        max: VALIDATION_THRESHOLDS.MAX_ANGLE,
        noNaN: true,
      }),
      averageBrightness: fc.double({
        min: VALIDATION_THRESHOLDS.DARK_THRESHOLD,
        max: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD,
        noNaN: true,
      }),
    });

/**
 * ぼやけた画像のメトリクスを生成するArbitrary
 */
const blurryMetricsArbitrary = (): fc.Arbitrary<ImageQualityMetrics> =>
  fc.record({
    laplacianVariance: fc.double({
      min: 0,
      max: VALIDATION_THRESHOLDS.BLUR_THRESHOLD - 1,
      noNaN: true,
    }),
    estimatedAngle: fc.double({
      min: 0,
      max: VALIDATION_THRESHOLDS.MAX_ANGLE,
      noNaN: true,
    }),
    averageBrightness: fc.double({
      min: VALIDATION_THRESHOLDS.DARK_THRESHOLD,
      max: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD,
      noNaN: true,
    }),
  });

/**
 * 角度が急すぎる画像のメトリクスを生成するArbitrary
 */
const steepAngleMetricsArbitrary = (): fc.Arbitrary<ImageQualityMetrics> =>
  fc.record({
    laplacianVariance: fc.double({
      min: VALIDATION_THRESHOLDS.BLUR_THRESHOLD,
      max: 10000,
      noNaN: true,
    }),
    estimatedAngle: fc.double({
      min: VALIDATION_THRESHOLDS.MAX_ANGLE + 1,
      max: 90,
      noNaN: true,
    }),
    averageBrightness: fc.double({
      min: VALIDATION_THRESHOLDS.DARK_THRESHOLD,
      max: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD,
      noNaN: true,
    }),
  });

/**
 * 暗すぎる画像のメトリクスを生成するArbitrary
 */
const darkMetricsArbitrary = (): fc.Arbitrary<ImageQualityMetrics> =>
  fc.record({
    laplacianVariance: fc.double({
      min: VALIDATION_THRESHOLDS.BLUR_THRESHOLD,
      max: 10000,
      noNaN: true,
    }),
    estimatedAngle: fc.double({
      min: 0,
      max: VALIDATION_THRESHOLDS.MAX_ANGLE,
      noNaN: true,
    }),
    averageBrightness: fc.double({
      min: 0,
      max: VALIDATION_THRESHOLDS.DARK_THRESHOLD - 1,
      noNaN: true,
    }),
  });

/**
 * 明るすぎる画像のメトリクスを生成するArbitrary
 */
const brightMetricsArbitrary = (): fc.Arbitrary<ImageQualityMetrics> =>
  fc.record({
    laplacianVariance: fc.double({
      min: VALIDATION_THRESHOLDS.BLUR_THRESHOLD,
      max: 10000,
      noNaN: true,
    }),
    estimatedAngle: fc.double({
      min: 0,
      max: VALIDATION_THRESHOLDS.MAX_ANGLE,
      noNaN: true,
    }),
    averageBrightness: fc.double({
      min: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD + 1,
      max: 255,
      noNaN: true,
    }),
  });

// ============================================================================
// Property 2: 画像検証の完全性
// ============================================================================

describe("Property 2: 画像検証の完全性", () => {
  /**
   * **Validates: Requirements 2.1, 2.5**
   *
   * 任意のキャプチャされた画像に対して、Image_Validatorは必ず
   * ぼやけ、角度、照明の3つの品質チェックを実行し、ValidationResultを返すこと。
   */
  it("任意の画像とメトリクスに対してValidationResultを返す", () => {
    fc.assert(
      fc.property(
        anyCapturedImageArbitrary(),
        imageQualityMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          // ValidationResultの構造を検証
          expect(result).toHaveProperty("isValid");
          expect(result).toHaveProperty("errors");
          expect(typeof result.isValid).toBe("boolean");
          expect(Array.isArray(result.errors)).toBe(true);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("全ての品質チェック（解像度、ぼやけ、角度、照明）が実行される", () => {
    fc.assert(
      fc.property(
        anyCapturedImageArbitrary(),
        imageQualityMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          // エラーがある場合、全てのエラーコードは有効なValidationErrorCodeである
          for (const error of result.errors) {
            expect(isValidValidationErrorCode(error.code)).toBe(true);
          }

          // isValidがtrueの場合、エラーは空
          if (result.isValid) {
            expect(result.errors).toHaveLength(0);
          }

          // isValidがfalseの場合、少なくとも1つのエラーがある
          if (!result.isValid) {
            expect(result.errors.length).toBeGreaterThan(0);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("有効な画像とメトリクスに対してisValid=trueを返す", () => {
    fc.assert(
      fc.property(
        validCapturedImageArbitrary(),
        validImageQualityMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validateImageSyncは常にValidationResultを返す", () => {
    fc.assert(
      fc.property(anyCapturedImageArbitrary(), (image) => {
        const result = validateImageSync(image);

        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("errors");
        expect(typeof result.isValid).toBe("boolean");
        expect(Array.isArray(result.errors)).toBe(true);

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 3: 画像品質エラーの適切性
// ============================================================================

describe("Property 3: 画像品質エラーの適切性", () => {
  /**
   * **Validates: Requirements 2.2, 2.3, 2.4**
   *
   * 任意の品質基準を満たさない画像に対して、Image_Validatorは適切なエラーコード
   * （BLUR、ANGLE、LIGHTING_DARK、LIGHTING_BRIGHT）と日本語のエラーメッセージを返すこと。
   */
  it("ぼやけた画像に対してBLURエラーを返す", () => {
    fc.assert(
      fc.property(
        validCapturedImageArbitrary(),
        blurryMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(false);

          const blurError = result.errors.find((e) => e.code === "BLUR");
          expect(blurError).toBeDefined();
          expect(blurError?.message).toBe("画像がぼやけています");
          expect(blurError?.suggestion).toBe("再撮影してください");

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("角度が急すぎる画像に対してANGLEエラーを返す", () => {
    fc.assert(
      fc.property(
        validCapturedImageArbitrary(),
        steepAngleMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(false);

          const angleError = result.errors.find((e) => e.code === "ANGLE");
          expect(angleError).toBeDefined();
          expect(angleError?.message).toBe("角度が急すぎます");
          expect(angleError?.suggestion).toBe("正面から撮影してください");

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("暗すぎる画像に対してLIGHTING_DARKエラーを返す", () => {
    fc.assert(
      fc.property(
        validCapturedImageArbitrary(),
        darkMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(false);

          const darkError = result.errors.find(
            (e) => e.code === "LIGHTING_DARK",
          );
          expect(darkError).toBeDefined();
          expect(darkError?.message).toBe("画像が暗すぎます");
          expect(darkError?.suggestion).toBe("明るい場所で撮影してください");

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("明るすぎる画像に対してLIGHTING_BRIGHTエラーを返す", () => {
    fc.assert(
      fc.property(
        validCapturedImageArbitrary(),
        brightMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(false);

          const brightError = result.errors.find(
            (e) => e.code === "LIGHTING_BRIGHT",
          );
          expect(brightError).toBeDefined();
          expect(brightError?.message).toBe("画像が明るすぎます");
          expect(brightError?.suggestion).toBe(
            "直射日光を避けて撮影してください",
          );

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("解像度が不足している画像に対してRESOLUTIONエラーを返す", () => {
    const lowResolutionImageArbitrary = (): fc.Arbitrary<CapturedImage> =>
      fc.record({
        base64: fc.base64String({ minLength: 100, maxLength: 1000 }),
        width: fc.integer({ min: 1, max: VALIDATION_THRESHOLDS.MIN_WIDTH - 1 }),
        height: fc.integer({
          min: 1,
          max: VALIDATION_THRESHOLDS.MIN_HEIGHT - 1,
        }),
        timestamp: fc.integer({ min: 0, max: Date.now() + 1000000 }),
      });

    fc.assert(
      fc.property(
        lowResolutionImageArbitrary(),
        validImageQualityMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          expect(result.isValid).toBe(false);

          const resolutionError = result.errors.find(
            (e) => e.code === "RESOLUTION",
          );
          expect(resolutionError).toBeDefined();
          expect(resolutionError?.message).toBe("解像度が不足しています");
          expect(resolutionError?.suggestion).toBe(
            "より近くで撮影してください",
          );

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("全てのエラーは日本語のメッセージと提案を含む", () => {
    fc.assert(
      fc.property(
        anyCapturedImageArbitrary(),
        imageQualityMetricsArbitrary(),
        (image, metrics) => {
          const result = validateImageWithMetrics(image, metrics);

          for (const error of result.errors) {
            // メッセージが存在し、空でない
            expect(error.message).toBeDefined();
            expect(error.message.length).toBeGreaterThan(0);

            // 提案が存在し、空でない
            expect(error.suggestion).toBeDefined();
            expect(error.suggestion.length).toBeGreaterThan(0);

            // 日本語文字を含む（ひらがな、カタカナ、漢字のいずれか）
            const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
            expect(japaneseRegex.test(error.message)).toBe(true);
            expect(japaneseRegex.test(error.suggestion)).toBe(true);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// 個別検証関数のプロパティテスト
// ============================================================================

describe("個別検証関数のプロパティ", () => {
  describe("validateResolution", () => {
    it("最小解像度以上の画像はnullを返す", () => {
      fc.assert(
        fc.property(validCapturedImageArbitrary(), (image) => {
          const result = validateResolution(image);
          expect(result).toBeNull();
          return true;
        }),
        { numRuns: 100 },
      );
    });

    it("最小解像度未満の画像はRESOLUTIONエラーを返す", () => {
      const lowResImageArbitrary = (): fc.Arbitrary<CapturedImage> =>
        fc.record({
          base64: fc.base64String({ minLength: 100, maxLength: 1000 }),
          width: fc.integer({
            min: 1,
            max: VALIDATION_THRESHOLDS.MIN_WIDTH - 1,
          }),
          height: fc.integer({
            min: VALIDATION_THRESHOLDS.MIN_HEIGHT,
            max: 3000,
          }),
          timestamp: fc.integer({ min: 0, max: Date.now() + 1000000 }),
        });

      fc.assert(
        fc.property(lowResImageArbitrary(), (image) => {
          const result = validateResolution(image);
          expect(result).not.toBeNull();
          expect(result?.code).toBe("RESOLUTION");
          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("validateBlur", () => {
    it("閾値以上のラプラシアン分散はnullを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: VALIDATION_THRESHOLDS.BLUR_THRESHOLD,
            max: 10000,
            noNaN: true,
          }),
          (variance) => {
            const result = validateBlur(variance);
            expect(result).toBeNull();
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("閾値未満のラプラシアン分散はBLURエラーを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: 0,
            max: VALIDATION_THRESHOLDS.BLUR_THRESHOLD - 0.001,
            noNaN: true,
          }),
          (variance) => {
            const result = validateBlur(variance);
            expect(result).not.toBeNull();
            expect(result?.code).toBe("BLUR");
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("validateAngle", () => {
    it("最大角度以下の角度はnullを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: 0,
            max: VALIDATION_THRESHOLDS.MAX_ANGLE,
            noNaN: true,
          }),
          (angle) => {
            const result = validateAngle(angle);
            expect(result).toBeNull();
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("最大角度を超える角度はANGLEエラーを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: VALIDATION_THRESHOLDS.MAX_ANGLE + 0.001,
            max: 90,
            noNaN: true,
          }),
          (angle) => {
            const result = validateAngle(angle);
            expect(result).not.toBeNull();
            expect(result?.code).toBe("ANGLE");
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("validateLighting", () => {
    it("適切な輝度範囲内の値はnullを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: VALIDATION_THRESHOLDS.DARK_THRESHOLD,
            max: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD,
            noNaN: true,
          }),
          (brightness) => {
            const result = validateLighting(brightness);
            expect(result).toBeNull();
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("暗すぎる輝度はLIGHTING_DARKエラーを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: 0,
            max: VALIDATION_THRESHOLDS.DARK_THRESHOLD - 0.001,
            noNaN: true,
          }),
          (brightness) => {
            const result = validateLighting(brightness);
            expect(result).not.toBeNull();
            expect(result?.code).toBe("LIGHTING_DARK");
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("明るすぎる輝度はLIGHTING_BRIGHTエラーを返す", () => {
      fc.assert(
        fc.property(
          fc.double({
            min: VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD + 0.001,
            max: 255,
            noNaN: true,
          }),
          (brightness) => {
            const result = validateLighting(brightness);
            expect(result).not.toBeNull();
            expect(result?.code).toBe("LIGHTING_BRIGHT");
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// エラーコードの網羅性テスト
// ============================================================================

describe("エラーコードの網羅性", () => {
  it("ALL_VALIDATION_ERROR_CODESは全ての有効なエラーコードを含む", () => {
    const expectedCodes: ValidationErrorCode[] = [
      "BLUR",
      "ANGLE",
      "LIGHTING_DARK",
      "LIGHTING_BRIGHT",
      "RESOLUTION",
    ];

    expect(ALL_VALIDATION_ERROR_CODES).toHaveLength(expectedCodes.length);
    for (const code of expectedCodes) {
      expect(ALL_VALIDATION_ERROR_CODES).toContain(code);
    }
  });

  it("isValidValidationErrorCodeは全ての有効なコードに対してtrueを返す", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_VALIDATION_ERROR_CODES), (code) => {
        expect(isValidValidationErrorCode(code)).toBe(true);
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("isValidValidationErrorCodeは無効なコードに対してfalseを返す", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) =>
              !ALL_VALIDATION_ERROR_CODES.includes(s as ValidationErrorCode),
          ),
        (code) => {
          expect(isValidValidationErrorCode(code)).toBe(false);
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
