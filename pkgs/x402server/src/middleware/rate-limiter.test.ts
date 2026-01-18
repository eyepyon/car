/**
 * レート制限ミドルウェアのユニットテスト
 *
 * @description
 * 同時リクエスト数とリクエストレートの制限をテスト
 *
 * @see Requirements 8.2, 8.4
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  RateLimitManager,
  rateLimiterWithManager,
  type RateLimitConfig,
  type RateLimitErrorResponse,
} from "./rate-limiter";

describe("RateLimitManager", () => {
  let manager: RateLimitManager;
  const defaultConfig: RateLimitConfig = {
    maxConcurrent: 5,
    windowMs: 1000,
    maxRequests: 10,
  };

  beforeEach(() => {
    manager = new RateLimitManager(defaultConfig);
  });

  describe("canAcceptRequest", () => {
    it("初期状態ではリクエストを受け付ける", () => {
      expect(manager.canAcceptRequest()).toBe(true);
    });

    it("同時リクエスト数が上限に達するとリクエストを拒否する", () => {
      // 5つのリクエストを開始
      for (let i = 0; i < 5; i++) {
        manager.startRequest();
      }

      expect(manager.canAcceptRequest()).toBe(false);
    });

    it("リクエスト終了後は再びリクエストを受け付ける", () => {
      // 5つのリクエストを開始
      for (let i = 0; i < 5; i++) {
        manager.startRequest();
      }

      expect(manager.canAcceptRequest()).toBe(false);

      // 1つのリクエストを終了
      manager.endRequest();

      expect(manager.canAcceptRequest()).toBe(true);
    });

    it("ウィンドウ内のリクエスト数が上限に達するとリクエストを拒否する", () => {
      // 10個のリクエストを開始して終了
      for (let i = 0; i < 10; i++) {
        manager.startRequest();
        manager.endRequest();
      }

      expect(manager.canAcceptRequest()).toBe(false);
    });
  });

  describe("getCurrentConcurrent", () => {
    it("現在の同時リクエスト数を正しく返す", () => {
      expect(manager.getCurrentConcurrent()).toBe(0);

      manager.startRequest();
      expect(manager.getCurrentConcurrent()).toBe(1);

      manager.startRequest();
      expect(manager.getCurrentConcurrent()).toBe(2);

      manager.endRequest();
      expect(manager.getCurrentConcurrent()).toBe(1);
    });
  });

  describe("getRequestCount", () => {
    it("ウィンドウ内のリクエスト数を正しく返す", () => {
      expect(manager.getRequestCount()).toBe(0);

      manager.startRequest();
      expect(manager.getRequestCount()).toBe(1);

      manager.startRequest();
      expect(manager.getRequestCount()).toBe(2);
    });
  });

  describe("reset", () => {
    it("状態をリセットする", () => {
      manager.startRequest();
      manager.startRequest();

      expect(manager.getCurrentConcurrent()).toBe(2);
      expect(manager.getRequestCount()).toBe(2);

      manager.reset();

      expect(manager.getCurrentConcurrent()).toBe(0);
      expect(manager.getRequestCount()).toBe(0);
    });
  });

  describe("ウィンドウのクリーンアップ", () => {
    it("古いタイムスタンプはクリーンアップされる", async () => {
      // 短いウィンドウで新しいマネージャーを作成
      const shortWindowManager = new RateLimitManager({
        maxConcurrent: 100,
        windowMs: 100, // 100ms
        maxRequests: 5,
      });

      // 5つのリクエストを記録
      for (let i = 0; i < 5; i++) {
        shortWindowManager.startRequest();
        shortWindowManager.endRequest();
      }

      expect(shortWindowManager.canAcceptRequest()).toBe(false);

      // ウィンドウが過ぎるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 古いタイムスタンプがクリーンアップされ、リクエストを受け付けるようになる
      expect(shortWindowManager.canAcceptRequest()).toBe(true);
    });
  });
});

describe("rateLimiterWithManager middleware", () => {
  let app: Hono;
  let manager: RateLimitManager;

  beforeEach(() => {
    manager = new RateLimitManager({
      maxConcurrent: 2,
      windowMs: 60000,
      maxRequests: 5,
    });

    app = new Hono();
    app.use("/*", rateLimiterWithManager(manager));
    app.get("/test", (c) => c.json({ message: "ok" }));
  });

  it("レート制限内のリクエストは成功する", async () => {
    const response = await app.request("/test");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ message: "ok" });
  });

  it("レート制限を超えるとRATE_LIMITEDエラーを返す", async () => {
    // ウィンドウ内のリクエスト数を上限まで使い切る
    for (let i = 0; i < 5; i++) {
      manager.startRequest();
      manager.endRequest();
    }

    const response = await app.request("/test");

    expect(response.status).toBe(429);

    const body = (await response.json()) as RateLimitErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("リクエスト数が制限を超えました");
    expect(body.error.suggestion).toBe("しばらく待ってから再試行してください");
  });

  it("同時リクエスト数が上限を超えるとRATE_LIMITEDエラーを返す", async () => {
    // 2つの同時リクエストを開始（終了しない）
    manager.startRequest();
    manager.startRequest();

    const response = await app.request("/test");

    expect(response.status).toBe(429);

    const body = (await response.json()) as RateLimitErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("リクエスト完了後は同時リクエストカウントが減少する", async () => {
    // 最初のリクエスト
    const response1 = await app.request("/test");
    expect(response1.status).toBe(200);

    // 2番目のリクエスト
    const response2 = await app.request("/test");
    expect(response2.status).toBe(200);

    // 同時リクエスト数は0に戻っているはず
    expect(manager.getCurrentConcurrent()).toBe(0);
  });

  it("エラーレスポンスにprocessingTimeが含まれる", async () => {
    // レート制限を超える
    for (let i = 0; i < 5; i++) {
      manager.startRequest();
      manager.endRequest();
    }

    const response = await app.request("/test");
    const body = (await response.json()) as RateLimitErrorResponse;

    expect(body).toHaveProperty("processingTime");
    expect(typeof body.processingTime).toBe("number");
    expect(body.processingTime).toBeGreaterThanOrEqual(0);
  });
});
