# Technology Stack

## Architecture

pnpm workspace を使ったモノレポ構成。  
フロントエンド（React + Vite）とバックエンド（Hono）を独立パッケージとして分離。

## Core Technologies

- **Language**: TypeScript
- **Framework**: React 19 (frontend), Hono (backend)
- **Runtime**: Node.js (ESM)

## Key Libraries

- React / React DOM: UI 実装の中心
- Vite: フロントの開発・ビルド基盤
- Hono: API/HTTP サーバー

## Development Standards

### Type Safety

- TypeScript を前提に実装（any の利用は最小限に）

### Code Quality

- フロントエンドで ESLint (flat config) を使用

### Testing

- 既存のテスト基盤は未整備（必要に応じて追加）

## Development Environment

### Required Tools

- pnpm (packageManager: 10.20.0)
- Node.js (バージョンは未固定)

### Common Commands
```bash
# Dev (frontend)
pnpm frontend dev

# Dev (backend)
pnpm backend dev

# Build (frontend)
pnpm --filter frontend build

# Build (backend)
pnpm --filter backend build

# Lint (frontend)
pnpm --filter frontend lint
```

## Key Technical Decisions

- ESM を採用（`type: module`）
- フロント/バックを分離したモノレポで学習・拡張を容易にする

---
updated_at: 2026-01-16
