/**
 * ImageValidator ユニットテスト
 *
 * @description
 * 画像検証モジュールのユニットテスト。
 * 各検証関数の動作を確認する。
 *
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from "vitest";
import {
  validateResolution,
  validateBlur,
  validateAngle,
  validateLighting,
  validateImageSync,
  validateImageWithMetrics,
  calculateAverageBrightness,
  calculateLaplacianVariance,
  VALIDATION_THRESHOLDS,
  isValidValidationErrorCode,
  ALL_VALIDATION_ERROR_CODES,
  type ImageQualityMetrics,
} from "./image-validator";
import type { CapturedImage } from "@/types/license-plate";

// ============================================================================
// テストヘルパー
// ============================================================================

/**
 * テスト用のCapturedImageを作成する
 */
function createTestImage(
  overrides: Partial<CapturedImage> = {},
): CapturedImage {
  return {
    base64: "dGVzdA==", // "test" in base64
    width: 800,
    height: 600,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * テスト用のImageDataを作成する
 */
function createTestImageData(
  width: number,
  height: number,
  fillValue: number = 128,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue; // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255; // A
  }
  return {
    data,
    width,
    height,
    colorSpace: "srgb",
  };
}

/**
 * エッジのあるテスト用ImageDataを作成する（ぼやけていない画像）
 */
function createSharpImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // チェッカーボードパターンでエッジを作成
      const isWhite = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
      const value = isWhite ? 255 : 0;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }
  return {
    data,
    width,
    height,
    colorSpace: "srgb",
  };
}

/**
 * ぼやけた画像のテスト用ImageDataを作成する
 */
function createBlurryImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // 均一な色で塗りつぶし（エッジがない = ぼやけている）
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return {
    data,
    width,
    height,
    colorSpace: "srgb",
  };
}

// ============================================================================
// 解像度検証テスト
// ============================================================================

describe("validateResolution", () => {
  it("有効な解像度の画像を受け入れる", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const result = validateResolution(image);
    expect(result).toBeNull();
  });

  it("最小解像度ちょうどの画像を受け入れる", () => {
    const image = createTestImage({
      width: VALIDATION_THRESHOLDS.MIN_WIDTH,
      height: VALIDATION_THRESHOLDS.MIN_HEIGHT,
    });
    const result = validateResolution(image);
    expect(result).toBeNull();
  });

  it("幅が不足している画像を拒否する", () => {
    const image = createTestImage({ width: 320, height: 600 });
    const result = validateResolution(image);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("RESOLUTION");
  });

  it("高さが不足している画像を拒否する", () => {
    const image = createTestImage({ width: 800, height: 240 });
    const result = validateResolution(image);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("RESOLUTION");
  });

  it("幅と高さの両方が不足している画像を拒否する", () => {
    const image = createTestImage({ width: 320, height: 240 });
    const result = validateResolution(image);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("RESOLUTION");
  });
});

// ============================================================================
// ぼやけ検証テスト
// ============================================================================

describe("validateBlur", () => {
  it("高いラプラシアン分散（シャープな画像）を受け入れる", () => {
    const result = validateBlur(500);
    expect(result).toBeNull();
  });

  it("閾値ちょうどのラプラシアン分散を受け入れる", () => {
    const result = validateBlur(VALIDATION_THRESHOLDS.BLUR_THRESHOLD);
    expect(result).toBeNull();
  });

  it("低いラプラシアン分散（ぼやけた画像）を拒否する", () => {
    const result = validateBlur(50);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("BLUR");
    expect(result?.message).toBe("画像がぼやけています");
    expect(result?.suggestion).toBe("再撮影してください");
  });

  it("ゼロのラプラシアン分散を拒否する", () => {
    const result = validateBlur(0);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("BLUR");
  });
});

// ============================================================================
// 角度検証テスト
// ============================================================================

describe("validateAngle", () => {
  it("小さい角度を受け入れる", () => {
    const result = validateAngle(10);
    expect(result).toBeNull();
  });

  it("閾値ちょうどの角度を受け入れる", () => {
    const result = validateAngle(VALIDATION_THRESHOLDS.MAX_ANGLE);
    expect(result).toBeNull();
  });

  it("ゼロ角度を受け入れる", () => {
    const result = validateAngle(0);
    expect(result).toBeNull();
  });

  it("大きい角度を拒否する", () => {
    const result = validateAngle(60);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("ANGLE");
    expect(result?.message).toBe("角度が急すぎます");
    expect(result?.suggestion).toBe("正面から撮影してください");
  });

  it("90度の角度を拒否する", () => {
    const result = validateAngle(90);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("ANGLE");
  });
});

// ============================================================================
// 照明検証テスト
// ============================================================================

describe("validateLighting", () => {
  it("適切な輝度を受け入れる", () => {
    const result = validateLighting(128);
    expect(result).toBeNull();
  });

  it("暗い閾値ちょうどの輝度を受け入れる", () => {
    const result = validateLighting(VALIDATION_THRESHOLDS.DARK_THRESHOLD);
    expect(result).toBeNull();
  });

  it("明るい閾値ちょうどの輝度を受け入れる", () => {
    const result = validateLighting(VALIDATION_THRESHOLDS.BRIGHT_THRESHOLD);
    expect(result).toBeNull();
  });

  it("暗すぎる画像を拒否する", () => {
    const result = validateLighting(20);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("LIGHTING_DARK");
    expect(result?.message).toBe("画像が暗すぎます");
    expect(result?.suggestion).toBe("明るい場所で撮影してください");
  });

  it("明るすぎる画像を拒否する", () => {
    const result = validateLighting(240);
    expect(result).not.toBeNull();
    expect(result?.code).toBe("LIGHTING_BRIGHT");
    expect(result?.message).toBe("画像が明るすぎます");
    expect(result?.suggestion).toBe("直射日光を避けて撮影してください");
  });
});

// ============================================================================
// 平均輝度計算テスト
// ============================================================================

describe("calculateAverageBrightness", () => {
  it("均一な画像の輝度を正しく計算する", () => {
    const imageData = createTestImageData(10, 10, 128);
    const brightness = calculateAverageBrightness(imageData);
    expect(brightness).toBeCloseTo(128, 0);
  });

  it("黒い画像の輝度を正しく計算する", () => {
    const imageData = createTestImageData(10, 10, 0);
    const brightness = calculateAverageBrightness(imageData);
    expect(brightness).toBe(0);
  });

  it("白い画像の輝度を正しく計算する", () => {
    const imageData = createTestImageData(10, 10, 255);
    const brightness = calculateAverageBrightness(imageData);
    expect(brightness).toBeCloseTo(255, 0);
  });
});

// ============================================================================
// ラプラシアン分散計算テスト
// ============================================================================

describe("calculateLaplacianVariance", () => {
  it("シャープな画像で高い分散を返す", () => {
    const imageData = createSharpImageData(100, 100);
    const variance = calculateLaplacianVariance(imageData);
    expect(variance).toBeGreaterThan(VALIDATION_THRESHOLDS.BLUR_THRESHOLD);
  });

  it("ぼやけた画像で低い分散を返す", () => {
    const imageData = createBlurryImageData(100, 100);
    const variance = calculateLaplacianVariance(imageData);
    expect(variance).toBeLessThan(VALIDATION_THRESHOLDS.BLUR_THRESHOLD);
  });
});

// ============================================================================
// 統合検証テスト
// ============================================================================

describe("validateImageWithMetrics", () => {
  it("全ての品質基準を満たす画像を受け入れる", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const metrics: ImageQualityMetrics = {
      laplacianVariance: 500,
      estimatedAngle: 10,
      averageBrightness: 128,
    };
    const result = validateImageWithMetrics(image, metrics);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("複数の問題がある画像で全てのエラーを返す", () => {
    const image = createTestImage({ width: 320, height: 240 });
    const metrics: ImageQualityMetrics = {
      laplacianVariance: 50, // ぼやけ
      estimatedAngle: 60, // 角度
      averageBrightness: 20, // 暗い
    };
    const result = validateImageWithMetrics(image, metrics);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);

    const errorCodes = result.errors.map((e) => e.code);
    expect(errorCodes).toContain("RESOLUTION");
    expect(errorCodes).toContain("BLUR");
    expect(errorCodes).toContain("ANGLE");
    expect(errorCodes).toContain("LIGHTING_DARK");
  });

  it("ぼやけのみの問題がある画像", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const metrics: ImageQualityMetrics = {
      laplacianVariance: 50,
      estimatedAngle: 10,
      averageBrightness: 128,
    };
    const result = validateImageWithMetrics(image, metrics);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("BLUR");
  });

  it("角度のみの問題がある画像", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const metrics: ImageQualityMetrics = {
      laplacianVariance: 500,
      estimatedAngle: 60,
      averageBrightness: 128,
    };
    const result = validateImageWithMetrics(image, metrics);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("ANGLE");
  });
});

// ============================================================================
// 同期版検証テスト
// ============================================================================

describe("validateImageSync", () => {
  it("ImageDataなしで解像度のみチェックする", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const result = validateImageSync(image);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("ImageDataなしで解像度エラーを検出する", () => {
    const image = createTestImage({ width: 320, height: 240 });
    const result = validateImageSync(image);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("RESOLUTION");
  });

  it("ImageDataありで全てのチェックを実行する", () => {
    const image = createTestImage({ width: 800, height: 600 });
    const imageData = createSharpImageData(800, 600);
    const result = validateImageSync(image, imageData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// ユーティリティ関数テスト
// ============================================================================

describe("isValidValidationErrorCode", () => {
  it("有効なエラーコードを認識する", () => {
    expect(isValidValidationErrorCode("BLUR")).toBe(true);
    expect(isValidValidationErrorCode("ANGLE")).toBe(true);
    expect(isValidValidationErrorCode("LIGHTING_DARK")).toBe(true);
    expect(isValidValidationErrorCode("LIGHTING_BRIGHT")).toBe(true);
    expect(isValidValidationErrorCode("RESOLUTION")).toBe(true);
  });

  it("無効なエラーコードを拒否する", () => {
    expect(isValidValidationErrorCode("INVALID")).toBe(false);
    expect(isValidValidationErrorCode("")).toBe(false);
    expect(isValidValidationErrorCode("blur")).toBe(false);
  });
});

describe("ALL_VALIDATION_ERROR_CODES", () => {
  it("全てのエラーコードを含む", () => {
    expect(ALL_VALIDATION_ERROR_CODES).toContain("BLUR");
    expect(ALL_VALIDATION_ERROR_CODES).toContain("ANGLE");
    expect(ALL_VALIDATION_ERROR_CODES).toContain("LIGHTING_DARK");
    expect(ALL_VALIDATION_ERROR_CODES).toContain("LIGHTING_BRIGHT");
    expect(ALL_VALIDATION_ERROR_CODES).toContain("RESOLUTION");
    expect(ALL_VALIDATION_ERROR_CODES).toHaveLength(5);
  });
});
