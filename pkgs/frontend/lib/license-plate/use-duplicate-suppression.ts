/**
 * 重複認識抑制カスタムフック
 *
 * @description
 * Reactコンポーネントで重複認識抑制を使用するためのカスタムフック。
 *
 * @see Requirements 7.4
 * @see Property 9: 重複認識の抑制
 */

"use client";

import { useCallback, useRef, useMemo } from "react";
import type { LicensePlateData } from "@/types/license-plate";
import {
  DuplicateSuppressionManager,
  type DuplicateSuppressionConfig,
  type DuplicateCheckResult,
} from "./duplicate-suppression";

// ============================================================================
// 型定義
// ============================================================================

/**
 * useDuplicateSuppression フックの戻り値
 */
export interface UseDuplicateSuppressionReturn {
  /**
   * 認識結果をチェックし、重複でなければコールバックを実行する
   *
   * @param data - 認識されたナンバープレートデータ
   * @param callback - 重複でない場合に実行するコールバック
   * @returns 重複チェック結果
   */
  processRecognition: (
    data: LicensePlateData,
    callback?: (data: LicensePlateData) => void,
  ) => DuplicateCheckResult;

  /**
   * 重複かどうかをチェックする（履歴を更新しない）
   *
   * @param data - 認識されたナンバープレートデータ
   * @returns 重複の場合true
   */
  isDuplicate: (data: LicensePlateData) => boolean;

  /**
   * 履歴をクリアする
   */
  clearHistory: () => void;

  /**
   * 期限切れのエントリを削除する
   *
   * @returns 削除されたエントリ数
   */
  cleanup: () => number;

  /**
   * 現在の履歴サイズ
   */
  historySize: number;
}

// ============================================================================
// カスタムフック
// ============================================================================

/**
 * 重複認識抑制カスタムフック
 *
 * @description
 * リアルタイムモードで同一ナンバープレートの連続認識を抑制するためのフック。
 * コンポーネントのライフサイクルに合わせて履歴を管理する。
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { processRecognition, clearHistory } = useDuplicateSuppression({
 *     suppressionDuration: 5000,
 *   });
 *
 *   const handleRecognition = (data: LicensePlateData) => {
 *     const result = processRecognition(data, (validData) => {
 *       // 重複でない場合のみ実行される
 *       console.log('新規認識:', validData.fullText);
 *     });
 *
 *     if (result.isDuplicate) {
 *       console.log('重複認識を抑制しました');
 *     }
 *   };
 *
 *   return <CameraCapture onCapture={handleRecognition} />;
 * }
 * ```
 *
 * @param config - 設定オプション
 * @returns 重複認識抑制の操作関数
 *
 * @see Requirements 7.4
 */
export function useDuplicateSuppression(
  config?: DuplicateSuppressionConfig,
): UseDuplicateSuppressionReturn {
  // マネージャーインスタンスをrefで保持（再レンダリングで再作成されない）
  const managerRef = useRef<DuplicateSuppressionManager | null>(null);

  // 遅延初期化
  if (!managerRef.current) {
    managerRef.current = new DuplicateSuppressionManager(config);
  }

  /**
   * 認識結果をチェックし、重複でなければコールバックを実行する
   */
  const processRecognition = useCallback(
    (
      data: LicensePlateData,
      callback?: (data: LicensePlateData) => void,
    ): DuplicateCheckResult => {
      const manager = managerRef.current!;
      const result = manager.checkAndRecord(data);

      if (!result.isDuplicate && callback) {
        callback(data);
      }

      return result;
    },
    [],
  );

  /**
   * 重複かどうかをチェックする
   */
  const isDuplicate = useCallback((data: LicensePlateData): boolean => {
    return managerRef.current!.isDuplicate(data);
  }, []);

  /**
   * 履歴をクリアする
   */
  const clearHistory = useCallback((): void => {
    managerRef.current!.clear();
  }, []);

  /**
   * 期限切れのエントリを削除する
   */
  const cleanup = useCallback((): number => {
    return managerRef.current!.cleanup();
  }, []);

  /**
   * 現在の履歴サイズ
   */
  const historySize = useMemo(() => {
    return managerRef.current?.size ?? 0;
  }, []);

  return {
    processRecognition,
    isDuplicate,
    clearHistory,
    cleanup,
    historySize,
  };
}

export default useDuplicateSuppression;
