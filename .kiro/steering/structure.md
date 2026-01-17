# Project Structure

## Organization Philosophy

フロントエンドとバックエンドを完全に分離したモノレポ構成。  
各パッケージ内に `src/` を持ち、入口ファイルから機能を拡張する前提。

## Directory Patterns

### Frontend Package
**Location**: `/pkgs/frontend/`  
**Purpose**: React + Vite による UI 実装  
**Example**: `src/main.tsx` がエントリ、`src/App.tsx` が主要 UI

### Backend Package
**Location**: `/pkgs/backend/`  
**Purpose**: Hono による API/HTTP サーバー  
**Example**: `src/index.ts` にサーバー起動とルーティングを集約

## Naming Conventions

- **Files**: TypeScript は `*.ts` / `*.tsx`
- **Components**: PascalCase（例: `App.tsx`）
- **Functions**: lowerCamelCase

## Import Organization

```typescript
import { useState } from 'react'
import App from './App.tsx'
```

**Path Aliases**:
- なし（相対パス中心）

## Code Organization Principles

- フロント/バックを跨ぐ依存を避け、各パッケージ内で完結
- 入口ファイルから機能を段階的に追加し、学習しやすい形を維持

---
updated_at: 2026-01-16
