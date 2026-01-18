/**
 * 認識結果キャッシュのプロパティテスト
 *
 * @description
 * Property 12: キャッシュの一貫性
 * 任意の同一画像（同一ハッシュ）に対する連続したリクエストに対して、
 * キャッシュ有効期間内であれば同一の認識結果を返すこと。
 *
 * **Validates: Requirements 8.5**
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  RecognitionCache,
  generateCacheKey,
  computeHash,
  DEFAULT_CACHE_CONFIG,
  type CacheConfig,
} from "./recognition-cache";
import type { LicensePlateData, PlateType } from "./qwen-vl-client";

// ============================================================================
// テストデータ生成（Arbitraries）
// ============================================================================

/**
 * 有効な地域名を生成
 */
const regionArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom(
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
  );

/**
 * 有効なひらがなを生成
 */
const hiraganaArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom(
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
    "わ",
    "れ",
  );

/**
 * 有効なプレートタイプを生成
 */
const plateTypeArbitrary = (): fc.Arbitrary<PlateType> =>
  fc.constantFrom("REGULAR", "LIGHT", "COMMERCIAL", "RENTAL", "DIPLOMATIC");

/**
 * 有効な分類番号を生成（3桁の数字文字列）
 */
const classificationNumberArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
      minLength: 3,
      maxLength: 3,
    })
    .map((chars) => chars.join(""));

/**
 * 有効な一連番号を生成（1-4桁の数字文字列）
 */
const serialNumberArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
      minLength: 1,
      maxLength: 4,
    })
    .map((chars) => chars.join(""));

/**
 * 有効な信頼度を生成
 */
const confidenceArbitrary = (): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 100 });

/**
 * 有効なLicensePlateDataを生成
 */
const licensePlateDataArbitrary = (): fc.Arbitrary<LicensePlateData> =>
  fc
    .record({
      region: regionArbitrary(),
      classificationNumber: classificationNumberArbitrary(),
      hiragana: hiraganaArbitrary(),
      serialNumber: serialNumberArbitrary(),
      confidence: confidenceArbitrary(),
      plateType: plateTypeArbitrary(),
      recognizedAt: fc.integer({ min: 0, max: Date.now() + 1000000 }),
    })
    .map((data) => ({
      ...data,
      fullText: `${data.region}${data.classificationNumber}${data.hiragana}${data.serialNumber}`,
    }));

/**
 * 有効なBase64画像データを生成（簡易版）
 */
const imageDataArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(
      fc.constantFrom(
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j",
        "k",
        "l",
        "m",
        "n",
        "o",
        "p",
        "q",
        "r",
        "s",
        "t",
        "u",
        "v",
        "w",
        "x",
        "y",
        "z",
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "+",
        "/",
      ),
      { minLength: 100, maxLength: 500 },
    )
    .map((chars) => `data:image/jpeg;base64,${chars.join("")}`);

// ============================================================================
// プロパティテスト
// ============================================================================

describe("Recognition Cache Property Tests", () => {
  let cache: RecognitionCache;

  beforeEach(() => {
    cache = new RecognitionCache();
  });

  /**
   * Property 12: キャッシュの一貫性
   *
   * **Validates: Requirements 8.5**
   */
  describe("Property 12: キャッシュの一貫性", () => {
    it("同一画像に対する連続したリクエストは同一の認識結果を返す", async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          async (imageData, result) => {
            // キャッシュに保存
            await cache.set(imageData, result);

            // 複数回取得して同一結果を確認
            const result1 = await cache.get(imageData);
            const result2 = await cache.get(imageData);
            const result3 = await cache.get(imageData);

            return (
              result1 !== null &&
              result2 !== null &&
              result3 !== null &&
              JSON.stringify(result1) === JSON.stringify(result) &&
              JSON.stringify(result2) === JSON.stringify(result) &&
              JSON.stringify(result3) === JSON.stringify(result)
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("異なる画像は異なるキャッシュエントリを持つ", async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDataArbitrary(),
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          licensePlateDataArbitrary(),
          async (imageData1, imageData2, result1, result2) => {
            // 同じ画像データの場合はスキップ
            if (imageData1 === imageData2) {
              return true;
            }

            await cache.set(imageData1, result1);
            await cache.set(imageData2, result2);

            const cached1 = await cache.get(imageData1);
            const cached2 = await cache.get(imageData2);

            return (
              cached1 !== null &&
              cached2 !== null &&
              JSON.stringify(cached1) === JSON.stringify(result1) &&
              JSON.stringify(cached2) === JSON.stringify(result2)
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("キャッシュに存在しない画像はnullを返す", async () => {
      await fc.assert(
        fc.asyncProperty(imageDataArbitrary(), async (imageData) => {
          const result = await cache.get(imageData);
          return result === null;
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * キャッシュ有効期限のプロパティテスト
   */
  describe("キャッシュ有効期限", () => {
    it("有効期限内のエントリは取得できる", async () => {
      const shortTtlCache = new RecognitionCache({
        ttl: 60000,
        maxEntries: 100,
      });

      await fc.assert(
        fc.asyncProperty(
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          async (imageData, result) => {
            await shortTtlCache.set(imageData, result);
            const cached = await shortTtlCache.get(imageData);

            return (
              cached !== null &&
              JSON.stringify(cached) === JSON.stringify(result)
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("有効期限切れのエントリはnullを返す", async () => {
      // 非常に短いTTLでテスト
      const expiredCache = new RecognitionCache({ ttl: 1, maxEntries: 100 });

      await fc.assert(
        fc.asyncProperty(
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          async (imageData, result) => {
            await expiredCache.set(imageData, result);

            // TTLが切れるまで待機
            await new Promise((resolve) => setTimeout(resolve, 10));

            const cached = await expiredCache.get(imageData);
            return cached === null;
          },
        ),
        { numRuns: 10 }, // 時間がかかるので少なめに
      );
    });
  });

  /**
   * キャッシュサイズ制限のプロパティテスト
   */
  describe("キャッシュサイズ制限", () => {
    it("最大エントリ数を超えない", async () => {
      const maxEntries = 10;
      const limitedCache = new RecognitionCache({ ttl: 60000, maxEntries });

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              imageData: imageDataArbitrary(),
              result: licensePlateDataArbitrary(),
            }),
            { minLength: 1, maxLength: 30 },
          ),
          async (entries) => {
            for (const entry of entries) {
              await limitedCache.set(entry.imageData, entry.result);
            }

            return limitedCache.size <= maxEntries;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * キャッシュ統計のプロパティテスト
   */
  describe("キャッシュ統計", () => {
    it("統計情報は常に有効な値を返す", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              imageData: imageDataArbitrary(),
              result: licensePlateDataArbitrary(),
              shouldSet: fc.boolean(),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          async (operations) => {
            const testCache = new RecognitionCache();

            for (const op of operations) {
              if (op.shouldSet) {
                await testCache.set(op.imageData, op.result);
              }
              await testCache.get(op.imageData);
            }

            const stats = testCache.getStats();

            return (
              stats.hits >= 0 &&
              stats.misses >= 0 &&
              stats.size >= 0 &&
              stats.hitRate >= 0 &&
              stats.hitRate <= 1
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("ヒット率は正しく計算される", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          async (hitCount, missCount, imageData, result) => {
            const testCache = new RecognitionCache();

            // キャッシュに保存
            await testCache.set(imageData, result);

            // ヒットを生成
            for (let i = 0; i < hitCount; i++) {
              await testCache.get(imageData);
            }

            // ミスを生成（存在しないキー）
            for (let i = 0; i < missCount; i++) {
              await testCache.get(`nonexistent_${i}_${Date.now()}`);
            }

            const stats = testCache.getStats();
            const total = hitCount + missCount;
            const expectedRate = total > 0 ? hitCount / total : 0;

            return Math.abs(stats.hitRate - expectedRate) < 0.001;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * キャッシュ削除のプロパティテスト
   */
  describe("キャッシュ削除", () => {
    it("削除後はエントリが取得できない", async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDataArbitrary(),
          licensePlateDataArbitrary(),
          async (imageData, result) => {
            await cache.set(imageData, result);

            // 削除前は取得できる
            const beforeDelete = await cache.get(imageData);
            if (beforeDelete === null) {
              return false;
            }

            // 削除
            const deleted = await cache.delete(imageData);

            // 削除後は取得できない
            const afterDelete = await cache.get(imageData);

            return deleted === true && afterDelete === null;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("クリア後は全てのエントリが削除される", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              imageData: imageDataArbitrary(),
              result: licensePlateDataArbitrary(),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (entries) => {
            for (const entry of entries) {
              await cache.set(entry.imageData, entry.result);
            }

            cache.clear();

            // 全てのエントリが削除されていることを確認
            for (const entry of entries) {
              const cached = await cache.get(entry.imageData);
              if (cached !== null) {
                return false;
              }
            }

            return cache.size === 0;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * ハッシュ生成のプロパティテスト
   */
  describe("ハッシュ生成", () => {
    it("同じデータは常に同じハッシュを生成する", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (data) => {
            const hash1 = await computeHash(data);
            const hash2 = await computeHash(data);

            return hash1 === hash2;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("異なるデータは異なるハッシュを生成する（高確率）", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (data1, data2) => {
            if (data1 === data2) {
              return true; // 同じデータの場合はスキップ
            }

            const hash1 = await computeHash(data1);
            const hash2 = await computeHash(data2);

            return hash1 !== hash2;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("キャッシュキーは同じ画像データに対して一貫している", async () => {
      await fc.assert(
        fc.asyncProperty(imageDataArbitrary(), async (imageData) => {
          const key1 = await generateCacheKey(imageData);
          const key2 = await generateCacheKey(imageData);

          return key1 === key2;
        }),
        { numRuns: 100 },
      );
    });
  });
});
