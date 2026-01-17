# Implementation Plan: Top Page

## Overview

トップページとウォレットページの実装計画。既存のCameraCapture、RecognitionResultコンポーネントを活用し、Apple-styleのミニマルなUIを構築する。

## Tasks

- [x] 1. レイアウトコンポーネントの作成
  - [x] 1.1 BottomNavigationコンポーネントを作成する
    - `pkgs/frontend/components/layout/BottomNavigation.tsx`を作成
    - ホームとウォレットの2つのナビゲーション項目を実装
    - usePathname()でアクティブ状態を判定
    - Lucide Reactアイコン（Home, Wallet）を使用
    - 固定位置（bottom: 0）、高さ64px
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.2 Headerコンポーネントを作成する
    - `pkgs/frontend/components/layout/Header.tsx`を作成
    - アプリタイトル「CarWallet」を表示
    - オプションで戻るボタンを表示
    - 高さ56px
    - _Requirements: 1.1_

- [x] 2. ホームページコンポーネントの作成
  - [x] 2.1 CameraButtonコンポーネントを作成する
    - `pkgs/frontend/components/home/CameraButton.tsx`を作成
    - 円形ボタン（直径120px）
    - カメラアイコンとテキストラベル
    - ホバー/アクティブ状態のアニメーション
    - aria-label設定
    - _Requirements: 2.5, 2.6_

  - [x] 2.2 CameraModalコンポーネントを作成する
    - `pkgs/frontend/components/home/CameraModal.tsx`を作成
    - フルスクリーンモーダル
    - 既存のCameraCaptureコンポーネントをシングルショットモードで統合
    - RecognitionResultコンポーネントで認識結果を表示
    - ESCキーで閉じる対応
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. ページの実装
  - [x] 3.1 トップページを更新する
    - `pkgs/frontend/app/page.tsx`を更新
    - Header、CameraButton、CameraModalを統合
    - モーダルの開閉状態を管理
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 3.2 ウォレットページを作成する
    - `pkgs/frontend/app/wallet/page.tsx`を作成
    - 残高プレースホルダー（¥0.00）
    - 取引履歴プレースホルダー
    - 「Coming Soon」バッジ
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.3 レイアウトを更新する
    - `pkgs/frontend/app/layout.tsx`を更新
    - BottomNavigationを追加
    - ページコンテンツ領域のパディング調整
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - 基本機能の確認
  - すべてのコンポーネントが正しくレンダリングされることを確認
  - ナビゲーションが正しく動作することを確認
  - 問題があればユーザーに確認

- [ ] 5. テストの実装
  - [ ]* 5.1 BottomNavigationのユニットテストを作成する
    - `pkgs/frontend/components/layout/BottomNavigation.test.tsx`を作成
    - 2つのナビゲーション項目の存在を確認
    - アクティブ状態の切り替えを確認
    - _Requirements: 5.2, 5.4_

  - [ ]* 5.2 CameraModalのユニットテストを作成する
    - `pkgs/frontend/components/home/CameraModal.test.tsx`を作成
    - モーダルの開閉を確認
    - CameraCaptureコンポーネントの統合を確認
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 5.3 Property 1のプロパティテストを作成する
    - **Property 1: Modal toggle state consistency**
    - モーダルの開閉状態の一貫性を検証
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 5.4 Property 3のプロパティテストを作成する
    - **Property 3: Navigation active state reflects current path**
    - ナビゲーションのアクティブ状態がパスと一致することを検証
    - **Validates: Requirements 3.3, 5.4**

  - [ ]* 5.5 Property 5のプロパティテストを作成する
    - **Property 5: Interactive elements are accessible**
    - インタラクティブ要素のアクセシビリティを検証
    - **Validates: Requirements 7.1, 7.2**

- [x] 6. アクセシビリティとPWA対応
  - [x] 6.1 アクセシビリティ属性を追加する
    - すべてのインタラクティブ要素にaria属性を設定
    - キーボードナビゲーション対応を確認
    - フォーカス状態のスタイリング
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 6.2 PWA設定を確認・更新する
    - manifest.jsonの設定を確認
    - アプリアイコンの設定を確認
    - _Requirements: 6.1, 6.3_

- [x] 7. Final Checkpoint - 全機能の確認
  - すべてのテストが通ることを確認
  - アクセシビリティ要件を満たすことを確認
  - 問題があればユーザーに確認

## Notes

- タスク5.x（テスト関連）は`*`マークでオプションとして設定
- 既存のCameraCapture、RecognitionResultコンポーネントを再利用
- Lucide Reactアイコンを使用（既にプロジェクトに含まれている）
- fast-checkを使用したProperty-Based Testing
