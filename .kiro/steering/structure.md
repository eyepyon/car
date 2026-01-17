# Project Structure

## Organization Philosophy

pnpm workspaceによるモノレポ構成。機能ドメインごとにパッケージを分離し、各パッケージが独立してビルド・テスト可能。

## Directory Patterns

### Circuit Package
**Location**: `pkgs/circuit/`
**Purpose**: ZK証明回路（Circom）の開発・コンパイル・テスト
**Example**: `src/PasswordHash.circom` - パスワードハッシュ回路

### Contract Package
**Location**: `pkgs/contract/`
**Purpose**: Solidityスマートコントラクト（Hardhat）
**Example**: `contracts/PasswordHashVerifier.sol` - ZK検証コントラクト

### Frontend Package
**Location**: `pkgs/frontend/`
**Purpose**: Next.js PWAアプリケーション
**Example**: `app/page.tsx` - メインページ

### MCP Package
**Location**: `pkgs/mcp/`
**Purpose**: Model Context Protocolサーバー
**Example**: `src/index.ts` - MCPエントリーポイント

### x402 Server Package
**Location**: `pkgs/x402server/`
**Purpose**: x402決済プロトコルサーバー
**Example**: `src/index.ts` - Honoサーバー

### Qwen Sample Package
**Location**: `pkgs/qwen-sample/`
**Purpose**: Qwen AI統合サンプル
**Example**: `src/index.ts` - AI呼び出しサンプル

## Naming Conventions

- **Files**: kebab-case（例: `password-hash.circom`）
- **Components**: PascalCase（例: `BlurText.tsx`）
- **Functions**: camelCase（例: `generateInput`）
- **Contracts**: PascalCase（例: `PasswordHashVerifier.sol`）

## Import Organization

```typescript
// External dependencies
import { Hono } from 'hono'

// Internal packages (workspace)
import { something } from '@car/contract'

// Local imports
import { utils } from './utils'
```

**Path Aliases**:
- `@/`: `pkgs/frontend/` 内のルート

## Code Organization Principles

- 各パッケージは独立してビルド・テスト可能
- 共通の依存関係はルートの`package.json`で管理
- ZKファイル（WASM, zkey）は`circuit`から`contract`/`frontend`へコピー
- 環境変数は各パッケージの`.env`で管理（`.env.example`を参照）

---
_パッケージ間の依存は明示的に、循環依存は禁止_
