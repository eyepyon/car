'use client';

/**
 * ヘッダーコンポーネント
 *
 * @description
 * ページ上部のヘッダー。アプリタイトルとオプションの戻るボタンを表示。
 *
 * @see Requirements 1.1
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// 型定義
// ============================================================================

export interface HeaderProps {
  /** ヘッダータイトル */
  title?: string;
  /** 戻るボタンを表示するか */
  showBackButton?: boolean;
  /** 追加のCSSクラス */
  className?: string;
}

// ============================================================================
// 定数
// ============================================================================

const DEFAULT_TITLE = 'CarWallet';

// ============================================================================
// コンポーネント
// ============================================================================

/**
 * ヘッダーコンポーネント
 *
 * @example
 * ```tsx
 * <Header title="ウォレット" showBackButton />
 * ```
 */
export function Header({
  title = DEFAULT_TITLE,
  showBackButton = false,
  className,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40',
        'h-14 px-4',
        'flex items-center',
        'bg-white/80 backdrop-blur-lg',
        'border-b border-gray-200',
        'dark:bg-gray-900/80 dark:border-gray-800',
        className
      )}
    >
      <div className="flex items-center gap-3 w-full max-w-3xl mx-auto">
        {showBackButton && (
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              'flex items-center justify-center',
              'w-10 h-10 -ml-2',
              'rounded-full',
              'text-gray-600 dark:text-gray-400',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
            aria-label="戻る"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}

export default Header;
