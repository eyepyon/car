/**
 * ナンバープレート型定義のユニットテスト
 *
 * @description
 * LicensePlateData型、RecognitionError型、およびユーティリティ関数のテスト
 */

import { describe, it, expect } from "vitest";
import {
  type LicensePlateData,
  type RecognitionError,
  type PlateType,
  type RecognitionErrorCode,
  generateFullText,
  createLicensePlateData,
  isValidConfidence,
  isCompleteLicensePlateData,
  isFullTextConsistent,
  createRecognitionError,
  createCaptureError,
  createValidationError,
  RECOGNITION_ERROR_MESSAGES,
  CAPTURE_ERROR_MESSAGES,
  VALIDATION_ERROR_MESSAGES,
} from "./license-plate";

describe("LicensePlateData", () => {
  describe("generateFullText", () => {
    it("should concatenate all components correctly", () => {
      const result = generateFullText({
        region: "品川",
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
      });
      expect(result).toBe("品川330あ1234");
    });

    it("should handle different regions", () => {
      const result = generateFullText({
        region: "横浜",
        classificationNumber: "500",
        hiragana: "か",
        serialNumber: "5678",
      });
      expect(result).toBe("横浜500か5678");
    });

    it("should handle short serial numbers", () => {
      const result = generateFullText({
        region: "名古屋",
        classificationNumber: "300",
        hiragana: "さ",
        serialNumber: "12",
      });
      expect(result).toBe("名古屋300さ12");
    });
  });

  describe("createLicensePlateData", () => {
    it("should create complete LicensePlateData with fullText and recognizedAt", () => {
      const beforeTime = Date.now();
      const data = createLicensePlateData({
        region: "品川",
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
        confidence: 98,
        plateType: "REGULAR",
      });
      const afterTime = Date.now();

      expect(data.region).toBe("品川");
      expect(data.classificationNumber).toBe("330");
      expect(data.hiragana).toBe("あ");
      expect(data.serialNumber).toBe("1234");
      expect(data.fullText).toBe("品川330あ1234");
      expect(data.confidence).toBe(98);
      expect(data.plateType).toBe("REGULAR");
      expect(data.recognizedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(data.recognizedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should handle rental plate type", () => {
      const data = createLicensePlateData({
        region: "品川",
        classificationNumber: "330",
        hiragana: "わ",
        serialNumber: "1234",
        confidence: 95,
        plateType: "RENTAL",
      });

      expect(data.plateType).toBe("RENTAL");
      expect(data.hiragana).toBe("わ");
    });
  });

  describe("isValidConfidence", () => {
    it("should return true for valid confidence values", () => {
      expect(isValidConfidence(0)).toBe(true);
      expect(isValidConfidence(50)).toBe(true);
      expect(isValidConfidence(100)).toBe(true);
    });

    it("should return false for invalid confidence values", () => {
      expect(isValidConfidence(-1)).toBe(false);
      expect(isValidConfidence(101)).toBe(false);
      expect(isValidConfidence(-100)).toBe(false);
      expect(isValidConfidence(200)).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isValidConfidence(0.5)).toBe(true);
      expect(isValidConfidence(99.9)).toBe(true);
    });
  });

  describe("isCompleteLicensePlateData", () => {
    it("should return true for complete data", () => {
      const data: LicensePlateData = {
        region: "品川",
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
        fullText: "品川330あ1234",
        confidence: 98,
        plateType: "REGULAR",
        recognizedAt: Date.now(),
      };
      expect(isCompleteLicensePlateData(data)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isCompleteLicensePlateData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isCompleteLicensePlateData(undefined)).toBe(false);
    });

    it("should return false for missing fields", () => {
      const incompleteData = {
        region: "品川",
        classificationNumber: "330",
        // missing other fields
      };
      expect(isCompleteLicensePlateData(incompleteData)).toBe(false);
    });

    it("should return false for wrong types", () => {
      const wrongTypes = {
        region: 123, // should be string
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
        fullText: "品川330あ1234",
        confidence: "98", // should be number
        plateType: "REGULAR",
        recognizedAt: Date.now(),
      };
      expect(isCompleteLicensePlateData(wrongTypes)).toBe(false);
    });
  });

  describe("isFullTextConsistent", () => {
    it("should return true when fullText matches components", () => {
      const data: LicensePlateData = {
        region: "品川",
        classificationNumber: "302",
        hiragana: "ほ",
        serialNumber: "3184",
        fullText: "品川302ほ3184",
        confidence: 98,
        plateType: "REGULAR",
        recognizedAt: Date.now(),
      };
      expect(isFullTextConsistent(data)).toBe(true);
    });

    it("should return false when fullText does not match", () => {
      const data: LicensePlateData = {
        region: "品川",
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
        fullText: "横浜500か5678", // wrong fullText
        confidence: 98,
        plateType: "REGULAR",
        recognizedAt: Date.now(),
      };
      expect(isFullTextConsistent(data)).toBe(false);
    });
  });
});

describe("RecognitionError", () => {
  describe("createRecognitionError", () => {
    it("should create error with correct message and suggestion", () => {
      const error = createRecognitionError("NO_PLATE_DETECTED");
      expect(error.code).toBe("NO_PLATE_DETECTED");
      expect(error.message).toBe("ナンバープレートが検出されませんでした");
      expect(error.suggestion).toBe("カメラをナンバープレートに向けてください");
      expect(error.partialData).toBeUndefined();
    });

    it("should include partial data when provided", () => {
      const partialData = { region: "品川", classificationNumber: "330" };
      const error = createRecognitionError("PARTIAL_RECOGNITION", partialData);
      expect(error.code).toBe("PARTIAL_RECOGNITION");
      expect(error.partialData).toEqual(partialData);
    });

    it("should handle all error codes", () => {
      const errorCodes: RecognitionErrorCode[] = [
        "NO_PLATE_DETECTED",
        "PARTIAL_RECOGNITION",
        "API_CONNECTION_FAILED",
        "TIMEOUT",
        "RATE_LIMITED",
        "INVALID_IMAGE",
      ];

      for (const code of errorCodes) {
        const error = createRecognitionError(code);
        expect(error.code).toBe(code);
        expect(error.message).toBeTruthy();
        expect(error.suggestion).toBeTruthy();
      }
    });
  });

  describe("RECOGNITION_ERROR_MESSAGES", () => {
    it("should have messages for all error codes", () => {
      const errorCodes: RecognitionErrorCode[] = [
        "NO_PLATE_DETECTED",
        "PARTIAL_RECOGNITION",
        "API_CONNECTION_FAILED",
        "TIMEOUT",
        "RATE_LIMITED",
        "INVALID_IMAGE",
      ];

      for (const code of errorCodes) {
        expect(RECOGNITION_ERROR_MESSAGES[code]).toBeDefined();
        expect(RECOGNITION_ERROR_MESSAGES[code].message).toBeTruthy();
        expect(RECOGNITION_ERROR_MESSAGES[code].suggestion).toBeTruthy();
      }
    });
  });
});

describe("CaptureError", () => {
  describe("createCaptureError", () => {
    it("should create error with correct message", () => {
      const error = createCaptureError("PERMISSION_DENIED");
      expect(error.code).toBe("PERMISSION_DENIED");
      expect(error.message).toBe("カメラへのアクセスが許可されていません");
    });

    it("should handle all capture error codes", () => {
      const codes = [
        "PERMISSION_DENIED",
        "DEVICE_NOT_FOUND",
        "CAPTURE_FAILED",
      ] as const;

      for (const code of codes) {
        const error = createCaptureError(code);
        expect(error.code).toBe(code);
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe("CAPTURE_ERROR_MESSAGES", () => {
    it("should have messages for all capture error codes", () => {
      expect(CAPTURE_ERROR_MESSAGES.PERMISSION_DENIED).toBeTruthy();
      expect(CAPTURE_ERROR_MESSAGES.DEVICE_NOT_FOUND).toBeTruthy();
      expect(CAPTURE_ERROR_MESSAGES.CAPTURE_FAILED).toBeTruthy();
    });
  });
});

describe("ValidationError", () => {
  describe("createValidationError", () => {
    it("should create error with correct message and suggestion", () => {
      const error = createValidationError("BLUR");
      expect(error.code).toBe("BLUR");
      expect(error.message).toBe("画像がぼやけています");
      expect(error.suggestion).toBe("再撮影してください");
    });

    it("should handle all validation error codes", () => {
      const codes = [
        "BLUR",
        "ANGLE",
        "LIGHTING_DARK",
        "LIGHTING_BRIGHT",
        "RESOLUTION",
      ] as const;

      for (const code of codes) {
        const error = createValidationError(code);
        expect(error.code).toBe(code);
        expect(error.message).toBeTruthy();
        expect(error.suggestion).toBeTruthy();
      }
    });
  });

  describe("VALIDATION_ERROR_MESSAGES", () => {
    it("should have messages for all validation error codes", () => {
      const codes = [
        "BLUR",
        "ANGLE",
        "LIGHTING_DARK",
        "LIGHTING_BRIGHT",
        "RESOLUTION",
      ] as const;

      for (const code of codes) {
        expect(VALIDATION_ERROR_MESSAGES[code]).toBeDefined();
        expect(VALIDATION_ERROR_MESSAGES[code].message).toBeTruthy();
        expect(VALIDATION_ERROR_MESSAGES[code].suggestion).toBeTruthy();
      }
    });
  });
});

describe("PlateType", () => {
  it("should support all Japanese plate types", () => {
    const plateTypes: PlateType[] = [
      "REGULAR",
      "LIGHT",
      "COMMERCIAL",
      "RENTAL",
      "DIPLOMATIC",
    ];

    // Verify all types are valid
    for (const type of plateTypes) {
      const data = createLicensePlateData({
        region: "品川",
        classificationNumber: "330",
        hiragana: "あ",
        serialNumber: "1234",
        confidence: 98,
        plateType: type,
      });
      expect(data.plateType).toBe(type);
    }
  });
});
