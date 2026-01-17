# x402 決済システム

## 概要
x402はステーブルコイン（USDC）を使用したAPI課金プロトコル。このプロジェクトでは、MCPクライアントとHonoサーバーの2つの実装を提供。

## アーキテクチャ

```
Claude Desktop (MCPクライアント)
    ↓ MCP Protocol
mcp (pkgs/mcp) - x402 MCPクライアント
    ↓ HTTP + x402 Payment
x402server (pkgs/x402server) - x402 決済対応APIサーバー
    ↓ 支払い検証
Base Sepolia (USDC決済)
```

## パッケージ詳細

### 1. MCP Client (pkgs/mcp)

**目的**: Claude Desktop等のMCPクライアントからx402決済を使用してAPIを呼び出す

**主要ファイル**:
- `src/index.ts`: MCPサーバーのメイン実装
  - `McpServer`: MCP SDKのサーバーインスタンス
  - `withPaymentInterceptor`: x402-axios によるHTTPリクエストへの自動支払い機能
  - `get-data-from-resource-server`: リソースサーバーからデータを取得するツール
- `src/lambda-server.ts`: AWS Lambda対応版
- `src/helpers.ts`: ユーティリティ関数

**依存関係**:
- `@modelcontextprotocol/sdk`: MCP プロトコルSDK
- `x402-axios`: Axiosに自動支払い機能を追加するインターセプター
- `viem`: Ethereumウォレット機能（privateKeyToAccount）
- `axios`: HTTPクライアント

**環境変数**:
- `PRIVATE_KEY`: 支払いを行うEthereumウォレットの秘密鍵（Hex形式）
- `RESOURCE_SERVER_URL`: 接続先のリソースサーバーURL（例: http://localhost:4021）
- `ENDPOINT_PATH`: 呼び出すエンドポイントパス（例: /weather）

**Claude Desktop設定例**:
```json
{
  "mcpServers": {
    "x402-demo": {
      "command": "pnpm",
      "args": ["--silent", "-C", "/path/to/pkgs/mcp", "dev"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "RESOURCE_SERVER_URL": "http://localhost:4021",
        "ENDPOINT_PATH": "/weather"
      }
    }
  }
}
```

**スクリプト**:
- `pnpm dev`: 開発モードで実行（tsx使用）
- `pnpm build`: TypeScript + esbuildでビルド
- `pnpm start`: ビルド済みバンドルを実行
- `pnpm lambda`: Lambda版を実行

### 2. x402 Server (pkgs/x402server)

**目的**: x402決済プロトコルを実装したAPIサーバー（有料データ提供）

**主要ファイル**:
- `src/index.ts`: Honoサーバーのメイン実装
  - CORS設定（全オリジン許可）
  - `/health`: ヘルスチェックエンドポイント（無料）
  - `paymentMiddleware`: x402-honoミドルウェアによる支払い要求
  - `/weather`: デモ用有料データエンドポイント（$0.001/リクエスト）

**依存関係**:
- `hono`: 高速軽量Webフレームワーク
- `@hono/node-server`: Node.jsアダプター
- `x402-hono`: Hono用x402ミドルウェア
- `x402`: x402プロトコルコアライブラリ
- `dotenv`: 環境変数管理

**環境変数**:
- `FACILITATOR_URL`: x402ファシリテーターのURL（支払い調整サーバー）
- `ADDRESS`: 支払いを受け取るEthereumアドレス（0x...形式）
- `NETWORK`: ブロックチェーンネットワーク（例: base-sepolia）
- `PORT`: サーバーポート（デフォルト: 4021、Cloud Runの場合は環境変数から取得）

**エンドポイント**:
- `GET /health`: ヘルスチェック（無料）
  - レスポンス: `{ status: "ok", timestamp: string, port: number }`
- `GET /weather`: 天気データ取得（有料: $0.001）
  - レスポンス: `{ report: { weather: string, temperature: number } }`

**スクリプト**:
- `pnpm dev`: 開発モードで実行
- `pnpm build`: TypeScriptコンパイル
- `pnpm start`: コンパイル済みコードを実行
- `pnpm docker:build`: Dockerイメージビルド（linux/amd64）
- `pnpm docker:run`: Dockerコンテナでローカル実行

**デプロイ**:
- Google Cloud Run対応（Dockerfile提供）
- ポート: 環境変数`PORT`から動的取得（Cloud Run互換）

## x402 決済フロー

1. **クライアント側（mcp）**:
   - ユーザーがClaude DesktopでMCPツール実行
   - `withPaymentInterceptor`がHTTPリクエストをインターセプト
   - 必要に応じてUSDCトークンで自動支払い
   - リクエスト送信

2. **サーバー側（x402server）**:
   - `paymentMiddleware`が支払いを検証
   - 支払いが不足/なし → `402 Payment Required`レスポンス
   - 支払い完了 → エンドポイント処理を実行
   - データレスポンス返却

3. **ブロックチェーン**:
   - Base Sepolia上でUSDC決済
   - ファシリテーターが支払い調整
   - トランザクション確認後、データ提供

## セキュリティ考慮事項

- **秘密鍵管理**: 
  - 環境変数で管理（`.env`ファイル、コミット禁止）
  - Claude Desktop設定ファイルで直接指定（ローカル開発）
  - プロダクション環境ではAWS Secrets Manager等を推奨

- **CORS設定**: 
  - 現在は全オリジン許可（`origin: ["*"]`）
  - プロダクションでは特定オリジンに制限推奨

- **ネットワーク**:
  - Base Sepoliaテストネット使用
  - 本番環境ではBase Mainnetに切り替え

## 料金設定

現在の設定:
- `/weather`: $0.001/リクエスト（デモ用）

変更方法:
```typescript
paymentMiddleware(
  payTo,
  {
    "/endpoint-path": {
      price: "$0.001",  // ここを変更
      network,
    },
  },
  { url: facilitatorUrl }
)
```

## トラブルシューティング

### MCPクライアントが動作しない
- `PRIVATE_KEY`が正しいHex形式か確認
- `RESOURCE_SERVER_URL`がサーバーのURLと一致するか確認
- x402serverが起動しているか確認

### 支払いが失敗する
- ウォレットにUSDCが十分あるか確認（Base Sepolia）
- `FACILITATOR_URL`が正しいか確認
- ネットワーク設定が一致するか確認（`NETWORK`環境変数）

### サーバーがエラーを返す
- 必須環境変数が全て設定されているか確認
- ポート4021が使用可能か確認
- ログで詳細なエラーメッセージを確認

## 将来の拡張

- 複数の有料エンドポイント追加
- 動的な料金設定（データ量・ユーザー属性に基づく）
- サブスクリプションモデルの実装
- 使用量ダッシュボードの構築
- AI API（Qwen、Molmo等）との統合