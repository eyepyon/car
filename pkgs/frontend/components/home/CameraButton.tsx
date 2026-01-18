"use client";

/**
 * カメラ起動ボタンコンポーネント
 *
 * @description
 * トップページ中央に配置される大きなカメラ起動ボタン。
 * タップするとカメラモーダルを開く。
 *
 * @see Requirements 2.5, 2.6
 */

import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";

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
        "flex flex-col items-center justify-center gap-3",
        "w-32 h-32 rounded-full",
        "bg-gradient-to-br from-primary via-blue-500 to-purple-600", // Reactor Gradient
        "text-primary-foreground shadow-lg shadow-primary/50",
        "relative overflow-hidden", // For inner effects
        "border-2 border-primary/50", // Mechanical rim
        "transition-all duration-300 ease-out",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,255,0.6)]", // Neon Glow on Hover
        "active:scale-95",
        "after:absolute after:inset-0 after:bg-gradient-to-t after:from-transparent after:to-white/20 after:opacity-0 after:hover:opacity-100 after:transition-opacity", // Glass reflection
        "animate-[pulse_3s_ease-in-out_infinite]", // Breathing effect
        className,
      )}
      aria-label="カメラを起動してナンバープレートを撮影"
    >
      <Camera className="h-10 w-10" strokeWidth={1.5} />
      <span className="text-sm font-medium">撮影する</span>
    </button>
  );
}

export default CameraButton;
