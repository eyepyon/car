/**
 * Qwen-VLクライアントのプロパティテスト
 *
 * @description
 * Property 8: リトライ動作
 * 任意のAPI接続失敗に対して、License_Plate_Recognition_Serviceは
 * 設定された回数（デフォルト3回）のリトライを実行し、
 * 全て失敗した場合にAPI_CONNECTION_FAILEDエラーを返すこと。
 *
 * **Validates: Requirements 6.1**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  withRetry,
  withTimeout,
  sleep,
  QwenVLError,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "./qwen-vl-client";

// ============================================================================
// テストデータ生成（Arbitraries）
// ============================================================================

/**
 * 有効なリトライ設定を生成（遅延を最小化してテストを高速化）
 */
const validRetryConfigArbitrary = (): fc.Arbitrary<RetryConfig> =>
  fc.record({
    maxRetries: fc.integer({ min: 0, max: 3 }),
    initialDelay: fc.constant(1), // 最小遅延でテストを高速化
    maxDelay: fc.constant(5),
    backoffMultiplier: fc.constant(1.1),
  });

// ============================================================================
// プロパティテスト
// ============================================================================

describe("Qwen-VL Client Property Tests", () => {
  /**
   * Property 8: リトライ動作
   *
   * **Validates: Requirements 6.1**
   */
  describe("Property 8: リトライ動作", () => {
    it("任意のリトライ設定で、失敗回数がリトライ回数以下なら最終的に成功する", async () => {
      await fc.assert(
        fc.asyncProperty(
          validRetryConfigArbitrary(),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 0, max: 3 }),
          async (config, successValue, failCountRaw) => {
            // 失敗回数をリトライ回数以下に設定
            const failCount = Math.min(failCountRaw, config.maxRetries);
            let attempts = 0;

            const fn = async () => {
              attempts++;
              if (attempts <= failCount) {
                throw new QwenVLError(
                  "Test error",
                  "API_CONNECTION_FAILED",
                  true,
                );
              }
              return successValue;
            };

            const result = await withRetry(fn, config);

            return result === successValue;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("任意のリトライ設定で、全てのリトライが失敗した場合はエラーを投げる", async () => {
      await fc.assert(
        fc.asyncProperty(validRetryConfigArbitrary(), async (config) => {
          const fn = async (): Promise<never> => {
            throw new QwenVLError("Test error", "API_CONNECTION_FAILED", true);
          };

          try {
            await withRetry(fn, config);
            return false; // エラーが投げられるべき
          } catch (error) {
            if (error instanceof QwenVLError) {
              return error.code === "API_CONNECTION_FAILED";
            }
            return false;
          }
        }),
        { numRuns: 100 },
      );
    });

    it("リトライ不可能なエラーは即座に投げられる", async () => {
      await fc.assert(
        fc.asyncProperty(validRetryConfigArbitrary(), async (config) => {
          let callCount = 0;
          const fn = async (): Promise<never> => {
            callCount++;
            throw new QwenVLError("Non-retryable", "INVALID_RESPONSE", false);
          };

          try {
            await withRetry(fn, config);
            return false;
          } catch (error) {
            // リトライ不可能なエラーは1回の呼び出しで即座に投げられる
            return callCount === 1 && error instanceof QwenVLError;
          }
        }),
        { numRuns: 100 },
      );
    });

    it("リトライ回数は設定された最大値を超えない", async () => {
      await fc.assert(
        fc.asyncProperty(validRetryConfigArbitrary(), async (config) => {
          let callCount = 0;
          const fn = async (): Promise<never> => {
            callCount++;
            throw new QwenVLError("Test error", "API_CONNECTION_FAILED", true);
          };

          try {
            await withRetry(fn, config);
          } catch {
            // 期待通りエラー
          }

          // 呼び出し回数は初回 + リトライ回数
          return callCount === config.maxRetries + 1;
        }),
        { numRuns: 100 },
      );
    });

    it("成功した場合、それ以上のリトライは実行されない", async () => {
      await fc.assert(
        fc.asyncProperty(
          validRetryConfigArbitrary(),
          fc.integer({ min: 0, max: 3 }),
          async (config, failBeforeSuccess) => {
            const actualFailCount = Math.min(
              failBeforeSuccess,
              config.maxRetries,
            );
            let callCount = 0;

            const fn = async () => {
              callCount++;
              if (callCount <= actualFailCount) {
                throw new QwenVLError(
                  "Test error",
                  "API_CONNECTION_FAILED",
                  true,
                );
              }
              return "success";
            };

            await withRetry(fn, config);

            // 呼び出し回数は失敗回数 + 成功の1回
            return callCount === actualFailCount + 1;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * タイムアウト動作のプロパティテスト
   *
   * **Validates: Requirements 6.2**
   */
  describe("タイムアウト動作", () => {
    it("タイムアウト時間内に完了する処理は成功する", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (value) => {
          // 即座に解決するPromise
          const fn = async () => value;
          const result = await withTimeout(fn(), 1000);
          return result === value;
        }),
        { numRuns: 50 },
      );
    });

    it("タイムアウト時間を超える処理はTIMEOUTエラーを投げる", async () => {
      // タイムアウトより長い処理
      const longRunningPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 200);
      });

      try {
        await withTimeout(longRunningPromise, 50);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(QwenVLError);
        if (error instanceof QwenVLError) {
          expect(error.code).toBe("TIMEOUT");
          expect(error.retryable).toBe(true);
        }
      }
    });
  });

  /**
   * デフォルト設定のプロパティテスト
   */
  describe("デフォルト設定", () => {
    it("デフォルトのリトライ設定は有効な値を持つ", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_RETRY_CONFIG.initialDelay).toBeGreaterThan(0);
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBeGreaterThanOrEqual(
        DEFAULT_RETRY_CONFIG.initialDelay,
      );
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBeGreaterThan(1);
    });

    it("デフォルト設定でのリトライ回数は3回", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    });
  });

  /**
   * QwenVLErrorのプロパティテスト
   */
  describe("QwenVLError", () => {
    it("任意のエラーコードとメッセージでQwenVLErrorを作成できる", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "API_CONNECTION_FAILED",
            "TIMEOUT",
            "INVALID_RESPONSE",
            "NO_PLATE_DETECTED",
            "PARSE_ERROR",
          ) as fc.Arbitrary<
            | "API_CONNECTION_FAILED"
            | "TIMEOUT"
            | "INVALID_RESPONSE"
            | "NO_PLATE_DETECTED"
            | "PARSE_ERROR"
          >,
          fc.string({ minLength: 1 }),
          fc.boolean(),
          (code, message, retryable) => {
            const error = new QwenVLError(message, code, retryable);

            return (
              error.code === code &&
              error.message === message &&
              error.retryable === retryable &&
              error.name === "QwenVLError" &&
              error instanceof Error
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * sleep関数のプロパティテスト
   */
  describe("sleep関数", () => {
    it("sleep関数は指定時間後に解決する", async () => {
      const ms = 10;
      const start = Date.now();
      await sleep(ms);
      const elapsed = Date.now() - start;

      // 許容誤差を考慮（タイマーの精度による）
      expect(elapsed).toBeGreaterThanOrEqual(ms - 5);
      expect(elapsed).toBeLessThan(ms + 100);
    });
  });
});
