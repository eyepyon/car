/**
 * ナンバープレート認識機能の統合テスト
 *
 * @description
 * カメラキャプチャ → 検証 → API呼び出し → 結果表示の
 * エンドツーエンドフローをテスト
 *
 * @see Requirements 1.1-8.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateImage,
  validateImageSync,
  validateResolution,
} from "./image-validator";
import {
  DuplicateSuppressionManager,
  isSameLicensePlate,
  removeDuplicatePlates,
} from "./duplicate-suppression";
import { LicensePlateApiClient, LicensePlateApiError } from "./api-client";
import type {
  CapturedImage,
  LicensePlateData,
  RecognizeResponse,
} from "@/types/license-plate";

// ============================================================================
// テストデータ
// ============================================================================

const createMockImage = (
  overrides?: Partial<CapturedImage>,
): CapturedImage => ({
  base64:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=",
  width: 1280,
  height: 720,
  timestamp: Date.now(),
  ...overrides,
});

const createMockLicensePlateData = (
  overrides?: Partial<LicensePlateData>,
): LicensePlateData => ({
  region: "品川",
  classificationNumber: "302",
  hiragana: "ほ",
  serialNumber: "3184",
  fullText: "品川302ほ3184",
  confidence: 98,
  plateType: "REGULAR",
  recognizedAt: Date.now(),
  ...overrides,
});

// ============================================================================
// 統合テスト: 画像検証フロー
// ============================================================================

describe("統合テスト: 画像検証フロー", () => {
  it("有効な画像は解像度検証を通過する", () => {
    const image = createMockImage();
    const result = validateResolution(image);

    // 解像度が十分な場合はnullを返す
    expect(result).toBeNull();
  });

  it("解像度が低い画像は検証に失敗する", () => {
    const image = createMockImage({ width: 320, height: 240 });
    const result = validateResolution(image);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("RESOLUTION");
  });

  it("検証エラーには日本語メッセージと提案が含まれる", () => {
    const image = createMockImage({ width: 320, height: 240 });
    const result = validateResolution(image);

    expect(result).not.toBeNull();
    expect(result?.message).toBeTruthy();
    expect(result?.suggestion).toBeTruthy();
  });

  it("validateImageSyncは解像度チェックを実行する", () => {
    const validImage = createMockImage();
    const invalidImage = createMockImage({ width: 320, height: 240 });

    // ImageDataなしの場合は解像度チェックのみ
    const validResult = validateImageSync(validImage);
    const invalidResult = validateImageSync(invalidImage);

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.some((e) => e.code === "RESOLUTION")).toBe(
      true,
    );
  });
});

// ============================================================================
// 統合テスト: 重複認識抑制フロー
// ============================================================================

describe("統合テスト: 重複認識抑制フロー", () => {
  let manager: DuplicateSuppressionManager;

  beforeEach(() => {
    manager = new DuplicateSuppressionManager({
      suppressionDuration: 5000,
    });
  });

  it("最初の認識は受け入れられる", () => {
    const plate = createMockLicensePlateData();
    const result = manager.checkAndRecord(plate);

    expect(result.isDuplicate).toBe(false);
    expect(result.recognitionCount).toBe(1);
  });

  it("抑制時間内の同一ナンバーは重複として扱われる", () => {
    const plate = createMockLicensePlateData();
    const baseTime = 1000000;

    manager.checkAndRecord(plate, baseTime);
    const result = manager.checkAndRecord(plate, baseTime + 1000);

    expect(result.isDuplicate).toBe(true);
  });

  it("異なるナンバーは独立して認識される", () => {
    const plate1 = createMockLicensePlateData({ fullText: "品川330あ1234" });
    const plate2 = createMockLicensePlateData({ fullText: "横浜500か5678" });

    const result1 = manager.checkAndRecord(plate1);
    const result2 = manager.checkAndRecord(plate2);

    expect(result1.isDuplicate).toBe(false);
    expect(result2.isDuplicate).toBe(false);
  });

  it("isSameLicensePlateは同一ナンバーを正しく判定する", () => {
    const plate1 = createMockLicensePlateData();
    const plate2 = createMockLicensePlateData();
    const plate3 = createMockLicensePlateData({ fullText: "横浜500か5678" });

    expect(isSameLicensePlate(plate1, plate2)).toBe(true);
    expect(isSameLicensePlate(plate1, plate3)).toBe(false);
  });

  it("removeDuplicatePlatesは重複を除去する", () => {
    const plates = [
      createMockLicensePlateData({ fullText: "品川330あ1234" }),
      createMockLicensePlateData({ fullText: "横浜500か5678" }),
      createMockLicensePlateData({ fullText: "品川330あ1234" }), // 重複
    ];

    const result = removeDuplicatePlates(plates);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.fullText)).toEqual([
      "品川330あ1234",
      "横浜500か5678",
    ]);
  });
});

// ============================================================================
// 統合テスト: APIクライアントフロー
// ============================================================================

describe("統合テスト: APIクライアントフロー", () => {
  let client: LicensePlateApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    client = new LicensePlateApiClient({
      baseUrl: "http://localhost:3001",
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("成功レスポンスを正しく処理する", async () => {
    const mockResponse: RecognizeResponse = {
      success: true,
      data: createMockLicensePlateData(),
      processingTime: 150,
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.recognize("base64image", { mode: "single" });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.fullText).toBe("品川330あ1234");
  });

  it("エラーレスポンスを正しく処理する", async () => {
    const mockResponse: RecognizeResponse = {
      success: false,
      error: {
        code: "NO_PLATE_DETECTED",
        message: "ナンバープレートが検出されませんでした",
        suggestion: "カメラをナンバープレートに向けてください",
      },
      processingTime: 100,
    };

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.recognize("base64image", { mode: "single" });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("NO_PLATE_DETECTED");
  });

  it("ネットワークエラーを正しく処理する", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      client.recognize("base64image", { mode: "single" }),
    ).rejects.toThrow(LicensePlateApiError);
  });

  it("タイムアウトを正しく処理する", async () => {
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          setTimeout(() => reject(error), 100);
        }),
    );

    await expect(
      client.recognize("base64image", { mode: "single" }),
    ).rejects.toThrow(LicensePlateApiError);
  });
});

// ============================================================================
// 統合テスト: 完全なフロー
// ============================================================================

describe("統合テスト: 完全なフロー", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("画像キャプチャ → 検証 → API呼び出し → 結果取得の完全フロー", async () => {
    // 1. 画像キャプチャ（モック）
    const capturedImage = createMockImage();

    // 2. 画像検証（同期版を使用、ImageDataなしで解像度チェックのみ）
    const validationResult = validateImageSync(capturedImage);
    expect(validationResult.isValid).toBe(true);

    // 3. API呼び出し
    const mockResponse: RecognizeResponse = {
      success: true,
      data: createMockLicensePlateData(),
      processingTime: 150,
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const client = new LicensePlateApiClient({
      baseUrl: "http://localhost:3001",
    });

    const result = await client.recognize(capturedImage.base64, {
      mode: "single",
    });

    // 4. 結果確認
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.region).toBe("品川");
    expect(result.data?.classificationNumber).toBe("330");
    expect(result.data?.hiragana).toBe("あ");
    expect(result.data?.serialNumber).toBe("1234");
    expect(result.data?.fullText).toBe("品川330あ1234");
    expect(result.data?.confidence).toBe(98);
    expect(result.data?.plateType).toBe("REGULAR");
    expect(result.processingTime).toBe(150);
  });

  it("リアルタイムモードでの重複抑制フロー", async () => {
    const manager = new DuplicateSuppressionManager({
      suppressionDuration: 5000,
    });

    const mockResponse: RecognizeResponse = {
      success: true,
      data: createMockLicensePlateData(),
      processingTime: 150,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const client = new LicensePlateApiClient({
      baseUrl: "http://localhost:3001",
    });

    const recognizedPlates: LicensePlateData[] = [];
    const baseTime = 1000000;

    // 5回連続で同じナンバーを認識（500ms間隔）
    for (let i = 0; i < 5; i++) {
      const result = await client.recognize("base64image", {
        mode: "realtime",
      });

      if (result.success && result.data) {
        const duplicateResult = manager.checkAndRecord(
          result.data,
          baseTime + i * 500,
        );

        if (!duplicateResult.isDuplicate) {
          recognizedPlates.push(result.data);
        }
      }
    }

    // 最初の1回のみ認識される
    expect(recognizedPlates).toHaveLength(1);
    expect(recognizedPlates[0].fullText).toBe("品川330あ1234");
  });

  it("エラー時のフォールバックフロー", () => {
    // 画像検証失敗（同期版を使用）
    const invalidImage = createMockImage({ width: 100, height: 100 });
    const validationResult = validateImageSync(invalidImage);

    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThan(0);

    // エラーメッセージが日本語で提供される
    const error = validationResult.errors[0];
    expect(error.message).toBeTruthy();
    expect(error.suggestion).toBeTruthy();
  });
});

// ============================================================================
// 統合テスト: データ構造の整合性
// ============================================================================

describe("統合テスト: データ構造の整合性", () => {
  it("LicensePlateDataのfullTextは各コンポーネントの連結と一致する", () => {
    const data = createMockLicensePlateData();
    const expected = `${data.region}${data.classificationNumber}${data.hiragana}${data.serialNumber}`;

    expect(data.fullText).toBe(expected);
  });

  it("信頼度スコアは0-100の範囲内", () => {
    const data = createMockLicensePlateData();

    expect(data.confidence).toBeGreaterThanOrEqual(0);
    expect(data.confidence).toBeLessThanOrEqual(100);
  });

  it("全てのプレートタイプが有効", () => {
    const validTypes = [
      "REGULAR",
      "LIGHT",
      "COMMERCIAL",
      "RENTAL",
      "DIPLOMATIC",
    ];

    for (const type of validTypes) {
      const data = createMockLicensePlateData({
        plateType: type as LicensePlateData["plateType"],
      });
      expect(validTypes).toContain(data.plateType);
    }
  });
});
