# Technology Stack

## Architecture

Web3 × AI融合のモビリティプラットフォーム。フロントエンド（Next.js PWA）、スマートコントラクト（Base L2）、ZK証明回路（Circom）、AI画像認識（Qwen）を統合。

## Core Technologies

- **Language**: TypeScript, Solidity, Circom
- **Framework**: Next.js 14 (App Router), Hardhat, Hono
- **Runtime**: Node.js 20+, pnpm workspace
- **Blockchain**: Base Sepolia (Ethereum L2)
- **AI**: Qwen-VL, allenai/Molmo2-8B

## Key Libraries

### Frontend
- React 18, TailwindCSS, shadcn/ui
- wagmi v2, viem, RainbowKit（Web3統合）

### Contract
- Hardhat, OpenZeppelin Contracts
- snarkjs（ZK証明生成・検証）

### Circuit
- Circom 2.x, snarkjs
- circomlib（標準回路ライブラリ）

### Backend
- Hono（軽量Webフレームワーク）
- x402（決済プロトコル）

## Development Standards

### Type Safety
- TypeScript strict mode
- Solidity 0.8.20+（最新のセキュリティ機能）

### Code Quality
- Biome（Lint + Format）
- Solhint（Solidityリンター）

### Testing
- Hardhat Test（コントラクト）
- Mocha/Chai（回路テスト）
- Vitest（フロントエンド）

## Development Environment

### Required Tools
- Node.js 20+
- pnpm 8+
- Circom 2.x（ZK回路コンパイル）
- snarkjs（証明生成）

### Common Commands
```bash
# Install dependencies
pnpm install

# Frontend dev server
pnpm frontend dev

# Contract compile & test
pnpm contract compile
pnpm contract test

# Circuit compile & execute
pnpm circuit compile
pnpm circuit executeGroth16

# Code quality
pnpm format
pnpm lint
```

## Key Technical Decisions

1. **Base L2選択**: 低ガス代（$0.01以下）、高速（2秒ブロック）、Coinbaseサポート
2. **Groth16採用**: 証明サイズが小さく、オンチェーン検証コストが低い
3. **PWA対応**: オフライン対応、プッシュ通知、ネイティブアプリ不要
4. **ERC4337 SmartAccount**: ガスレス取引、ソーシャルリカバリー対応

---
_パフォーマンスとセキュリティのバランスを重視_
