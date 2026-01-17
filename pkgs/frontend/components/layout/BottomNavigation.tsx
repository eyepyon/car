'use client';

/**
 * ボトムナビゲーションコンポーネント
 *
 * @description
 * 画面下部に固定表示されるナビゲーションバー。
 * ホームとウォレットの2つのナビゲーション項目を提供。
 *
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// 型定義
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface BottomNavigationProps {
  className?: string;
}

// ============================================================================
// 定数
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'ホーム',
    icon: <Home className="h-6 w-6" />,
  },
  {
    href: '/wallet',
    label: 'ウォレット',
    icon: <Wallet className="h-6 w-6" />,
  },
];

// ============================================================================
// コンポーネント
// ============================================================================

/**
 * ボトムナビゲーションコンポーネント
 *
 * @example
 * ```tsx
 * <BottomNavigation />
 * ```
 */
export function BottomNavigation({ className }: BottomNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'h-16 bg-white/80 backdrop-blur-lg',
        'border-t border-gray-200',
        'dark:bg-gray-900/80 dark:border-gray-800',
        'safe-area-inset-bottom',
        className
      )}
      role="navigation"
      aria-label="メインナビゲーション"
    >
      <div className="flex h-full items-center justify-around max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1',
                'w-full h-full px-4 py-2',
                'transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
