/**
 * 重複認識抑制ユーティリティ
 *
 * @description
 * リアルタイムモードで同一ナンバープレートの連続認識を抑制するためのユーティリティ。
 * 一定時間内に同じナンバープレートが認識された場合、重複として扱い抑制する。
 *
 * @see Requirements 7.4
 * @see Property 9: 重複認識の抑制
 */

import type { LicensePlateData } from "@/types/license-plate";

// ============================================================================
// 定数
// ============================================================================

/**
 * デフォルトの抑制時間（ミリ秒）
 * 同一ナンバープレートの認識を抑制する時間
 */
export const DEFAULT_SUPPRESSION_DURATION = 5000; // 5秒

/**
 * デフォルトの最大履歴サイズ
 * メモリ使用量を制限するための上限
 */
export const DEFAULT_MAX_HISTORY_SIZE = 100;

// ============================================================================
// 型定義
// ============================================================================

/**
 * 認識履歴エントリ
 */
export interface RecognitionHistoryEntry {
  /**
   * ナンバープレートのフルテキスト（識別子として使用）
   */
  fullText: string;

  /**
   * 最後に認識された時刻（Unix timestamp in milliseconds）
   */
  lastRecognizedAt: number;

  /**
   * 認識回数
   */
  count: number;
}

/**
 * 重複抑制の設定
 */
export interface DuplicateSuppressionConfig {
  /**
   * 抑制時間（ミリ秒）
   * @default 5000
   */
  suppressionDuration?: number;

  /**
   * 最大履歴サイズ
   * @default 100
   */
  maxHistorySize?: number;
}

/**
 * 重複チェック結果
 */
export interface DuplicateCheckResult {
  /**
   * 重複かどうか
   */
  isDuplicate: boolean;

  /**
   * 前回の認識からの経過時間（ミリ秒）
   * 重複の場合のみ設定
   */
  timeSinceLastRecognition?: number;

  /**
   * 認識回数
   */
  recognitionCount: number;
}

// ============================================================================
// DuplicateSuppressionManager クラス
// ============================================================================

/**
 * 重複認識抑制マネージャー
 *
 * @description
 * リアルタイムモードで同一ナンバープレートの連続認識を抑制するためのクラス。
 * LRU方式で履歴を管理し、メモリ使用量を制限する。
 *
 * @example
 * ```typescript
 * const manager = new DuplicateSuppressionManager({ suppressionDuration: 5000 });
 *
 * // 認識結果をチェック
 * const result = manager.checkAndRecord(licensePlateData);
 * if (result.isDuplicate) {
 *   console.log('重複認識を抑制しました');
 * } else {
 *   console.log('新規認識:', licensePlateData.fullText);
 * }
 * ```
 *
 * @see Requirements 7.4
 */
export class DuplicateSuppressionManager {
  private history: Map<string, RecognitionHistoryEntry>;
  private suppressionDuration: number;
  private maxHistorySize: number;

  /**
   * コンストラクタ
   *
   * @param config - 設定オプション
   */
  constructor(config: DuplicateSuppressionConfig = {}) {
    this.history = new Map();
    this.suppressionDuration =
      config.suppressionDuration ?? DEFAULT_SUPPRESSION_DURATION;
    this.maxHistorySize = config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  }

  /**
   * 認識結果をチェックし、履歴に記録する
   *
   * @param data - 認識されたナンバープレートデータ
   * @param currentTime - 現在時刻（テスト用にオーバーライド可能）
   * @returns 重複チェック結果
   *
   * @see Property 9: 重複認識の抑制
   */
  checkAndRecord(
    data: LicensePlateData,
    currentTime: number = Date.now(),
  ): DuplicateCheckResult {
    const key = this.generateKey(data);
    const existingEntry = this.history.get(key);

    if (existingEntry) {
      const timeSinceLastRecognition =
        currentTime - existingEntry.lastRecognizedAt;

      if (timeSinceLastRecognition < this.suppressionDuration) {
        // 重複として扱う（履歴は更新しない）
        return {
          isDuplicate: true,
          timeSinceLastRecognition,
          recognitionCount: existingEntry.count,
        };
      }

      // 抑制時間を超えた場合は新規認識として扱う
      existingEntry.lastRecognizedAt = currentTime;
      existingEntry.count += 1;

      // LRU: 既存エントリを削除して再追加（最新に移動）
      this.history.delete(key);
      this.history.set(key, existingEntry);

      return {
        isDuplicate: false,
        recognitionCount: existingEntry.count,
      };
    }

    // 新規エントリを追加
    this.addEntry(key, currentTime);

    return {
      isDuplicate: false,
      recognitionCount: 1,
    };
  }

  /**
   * 重複かどうかをチェックする（履歴を更新しない）
   *
   * @param data - 認識されたナンバープレートデータ
   * @param currentTime - 現在時刻
   * @returns 重複の場合true
   */
  isDuplicate(
    data: LicensePlateData,
    currentTime: number = Date.now(),
  ): boolean {
    const key = this.generateKey(data);
    const existingEntry = this.history.get(key);

    if (!existingEntry) {
      return false;
    }

    const timeSinceLastRecognition =
      currentTime - existingEntry.lastRecognizedAt;
    return timeSinceLastRecognition < this.suppressionDuration;
  }

  /**
   * 履歴をクリアする
   */
  clear(): void {
    this.history.clear();
  }

  /**
   * 期限切れのエントリを削除する
   *
   * @param currentTime - 現在時刻
   * @returns 削除されたエントリ数
   */
  cleanup(currentTime: number = Date.now()): number {
    let removedCount = 0;

    for (const [key, entry] of this.history.entries()) {
      if (currentTime - entry.lastRecognizedAt >= this.suppressionDuration) {
        this.history.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * 現在の履歴サイズを取得する
   */
  get size(): number {
    return this.history.size;
  }

  /**
   * 設定を取得する
   */
  get config(): Required<DuplicateSuppressionConfig> {
    return {
      suppressionDuration: this.suppressionDuration,
      maxHistorySize: this.maxHistorySize,
    };
  }

  /**
   * 履歴のスナップショットを取得する（デバッグ用）
   */
  getHistorySnapshot(): RecognitionHistoryEntry[] {
    return Array.from(this.history.values());
  }

  // ============================================================================
  // プライベートメソッド
  // ============================================================================

  /**
   * ナンバープレートデータからキーを生成する
   */
  private generateKey(data: LicensePlateData): string {
    // fullTextをキーとして使用
    return data.fullText;
  }

  /**
   * 新規エントリを追加する
   */
  private addEntry(key: string, currentTime: number): void {
    // 最大サイズに達している場合、最も古いエントリを削除（LRU）
    if (this.history.size >= this.maxHistorySize) {
      const oldestKey = this.history.keys().next().value;
      if (oldestKey) {
        this.history.delete(oldestKey);
      }
    }

    this.history.set(key, {
      fullText: key,
      lastRecognizedAt: currentTime,
      count: 1,
    });
  }
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * シングルトンインスタンスを作成する
 *
 * @param config - 設定オプション
 * @returns DuplicateSuppressionManager インスタンス
 */
export function createDuplicateSuppressionManager(
  config?: DuplicateSuppressionConfig,
): DuplicateSuppressionManager {
  return new DuplicateSuppressionManager(config);
}

/**
 * 2つのナンバープレートが同一かどうかを判定する
 *
 * @param a - ナンバープレートデータA
 * @param b - ナンバープレートデータB
 * @returns 同一の場合true
 */
export function isSameLicensePlate(
  a: LicensePlateData,
  b: LicensePlateData,
): boolean {
  return a.fullText === b.fullText;
}

/**
 * ナンバープレートデータの配列から重複を除去する
 *
 * @param plates - ナンバープレートデータの配列
 * @returns 重複を除去した配列
 */
export function removeDuplicatePlates(
  plates: LicensePlateData[],
): LicensePlateData[] {
  const seen = new Set<string>();
  return plates.filter((plate) => {
    if (seen.has(plate.fullText)) {
      return false;
    }
    seen.add(plate.fullText);
    return true;
  });
}
