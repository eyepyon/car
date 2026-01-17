# コマンド一覧

## プロジェクトルートコマンド

### パッケージ管理
```bash
# 依存関係のインストール
pnpm install

# 特定パッケージへのコマンド実行
pnpm --filter <package-name> <command>
```

### コード品質（Biome）
```bash
# コードフォーマット
pnpm format
# または
pnpm exec biome format --write .

# リント（修正含む）
pnpm lint
# または
pnpm exec biome check --write .

# リント（チェックのみ）
pnpm exec biome check .
```

### パッケージ別エイリアス
```bash
# フロントエンド
pnpm frontend <command>

# スマートコントラクト
pnpm contract <command>

# ZK回路
pnpm circuit <command>

# x402 MCPクライアント
pnpm mcp <command>

# x402サーバー
pnpm x402server <command>
```

## フロントエンド（pkgs/frontend）

### 開発・ビルド
```bash
# 開発サーバー起動
pnpm frontend dev

# 本番ビルド
pnpm frontend build

# 本番サーバー起動
pnpm frontend start

# リント
pnpm frontend lint
```

### PWAアイコン生成
```bash
pnpm frontend generate:icons
```

## スマートコントラクト（pkgs/contract）

### 開発フロー
```bash
# コンパイル
pnpm contract compile

# テスト実行
pnpm contract test

# カバレッジ取得
pnpm contract coverage

# クリーン（成果物削除）
pnpm contract clean
```

### デプロイ・検証
```bash
# PasswordHashVerifier デプロイ＆検証
pnpm contract deploy:PasswordHashVerifier

# デプロイ済みコントラクトの検証
pnpm contract verify
```

### ローカルノード
```bash
# ローカルHardhatノード起動
pnpm contract local
```

### ユーティリティタスク
```bash
# アカウント残高確認
pnpm contract getBalance

# チェーン情報取得
pnpm contract getChainInfo
```

### Solidity フォーマット
```bash
# Solidity コード整形
pnpm contract format
```

## ZK証明回路（pkgs/circuit）

### 回路開発フロー
```bash
# 1. 回路コンパイル（.circom → R1CS, WASM, C++）
pnpm circuit compile

# 2. 入力データ生成
pnpm circuit generateInput

# 3. Witness 生成
pnpm circuit generateWitness

# 4. 証明生成・検証（Groth16）
pnpm circuit executeGroth16

# 5. テスト実行
pnpm circuit test
```

### ファイルコピー（他パッケージへの配布）
```bash
# Verifierコントラクトをバックエンドにコピー
pnpm circuit cp:verifier

# ZKファイル（WASM, zkey）をバックエンド・フロントエンドにコピー
pnpm circuit cp:zk
```

### 回路コンパイル詳細
```bash
# デフォルト（PasswordHash）
./scripts/compile.sh

# カスタム回路名指定
./scripts/compile.sh <CircuitName>
```

## x402 MCPクライアント（pkgs/mcp）

### 開発・実行
```bash
# 開発モードで起動（tsx使用）
pnpm mcp dev

# ビルド（TypeScript + esbuild）
pnpm mcp build

# ビルド済みバンドルを実行
pnpm mcp start

# AWS Lambda版を起動
pnpm mcp lambda
```

### コード品質
```bash
# フォーマット
pnpm mcp format
pnpm mcp format:check

# リント
pnpm mcp lint
pnpm mcp lint:check
```

### 環境変数設定
```bash
# .env ファイルに以下を設定
PRIVATE_KEY=0x...                        # 支払い用ウォレット秘密鍵
RESOURCE_SERVER_URL=http://localhost:4021 # リソースサーバーURL
ENDPOINT_PATH=/weather                    # エンドポイントパス
```

### Claude Desktop統合
`~/Library/Application Support/Claude/claude_desktop_config.json` に追加：
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

## x402サーバー（pkgs/x402server）

### 開発・実行
```bash
# 開発モードで起動
pnpm x402server dev

# TypeScriptコンパイル
pnpm x402server build

# コンパイル済みコードを実行
pnpm x402server start
```

### Docker操作
```bash
# Dockerイメージビルド（linux/amd64）
pnpm x402server docker:build

# Dockerコンテナでローカル実行
pnpm x402server docker:run
```

### 環境変数設定
```bash
# .env ファイルに以下を設定
FACILITATOR_URL=https://facilitator.x402.io  # x402ファシリテーターURL
ADDRESS=0x...                                 # 支払い受取アドレス
NETWORK=base-sepolia                          # ブロックチェーンネットワーク
PORT=4021                                     # サーバーポート（省略可）
```

### Google Cloud Run デプロイ
```bash
# 1. Google Cloud SDK認証
gcloud auth login

# 2. プロジェクト設定
gcloud config set project <project-id>

# 3. Cloud Runにデプロイ
gcloud run deploy x402-api \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars FACILITATOR_URL=<url>,ADDRESS=<address>,NETWORK=base-sepolia
```

## Git コマンド（macOS/Darwin）

### 基本操作
```bash
# ステータス確認
git status

# 変更をステージング
git add <file>
git add .

# コミット（コンベンショナルコミット推奨）
git commit -m "feat: 新機能追加"
git commit -m "fix: バグ修正"
git commit -m "docs: ドキュメント更新"
git commit -m "test: テスト追加"
git commit -m "refactor: リファクタリング"
git commit -m "chore: その他の変更"

# プッシュ
git push origin <branch-name>

# ブランチ作成・切り替え
git checkout -b <new-branch>
git switch <branch>

# マージ
git merge <branch>

# 差分確認
git diff
git diff --staged
```

## システムユーティリティ（macOS）

### ファイル操作
```bash
# ディレクトリ一覧
ls -la

# ファイル検索
find . -name "*.ts"

# パターン検索
grep -r "pattern" .

# ディレクトリ移動
cd <directory>
pushd <directory>  # スタックに保存
popd               # 前のディレクトリに戻る

# カレントディレクトリ
pwd
```

### プロセス管理
```bash
# プロセス確認
ps aux | grep <process>

# ポート確認
lsof -i :<port>

# プロセス終了
kill <pid>
kill -9 <pid>  # 強制終了
```

## 環境変数設定

```bash
# .env ファイルに以下を設定
PRIVATE_KEY=<your-private-key>
ALCHMEY_API_KEY=<alchemy-api-key>
BASESCAN_API_KEY=<basescan-api-key>
```

## 推奨ワークフロー

### 新機能開発時
```bash
# 1. ブランチ作成
git checkout -b feat/<feature-name>

# 2. 開発（各パッケージで並行可能）
pnpm frontend dev    # ターミナル1
pnpm contract local  # ターミナル2（必要時）

# 3. コード品質チェック
pnpm format
pnpm lint

# 4. テスト実行
pnpm contract test
pnpm circuit test

# 5. コミット
git add .
git commit -m "feat: <description>"

# 6. プッシュ
git push origin feat/<feature-name>
```

### タスク完了時の確認事項
1. `pnpm format` でコード整形
2. `pnpm lint` でリント通過
3. 該当パッケージのテスト実行
4. コンベンショナルコミット形式でコミット
5. 変更内容のドキュメント更新（必要時）