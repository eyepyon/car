/**
 * レート制限ミドルウェアのプロパティテスト
 *
 * @description
 * Property 11: レート制限の動作
 * 任意のレート制限を超えたリクエストに対して、RATE_LIMITEDエラーコードと
 * 適切なメッセージを含むエラーレスポンスを返すこと。
 *
 * **Validates: Requirements 8.4**
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { Hono } from 'hono';
import {
  RateLimitManager,
  rateLimiterWithManager,
  type RateLimitConfig,
  type RateLimitErrorResponse,
} from './rate-limiter';

// ============================================================================
// テストデータ生成（Arbitraries）
// ============================================================================

/**
 * 有効なレート制限設定を生成
 */
const validRateLimitConfigArbitrary = (): fc.Arbitrary<RateLimitConfig> =>
  fc.record({
    maxConcurrent: fc.integer({ min: 1, max: 100 }),
    windowMs: fc.integer({ min: 100, max: 60000 }),
    maxRequests: fc.integer({ min: 1, max: 1000 }),
  });

/**
 * レート制限内のリクエスト数を生成
 */
const withinLimitRequestCountArbitrary = (maxRequests: number): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: Math.max(1, maxRequests - 1) });

// ============================================================================
// プロパティテスト
// ============================================================================

describe('Rate Limiter Property Tests', () => {
  /**
   * Property 11: レート制限の動作
   *
   * **Validates: Requirements 8.4**
   */
  describe('Property 11: レート制限の動作', () => {
    it('任意のレート制限を超えたリクエストに対して、RATE_LIMITEDエラーコードを返す', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          (config) => {
            const manager = new RateLimitManager(config);

            // ウィンドウ内のリクエスト数を上限まで使い切る
            for (let i = 0; i < config.maxRequests; i++) {
              manager.startRequest();
              manager.endRequest();
            }

            // 次のリクエストは拒否されるべき
            return manager.canAcceptRequest() === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意の同時リクエスト数が上限に達した場合、リクエストを拒否する', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          (config) => {
            const manager = new RateLimitManager(config);

            // 同時リクエスト数を上限まで使い切る
            for (let i = 0; i < config.maxConcurrent; i++) {
              manager.startRequest();
            }

            // 次のリクエストは拒否されるべき
            return manager.canAcceptRequest() === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('レート制限超過時のエラーレスポンスは必須フィールドを全て含む', async () => {
      await fc.assert(
        fc.asyncProperty(
          validRateLimitConfigArbitrary(),
          async (config) => {
            const manager = new RateLimitManager(config);
            const app = new Hono();
            app.use('/*', rateLimiterWithManager(manager));
            app.get('/test', (c) => c.json({ message: 'ok' }));

            // レート制限を超える
            for (let i = 0; i < config.maxRequests; i++) {
              manager.startRequest();
              manager.endRequest();
            }

            const response = await app.request('/test');

            if (response.status !== 429) {
              return false;
            }

            const body = (await response.json()) as RateLimitErrorResponse;

            // エラーレスポンスの構造を検証
            return (
              body.success === false &&
              body.error.code === 'RATE_LIMITED' &&
              typeof body.error.message === 'string' &&
              body.error.message.length > 0 &&
              typeof body.error.suggestion === 'string' &&
              body.error.suggestion.length > 0 &&
              typeof body.processingTime === 'number' &&
              body.processingTime >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('レート制限内のリクエストは常に受け付けられる', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          (config) => {
            const manager = new RateLimitManager(config);

            // 制限内のリクエスト数
            const requestCount = Math.min(config.maxRequests - 1, config.maxConcurrent - 1);

            if (requestCount <= 0) {
              return true; // 制限が1の場合はスキップ
            }

            // リクエストを開始して終了
            for (let i = 0; i < requestCount; i++) {
              if (!manager.canAcceptRequest()) {
                return false;
              }
              manager.startRequest();
              manager.endRequest();
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('リクエスト終了後は同時リクエストカウントが正しく減少する', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          fc.integer({ min: 1, max: 50 }),
          (config, requestCount) => {
            const manager = new RateLimitManager(config);
            const actualRequestCount = Math.min(requestCount, config.maxConcurrent);

            // リクエストを開始
            for (let i = 0; i < actualRequestCount; i++) {
              manager.startRequest();
            }

            const countAfterStart = manager.getCurrentConcurrent();

            // リクエストを終了
            for (let i = 0; i < actualRequestCount; i++) {
              manager.endRequest();
            }

            const countAfterEnd = manager.getCurrentConcurrent();

            return countAfterStart === actualRequestCount && countAfterEnd === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('同時リクエスト数は負の値にならない', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          fc.integer({ min: 1, max: 100 }),
          (config, extraEndRequests) => {
            const manager = new RateLimitManager(config);

            // いくつかのリクエストを開始して終了
            manager.startRequest();
            manager.endRequest();

            // 余分にendRequestを呼び出す
            for (let i = 0; i < extraEndRequests; i++) {
              manager.endRequest();
            }

            // 同時リクエスト数は0以上であるべき
            return manager.getCurrentConcurrent() >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('リセット後は初期状態に戻る', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          fc.integer({ min: 1, max: 50 }),
          (config, requestCount) => {
            const manager = new RateLimitManager(config);
            const actualRequestCount = Math.min(requestCount, config.maxRequests);

            // いくつかのリクエストを記録
            for (let i = 0; i < actualRequestCount; i++) {
              manager.startRequest();
            }

            // リセット
            manager.reset();

            // 初期状態に戻っているべき
            return (
              manager.getCurrentConcurrent() === 0 &&
              manager.getRequestCount() === 0 &&
              manager.canAcceptRequest() === true
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('設定値は変更されない', () => {
      fc.assert(
        fc.property(
          validRateLimitConfigArbitrary(),
          (config) => {
            const manager = new RateLimitManager(config);

            // いくつかの操作を実行
            manager.startRequest();
            manager.endRequest();
            manager.reset();

            // 設定値が変更されていないことを確認
            const retrievedConfig = manager.getConfig();
            return (
              retrievedConfig.maxConcurrent === config.maxConcurrent &&
              retrievedConfig.windowMs === config.windowMs &&
              retrievedConfig.maxRequests === config.maxRequests
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
