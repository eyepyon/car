/**
 * ナンバープレート認識APIルートのユニットテスト
 *
 * @description
 * POST /api/license-plate/recognize エンドポイントのテスト
 *
 * @see Requirements 3.1, 3.4
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  createLicensePlateRouter,
  type RecognizeResponse,
} from "./license-plate";
import { resetRateLimitManager } from "../middleware/rate-limiter";

describe("License Plate Recognition API", () => {
  let app: Hono;

  beforeEach(() => {
    // レート制限マネージャーをリセット
    resetRateLimitManager();

    // テスト用アプリを作成
    app = new Hono();
    app.route(
      "/api/license-plate",
      createLicensePlateRouter({
        rateLimitConfig: {
          maxConcurrent: 100,
          windowMs: 60000,
          maxRequests: 1000, // テスト用に大きな値
        },
      }),
    );
  });

  describe("POST /api/license-plate/recognize", () => {
    it("有効な画像で認識成功レスポンスを返す", async () => {
      // 有効なBase64画像データ（最小限のテストデータ）
      const validBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: validBase64,
          mode: "single",
        }),
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.region).toBe("品川");
      expect(body.data?.classificationNumber).toBe("330");
      expect(body.data?.hiragana).toBe("あ");
      expect(body.data?.serialNumber).toBe("1234");
      expect(body.data?.fullText).toBe("品川330あ1234");
      expect(body.data?.confidence).toBeGreaterThanOrEqual(0);
      expect(body.data?.confidence).toBeLessThanOrEqual(100);
      expect(body.processingTime).toBeGreaterThanOrEqual(0);
    });

    it("realtimeモードでも認識成功レスポンスを返す", async () => {
      const validBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: validBase64,
          mode: "realtime",
        }),
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(true);
    });

    it("画像データが空の場合はエラーを返す", async () => {
      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: "",
          mode: "single",
        }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error?.code).toBe("INVALID_IMAGE");
    });

    it("無効なモードの場合はエラーを返す", async () => {
      const validBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: validBase64,
          mode: "invalid",
        }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it("リクエストボディがない場合はエラーを返す", async () => {
      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(false);
    });

    it("imageフィールドがない場合はエラーを返す", async () => {
      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "single",
        }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(false);
    });

    it("modeフィールドがない場合はエラーを返す", async () => {
      const validBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: validBase64,
        }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(false);
    });

    it("data:image/...;base64,プレフィックス付きの画像も受け付ける", async () => {
      const base64WithPrefix =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64WithPrefix,
          mode: "single",
        }),
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as RecognizeResponse;
      expect(body.success).toBe(true);
    });
  });

  describe("レスポンス構造の検証", () => {
    it("成功レスポンスは必須フィールドを全て含む", async () => {
      const validBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: validBase64,
          mode: "single",
        }),
      });

      const body = (await response.json()) as RecognizeResponse;

      // RecognizeResponse構造の検証
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("processingTime");

      // LicensePlateData構造の検証
      expect(body.data).toHaveProperty("region");
      expect(body.data).toHaveProperty("classificationNumber");
      expect(body.data).toHaveProperty("hiragana");
      expect(body.data).toHaveProperty("serialNumber");
      expect(body.data).toHaveProperty("fullText");
      expect(body.data).toHaveProperty("confidence");
      expect(body.data).toHaveProperty("plateType");
      expect(body.data).toHaveProperty("recognizedAt");
    });

    it("エラーレスポンスは必須フィールドを全て含む", async () => {
      const response = await app.request("/api/license-plate/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: "",
          mode: "single",
        }),
      });

      const body = (await response.json()) as RecognizeResponse;

      // RecognizeResponse構造の検証
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("processingTime");

      // RecognitionError構造の検証
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
      expect(body.error).toHaveProperty("suggestion");
    });
  });
});
