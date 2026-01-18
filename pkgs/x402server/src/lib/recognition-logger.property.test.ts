/**
 * 認識ログ機能のプロパティテスト
 *
 * @description
 * Property 7: エラーレスポンスの構造
 * 任意のエラーが発生した場合、RecognitionErrorはcode、message、suggestionの
 * 全フィールドを含み、エラーログが記録されること。
 *
 * **Validates: Requirements 6.3, 6.4**
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { RecognitionLogger } from "./recognition-logger";
import {
  createRecognitionError,
  RECOGNITION_ERROR_MESSAGES,
  type RecognitionErrorCode,
} from "../routes/license-plate";

// ============================================================================
// テストデータ生成（Arbitraries）
// ============================================================================

/**
 * 16進数文字を生成するための定数
 */
const HEX_CHARS = "0123456789abcdef";

/**
 * 有効な認識エラーコードを生成
 */
const recognitionErrorCodeArbitrary = (): fc.Arbitrary<RecognitionErrorCode> =>
  fc.constantFrom(
    "NO_PLATE_DETECTED",
    "PARTIAL_RECOGNITION",
    "API_CONNECTION_FAILED",
    "TIMEOUT",
    "RATE_LIMITED",
    "INVALID_IMAGE",
  );

/**
 * 有効な認識モードを生成
 */
const recognitionModeArbitrary = (): fc.Arbitrary<"single" | "realtime"> =>
  fc.constantFrom("single", "realtime");

/**
 * 有効な処理時間を生成
 */
const processingTimeArbitrary = (): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 10000 });

/**
 * 有効な信頼度を生成
 */
const confidenceArbitrary = (): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 100 });

/**
 * 有効な画像ハッシュを生成（64文字の16進数文字列）
 */
const imageHashArbitrary = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...HEX_CHARS.split("")), {
      minLength: 64,
      maxLength: 64,
    })
    .map((chars) => chars.join(""));

// ============================================================================
// プロパティテスト
// ============================================================================

describe("Recognition Logger Property Tests", () => {
  let logger: RecognitionLogger;

  beforeEach(() => {
    logger = new RecognitionLogger();
  });

  /**
   * Property 7: エラーレスポンスの構造
   *
   * **Validates: Requirements 6.3, 6.4**
   */
  describe("Property 7: エラーレスポンスの構造", () => {
    it("任意のエラーコードに対して、RecognitionErrorは必須フィールドを全て含む", () => {
      fc.assert(
        fc.property(recognitionErrorCodeArbitrary(), (errorCode) => {
          const error = createRecognitionError(errorCode);

          return (
            typeof error.code === "string" &&
            error.code === errorCode &&
            typeof error.message === "string" &&
            error.message.length > 0 &&
            typeof error.suggestion === "string" &&
            error.suggestion.length > 0
          );
        }),
        { numRuns: 100 },
      );
    });

    it("任意のエラーコードに対して、エラーメッセージは日本語で提供される", () => {
      fc.assert(
        fc.property(recognitionErrorCodeArbitrary(), (errorCode) => {
          const error = createRecognitionError(errorCode);

          // 日本語文字が含まれているかチェック
          const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
            error.message + error.suggestion,
          );

          return hasJapanese;
        }),
        { numRuns: 100 },
      );
    });

    it("任意のエラーに対して、エラーログが記録される", () => {
      fc.assert(
        fc.property(
          imageHashArbitrary(),
          processingTimeArbitrary(),
          recognitionErrorCodeArbitrary(),
          recognitionModeArbitrary(),
          (imageHash, processingTime, errorCode, mode) => {
            const initialCount = logger.getLogCount();

            logger.logError({
              imageHash,
              processingTime,
              errorCode,
              mode,
            });

            const newCount = logger.getLogCount();
            const recentLogs = logger.getRecentLogs(1);

            return (
              newCount === initialCount + 1 &&
              recentLogs.length === 1 &&
              recentLogs[0].success === false &&
              recentLogs[0].errorCode === errorCode
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("任意の成功に対して、成功ログが記録される", () => {
      fc.assert(
        fc.property(
          imageHashArbitrary(),
          processingTimeArbitrary(),
          confidenceArbitrary(),
          recognitionModeArbitrary(),
          (imageHash, processingTime, confidence, mode) => {
            const initialCount = logger.getLogCount();

            logger.logSuccess({
              imageHash,
              processingTime,
              confidence,
              mode,
            });

            const newCount = logger.getLogCount();
            const recentLogs = logger.getRecentLogs(1);

            return (
              newCount === initialCount + 1 &&
              recentLogs.length === 1 &&
              recentLogs[0].success === true &&
              recentLogs[0].confidence === confidence
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("全てのエラーコードに対応するメッセージが定義されている", () => {
      const allErrorCodes: RecognitionErrorCode[] = [
        "NO_PLATE_DETECTED",
        "PARTIAL_RECOGNITION",
        "API_CONNECTION_FAILED",
        "TIMEOUT",
        "RATE_LIMITED",
        "INVALID_IMAGE",
      ];

      for (const code of allErrorCodes) {
        const messages = RECOGNITION_ERROR_MESSAGES[code];
        expect(messages).toBeDefined();
        expect(messages.message).toBeTruthy();
        expect(messages.suggestion).toBeTruthy();
      }
    });
  });

  /**
   * ログ統計のプロパティテスト
   */
  describe("ログ統計", () => {
    it("統計情報は常に有効な値を返す", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              success: fc.boolean(),
              processingTime: processingTimeArbitrary(),
              confidence: confidenceArbitrary(),
              errorCode: recognitionErrorCodeArbitrary(),
              mode: recognitionModeArbitrary(),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          (logEntries) => {
            const testLogger = new RecognitionLogger();

            for (const entry of logEntries) {
              if (entry.success) {
                testLogger.logSuccess({
                  imageHash: "test",
                  processingTime: entry.processingTime,
                  confidence: entry.confidence,
                  mode: entry.mode,
                });
              } else {
                testLogger.logError({
                  imageHash: "test",
                  processingTime: entry.processingTime,
                  errorCode: entry.errorCode,
                  mode: entry.mode,
                });
              }
            }

            const stats = testLogger.getStatistics();

            return (
              stats.totalRequests === logEntries.length &&
              stats.successCount >= 0 &&
              stats.failureCount >= 0 &&
              stats.successCount + stats.failureCount === stats.totalRequests &&
              stats.successRate >= 0 &&
              stats.successRate <= 100 &&
              stats.averageProcessingTime >= 0
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it("成功率は正しく計算される", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          (successCount, failureCount) => {
            const testLogger = new RecognitionLogger();

            for (let i = 0; i < successCount; i++) {
              testLogger.logSuccess({
                imageHash: "test",
                processingTime: 100,
                confidence: 90,
                mode: "single",
              });
            }

            for (let i = 0; i < failureCount; i++) {
              testLogger.logError({
                imageHash: "test",
                processingTime: 100,
                errorCode: "TIMEOUT",
                mode: "single",
              });
            }

            const stats = testLogger.getStatistics();
            const total = successCount + failureCount;
            const expectedRate = total > 0 ? (successCount / total) * 100 : 0;

            return Math.abs(stats.successRate - expectedRate) < 0.001;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * 画像ハッシュのプロパティテスト
   */
  describe("画像ハッシュ", () => {
    it("同じ画像データは常に同じハッシュを生成する", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (imageData) => {
            const hash1 = RecognitionLogger.hashImage(imageData);
            const hash2 = RecognitionLogger.hashImage(imageData);

            return hash1 === hash2;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("異なる画像データは異なるハッシュを生成する（高確率）", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          (imageData1, imageData2) => {
            if (imageData1 === imageData2) {
              return true; // 同じデータの場合はスキップ
            }

            const hash1 = RecognitionLogger.hashImage(imageData1);
            const hash2 = RecognitionLogger.hashImage(imageData2);

            return hash1 !== hash2;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("ハッシュは64文字の16進数文字列である", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (imageData) => {
            const hash = RecognitionLogger.hashImage(imageData);

            return hash.length === 64 && /^[0-9a-f]+$/.test(hash);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * ログ管理のプロパティテスト
   */
  describe("ログ管理", () => {
    it("ログ数は最大値を超えない", () => {
      const maxLogs = 100;
      const testLogger = new RecognitionLogger(maxLogs);

      fc.assert(
        fc.property(fc.integer({ min: 1, max: 200 }), (logCount) => {
          for (let i = 0; i < logCount; i++) {
            testLogger.logSuccess({
              imageHash: `test${i}`,
              processingTime: 100,
              confidence: 90,
              mode: "single",
            });
          }

          return testLogger.getLogCount() <= maxLogs;
        }),
        { numRuns: 10 },
      );
    });

    it("クリア後はログ数が0になる", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 50 }), (logCount) => {
          const testLogger = new RecognitionLogger();

          for (let i = 0; i < logCount; i++) {
            testLogger.logSuccess({
              imageHash: `test${i}`,
              processingTime: 100,
              confidence: 90,
              mode: "single",
            });
          }

          testLogger.clear();

          return testLogger.getLogCount() === 0;
        }),
        { numRuns: 100 },
      );
    });
  });
});
