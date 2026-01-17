'use client';

/**
 * カメラ起動ボタンコンポーネント
 *
 * @description
 * トップページ中央に配置される大きなカメラ起動ボタン。
 * タップするとカメラモーダルを開く。
 *
 * @see Requirements 2.5, 2.6
 */

import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// 型定義
// ============================================================================

export interface CameraButtonProps {
  /** クリック時のコールバック */
  onClick: () => void;
  /** 無効状態 */
  disabled?: boolean;
  /** 追加のCSSクラス */
  className?: string;
}

// ============================================================================
// コンポーネント
// ============================================================================

/**
 * カメラ起動ボタンコンポーネント
 *
 * @example
 * ```tsx
 * <CameraButton onClick={() => setModalOpen(true)} />
 * ```
 */
export function CameraButton({
  onClick,
  disabled = false,
  className,
}: CameraButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        'w-32 h-32 rounded-full',
        'bg-gradient-to-br from-blue-500 to-blue-600',
        'text-white shadow-lg shadow-blue-500/30',
        'transition-all duration-300 ease-out',
        'hover:scale-105 hover:shadow-xl hover:shadow-blue-500/40',
        'active:scale-95',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        className
      )}
      aria-label="カメラを起動してナンバープレートを撮影"
    >
      <Camera className="h-10 w-10" strokeWidth={1.5} />
      <span className="text-sm font-medium">撮影する</span>
    </button>
  );
}

export default CameraButton;
