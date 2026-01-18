/**
 * レート制限ミドルウェア
 *
 * @description
 * 同時リクエスト数とリクエストレートを制限するミドルウェア。
 * 高負荷時に適切なエラーレスポンスを返す。
 *
 * @see Requirements 8.2, 8.4
 */

import type { Context, Next, MiddlewareHandler } from "hono";

// ============================================================================
// 型定義
// ============================================================================

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  /**
   * 最大同時リクエスト数
   * @default 100
   */
  maxConcurrent: number;

  /**
   * レート制限のウィンドウ時間（ミリ秒）
   * @default 60000 (1分)
   */
  windowMs: number;

  /**
   * ウィンドウ内の最大リクエスト数
   * @default 100
   */
  maxRequests: number;
}

/**
 * レート制限エラーレスポンス
 */
export interface RateLimitErrorResponse {
  success: false;
  error: {
    code: "RATE_LIMITED";
    message: string;
    suggestion: string;
  };
  processingTime: number;
}

/**
 * レート制限の状態
 */
interface RateLimitState {
  /** 現在の同時リクエスト数 */
  currentConcurrent: number;
  /** ウィンドウ内のリクエスト履歴（タイムスタンプ） */
  requestTimestamps: number[];
}

// ============================================================================
// レート制限クラス
// ============================================================================

/**
 * レート制限マネージャー
 *
 * @description
 * 同時リクエスト数とリクエストレートを管理するクラス。
 * スライディングウィンドウアルゴリズムを使用。
 */
export class RateLimitManager {
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.state = {
      currentConcurrent: 0,
      requestTimestamps: [],
    };
  }

  /**
   * 現在の同時リクエスト数を取得
   */
  getCurrentConcurrent(): number {
    return this.state.currentConcurrent;
  }

  /**
   * ウィンドウ内のリクエスト数を取得
   */
  getRequestCount(): number {
    this.cleanupOldTimestamps();
    return this.state.requestTimestamps.length;
  }

  /**
   * リクエストを許可するかチェック
   *
   * @returns 許可される場合true
   */
  canAcceptRequest(): boolean {
    this.cleanupOldTimestamps();

    // 同時リクエスト数のチェック
    if (this.state.currentConcurrent >= this.config.maxConcurrent) {
      return false;
    }

    // ウィンドウ内のリクエスト数のチェック
    if (this.state.requestTimestamps.length >= this.config.maxRequests) {
      return false;
    }

    return true;
  }

  /**
   * リクエスト開始を記録
   */
  startRequest(): void {
    this.state.currentConcurrent++;
    this.state.requestTimestamps.push(Date.now());
  }

  /**
   * リクエスト終了を記録
   */
  endRequest(): void {
    this.state.currentConcurrent = Math.max(
      0,
      this.state.currentConcurrent - 1,
    );
  }

  /**
   * 古いタイムスタンプをクリーンアップ
   */
  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.state.requestTimestamps = this.state.requestTimestamps.filter(
      (timestamp) => timestamp > windowStart,
    );
  }

  /**
   * 状態をリセット（テスト用）
   */
  reset(): void {
    this.state = {
      currentConcurrent: 0,
      requestTimestamps: [],
    };
  }

  /**
   * 設定を取得
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

// ============================================================================
// デフォルト設定
// ============================================================================

/**
 * デフォルトのレート制限設定
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxConcurrent: 100,
  windowMs: 60000, // 1分
  maxRequests: 100,
};

// ============================================================================
// ミドルウェア
// ============================================================================

/**
 * グローバルなレート制限マネージャーインスタンス
 * （テスト時にリセット可能）
 */
let globalRateLimitManager: RateLimitManager | null = null;

/**
 * グローバルなレート制限マネージャーを取得または作成
 */
export function getOrCreateRateLimitManager(
  config: RateLimitConfig,
): RateLimitManager {
  if (!globalRateLimitManager) {
    globalRateLimitManager = new RateLimitManager(config);
  }
  return globalRateLimitManager;
}

/**
 * グローバルなレート制限マネージャーをリセット（テスト用）
 */
export function resetRateLimitManager(): void {
  if (globalRateLimitManager) {
    globalRateLimitManager.reset();
  }
  globalRateLimitManager = null;
}

/**
 * レート制限ミドルウェアを作成
 *
 * @param config - レート制限設定
 * @returns Honoミドルウェア
 *
 * @example
 * ```typescript
 * const app = new Hono();
 * app.use('/api/*', rateLimiter({ maxConcurrent: 100, windowMs: 60000, maxRequests: 100 }));
 * ```
 *
 * @see Requirements 8.2, 8.4
 */
export function rateLimiter(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
): MiddlewareHandler {
  const manager = getOrCreateRateLimitManager(config);

  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    // レート制限チェック
    if (!manager.canAcceptRequest()) {
      const processingTime = Date.now() - startTime;

      const errorResponse: RateLimitErrorResponse = {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "リクエスト数が制限を超えました",
          suggestion: "しばらく待ってから再試行してください",
        },
        processingTime,
      };

      // ログ記録
      console.warn("[RateLimiter] Rate limit exceeded:", {
        currentConcurrent: manager.getCurrentConcurrent(),
        requestCount: manager.getRequestCount(),
        maxConcurrent: config.maxConcurrent,
        maxRequests: config.maxRequests,
      });

      return c.json(errorResponse, 429);
    }

    // リクエスト開始を記録
    manager.startRequest();

    try {
      // 次のミドルウェア/ハンドラーを実行
      await next();
    } finally {
      // リクエスト終了を記録
      manager.endRequest();
    }
  };
}

/**
 * カスタムレート制限マネージャーを使用するミドルウェアを作成
 * （テスト用）
 */
export function rateLimiterWithManager(
  manager: RateLimitManager,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    // レート制限チェック
    if (!manager.canAcceptRequest()) {
      const processingTime = Date.now() - startTime;

      const errorResponse: RateLimitErrorResponse = {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "リクエスト数が制限を超えました",
          suggestion: "しばらく待ってから再試行してください",
        },
        processingTime,
      };

      return c.json(errorResponse, 429);
    }

    // リクエスト開始を記録
    manager.startRequest();

    try {
      await next();
    } finally {
      manager.endRequest();
    }
  };
}

export default rateLimiter;
