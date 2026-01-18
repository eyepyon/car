/**
 * ナンバープレート認識ライブラリ
 *
 * @description
 * ナンバープレート認識機能で使用するユーティリティとフックをエクスポート
 */

// 画像検証
export {
  validateImage,
  validateImageSync,
  validateResolution,
  validateBlur,
  validateAngle,
  validateLighting,
  calculateImageQualityMetrics,
  validateImageWithMetrics,
  getImageDataFromBase64,
  calculateAverageBrightness,
  calculateLaplacianVariance,
  estimateAngle,
  VALIDATION_THRESHOLDS,
  ALL_VALIDATION_ERROR_CODES,
  isValidValidationErrorCode,
  type ImageQualityMetrics,
} from "./image-validator";

// 重複認識抑制
export {
  DuplicateSuppressionManager,
  createDuplicateSuppressionManager,
  isSameLicensePlate,
  removeDuplicatePlates,
  DEFAULT_SUPPRESSION_DURATION,
  DEFAULT_MAX_HISTORY_SIZE,
  type RecognitionHistoryEntry,
  type DuplicateSuppressionConfig,
  type DuplicateCheckResult,
} from "./duplicate-suppression";

// カスタムフック - 重複抑制
export {
  useDuplicateSuppression,
  type UseDuplicateSuppressionReturn,
} from "./use-duplicate-suppression";

// APIクライアント
export {
  LicensePlateApiClient,
  LicensePlateApiError,
  getLicensePlateApiClient,
  resetLicensePlateApiClient,
  imageFileToBase64,
  blobToBase64,
  type LicensePlateApiClientConfig,
  type RecognizeOptions,
} from "./api-client";

// カスタムフック - 認識統合
export {
  useLicensePlateRecognition,
  type RecognitionState,
  type UseLicensePlateRecognitionConfig,
  type UseLicensePlateRecognitionReturn,
} from "./use-license-plate-recognition";
