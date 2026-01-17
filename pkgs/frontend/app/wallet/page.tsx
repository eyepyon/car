'use client';

/**
 * ウォレットページ（ダミー）
 *
 * @description
 * ウォレット機能のプレースホルダーページ。
 * 将来の機能実装に向けたUIデザインのみを表示。
 *
 * @see Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Wallet, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

// ============================================================================
// ダミーデータ
// ============================================================================

const DUMMY_TRANSACTIONS = [
  {
    id: '1',
    type: 'receive' as const,
    amount: '+¥500',
    description: '投げ銭を受け取りました',
    time: '2分前',
  },
  {
    id: '2',
    type: 'send' as const,
    amount: '-¥100',
    description: '投げ銭を送りました',
    time: '1時間前',
  },
  {
    id: '3',
    type: 'receive' as const,
    amount: '+¥1,000',
    description: '駐車場料金の払い戻し',
    time: '昨日',
  },
];

// ============================================================================
// コンポーネント
// ============================================================================

export default function WalletPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <Header title="ウォレット" />

      <main className="flex-1 flex flex-col px-4 pb-20">
        {/* Coming Soon バッジ */}
        <div className="flex justify-center mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Coming Soon
          </span>
        </div>

        {/* 残高カード */}
        <div className="mt-6 p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium">
              CarWallet 残高
            </span>
          </div>
          <p className="text-4xl font-bold text-white">¥0.00</p>
          <p className="text-white/60 text-sm mt-2">
            ウォレット機能は開発中です
          </p>
        </div>

        {/* アクションボタン */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-800',
              'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <ArrowDownLeft className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              受け取る
            </span>
          </button>
          <button
            type="button"
            disabled
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-800',
              'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <ArrowUpRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              送る
            </span>
          </button>
        </div>

        {/* 取引履歴 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            取引履歴
          </h3>
          <div className="space-y-3">
            {DUMMY_TRANSACTIONS.map((tx) => (
              <div
                key={tx.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl',
                  'bg-white dark:bg-gray-900',
                  'border border-gray-200 dark:border-gray-800',
                  'opacity-50'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-full',
                    tx.type === 'receive'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  )}
                >
                  {tx.type === 'receive' ? (
                    <ArrowDownLeft
                      className={cn(
                        'h-5 w-5',
                        'text-green-600 dark:text-green-400'
                      )}
                    />
                  ) : (
                    <ArrowUpRight
                      className={cn(
                        'h-5 w-5',
                        'text-blue-600 dark:text-blue-400'
                      )}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {tx.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tx.time}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    tx.type === 'receive'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                  )}
                >
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 開発中メッセージ */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ウォレット機能は現在開発中です。
            <br />
            今後のアップデートをお待ちください。
          </p>
        </div>
      </main>
    </div>
  );
}
