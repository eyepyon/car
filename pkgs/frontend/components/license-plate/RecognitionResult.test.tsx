/**
 * RecognitionResultDisplay コンポーネントのユニットテスト
 *
 * @description
 * 認識結果表示コンポーネントの各状態（成功、エラー、ローディング、空）をテスト
 *
 * @see Requirements 3.4, 6.3
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecognitionResultDisplay } from "./RecognitionResult";
import type { LicensePlateData, RecognitionError } from "@/types/license-plate";

// ============================================================================
// テストデータ
// ============================================================================

const mockSuccessResult: LicensePlateData = {
  region: "品川",
  classificationNumber: "302",
  hiragana: "ほ",
  serialNumber: "3184",
  fullText: "品川302ほ3184",
  confidence: 98,
  plateType: "REGULAR",
  recognizedAt: Date.now(),
};

const mockLowConfidenceResult: LicensePlateData = {
  ...mockSuccessResult,
  confidence: 50,
};

const mockMediumConfidenceResult: LicensePlateData = {
  ...mockSuccessResult,
  confidence: 75,
};

const mockError: RecognitionError = {
  code: "NO_PLATE_DETECTED",
  message: "ナンバープレートが検出されませんでした",
  suggestion: "カメラをナンバープレートに向けてください",
};

const mockErrorWithPartialData: RecognitionError = {
  code: "PARTIAL_RECOGNITION",
  message: "部分的な認識のみ成功しました",
  suggestion: "より鮮明な画像で再試行してください",
  partialData: {
    region: "品川",
    classificationNumber: "302",
  },
};

// ============================================================================
// 成功状態のテスト
// ============================================================================

describe("RecognitionResultDisplay - 成功状態", () => {
  it("認識結果を正しく表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={false}
        error={null}
      />,
    );

    // フルテキストが表示される
    expect(screen.getByText("品川302ほ3184")).toBeInTheDocument();

    // 各フィールドが表示される
    expect(screen.getByText("品川")).toBeInTheDocument();
    expect(screen.getByText("302")).toBeInTheDocument();
    expect(screen.getByText("ほ")).toBeInTheDocument();
    expect(screen.getByText("3184")).toBeInTheDocument();

    // 成功メッセージが表示される
    expect(screen.getByText("認識成功")).toBeInTheDocument();
  });

  it("高信頼度バッジを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/高信頼度/)).toBeInTheDocument();
    expect(screen.getByText(/98%/)).toBeInTheDocument();
  });

  it("中信頼度バッジを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockMediumConfidenceResult}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/中信頼度/)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it("低信頼度バッジを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockLowConfidenceResult}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/低信頼度/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("プレートタイプを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("普通自動車")).toBeInTheDocument();
  });

  it("処理時間を表示する", () => {
    render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={false}
        error={null}
        processingTime={150}
      />,
    );

    expect(screen.getByText(/処理時間: 150ms/)).toBeInTheDocument();
  });

  it("各プレートタイプを正しく表示する", () => {
    const plateTypes = [
      { type: "REGULAR", label: "普通自動車" },
      { type: "LIGHT", label: "軽自動車" },
      { type: "COMMERCIAL", label: "事業用" },
      { type: "RENTAL", label: "レンタカー" },
      { type: "DIPLOMATIC", label: "外交官" },
    ] as const;

    for (const { type, label } of plateTypes) {
      const result = { ...mockSuccessResult, plateType: type };
      const { unmount } = render(
        <RecognitionResultDisplay
          result={result}
          isLoading={false}
          error={null}
        />,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});

// ============================================================================
// エラー状態のテスト
// ============================================================================

describe("RecognitionResultDisplay - エラー状態", () => {
  it("エラーメッセージを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockError}
      />,
    );

    expect(
      screen.getByText("ナンバープレートが検出されませんでした"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("カメラをナンバープレートに向けてください"),
    ).toBeInTheDocument();
  });

  it("エラーコードを表示する", () => {
    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockError}
      />,
    );

    expect(screen.getByText(/NO_PLATE_DETECTED/)).toBeInTheDocument();
  });

  it("部分認識結果を表示する", () => {
    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockErrorWithPartialData}
      />,
    );

    expect(screen.getByText(/地名: 品川/)).toBeInTheDocument();
    expect(screen.getByText(/分類番号: 330/)).toBeInTheDocument();
  });

  it("再試行ボタンをクリックできる", () => {
    const onRetry = vi.fn();

    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockError}
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByRole("button", { name: "再試行" });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("onRetryがない場合は再試行ボタンを表示しない", () => {
    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockError}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "再試行" }),
    ).not.toBeInTheDocument();
  });

  it("アラートロールを持つ", () => {
    render(
      <RecognitionResultDisplay
        result={null}
        isLoading={false}
        error={mockError}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ============================================================================
// ローディング状態のテスト
// ============================================================================

describe("RecognitionResultDisplay - ローディング状態", () => {
  it("ローディングインジケーターを表示する", () => {
    render(
      <RecognitionResultDisplay result={null} isLoading={true} error={null} />,
    );

    expect(screen.getByText("認識中...")).toBeInTheDocument();
  });

  it("ローディング中は結果を表示しない", () => {
    render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={true}
        error={null}
      />,
    );

    // ローディング中は結果が表示されない
    expect(screen.queryByText("品川330あ1234")).not.toBeInTheDocument();
    expect(screen.getByText("認識中...")).toBeInTheDocument();
  });
});

// ============================================================================
// 空状態のテスト
// ============================================================================

describe("RecognitionResultDisplay - 空状態", () => {
  it("空状態メッセージを表示する", () => {
    render(
      <RecognitionResultDisplay result={null} isLoading={false} error={null} />,
    );

    expect(
      screen.getByText("ナンバープレートを撮影してください"),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// スタイルとアクセシビリティのテスト
// ============================================================================

describe("RecognitionResultDisplay - スタイルとアクセシビリティ", () => {
  it("カスタムクラス名を適用できる", () => {
    const { container } = render(
      <RecognitionResultDisplay
        result={mockSuccessResult}
        isLoading={false}
        error={null}
        className="custom-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("認識時刻を表示する", () => {
    const timestamp = new Date("2026-01-18T10:30:45").getTime();
    const result = { ...mockSuccessResult, recognizedAt: timestamp };

    render(
      <RecognitionResultDisplay
        result={result}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/認識時刻:/)).toBeInTheDocument();
  });
});
