# Technology Stack

## Architecture

Web3 × AI融合のモビリティプラットフォーム。フロントエンド（Next.js PWA）、スマートコントラクト（Base L2）、ZK証明回路（Circom）、AI画像認識（Qwen）を統合。

## Core Technologies

- **Language**: TypeScript, Solidity, Circom, PHP, Python
- **Framework**: Next.js 14 (App Router), Hardhat, Hono, Laravel 11, Flask
- **Runtime**: Node.js 20+, pnpm workspace, PHP 8.3+, Python 3.x
- **Blockchain**: Base Sepolia (Ethereum L2)
- **AI**: Qwen-VL, allenai/Molmo2-8B
- **Database**: MySQL 8.0+

## Key Libraries

### Frontend
- React 18, TailwindCSS, shadcn/ui, React Bits
- wagmi v2, viem, RainbowKit（Web3統合）

### Contract
- Hardhat, OpenZeppelin Contracts
- snarkjs（ZK証明生成・検証）

### Circuit
- Circom 2.x, snarkjs
- circomlib（標準回路ライブラリ）

### Backend
- Hono（軽量Webフレームワーク）
- Laravel 11（PHP 8.3+、メインAPI）
- Flask（Python、バッチ処理・AI連携）
- x402（決済プロトコル）
- Sesame Web API（ゲート開閉制御）

### API Routes
- `/api/` - Laravel API（メイン）
- `/papi/` - Flask API（Python）

### API Domain
- **Production**: `https://api.incar.style`
- **Frontend環境変数**: `NEXT_PUBLIC_API_BASE_URL`

### External APIs
- Sesame Web API（スマートロック制御）
- Qwen MCP Server（会話AI連携）

### Documentation
- `/docs/` - APIドキュメント（PHP/Python別）

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
