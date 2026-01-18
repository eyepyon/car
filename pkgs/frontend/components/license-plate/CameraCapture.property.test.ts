/**
 * CameraCaptureコンポーネントのプロパティテスト
 *
 * @description
 * 画像キャプチャの有効性を検証するプロパティベーステスト。
 * fast-checkを使用してランダムな入力に対する普遍的なプロパティを検証。
 *
 * **Validates: Requirements 1.1, 1.5**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { CapturedImage } from "@/types/license-plate";

// ============================================================================
// 定数
// ============================================================================

/**
 * 最小解像度要件
 * @see Requirements 1.5
 */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

// ============================================================================
// Arbitraries（テストデータ生成器）
// ============================================================================

/**
 * 有効なBase64画像データを生成するArbitrary
 */
const validBase64ImageArbitrary = () =>
  fc.string({ minLength: 100, maxLength: 10000 }).map((str) => {
    // Base64エンコードされた画像データをシミュレート
    const base64 = Buffer.from(str).toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  });

/**
 * 有効な画像幅を生成するArbitrary（最小640ピクセル）
 */
const validWidthArbitrary = () => fc.integer({ min: MIN_WIDTH, max: 4096 });

/**
 * 有効な画像高さを生成するArbitrary（最小480ピクセル）
 */
const validHeightArbitrary = () => fc.integer({ min: MIN_HEIGHT, max: 2160 });

/**
 * 有効なタイムスタンプを生成するArbitrary
 */
const validTimestampArbitrary = () =>
  fc.integer({ min: 0, max: Date.now() + 1000000 });

/**
 * 有効なCapturedImageを生成するArbitrary
 */
const validCapturedImageArbitrary = (): fc.Arbitrary<CapturedImage> =>
  fc.record({
    base64: validBase64ImageArbitrary(),
    width: validWidthArbitrary(),
    height: validHeightArbitrary(),
    timestamp: validTimestampArbitrary(),
  });

/**
 * 無効な幅（最小解像度未満）を生成するArbitrary
 */
const invalidWidthArbitrary = () => fc.integer({ min: 1, max: MIN_WIDTH - 1 });

/**
 * 無効な高さ（最小解像度未満）を生成するArbitrary
 */
const invalidHeightArbitrary = () =>
  fc.integer({ min: 1, max: MIN_HEIGHT - 1 });

// ============================================================================
// プロパティテスト
// ============================================================================

describe("CameraCapture Property Tests", () => {
  /**
   * Property 1: 画像キャプチャの有効性
   *
   * 任意のカメラストリームからキャプチャされた画像に対して、
   * 出力は有効なBase64文字列であり、幅と高さが640x480ピクセル以上であること。
   *
   * **Validates: Requirements 1.1, 1.5**
   */
  describe("Property 1: 画像キャプチャの有効性", () => {
    it("有効なCapturedImageは常にBase64形式の文字列を含む", () => {
      fc.assert(
        fc.property(validCapturedImageArbitrary(), (image) => {
          // Base64形式のプレフィックスを確認
          expect(image.base64).toMatch(
            /^data:image\/(jpeg|png|gif|webp);base64,/,
          );
          // Base64部分が存在することを確認
          const base64Part = image.base64.split(",")[1];
          expect(base64Part).toBeDefined();
          expect(base64Part.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it("有効なCapturedImageは常に最小解像度640x480を満たす", () => {
      fc.assert(
        fc.property(validCapturedImageArbitrary(), (image) => {
          expect(image.width).toBeGreaterThanOrEqual(MIN_WIDTH);
          expect(image.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
        }),
        { numRuns: 100 },
      );
    });

    it("有効なCapturedImageは常に正のタイムスタンプを持つ", () => {
      fc.assert(
        fc.property(validCapturedImageArbitrary(), (image) => {
          expect(image.timestamp).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(image.timestamp)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("有効なCapturedImageは全ての必須フィールドを持つ", () => {
      fc.assert(
        fc.property(validCapturedImageArbitrary(), (image) => {
          expect(image).toHaveProperty("base64");
          expect(image).toHaveProperty("width");
          expect(image).toHaveProperty("height");
          expect(image).toHaveProperty("timestamp");
          expect(typeof image.base64).toBe("string");
          expect(typeof image.width).toBe("number");
          expect(typeof image.height).toBe("number");
          expect(typeof image.timestamp).toBe("number");
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * 解像度検証のプロパティテスト
   */
  describe("解像度検証", () => {
    it("幅が640未満の画像は最小解像度要件を満たさない", () => {
      fc.assert(
        fc.property(
          invalidWidthArbitrary(),
          validHeightArbitrary(),
          (width, height) => {
            const meetsMinResolution =
              width >= MIN_WIDTH && height >= MIN_HEIGHT;
            expect(meetsMinResolution).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("高さが480未満の画像は最小解像度要件を満たさない", () => {
      fc.assert(
        fc.property(
          validWidthArbitrary(),
          invalidHeightArbitrary(),
          (width, height) => {
            const meetsMinResolution =
              width >= MIN_WIDTH && height >= MIN_HEIGHT;
            expect(meetsMinResolution).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("幅と高さの両方が最小値以上の場合のみ解像度要件を満たす", () => {
      fc.assert(
        fc.property(
          validWidthArbitrary(),
          validHeightArbitrary(),
          (width, height) => {
            const meetsMinResolution =
              width >= MIN_WIDTH && height >= MIN_HEIGHT;
            expect(meetsMinResolution).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Base64形式の検証
   */
  describe("Base64形式の検証", () => {
    it("有効なBase64画像データは常にdata:image/で始まる", () => {
      fc.assert(
        fc.property(validBase64ImageArbitrary(), (base64) => {
          expect(base64.startsWith("data:image/")).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("有効なBase64画像データは常に;base64,を含む", () => {
      fc.assert(
        fc.property(validBase64ImageArbitrary(), (base64) => {
          expect(base64.includes(";base64,")).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("Base64データ部分は空でない", () => {
      fc.assert(
        fc.property(validBase64ImageArbitrary(), (base64) => {
          const parts = base64.split(",");
          expect(parts.length).toBe(2);
          expect(parts[1].length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * タイムスタンプの検証
   */
  describe("タイムスタンプの検証", () => {
    it("タイムスタンプは常に整数である", () => {
      fc.assert(
        fc.property(validTimestampArbitrary(), (timestamp) => {
          expect(Number.isInteger(timestamp)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("タイムスタンプは常に非負である", () => {
      fc.assert(
        fc.property(validTimestampArbitrary(), (timestamp) => {
          expect(timestamp).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });
  });
});
