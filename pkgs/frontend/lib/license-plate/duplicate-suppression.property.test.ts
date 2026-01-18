/**
 * 重複認識抑制のプロパティテスト
 *
 * @description
 * Property 9: 重複認識の抑制
 * 任意の連続した同一ナンバープレートの認識に対して、
 * リアルタイムモードでは最初の認識結果のみを返し、後続の重複結果は抑制されること。
 *
 * @see Requirements 7.4
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  DuplicateSuppressionManager,
  isSameLicensePlate,
  removeDuplicatePlates,
  DEFAULT_SUPPRESSION_DURATION,
  DEFAULT_MAX_HISTORY_SIZE,
} from "./duplicate-suppression";
import type { LicensePlateData, PlateType } from "@/types/license-plate";

// ============================================================================
// テストデータ生成用 Arbitrary
// ============================================================================

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
];
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
  "わ",
  "れ",
];
const PLATE_TYPES: PlateType[] = [
  "REGULAR",
  "LIGHT",
  "COMMERCIAL",
  "RENTAL",
  "DIPLOMATIC",
];
const DIGITS = "0123456789";

/**
 * 分類番号を生成する Arbitrary
 */
const classificationNumberArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...DIGITS.split("")), { minLength: 3, maxLength: 3 })
    .map((chars) => chars.join(""));

/**
 * 一連番号を生成する Arbitrary
 */
const serialNumberArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...DIGITS.split("")), { minLength: 1, maxLength: 4 })
    .map((chars) => chars.join(""));

/**
 * 有効なLicensePlateDataを生成する Arbitrary
 */
const licensePlateDataArbitrary = (): fc.Arbitrary<LicensePlateData> =>
  fc
    .record({
      region: fc.constantFrom(...REGIONS),
      classificationNumber: classificationNumberArbitrary(),
      hiragana: fc.constantFrom(...HIRAGANA),
      serialNumber: serialNumberArbitrary(),
      confidence: fc.integer({ min: 0, max: 100 }),
      plateType: fc.constantFrom(...PLATE_TYPES),
      recognizedAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
    })
    .map((data) => ({
      ...data,
      fullText: `${data.region}${data.classificationNumber}${data.hiragana}${data.serialNumber}`,
    }));

/**
 * 異なるナンバープレートのペアを生成する Arbitrary
 */
const differentPlatesArbitrary = (): fc.Arbitrary<
  [LicensePlateData, LicensePlateData]
> =>
  fc
    .tuple(licensePlateDataArbitrary(), licensePlateDataArbitrary())
    .filter(([a, b]) => a.fullText !== b.fullText);

/**
 * 抑制時間内の時間差を生成する Arbitrary
 */
const withinSuppressionDurationArbitrary = (
  suppressionDuration: number,
): fc.Arbitrary<number> => fc.integer({ min: 0, max: suppressionDuration - 1 });

/**
 * 抑制時間を超えた時間差を生成する Arbitrary
 */
const beyondSuppressionDurationArbitrary = (
  suppressionDuration: number,
): fc.Arbitrary<number> =>
  fc.integer({ min: suppressionDuration, max: suppressionDuration * 10 });

// ============================================================================
// Property 9: 重複認識の抑制
// ============================================================================

describe("Property 9: 重複認識の抑制", () => {
  let manager: DuplicateSuppressionManager;

  beforeEach(() => {
    manager = new DuplicateSuppressionManager();
  });

  /**
   * Property 9.1: 最初の認識は常に受け入れられる
   *
   * 任意のナンバープレートに対して、最初の認識は重複として扱われないこと。
   */
  it("最初の認識は常に受け入れられる", () => {
    fc.assert(
      fc.property(licensePlateDataArbitrary(), (plate) => {
        const manager = new DuplicateSuppressionManager();
        const result = manager.checkAndRecord(plate);

        // 最初の認識は重複ではない
        expect(result.isDuplicate).toBe(false);
        expect(result.recognitionCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9.2: 抑制時間内の同一ナンバープレートは重複として扱われる
   *
   * 任意の同一ナンバープレートに対して、抑制時間内の連続認識は重複として扱われること。
   */
  it("抑制時間内の同一ナンバープレートは重複として扱われる", () => {
    fc.assert(
      fc.property(
        licensePlateDataArbitrary(),
        withinSuppressionDurationArbitrary(DEFAULT_SUPPRESSION_DURATION),
        (plate, timeDelta) => {
          const manager = new DuplicateSuppressionManager();
          const baseTime = 1000000;

          // 最初の認識
          const firstResult = manager.checkAndRecord(plate, baseTime);
          expect(firstResult.isDuplicate).toBe(false);

          // 抑制時間内の2回目の認識
          const secondResult = manager.checkAndRecord(
            plate,
            baseTime + timeDelta,
          );
          expect(secondResult.isDuplicate).toBe(true);
          expect(secondResult.timeSinceLastRecognition).toBe(timeDelta);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9.3: 抑制時間を超えた同一ナンバープレートは新規認識として扱われる
   *
   * 任意の同一ナンバープレートに対して、抑制時間を超えた認識は新規として扱われること。
   */
  it("抑制時間を超えた同一ナンバープレートは新規認識として扱われる", () => {
    fc.assert(
      fc.property(
        licensePlateDataArbitrary(),
        beyondSuppressionDurationArbitrary(DEFAULT_SUPPRESSION_DURATION),
        (plate, timeDelta) => {
          const manager = new DuplicateSuppressionManager();
          const baseTime = 1000000;

          // 最初の認識
          const firstResult = manager.checkAndRecord(plate, baseTime);
          expect(firstResult.isDuplicate).toBe(false);

          // 抑制時間を超えた2回目の認識
          const secondResult = manager.checkAndRecord(
            plate,
            baseTime + timeDelta,
          );
          expect(secondResult.isDuplicate).toBe(false);
          expect(secondResult.recognitionCount).toBe(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9.4: 異なるナンバープレートは独立して扱われる
   *
   * 任意の異なるナンバープレートに対して、それぞれ独立して認識されること。
   */
  it("異なるナンバープレートは独立して扱われる", () => {
    fc.assert(
      fc.property(differentPlatesArbitrary(), ([plateA, plateB]) => {
        const manager = new DuplicateSuppressionManager();
        const baseTime = 1000000;

        // プレートAの認識
        const resultA = manager.checkAndRecord(plateA, baseTime);
        expect(resultA.isDuplicate).toBe(false);

        // プレートBの認識（プレートAの直後でも重複ではない）
        const resultB = manager.checkAndRecord(plateB, baseTime + 100);
        expect(resultB.isDuplicate).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9.5: 認識回数は正確にカウントされる
   *
   * 任意のナンバープレートに対して、認識回数が正確にカウントされること。
   */
  it("認識回数は正確にカウントされる", () => {
    fc.assert(
      fc.property(
        licensePlateDataArbitrary(),
        fc.integer({ min: 2, max: 10 }),
        (plate, recognitionCount) => {
          const manager = new DuplicateSuppressionManager();
          let currentTime = 1000000;

          // 複数回認識（抑制時間を超えて）
          for (let i = 0; i < recognitionCount; i++) {
            const result = manager.checkAndRecord(plate, currentTime);
            expect(result.isDuplicate).toBe(false);
            expect(result.recognitionCount).toBe(i + 1);
            currentTime += DEFAULT_SUPPRESSION_DURATION + 1;
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 9.6: 履歴サイズは最大値を超えない
   *
   * 任意の数のナンバープレートを認識しても、履歴サイズは最大値を超えないこと。
   */
  it("履歴サイズは最大値を超えない", () => {
    fc.assert(
      fc.property(
        fc.array(licensePlateDataArbitrary(), { minLength: 1, maxLength: 200 }),
        (plates) => {
          const maxHistorySize = 50;
          const manager = new DuplicateSuppressionManager({ maxHistorySize });
          let currentTime = 1000000;

          // 全てのプレートを認識
          for (const plate of plates) {
            manager.checkAndRecord(plate, currentTime);
            currentTime += 100;
          }

          // 履歴サイズは最大値を超えない
          expect(manager.size).toBeLessThanOrEqual(maxHistorySize);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 9.7: クリア後は全ての認識が新規として扱われる
   *
   * 履歴をクリアした後は、以前認識したナンバープレートも新規として扱われること。
   */
  it("クリア後は全ての認識が新規として扱われる", () => {
    fc.assert(
      fc.property(licensePlateDataArbitrary(), (plate) => {
        const manager = new DuplicateSuppressionManager();
        const baseTime = 1000000;

        // 最初の認識
        manager.checkAndRecord(plate, baseTime);

        // 履歴をクリア
        manager.clear();
        expect(manager.size).toBe(0);

        // クリア後の認識は新規として扱われる
        const result = manager.checkAndRecord(plate, baseTime + 100);
        expect(result.isDuplicate).toBe(false);
        expect(result.recognitionCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9.8: isDuplicateは履歴を更新しない
   *
   * isDuplicateメソッドは履歴を更新せず、チェックのみを行うこと。
   */
  it("isDuplicateは履歴を更新しない", () => {
    fc.assert(
      fc.property(licensePlateDataArbitrary(), (plate) => {
        const manager = new DuplicateSuppressionManager();
        const baseTime = 1000000;

        // 最初の認識
        manager.checkAndRecord(plate, baseTime);

        // isDuplicateでチェック（履歴は更新されない）
        const isDup1 = manager.isDuplicate(plate, baseTime + 100);
        expect(isDup1).toBe(true);

        // 抑制時間を超えてもisDuplicateは履歴を更新しないので、
        // checkAndRecordで確認すると新規認識として扱われる
        const isDup2 = manager.isDuplicate(
          plate,
          baseTime + DEFAULT_SUPPRESSION_DURATION + 1,
        );
        expect(isDup2).toBe(false);

        // checkAndRecordで確認
        const result = manager.checkAndRecord(
          plate,
          baseTime + DEFAULT_SUPPRESSION_DURATION + 1,
        );
        expect(result.isDuplicate).toBe(false);
        expect(result.recognitionCount).toBe(2);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// ユーティリティ関数のテスト
// ============================================================================

describe("isSameLicensePlate", () => {
  it("同一のfullTextを持つプレートは同一と判定される", () => {
    fc.assert(
      fc.property(licensePlateDataArbitrary(), (plate) => {
        // 同じプレートは同一
        expect(isSameLicensePlate(plate, plate)).toBe(true);

        // fullTextが同じなら同一
        const copy = { ...plate };
        expect(isSameLicensePlate(plate, copy)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("異なるfullTextを持つプレートは異なると判定される", () => {
    fc.assert(
      fc.property(differentPlatesArbitrary(), ([plateA, plateB]) => {
        expect(isSameLicensePlate(plateA, plateB)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe("removeDuplicatePlates", () => {
  it("重複を除去した配列を返す", () => {
    fc.assert(
      fc.property(
        fc.array(licensePlateDataArbitrary(), { minLength: 0, maxLength: 50 }),
        (plates) => {
          const result = removeDuplicatePlates(plates);

          // 結果の長さは元の配列以下
          expect(result.length).toBeLessThanOrEqual(plates.length);

          // 結果に重複がない
          const fullTexts = result.map((p) => p.fullText);
          const uniqueFullTexts = new Set(fullTexts);
          expect(fullTexts.length).toBe(uniqueFullTexts.size);

          // 元の配列の全てのfullTextが結果に含まれる
          const resultFullTexts = new Set(result.map((p) => p.fullText));
          for (const plate of plates) {
            expect(resultFullTexts.has(plate.fullText)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("空の配列に対しては空の配列を返す", () => {
    const result = removeDuplicatePlates([]);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// 設定のテスト
// ============================================================================

describe("DuplicateSuppressionManager 設定", () => {
  it("カスタム抑制時間が正しく適用される", () => {
    fc.assert(
      fc.property(
        licensePlateDataArbitrary(),
        fc.integer({ min: 1000, max: 30000 }),
        (plate, customDuration) => {
          const manager = new DuplicateSuppressionManager({
            suppressionDuration: customDuration,
          });
          const baseTime = 1000000;

          // 最初の認識
          manager.checkAndRecord(plate, baseTime);

          // カスタム抑制時間内は重複
          const withinResult = manager.checkAndRecord(
            plate,
            baseTime + customDuration - 1,
          );
          expect(withinResult.isDuplicate).toBe(true);

          // カスタム抑制時間を超えると新規
          const beyondResult = manager.checkAndRecord(
            plate,
            baseTime + customDuration,
          );
          expect(beyondResult.isDuplicate).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("設定が正しく取得できる", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 30000 }),
        fc.integer({ min: 10, max: 500 }),
        (suppressionDuration, maxHistorySize) => {
          const manager = new DuplicateSuppressionManager({
            suppressionDuration,
            maxHistorySize,
          });

          const config = manager.config;
          expect(config.suppressionDuration).toBe(suppressionDuration);
          expect(config.maxHistorySize).toBe(maxHistorySize);
        },
      ),
      { numRuns: 50 },
    );
  });
});
