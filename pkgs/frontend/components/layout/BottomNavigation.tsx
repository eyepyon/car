"use client";

/**
 * ボトムナビゲーションコンポーネント
 *
 * @description
 * 画面下部に固定表示されるナビゲーションバー。
 * ホームとウォレットの2つのナビゲーション項目を提供。
 *
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { cn } from "@/lib/utils";
import { Home, MessageCircle, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    href: "/",
    label: "ホーム",
    icon: <Home className="h-6 w-6" />,
  },
  {
    href: "/wallet",
    label: "ウォレット",
    icon: <Wallet className="h-6 w-6" />,
  },
  {
    href: "/chat",
    label: "チャット",
    icon: <MessageCircle className="h-6 w-6" />,
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
        "fixed bottom-0 left-0 right-0 z-50",
        "h-16 bg-background/80 backdrop-blur-md",
        "border-t border-border",
        "safe-area-inset-bottom",
        className,
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
                "flex flex-col items-center justify-center gap-1",
                "w-full h-full px-4 py-2",
                "transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
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
