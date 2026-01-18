"use client";

/**
 * トップページ
 *
 * @description
 * アプリケーションのメインエントリーポイント。
 * カメラ起動ボタンを中央に配置し、ナンバープレート認識機能へのアクセスを提供。
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { CameraButton } from "@/components/home/CameraButton";
import { CameraModal } from "@/components/home/CameraModal";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import DecryptedText from "@/components/ui/react-bits/DecryptedText";
import type { LicensePlateData } from "@/types/license-plate";
import { useState } from "react";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRecognition, setLastRecognition] =
    useState<LicensePlateData | null>(null);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleRecognitionComplete = (result: LicensePlateData) => {
    setLastRecognition(result);
    console.log("Recognition complete:", result);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        {/* ウェルカムメッセージ */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-2 h-8">
            <DecryptedText
              text="ナンバープレートを撮影"
              animateOn="view"
              speed={80}
            />
          </h2>
          <p className="text-muted-foreground">
            カメラでナンバープレートを撮影して認識します
          </p>
        </div>

        {/* カメラボタン */}
        <CameraButton onClick={handleOpenModal} />

        {/* 最後の認識結果 */}
        {lastRecognition && (
          <Card className="mt-8 w-full max-w-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">
                最後の認識結果
              </p>
              <p className="text-xl font-bold text-foreground">
                {lastRecognition.fullText}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                信頼度: {lastRecognition.confidence}%
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* カメラモーダル */}
      <CameraModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRecognitionComplete={handleRecognitionComplete}
      />
    </div>
  );
}
