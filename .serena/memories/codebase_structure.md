# プロジェクト構造

## ディレクトリ構成

```
/Users/harukikondo/git/car/
├── .kiro/                    # Kiro AI開発フレームワーク設定
│   ├── steering/            # プロジェクト全体のコンテキスト
│   │   ├── product.md       # プロダクト概要
│   │   ├── tech.md          # 技術スタック
│   │   └── structure.md     # 構造ガイド
│   └── settings/            # 設定ファイル
├── pkgs/                    # モノレポパッケージ
│   ├── frontend/           # Next.js Webアプリ
│   ├── contract/           # Solidityスマートコントラクト
│   ├── circuit/            # Circom ZK証明回路
│   ├── mcp/                # x402 MCPクライアント
│   └── x402server/         # x402 決済サーバー
├── AGENTS.md               # AI開発ガイドライン
├── README.md               # プロジェクト説明
├── biome.json              # Biome設定（フォーマット・リント）
├── package.json            # ルートパッケージ設定
├── pnpm-lock.yaml          # 依存関係ロック
└── pnpm-workspace.yaml     # ワークスペース設定
```

## パッケージ詳細

### 1. Frontend（pkgs/frontend）
```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   ├── page.tsx           # トップページ
│   └── manifest.ts        # PWAマニフェスト
├── components/            # Reactコンポーネント
│   └── BlurText.tsx
├── lib/                   # ユーティリティ
│   └── utils.ts
├── public/                # 静的ファイル
│   └── manifest.json
├── components.json        # shadcn/ui設定
├── next.config.ts         # Next.js設定
├── tsconfig.json          # TypeScript設定
└── package.json
```

**エントリーポイント**: `app/page.tsx`

### 2. Contract（pkgs/contract）
```
contract/
├── contracts/             # Solidityソースコード
│   ├── PasswordHashVerifier.sol    # ZK検証コントラクト
│   └── interface/
│       └── IPasswordHashVerifier.sol
├── ignition/             # Hardhat Ignitionデプロイ
│   ├── modules/
│   │   └── PasswordHashVerifier.ts
│   └── deployments/
│       └── chain-84532/  # Base Sepolia デプロイ履歴
├── test/                 # コントラクトテスト
│   └── PasswordHashVerifier.test.ts
├── tasks/                # Hardhatカスタムタスク
│   ├── index.ts
│   └── utils/
│       ├── getBalance.ts
│       └── getChainInfo.ts
├── helpers/              # ヘルパー関数
│   └── contractJsonHelper.ts
├── artifacts/            # コンパイル成果物
├── cache/                # Hardhatキャッシュ
├── zk/                   # ZK証明用ファイル
│   └── PasswordHash_final.zkey
├── hardhat.config.ts     # Hardhat設定
└── package.json
```

**エントリーポイント**: `contracts/PasswordHashVerifier.sol`

### 3. Circuit（pkgs/circuit）
```
circuit/
├── src/                  # Circom回路ソース
│   └── PasswordHash.circom
├── scripts/              # ビルド・実行スクリプト
│   ├── compile.sh       # 回路コンパイル
│   ├── generateInput.js # 入力データ生成
│   ├── generateWitness.sh  # Witness生成
│   └── executeGroth16.sh   # 証明生成・検証
├── test/                 # 回路テスト
│   └── verify.test.js
├── data/                 # 入出力データ
│   ├── input.json       # 入力
│   ├── proof.json       # 証明
│   ├── public.json      # 公開入力
│   └── calldata.json    # コントラクト呼び出しデ���タ
├── zkey/                 # Proving/Verification keys
│   ├── PasswordHash_0000.zkey
│   ├── PasswordHash_final.zkey
│   └── verification_key.json
├── ptau/                 # Powers of Tau
│   └── powersOfTau28_hez_final_14.ptau
├── PasswordHash_js/      # WASM Witness生成
│   ├── generate_witness.js
│   └── witness_calculator.js
├── PasswordHash_cpp/     # C++ Witness生成
├── PasswordHash.r1cs     # コンパイル済み回路
├── PasswordHashVerifier.sol  # 生成されたVerifier
└── package.json
```

**エントリーポイント**: `src/PasswordHash.circom`

### 4. MCP（pkgs/mcp）
```
mcp/
├── src/                  # TypeScriptソースコード
│   ├── index.ts         # MCPサーバーメインエントリー
│   ├── lambda-server.ts # AWS Lambda実装
│   └── helpers.ts       # ヘルパー関数
├── bundle.js            # バンドルされたサーバー
├── esbuild.js           # esbuildビルド設定
├── run.sh               # 実行スクリプト
├── eslint.config.js     # ESLint設定
├── tsconfig.json        # TypeScript設定
├── README.md            # セットアップドキュメント
└── package.json
```

**エントリーポイント**: `src/index.ts`
**機能**: 
- Model Context Protocol (MCP) サーバー実装
- x402決済プロトコルを使用した自動支払い機能
- Claude Desktop等のMCPクライアントとの統合
- リソースサーバーからの有料データ取得

### 5. x402server（pkgs/x402server）
```
x402server/
├── src/                 # TypeScriptソースコード
│   └── index.ts        # Honoサーバーメインエントリー
├── Dockerfile          # Docker設定
├── eslint.config.js    # ESLint設定
├── tsconfig.json       # TypeScript設定
├── README.md           # デプロイドキュメント
└── package.json
```

**エントリーポイント**: `src/index.ts`
**機能**:
- Honoフレームワークによる高速APIサーバー
- x402-hono決済ミドルウェアの実装
- ステーブルコイン（USDC）による有料APIエンドポイント
- Google Cloud Run対応のDocker化
- `/weather` エンドポイント（デモ用有料データ提供）

## 命名規則

### ファイル
- TypeScript/React: `PascalCase.tsx`, `camelCase.ts`
- Solidity: `PascalCase.sol`
- Circom: `PascalCase.circom`
- スクリプト: `camelCase.sh`, `camelCase.js`
- 設定ファイル: `kebab-case.json`

### コード
- **変数・関数**: `camelCase`
- **コンポーネント・クラス**: `PascalCase`
- **定数**: `UPPER_SNAKE_CASE`
- **インターフェース**: `IPascalCase`（Solidity）

### Git
- **ブランチ**: `feat/<feature-name>`, `fix/<bug-name>`
- **コミット**: コンベンショナルコミット形式
  - `feat:` 新機能
  - `fix:` バグ修正
  - `docs:` ドキュメント
  - `test:` テスト
  - `refactor:` リファクタリング
  - `chore:` その他

## インポート整理

Biomeによる自動整理が有効（`assist.actions.source.organizeImports: on`）

```typescript
// 外部ライブラリ
import { useState } from 'react'
import { createPublicClient } from 'viem'

// 内部モジュール
import { utils } from '@/lib/utils'
import Component from './Component'
```

## 設定ファイル

### Biome（プロジェクトルート）
- **パス**: `biome.json`
- **機能**: フォーマット、リント、インポート整理
- **対象**: TypeScript, JavaScript

### TypeScript
- **Frontend**: `pkgs/frontend/tsconfig.json`
- **Contract**: `pkgs/contract/tsconfig.json`

### Hardhat
- **パス**: `pkgs/contract/hardhat.config.ts`
- **ネットワーク**: Base Sepolia
- **Solidity**: 0.8.28, viaIR有効

### Next.js
- **パス**: `pkgs/frontend/next.config.ts`
- **機能**: PWA対応、最適化設定

## コード整理の原則

1. **パッケージ分離**: フロント/コントラクト/回路は独立
2. **相対パス優先**: 各パッケージ内で完結
3. **成果物の分離**: `artifacts/`, `cache/`, `PasswordHash_*/` は.gitignore対象
4. **型安全性**: TypeScript strict mode
5. **自動整形**: コミット前に `pnpm format`

## 依存関係の流れ

```
circuit (Circom)
  ↓ (コンパイル)
PasswordHashVerifier.sol
  ↓ (コピー)
contract (Hardhat)
  ↓ (デプロイ)
Base Sepolia
  ↑ (検証・支払い)
frontend (Next.js)
  ↑ (支払い要求)
x402server (Hono)
  ↑ (MCPプロトコル)
mcp (MCP Client)
  ↑ (Claude等のMCPクライアント)
```

## 重要な成果物

1. **ZK証明系**
   - `circuit/zkey/PasswordHash_final.zkey`: Proving key
   - `circuit/PasswordHash_js/*.wasm`: Witness生成器
   - `circuit/PasswordHashVerifier.sol`: 検証コントラクト

2. **スマートコントラクト**
   - `contract/artifacts/`: コンパイル済みJSON
   - `contract/ignition/deployments/chain-84532/`: デプロイ履歴

3. **フロントエンド**
   - `frontend/.next/`: Next.jsビルド出力（未コミット）