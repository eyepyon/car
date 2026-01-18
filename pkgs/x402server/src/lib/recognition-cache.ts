/**
 * 認識結果キャッシュ
 *
 * @description
 * 画像ハッシュをキーとして認識結果をキャッシュし、
 * 同一画像に対する重複リクエストを効率化する。
 *
 * @see Requirements 8.5
 * @see Property 12: キャッシュの一貫性
 */

import type { LicensePlateData } from "./qwen-vl-client";

// ============================================================================
// 型定義
// ============================================================================

/**
 * キャッシュエントリ
 */
export interface CacheEntry {
  /** キャッシュキー（画像ハッシュ） */
  key: string;
  /** 認識結果 */
  result: LicensePlateData;
  /** 作成日時（ミリ秒） */
  createdAt: number;
  /** 有効期限（ミリ秒） */
  expiresAt: number;
}

/**
 * キャッシュ設定
 */
export interface CacheConfig {
  /** キャッシュ有効期間（ミリ秒） */
  ttl: number;
  /** 最大エントリ数 */
  maxEntries: number;
}

/**
 * キャッシュ統計
 */
export interface CacheStats {
  /** ヒット数 */
  hits: number;
  /** ミス数 */
  misses: number;
  /** 現在のエントリ数 */
  size: number;
  /** ヒット率（0-1） */
  hitRate: number;
}

// ============================================================================
// 定数
// ============================================================================

/**
 * デフォルトのキャッシュ設定
 * @see Requirements 8.5
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5分
  maxEntries: 1000,
};

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 文字列のSHA-256ハッシュを計算する
 *
 * @param data - ハッシュ化するデータ
 * @returns 16進数のハッシュ文字列
 */
export async function computeHash(data: string): Promise<string> {
  // Node.js環境
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await globalThis.crypto.subtle.digest(
      "SHA-256",
      dataBuffer,
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // フォールバック: 簡易ハッシュ（本番環境では使用しない）
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * 画像データからキャッシュキーを生成する
 *
 * @param imageData - Base64エンコードされた画像データ
 * @returns キャッシュキー
 */
export async function generateCacheKey(imageData: string): Promise<string> {
  // data:image/...;base64, プレフィックスを除去
  const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, "");
  return computeHash(base64Data);
}

// ============================================================================
// RecognitionCacheクラス
// ============================================================================

/**
 * 認識結果キャッシュ
 *
 * @description
 * インメモリキャッシュで認識結果を保存し、
 * 同一画像に対する重複リクエストを効率化する。
 *
 * @example
 * ```typescript
 * const cache = new RecognitionCache();
 *
 * // キャッシュに保存
 * await cache.set(imageData, recognitionResult);
 *
 * // キャッシュから取得
 * const cached = await cache.get(imageData);
 * if (cached) {
 *   console.log('キャッシュヒット:', cached.fullText);
 * }
 * ```
 *
 * @see Requirements 8.5
 * @see Property 12: キャッシュの一貫性
 */
export class RecognitionCache {
  private readonly cache: Map<string, CacheEntry>;
  private readonly config: CacheConfig;
  private stats: { hits: number; misses: number };

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.cache = new Map();
    this.config = config;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * キャッシュから認識結果を取得する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns キャッシュされた認識結果、または null
   */
  async get(imageData: string): Promise<LicensePlateData | null> {
    const key = await generateCacheKey(imageData);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 有効期限チェック
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.result;
  }

  /**
   * 認識結果をキャッシュに保存する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @param result - 認識結果
   */
  async set(imageData: string, result: LicensePlateData): Promise<void> {
    const key = await generateCacheKey(imageData);
    const now = Date.now();

    // 最大エントリ数を超えた場合、古いエントリを削除
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      key,
      result,
      createdAt: now,
      expiresAt: now + this.config.ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * キャッシュから特定のエントリを削除する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns 削除されたかどうか
   */
  async delete(imageData: string): Promise<boolean> {
    const key = await generateCacheKey(imageData);
    return this.cache.delete(key);
  }

  /**
   * キャッシュをクリアする
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 期限切れのエントリを削除する
   *
   * @returns 削除されたエントリ数
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * キャッシュ統計を取得する
   *
   * @returns キャッシュ統計
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * キャッシュサイズを取得する
   *
   * @returns 現在のエントリ数
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * キャッシュにエントリが存在するか確認する
   *
   * @param imageData - Base64エンコードされた画像データ
   * @returns エントリが存在し、有効期限内かどうか
   */
  async has(imageData: string): Promise<boolean> {
    const result = await this.get(imageData);
    // get()でmissesがカウントされるので、statsを調整
    if (result === null) {
      this.stats.misses--; // has()はmissesをカウントしない
    } else {
      this.stats.hits--; // has()はhitsをカウントしない
    }
    return result !== null;
  }

  /**
   * 最も古いエントリを削除する
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// ============================================================================
// シングルトンインスタンス
// ============================================================================

/**
 * グローバルキャッシュインスタンス
 */
let globalCache: RecognitionCache | null = null;

/**
 * グローバルキャッシュインスタンスを取得する
 *
 * @param config - キャッシュ設定（初回のみ有効）
 * @returns RecognitionCache インスタンス
 */
export function getGlobalCache(config?: CacheConfig): RecognitionCache {
  if (!globalCache) {
    globalCache = new RecognitionCache(config);
  }
  return globalCache;
}

/**
 * グローバルキャッシュをリセットする（テスト用）
 */
export function resetGlobalCache(): void {
  globalCache = null;
}

export default RecognitionCache;
