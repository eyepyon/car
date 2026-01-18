"use client";

/**
 * ウォレットページ（ダミー）
 *
 * @description
 * ウォレット機能のプレースホルダーページ。
 * 将来の機能実装に向けたUIデザインのみを表示。
 *
 * @see Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DecryptedText from "@/components/ui/react-bits/DecryptedText";
import ShinyText from "@/components/ui/react-bits/ShinyText";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Clock, Wallet } from "lucide-react";

// ============================================================================
// ダミーデータ
// ============================================================================

const DUMMY_TRANSACTIONS = [
  {
    id: "1",
    type: "receive" as const,
    amount: "+¥500",
    description: "投げ銭を受け取りました",
    time: "2分前",
  },
  {
    id: "2",
    type: "send" as const,
    amount: "-¥100",
    description: "投げ銭を送りました",
    time: "1時間前",
  },
  {
    id: "3",
    type: "receive" as const,
    amount: "+¥1,000",
    description: "駐車場料金の払い戻し",
    time: "昨日",
  },
];

// ============================================================================
// コンポーネント
// ============================================================================

export default function WalletPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header
        title={
          <DecryptedText
            text="ウォレット"
            animateOn="view"
            speed={100}
            className="font-bold text-xl text-primary"
          />
        }
      />

      <main className="flex-1 flex flex-col px-4 pb-20">
        {/* Coming Soon バッジ */}
        <div className="flex justify-center mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Coming Soon
          </span>
        </div>

        {/* 残高カード */}
        <Card className="mt-6 border-primary/50 bg-black/60 backdrop-blur-xl relative overflow-hidden group">
          {/* Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/20 rounded-lg box-glow">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm font-medium">
                CarWallet 残高
              </span>
            </div>
            <div className="mb-2">
                <ShinyText text="¥0.00" className="text-4xl font-bold" />
            </div>
            <p className="text-muted-foreground/80 text-sm">
              <DecryptedText text="ウォレット機能は開発中です" speed={50} animateOn="view" />
            </p>
          </CardContent>
        </Card>

        {/* アクションボタン */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled
            className="h-auto flex-col gap-2 p-4 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="p-3 bg-green-500/10 rounded-full">
              <ArrowDownLeft className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-sm font-medium">受け取る</span>
          </Button>
          <Button
            variant="outline"
            disabled
            className="h-auto flex-col gap-2 p-4 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="p-3 bg-blue-500/10 rounded-full">
              <ArrowUpRight className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium">送る</span>
          </Button>
        </div>

        {/* 取引履歴 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full box-glow" />
            取引履歴
          </h3>
          <div className="space-y-3">
            {DUMMY_TRANSACTIONS.map((tx) => (
              <Card
                key={tx.id}
                className="flex items-center gap-4 p-4 border-border/50 bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-colors"
              >
                <div
                  className={cn(
                    "p-2 rounded-full",
                    tx.type === "receive"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-blue-500/10 text-blue-500",
                  )}
                >
                  {tx.type === "receive" ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {tx.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.time}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    tx.type === "receive"
                      ? "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                      : "text-foreground",
                  )}
                >
                  {tx.amount}
                </span>
              </Card>
            ))}
          </div>
        </div>

        {/* 開発中メッセージ */}
        <div className="mt-8 p-4 bg-muted/20 border border-muted/30 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            <DecryptedText
                text="ウォレット機能は現在開発中です。今後のアップデートをお待ちください。"
                speed={30}
                animateOn="view"
            />
          </p>
        </div>
      </main>
    </div>
  );
}
