"use client";

/**
 * 認識結果表示コンポーネント
 *
 * @description
 * ナンバープレート認識結果を構造化して表示するコンポーネント。
 * 成功時は認識データを、エラー時はエラーメッセージと推奨アクションを表示。
 *
 * @see Requirements 3.4, 6.3
 */

import { cn } from "@/lib/utils";
import type {
  LicensePlateData,
  RecognitionError,
  PlateType,
} from "@/types/license-plate";

// ============================================================================
// 型定義
// ============================================================================

/**
 * RecognitionResultDisplayコンポーネントのプロパティ
 */
export interface RecognitionResultDisplayProps {
  /**
   * 認識結果データ（成功時）
   */
  result: LicensePlateData | null;

  /**
   * ローディング状態
   */
  isLoading: boolean;

  /**
   * エラー情報（失敗時）
   */
  error: RecognitionError | null;

  /**
   * 処理時間（ミリ秒）
   */
  processingTime?: number;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * 再試行ボタンのコールバック
   */
  onRetry?: () => void;
}

// ============================================================================
// 定数
// ============================================================================

/**
 * プレートタイプの表示名
 */
const PLATE_TYPE_LABELS: Record<PlateType, string> = {
  REGULAR: "普通自動車",
  LIGHT: "軽自動車",
  COMMERCIAL: "事業用",
  RENTAL: "レンタカー",
  DIPLOMATIC: "外交官",
};

/**
 * プレートタイプの色
 */
const PLATE_TYPE_COLORS: Record<PlateType, { bg: string; text: string }> = {
  REGULAR: { bg: "bg-white", text: "text-green-700" },
  LIGHT: { bg: "bg-yellow-400", text: "text-gray-900" },
  COMMERCIAL: { bg: "bg-green-600", text: "text-white" },
  RENTAL: { bg: "bg-white", text: "text-green-700" },
  DIPLOMATIC: { bg: "bg-blue-600", text: "text-white" },
};

/**
 * 信頼度のしきい値
 */
const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 70,
};

// ============================================================================
// メインコンポーネント
// ============================================================================

/**
 * 認識結果表示コンポーネント
 *
 * @example
 * ```tsx
 * <RecognitionResultDisplay
 *   result={recognitionResult}
 *   isLoading={isRecognizing}
 *   error={recognitionError}
 *   processingTime={150}
 *   onRetry={() => handleRetry()}
 * />
 * ```
 */
export function RecognitionResultDisplay({
  result,
  isLoading,
  error,
  processingTime,
  className,
  onRetry,
}: RecognitionResultDisplayProps) {
  // ローディング状態
  if (isLoading) {
    return <LoadingState className={className} />;
  }

  // エラー状態
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} className={className} />;
  }

  // 結果なし
  if (!result) {
    return <EmptyState className={className} />;
  }

  // 成功状態
  return (
    <SuccessState
      result={result}
      processingTime={processingTime}
      className={className}
    />
  );
}

// ============================================================================
// サブコンポーネント
// ============================================================================

/**
 * ローディング状態
 */
function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white p-8",
        className,
      )}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <p className="text-sm text-gray-600">認識中...</p>
    </div>
  );
}

/**
 * エラー状態
 * @see Requirements 6.3
 */
function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: RecognitionError;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
          <span className="text-lg">⚠️</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">{error.message}</h3>
          <p className="mt-1 text-sm text-red-600">{error.suggestion}</p>
          <p className="mt-2 text-xs text-red-500">
            エラーコード: {error.code}
          </p>
        </div>
      </div>

      {/* 部分認識結果がある場合 */}
      {error.partialData && (
        <div className="mt-2 rounded border border-red-200 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">
            部分的な認識結果:
          </p>
          <PartialDataDisplay data={error.partialData} />
        </div>
      )}

      {/* 再試行ボタン */}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-2 self-start rounded-lg px-4 py-2 text-sm font-medium",
            "bg-red-600 text-white",
            "hover:bg-red-700",
            "focus:outline-none focus:ring-2 focus:ring-red-500/50",
          )}
        >
          再試行
        </button>
      )}
    </div>
  );
}

/**
 * 空状態
 */
function EmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-8",
        className,
      )}
    >
      <span className="text-4xl">📷</span>
      <p className="text-sm text-gray-600">
        ナンバープレートを撮影してください
      </p>
    </div>
  );
}

/**
 * 成功状態
 * @see Requirements 3.4
 */
function SuccessState({
  result,
  processingTime,
  className,
}: {
  result: LicensePlateData;
  processingTime?: number;
  className?: string;
}) {
  const plateColors = PLATE_TYPE_COLORS[result.plateType];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-green-200 bg-green-50 p-6",
        className,
      )}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <h3 className="font-semibold text-green-800">認識成功</h3>
        </div>
        <ConfidenceBadge confidence={result.confidence} />
      </div>

      {/* ナンバープレート表示 */}
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-gray-800 p-4",
          plateColors.bg,
        )}
      >
        <span className={cn("text-2xl font-bold", plateColors.text)}>
          {result.fullText}
        </span>
      </div>

      {/* 詳細情報 */}
      <div className="grid grid-cols-2 gap-3">
        <DetailItem label="地名" value={result.region} />
        <DetailItem label="分類番号" value={result.classificationNumber} />
        <DetailItem label="ひらがな" value={result.hiragana} />
        <DetailItem label="一連番号" value={result.serialNumber} />
      </div>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-3 border-t border-green-200 pt-3">
        <PlateTypeBadge type={result.plateType} />
        {processingTime !== undefined && (
          <span className="text-xs text-gray-500">
            処理時間: {processingTime}ms
          </span>
        )}
        <span className="text-xs text-gray-500">
          認識時刻: {formatTimestamp(result.recognizedAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * 部分認識データ表示
 */
function PartialDataDisplay({ data }: { data: Partial<LicensePlateData> }) {
  const items = [
    { label: "地名", value: data.region },
    { label: "分類番号", value: data.classificationNumber },
    { label: "ひらがな", value: data.hiragana },
    { label: "一連番号", value: data.serialNumber },
  ].filter((item) => item.value !== undefined);

  if (items.length === 0) {
    return <p className="text-xs text-gray-500">認識できた項目はありません</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded bg-gray-100 px-2 py-1 text-xs"
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

/**
 * 詳細項目
 */
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

/**
 * 信頼度バッジ
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  let colorClass: string;
  let label: string;

  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    colorClass = "bg-green-100 text-green-800";
    label = "高信頼度";
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    colorClass = "bg-yellow-100 text-yellow-800";
    label = "中信頼度";
  } else {
    colorClass = "bg-red-100 text-red-800";
    label = "低信頼度";
  }

  return (
    <span
      className={cn("rounded-full px-2 py-1 text-xs font-medium", colorClass)}
    >
      {label}: {confidence}%
    </span>
  );
}

/**
 * プレートタイプバッジ
 */
function PlateTypeBadge({ type }: { type: PlateType }) {
  const colors = PLATE_TYPE_COLORS[type];
  const label = PLATE_TYPE_LABELS[type];

  return (
    <span
      className={cn(
        "rounded-full border border-gray-300 px-2 py-1 text-xs font-medium",
        colors.bg,
        colors.text,
      )}
    >
      {label}
    </span>
  );
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * タイムスタンプをフォーマットする
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ============================================================================
// エクスポート
// ============================================================================

export default RecognitionResultDisplay;
