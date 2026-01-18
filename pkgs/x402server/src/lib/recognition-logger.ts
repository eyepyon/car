/**
 * 認識ログ機能
 *
 * @description
 * ナンバープレート認識処理のログを記録・管理する。
 * プライバシー保護のため、画像データはハッシュ化して保存。
 *
 * @see Requirements 6.4
 */

import { createHash } from "crypto";
import type { RecognitionErrorCode } from "../routes/license-plate";

// ============================================================================
// 型定義
// ============================================================================

/**
 * 認識ログエントリ
 */
export interface RecognitionLog {
  /** ログID */
  id: string;
  /** タイムスタンプ */
  timestamp: number;
  /** 画像ハッシュ（プライバシー保護のためハッシュのみ） */
  imageHash: string;
  /** 認識成功フラグ */
  success: boolean;
  /** 処理時間（ミリ秒） */
  processingTime: number;
  /** エラーコード（失敗時のみ） */
  errorCode?: RecognitionErrorCode;
  /** 認識信頼度（成功時のみ） */
  confidence?: number;
  /** 認識モード */
  mode: "single" | "realtime";
  /** リクエスト元IP（オプション） */
  clientIp?: string;
}

/**
 * ログ統計情報
 */
export interface LogStatistics {
  /** 総リクエスト数 */
  totalRequests: number;
  /** 成功数 */
  successCount: number;
  /** 失敗数 */
  failureCount: number;
  /** 成功率 */
  successRate: number;
  /** 平均処理時間（ミリ秒） */
  averageProcessingTime: number;
  /** エラーコード別カウント */
  errorCounts: Record<string, number>;
}

// ============================================================================
// ロガークラス
// ============================================================================

/**
 * 認識ログマネージャー
 *
 * @description
 * 認識処理のログを管理する。
 * メモリ内にログを保持し、統計情報を提供する。
 *
 * @example
 * ```typescript
 * const logger = new RecognitionLogger();
 *
 * // 成功ログを記録
 * logger.logSuccess({
 *   imageHash: 'abc123...',
 *   processingTime: 150,
 *   confidence: 98,
 *   mode: 'single',
 * });
 *
 * // エラーログを記録
 * logger.logError({
 *   imageHash: 'def456...',
 *   processingTime: 5000,
 *   errorCode: 'TIMEOUT',
 *   mode: 'single',
 * });
 *
 * // 統計情報を取得
 * const stats = logger.getStatistics();
 * ```
 *
 * @see Requirements 6.4
 */
export class RecognitionLogger {
  private logs: RecognitionLog[] = [];
  private maxLogs: number;

  constructor(maxLogs = 10000) {
    this.maxLogs = maxLogs;
  }

  /**
   * 画像データからハッシュを生成する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns SHA-256ハッシュ
   */
  static hashImage(imageData: string): string {
    return createHash("sha256").update(imageData).digest("hex");
  }

  /**
   * ユニークなログIDを生成する
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 成功ログを記録する
   *
   * @param params - ログパラメータ
   * @returns 作成されたログエントリ
   */
  logSuccess(params: {
    imageHash: string;
    processingTime: number;
    confidence: number;
    mode: "single" | "realtime";
    clientIp?: string;
  }): RecognitionLog {
    const log: RecognitionLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      imageHash: params.imageHash,
      success: true,
      processingTime: params.processingTime,
      confidence: params.confidence,
      mode: params.mode,
      clientIp: params.clientIp,
    };

    this.addLog(log);
    this.logToConsole("SUCCESS", log);

    return log;
  }

  /**
   * エラーログを記録する
   *
   * @param params - ログパラメータ
   * @returns 作成されたログエントリ
   */
  logError(params: {
    imageHash: string;
    processingTime: number;
    errorCode: RecognitionErrorCode;
    mode: "single" | "realtime";
    clientIp?: string;
    errorMessage?: string;
  }): RecognitionLog {
    const log: RecognitionLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      imageHash: params.imageHash,
      success: false,
      processingTime: params.processingTime,
      errorCode: params.errorCode,
      mode: params.mode,
      clientIp: params.clientIp,
    };

    this.addLog(log);
    this.logToConsole("ERROR", log, params.errorMessage);

    return log;
  }

  /**
   * ログを追加する（最大数を超えた場合は古いログを削除）
   */
  private addLog(log: RecognitionLog): void {
    this.logs.push(log);

    // 最大数を超えた場合は古いログを削除
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * コンソールにログを出力する
   */
  private logToConsole(
    level: "SUCCESS" | "ERROR",
    log: RecognitionLog,
    errorMessage?: string,
  ): void {
    const timestamp = new Date(log.timestamp).toISOString();
    const prefix = `[LicensePlate][${level}]`;

    if (level === "SUCCESS") {
      console.log(
        `${prefix} ${timestamp} - ID: ${log.id}, Mode: ${log.mode}, ` +
          `ProcessingTime: ${log.processingTime}ms, Confidence: ${log.confidence}%`,
      );
    } else {
      console.error(
        `${prefix} ${timestamp} - ID: ${log.id}, Mode: ${log.mode}, ` +
          `ProcessingTime: ${log.processingTime}ms, ErrorCode: ${log.errorCode}` +
          (errorMessage ? `, Message: ${errorMessage}` : ""),
      );
    }
  }

  /**
   * 統計情報を取得する
   *
   * @param since - この時刻以降のログのみを対象（オプション）
   * @returns 統計情報
   */
  getStatistics(since?: number): LogStatistics {
    const filteredLogs = since
      ? this.logs.filter((log) => log.timestamp >= since)
      : this.logs;

    const totalRequests = filteredLogs.length;
    const successCount = filteredLogs.filter((log) => log.success).length;
    const failureCount = totalRequests - successCount;

    const totalProcessingTime = filteredLogs.reduce(
      (sum, log) => sum + log.processingTime,
      0,
    );

    const errorCounts: Record<string, number> = {};
    for (const log of filteredLogs) {
      if (log.errorCode) {
        errorCounts[log.errorCode] = (errorCounts[log.errorCode] || 0) + 1;
      }
    }

    return {
      totalRequests,
      successCount,
      failureCount,
      successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
      averageProcessingTime:
        totalRequests > 0 ? totalProcessingTime / totalRequests : 0,
      errorCounts,
    };
  }

  /**
   * 最近のログを取得する
   *
   * @param count - 取得するログ数
   * @returns ログエントリの配列
   */
  getRecentLogs(count = 100): RecognitionLog[] {
    return this.logs.slice(-count);
  }

  /**
   * 特定のエラーコードのログを取得する
   *
   * @param errorCode - エラーコード
   * @param count - 取得するログ数
   * @returns ログエントリの配列
   */
  getLogsByErrorCode(
    errorCode: RecognitionErrorCode,
    count = 100,
  ): RecognitionLog[] {
    return this.logs.filter((log) => log.errorCode === errorCode).slice(-count);
  }

  /**
   * ログをクリアする
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * ログ数を取得する
   */
  getLogCount(): number {
    return this.logs.length;
  }
}

// ============================================================================
// シングルトンインスタンス
// ============================================================================

/**
 * グローバルな認識ロガーインスタンス
 */
export const recognitionLogger = new RecognitionLogger();

export default RecognitionLogger;
