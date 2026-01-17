# 技術スタック

## 全体アーキテクチャ
pnpm workspace (v10.20.0) を使ったモノレポ構成。フロントエンド、コントラクト、ZK回路を独立パッケージとして分離。

## 言語
- TypeScript（メイン言語）
- Solidity（スマートコントラクト）
- Circom（ZK証明回路）

## フロントエンド（pkgs/frontend）
### フレームワーク・ライブラリ
- **Next.js 16.1.3**: React フレームワーク
- **React 19.2.3**: UI ライブラリ
- **TypeScript 5**: 型安全性
- **TailwindCSS 4**: スタイリング
- **Shadcn/ui**: UIコンポーネント
- **Motion (Framer Motion) 12.26.2**: アニメーション
- **PWA対応**: @ducanh2912/next-pwa

### 開発ツール
- ESLint 9（flat config）
- Sharp（画像処理）

## バックエンド

### MCP/API サーバー（pkgs/mcp, pkgs/x402server）
- **Model Context Protocol (MCP) SDK 1.9.0**: Claude等のAIとの統合
- **Hono 4.7.1**: 高速軽量Webフレームワーク
- **x402-axios/x402-hono**: x402決済プロトコル実装
- **Axios 1.8.4**: HTTPクライアント
- **Express 4.18.2**: Node.jsサーバーフレームワーク（Lambda用）
- **@vendia/serverless-express 4.12.6**: AWS Lambda対応
- **@hono/node-server 1.13.8**: Hono Node.jsアダプター
- **tsx**: TypeScript実行環境

### ブロックチェーン（pkgs/contract）
- **Hardhat 2.26.1**: 開発環境
- **Viem**: Ethereum クライアント
- **Base Sepolia**: デプロイ先L2チェーン（Chain ID: 84532）
- **Solidity 0.8.28**: スマートコントラクト言語（viaIR有効）

### ライブラリ
- OpenZeppelin 5.0.0: 標準コントラクト
- Solhint 5.0.4: Linter
- Mocha + Chai: テストフレームワーク

### インフラ
- Alchemy API: ノード接続
- Basescan: コントラクト検証

## ZK証明回路（pkgs/circuit）
### ツール
- **Circom**: 回路記述言語
- **SnarkJS 0.6.9**: 証明生成・検証
- **Circomlib 2.0.5**: 標準回路ライブラリ
- **Circomlibjs 0.1.7**: JavaScript実装

### プロトコル
- Groth16: ZK証明システム
- Powers of Tau（14次）: Trusted setup

## AI技術（計画）
- Qwen: マルチモーダルAI
- allenai/Molmo2-8B: 画像認識モデル

## Web3技術
- **ERC4337**: アカウント抽象化（SmartAccount）
- **ZK証明**: プライバシー保護
- **Base L2**: 低コスト・高速決済
- **x402**: ステーブルコイン（USDC）による決済プロトコル
  - 自動支払いインターセプター
  - API使用量ベースの課金
  - Base Sepoliaテストネットで動作

## コード品質ツール
- **Biome 2.3.11**: フォーマッター・リンター（プロジェクトルート）
  - VCS統合（Git）
  - インポート自動整理
  - ダブルクォート推奨

## 開発環境
- Node.js: >=18
- pnpm: 10.20.0（packageManager固定）
- macOS（Darwin）: 開発環境OS

## ネットワーク設定
- Base Sepolia Testnet
  - RPC: Alchemy経由
  - Chain ID: 84532
  - Block Explorer: Basescan