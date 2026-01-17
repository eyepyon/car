'use client';

/**
 * トップページ
 *
 * @description
 * アプリケーションのメインエントリーポイント。
 * カメラ起動ボタンを中央に配置し、ナンバープレート認識機能へのアクセスを提供。
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { CameraButton } from '@/components/home/CameraButton';
import { CameraModal } from '@/components/home/CameraModal';
import type { LicensePlateData } from '@/types/license-plate';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRecognition, setLastRecognition] = useState<LicensePlateData | null>(null);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleRecognitionComplete = (result: LicensePlateData) => {
    setLastRecognition(result);
    console.log('Recognition complete:', result);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        {/* ウェルカムメッセージ */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            ナンバープレートを撮影
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            カメラでナンバープレートを撮影して認識します
          </p>
        </div>

        {/* カメラボタン */}
        <CameraButton onClick={handleOpenModal} />

        {/* 最後の認識結果 */}
        {lastRecognition && (
          <div className="mt-8 p-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              最後の認識結果
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {lastRecognition.fullText}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              信頼度: {lastRecognition.confidence}%
            </p>
          </div>
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
