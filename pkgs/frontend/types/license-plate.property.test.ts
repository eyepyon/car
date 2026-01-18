/**
 * ナンバープレート型定義のプロパティベーステスト
 *
 * @description
 * fast-checkを使用したプロパティベーステスト。
 * ランダムに生成された入力に対して普遍的なプロパティを検証します。
 * 各プロパティテストは最低100回のイテレーションを実行します。
 *
 * **Validates: Requirements 4.1-4.6**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  type LicensePlateData,
  type PlateType,
  type RecognitionErrorCode,
  generateFullText,
  createLicensePlateData,
  isValidConfidence,
  isCompleteLicensePlateData,
  isFullTextConsistent,
  createRecognitionError,
} from "./license-plate";

// ============================================================================
// テストデータ生成用のArbitraries
// ============================================================================

/**
 * 日本の地名（ナンバープレート用）
 */
const REGIONS = [
  "品川",
  "横浜",
  "名古屋",
  "大阪",
  "神戸",
  "福岡",
  "札幌",
  "仙台",
  "広島",
  "京都",
  "千葉",
  "埼玉",
  "川崎",
  "相模",
  "湘南",
  "多摩",
  "練馬",
  "足立",
  "世田谷",
  "杉並",
];

/**
 * ナンバープレートのひらがな
 */
const HIRAGANA = [
  "あ",
  "い",
  "う",
  "え",
  "お",
  "か",
  "き",
  "く",
  "け",
  "こ",
  "さ",
  "し",
  "す",
  "せ",
  "そ",
  "た",
  "ち",
  "つ",
  "て",
  "と",
  "な",
  "に",
  "ぬ",
  "ね",
  "の",
  "は",
  "ひ",
  "ふ",
  "へ",
  "ほ",
  "ま",
  "み",
  "む",
  "め",
  "も",
  "や",
  "ゆ",
  "よ",
  "ら",
  "り",
  "る",
  "れ",
  "ろ",
  "わ",
];

/**
 * ナンバープレートの種類
 */
const PLATE_TYPES: PlateType[] = [
  "REGULAR",
  "LIGHT",
  "COMMERCIAL",
  "RENTAL",
  "DIPLOMATIC",
];

/**
 * 認識エラーコード
 */
const ERROR_CODES: RecognitionErrorCode[] = [
  "NO_PLATE_DETECTED",
  "PARTIAL_RECOGNITION",
  "API_CONNECTION_FAILED",
  "TIMEOUT",
  "RATE_LIMITED",
  "INVALID_IMAGE",
];

/**
 * 地名のArbitrary
 */
const regionArbitrary = fc.constantFrom(...REGIONS);

/**
 * 分類番号のArbitrary（3桁の数字文字列）
 */
const classificationNumberArbitrary = fc
  .integer({ min: 100, max: 999 })
  .map((n) => n.toString());

/**
 * ひらがなのArbitrary
 */
const hiraganaArbitrary = fc.constantFrom(...HIRAGANA);

/**
 * 一連番号のArbitrary（1-4桁の数字文字列）
 */
const serialNumberArbitrary = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => n.toString());

/**
 * 信頼度スコアのArbitrary（0-100の整数）
 */
const confidenceArbitrary = fc.integer({ min: 0, max: 100 });

/**
 * プレートタイプのArbitrary
 */
const plateTypeArbitrary = fc.constantFrom(...PLATE_TYPES);

/**
 * 有効なLicensePlateDataを生成するArbitrary
 */
const validLicensePlateDataArbitrary = fc
  .record({
    region: regionArbitrary,
    classificationNumber: classificationNumberArbitrary,
    hiragana: hiraganaArbitrary,
    serialNumber: serialNumberArbitrary,
    confidence: confidenceArbitrary,
    plateType: plateTypeArbitrary,
  })
  .map((data) => createLicensePlateData(data));

/**
 * 認識エラーコードのArbitrary
 */
const recognitionErrorCodeArbitrary = fc.constantFrom(...ERROR_CODES);

/**
 * 部分的なLicensePlateDataのArbitrary
 */
const partialLicensePlateDataArbitrary = fc.record({
  region: fc.option(regionArbitrary, { nil: undefined }),
  classificationNumber: fc.option(classificationNumberArbitrary, {
    nil: undefined,
  }),
  hiragana: fc.option(hiraganaArbitrary, { nil: undefined }),
  serialNumber: fc.option(serialNumberArbitrary, { nil: undefined }),
});

// ============================================================================
// プロパティテスト
// ============================================================================

describe("LicensePlateData Property Tests", () => {
  /**
   * Property 4: 認識結果データ構造の完全性
   *
   * *任意の* 成功した認識結果に対して、LicensePlateDataは必ず
   * region、classificationNumber、hiragana、serialNumber、fullText、
   * confidence、plateTypeの全フィールドを含むこと。
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**
   */
  it("Property 4: should return complete LicensePlateData for successful recognition", () => {
    fc.assert(
      fc.property(validLicensePlateDataArbitrary, (data) => {
        // 全ての必須フィールドが存在することを検証
        expect(typeof data.region).toBe("string");
        expect(data.region.length).toBeGreaterThan(0);

        expect(typeof data.classificationNumber).toBe("string");
        expect(data.classificationNumber.length).toBeGreaterThan(0);

        expect(typeof data.hiragana).toBe("string");
        expect(data.hiragana.length).toBeGreaterThan(0);

        expect(typeof data.serialNumber).toBe("string");
        expect(data.serialNumber.length).toBeGreaterThan(0);

        expect(typeof data.fullText).toBe("string");
        expect(data.fullText.length).toBeGreaterThan(0);

        expect(typeof data.confidence).toBe("number");

        expect(typeof data.plateType).toBe("string");
        expect(PLATE_TYPES).toContain(data.plateType);

        expect(typeof data.recognizedAt).toBe("number");

        // isCompleteLicensePlateDataでも検証
        expect(isCompleteLicensePlateData(data)).toBe(true);

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: フルテキストの整合性
   *
   * *任意の* 成功した認識結果に対して、fullTextフィールドは
   * region + classificationNumber + hiragana + serialNumberの連結と等しいこと。
   *
   * **Validates: Requirements 4.5**
   */
  it("Property 5: should have fullText equal to concatenation of components", () => {
    fc.assert(
      fc.property(validLicensePlateDataArbitrary, (data) => {
        const expected = generateFullText(data);
        const expectedManual =
          data.region +
          data.classificationNumber +
          data.hiragana +
          data.serialNumber;

        // fullTextが各コンポーネントの連結と一致することを検証
        expect(data.fullText).toBe(expected);
        expect(data.fullText).toBe(expectedManual);

        // isFullTextConsistentでも検証
        expect(isFullTextConsistent(data)).toBe(true);

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: 信頼度スコアの範囲
   *
   * *任意の* 認識結果に対して、confidenceフィールドは0以上100以下の数値であること。
   *
   * **Validates: Requirements 4.6**
   */
  it("Property 6: should have confidence between 0 and 100", () => {
    fc.assert(
      fc.property(validLicensePlateDataArbitrary, (data) => {
        // 信頼度が0-100の範囲内であることを検証
        expect(data.confidence).toBeGreaterThanOrEqual(0);
        expect(data.confidence).toBeLessThanOrEqual(100);

        // isValidConfidenceでも検証
        expect(isValidConfidence(data.confidence)).toBe(true);

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 追加プロパティ: 信頼度スコアの範囲外の値は無効
   */
  it("should reject confidence values outside 0-100 range", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: -1 }), // 負の値
          fc.integer({ min: 101 }), // 100より大きい値
        ),
        (invalidConfidence) => {
          expect(isValidConfidence(invalidConfidence)).toBe(false);
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 追加プロパティ: generateFullTextは常に同じ結果を返す（冪等性）
   */
  it("should be idempotent for generateFullText", () => {
    fc.assert(
      fc.property(
        fc.record({
          region: regionArbitrary,
          classificationNumber: classificationNumberArbitrary,
          hiragana: hiraganaArbitrary,
          serialNumber: serialNumberArbitrary,
        }),
        (data) => {
          const result1 = generateFullText(data);
          const result2 = generateFullText(data);
          expect(result1).toBe(result2);
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 追加プロパティ: createLicensePlateDataは常に有効なデータを生成
   */
  it("should always create valid LicensePlateData", () => {
    fc.assert(
      fc.property(
        fc.record({
          region: regionArbitrary,
          classificationNumber: classificationNumberArbitrary,
          hiragana: hiraganaArbitrary,
          serialNumber: serialNumberArbitrary,
          confidence: confidenceArbitrary,
          plateType: plateTypeArbitrary,
        }),
        (params) => {
          const data = createLicensePlateData(params);

          // 生成されたデータは常に完全であること
          expect(isCompleteLicensePlateData(data)).toBe(true);

          // fullTextは常に整合性があること
          expect(isFullTextConsistent(data)).toBe(true);

          // 信頼度は常に有効な範囲内であること
          expect(isValidConfidence(data.confidence)).toBe(true);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("RecognitionError Property Tests", () => {
  /**
   * Property 7の一部: エラーレスポンスの構造
   *
   * *任意の* エラーが発生した場合、RecognitionErrorは
   * code、message、suggestionの全フィールドを含むこと。
   *
   * **Validates: Requirements 6.3, 6.4**
   */
  it("Property 7: should return complete error structure for all errors", () => {
    fc.assert(
      fc.property(recognitionErrorCodeArbitrary, (code) => {
        const error = createRecognitionError(code);

        // 全ての必須フィールドが存在することを検証
        expect(typeof error.code).toBe("string");
        expect(ERROR_CODES).toContain(error.code);

        expect(typeof error.message).toBe("string");
        expect(error.message.length).toBeGreaterThan(0);

        expect(typeof error.suggestion).toBe("string");
        expect(error.suggestion.length).toBeGreaterThan(0);

        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 追加プロパティ: 部分データ付きエラーの構造
   */
  it("should include partial data when provided", () => {
    fc.assert(
      fc.property(
        recognitionErrorCodeArbitrary,
        partialLicensePlateDataArbitrary,
        (code, partialData) => {
          const error = createRecognitionError(code, partialData);

          // 基本フィールドが存在
          expect(typeof error.code).toBe("string");
          expect(typeof error.message).toBe("string");
          expect(typeof error.suggestion).toBe("string");

          // 部分データが含まれている
          expect(error.partialData).toBeDefined();
          expect(error.partialData).toEqual(partialData);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 追加プロパティ: エラーメッセージは日本語
   */
  it("should have Japanese error messages", () => {
    fc.assert(
      fc.property(recognitionErrorCodeArbitrary, (code) => {
        const error = createRecognitionError(code);

        // メッセージに日本語文字が含まれていることを検証
        // 日本語文字の正規表現パターン
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

        expect(japanesePattern.test(error.message)).toBe(true);
        expect(japanesePattern.test(error.suggestion)).toBe(true);

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

describe("PlateType Property Tests", () => {
  /**
   * 追加プロパティ: 全てのプレートタイプが有効
   */
  it("should support all plate types in createLicensePlateData", () => {
    fc.assert(
      fc.property(
        fc.record({
          region: regionArbitrary,
          classificationNumber: classificationNumberArbitrary,
          hiragana: hiraganaArbitrary,
          serialNumber: serialNumberArbitrary,
          confidence: confidenceArbitrary,
          plateType: plateTypeArbitrary,
        }),
        (params) => {
          const data = createLicensePlateData(params);

          // プレートタイプが正しく設定されていること
          expect(data.plateType).toBe(params.plateType);
          expect(PLATE_TYPES).toContain(data.plateType);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
