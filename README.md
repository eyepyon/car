# car

次世代モーティブ生成AIハッカソン用のリポジトリです。

## 概要

**「ナンバープレート連動ウォレットシステム」** は、ブロックチェーン（Web3）とAI技術を融合させた次世代のモビリティプラットフォームです。最大の特長は、車両のナンバープレートそのものを「ウォレットID」化する点にあります。

これにより、専用アプリの操作を必要とせず、走行するだけで相手や施設を特定し、シームレスな決済やデータ連携を可能にします。技術スタックとしては、低コスト・高速決済を実現する「Base L2」ブロックチェーンや、画像・音声認識を統合したマルチモーダルAI「Qwen」を採用しており、実用性の高いスケーラブルな構成となっています,。

## システム構成図

```mermaid
graph TB
    subgraph "クライアント層"
        Mobile["📱 モバイルアプリ<br/>(Next.js PWA)"]
        Camera["📷 AIカメラ<br/>(ゲート設置)"]
        DashCam["🎥 ドライブレコーダー"]
    end

    subgraph "フロントエンド層"
        NextJS["⚛️ Next.js<br/>TypeScript + TailwindCSS<br/>Shadcn/ui + React Bits"]
        PWA["📲 PWA機能<br/>(オフライン対応)"]
        Wallet["👛 ウォレットUI<br/>(SmartAccount連携)"]
    end

    subgraph "バックエンド層 - PHP"
        Laravel["🐘 Laravel 11<br/>(PHP)"]
        GateAPI["🚧 ゲート開閉API<br/>(Sesame連携)"]
        MySQL["🗄️ MySQL 8<br/>(トランザクション履歴)"]
    end

    subgraph "バックエンド層 - Python"
        Flask["🐍 Flask<br/>(Python)"]
        ConversationAPI["💬 会話API<br/>(Qwen MCP連携)"]
        BatchJobs["⚙️ バッチ処理<br/>(データ集計)"]
    end

    subgraph "AI/ML層"
        Qwen["🤖 Qwen<br/>(マルチモーダルAI)"]
        Molmo["🔍 Molmo2-8B<br/>(画像認識)"]
        MCP["🔌 MCP Server<br/>(AI統合)"]
        OCR["📝 OCR処理<br/>(ナンバー認識)"]
    end

    subgraph "Web3/ブロックチェーン層"
        BaseSepolia["⛓️ Base Sepolia<br/>(L2 Testnet)"]
        SmartAccount["📜 SmartAccount<br/>(ERC4337)"]
        Factory["🏭 LicensePlateAccountFactory<br/>(アカウント生成)"]
        MockERC20["💰 MockERC20<br/>(トークン)"]
        Verifier["✅ Verifier Contract<br/>(ZK検証)"]
    end

    subgraph "ZK証明層"
        Circom["⚡ Circom回路<br/>(ナンバー秘匿化)"]
        Groth16["🔐 Groth16証明<br/>(ゼロ知識証明)"]
        WASM["📦 WASM<br/>(Witness生成)"]
    end

    subgraph "外部サービス"
        Sesame["🔓 Sesame Web API<br/>(スマートロック)"]
        Oracle["🔮 価格Oracle<br/>(車両査定)"]
        x402["💸 x402 Protocol<br/>(決済)"]
    end

    subgraph "インフラ・ツール"
        Alchemy["🌐 Alchemy API<br/>(RPC Provider)"]
        Basescan["🔍 Basescan API<br/>(Contract Verify)"]
        Biome["🧹 Biome<br/>(Linter/Formatter)"]
    end

    %% クライアント → フロントエンド
    Mobile --> NextJS
    Camera --> OCR
    DashCam --> OCR

    %% フロントエンド内部
    NextJS --> PWA
    NextJS --> Wallet

    %% フロントエンド → バックエンド
    NextJS --> Laravel
    NextJS --> Flask
    Wallet --> SmartAccount

    %% バックエンド PHP
    Laravel --> MySQL
    Laravel --> GateAPI
    GateAPI --> Sesame

    %% バックエンド Python
    Flask --> ConversationAPI
    Flask --> BatchJobs
    ConversationAPI --> MCP

    %% AI層
    OCR --> Molmo
    Molmo --> Qwen
    MCP --> Qwen
    Qwen --> ConversationAPI

    %% ZK証明フロー
    OCR --> Circom
    Circom --> WASM
    WASM --> Groth16
    Groth16 --> Verifier

    %% Web3層
    Verifier --> BaseSepolia
    Factory --> BaseSepolia
    SmartAccount --> BaseSepolia
    MockERC20 --> BaseSepolia
    SmartAccount --> x402

    %% 外部サービス連携
    SmartAccount --> Oracle
    Laravel --> Alchemy
    Factory --> Alchemy

    %% インフラ
    BaseSepolia --> Basescan
    NextJS --> Biome

    %% スタイリング
    classDef frontend fill:#61dafb,stroke:#333,stroke-width:2px,color:#000
    classDef backend fill:#ff6b6b,stroke:#333,stroke-width:2px,color:#fff
    classDef ai fill:#ffd93d,stroke:#333,stroke-width:2px,color:#000
    classDef blockchain fill:#8b5cf6,stroke:#333,stroke-width:2px,color:#fff
    classDef zk fill:#10b981,stroke:#333,stroke-width:2px,color:#fff
    classDef external fill:#f97316,stroke:#333,stroke-width:2px,color:#fff
    classDef infra fill:#6b7280,stroke:#333,stroke-width:2px,color:#fff

    class NextJS,PWA,Wallet,Mobile frontend
    class Laravel,Flask,GateAPI,ConversationAPI,BatchJobs,MySQL backend
    class Qwen,Molmo,MCP,OCR ai
    class BaseSepolia,SmartAccount,Factory,MockERC20,Verifier blockchain
    class Circom,Groth16,WASM zk
    class Sesame,Oracle,x402 external
    class Alchemy,Basescan,Biome,Camera,DashCam infra
```

## 解決したい課題

このプロダクトは、現在のモビリティ社会における「ユーザーの摩擦」と「社会的な非効率性」の解決を目指しています。

- **現場の摩擦・ユーザー負担**:
    駐車場精算機での小銭探しや雨天時の窓開け操作、ドライブスルーでの長い待ち時間、運転中のスマホ操作による危険性などが挙げられます,。
- **証拠の信頼性不足**:
    ドライブレコーダー映像の改ざんリスクや、事故時の証拠提出手続きの複雑さが課題となっています。
- **データの死蔵と非還元**:
    膨大な走行データが活用されず、データ提供者であるドライバーへのインセンティブも存在しません。
- **社会・制度課題**:
    観光地でのオーバーツーリズム（渋滞）や、既存のETC・ゲートシステムの導入・維持コストが極めて高い（中小施設には障壁となる）という問題があります。

## このプロダクトで実現できること

「車に乗ったままで何でもできる」世界の実現により、以下のような具体的な価値を提供します。

- **フリクションレスな自動決済**:
    - **ゲート自動決済**:
        AIカメラがナンバーを認識し、0.5秒でゲート解錠と決済を完了させます。
    - **ドライブスルー革命**:
        店舗到着と同時に注文・決済が完了し、待ち時間ゼロで商品を受け取れます。
- **安全で高度な運転支援**:
    - **AIコンシェルジュ**:
        音声AIにより、運転中に「近くの空いてる駐車場」を検索・予約・決済までハンズフリーで完結できます。
    - **デジタル証拠登録**:
        映像をブロックチェーンに即時記録することで、改ざん不可能な証拠として事故解決を迅速化します。
- **新たな経済圏の創出**:
    - **データ収益化**:
        走行データを匿名化して販売し、収益の70%をユーザーへ還元する「走るほど稼げる」仕組みを提供します（月間平均640円の報酬を想定）。
    - **P2P投げ銭**:
        運転中に道を譲ってもらった際などの感謝を、ナンバー認識を通じてチップとして送ることができます。
- お金が無くても大丈夫。自分の車を登録した時に車の価値が査定され、その金額をローン枠として利用できすぐに使うことが出来ます。（「わ」「れ」ナンバーの車はレンタカーやカーシェアなので使えません。）
- **社会的インパクト**:
    - ダイナミックプライシング（混雑に応じた価格変動）により、観光地の渋滞を最大30%緩和します。
    - 降車回数や窓開け操作を90%削減し、店舗の回転率を30%向上させます。

## 実現方法

1. 車のナンバープレートを画像認識して抽出(この値が重要になるので画像の認識の精度は非常に重要)
2. 抽出した情報をZKで秘匿化(パスワードハッシュ化と同じでも良いかも)
3. その値を使ったAA用のSmartAccount(ERC4337規格準拠)を作成する。
4. スマホなどに金額案内などと同時に利用承認の通知が来る。
5. 承認したらゲートが開く
6. 出るときAIカメラで自動的にゲートを開けるのと課金トランザクション発生(課金する時にx402を使う？？)

## 機能一覧表

| 機能 | 説明 | ステータス |
|:------|:------|:------------|
|ナンバープレート認識機能|車のナンバープレートの情報を認識する。||
|ウォレットアドレス変換機能|ゼロ知識証明により内容を秘匿化しながら決定論的にナンバープレートからウォレットアドレスを算出する機能||
|自動車の価値を算出する機能(トークン化)|自動車の現在の評価額をトークン化する機能||
|チップ機能|道とかを譲ってもらった機能(支払い方法についてはx402を送信する)||

## 機能ごとの処理シーケンス図

### 1. ナンバープレート認識機能

```mermaid
sequenceDiagram
    participant Car as 🚗 車両
    participant Camera as 📷 AIカメラ
    participant AI as 🤖 画像認識AI
    participant System as 💾 システム

    Car->>Camera: 車両接近
    Camera->>Camera: 画像キャプチャ
    Camera->>AI: 画像データ送信
    AI->>AI: ナンバープレート検出
    AI->>AI: OCR処理
    AI->>System: ナンバープレート情報<br/>(例: 品川330あ1234)
    System-->>AI: 認識成功確認
    Note over AI,System: 精度: 高精度な認識が必須
```

### 2. ウォレットアドレス変換機能

```mermaid
sequenceDiagram
    participant System as 💾 システム
    participant ZK as 🔐 ZK証明回路
    participant Circuit as ⚡ Circom回路
    participant Verifier as ✅ Verifier Contract
    participant Blockchain as ⛓️ Base L2

    System->>ZK: ナンバープレート情報
    ZK->>Circuit: 入力データ生成
    Circuit->>Circuit: Witness生成
    Circuit->>Circuit: Proof生成<br/>(Groth16)
    Circuit->>ZK: ZK証明 + 公開出力
    ZK->>ZK: 決定論的アドレス算出
    ZK->>Verifier: 証明検証リクエスト
    Verifier->>Blockchain: オンチェーン検証
    Blockchain-->>Verifier: 検証結果
    Verifier-->>System: ウォレットアドレス<br/>(ERC4337 SmartAccount)
    Note over ZK,Verifier: プライバシー保護:<br/>ナンバーは秘匿化
```

### 3. ゲート自動決済フロー（統合）

```mermaid
sequenceDiagram
    participant Car as 🚗 車両
    participant Gate as 🚧 ゲート
    participant Camera as 📷 AIカメラ
    participant System as 💾 システム
    participant Wallet as 👛 SmartAccount
    participant Phone as 📱 スマホ
    participant Blockchain as ⛓️ Base L2

    Note over Car,Gate: 入場時
    Car->>Gate: ゲート接近
    Gate->>Camera: 検知
    Camera->>System: ナンバー認識<br/>(0.5秒)
    System->>Wallet: アドレス変換
    System->>Phone: 利用案内通知<br/>(金額・場所)
    Phone->>Phone: ユーザー確認
    Phone->>System: 承認
    System->>Gate: 解錠指示
    Gate->>Car: ゲート開放

    Note over Car,Gate: 退場時
    Car->>Gate: ゲート接近（退場）
    Gate->>Camera: 検知
    Camera->>System: ナンバー認識
    System->>Wallet: 決済実行
    Wallet->>Blockchain: トランザクション送信<br/>(x402 / Base L2)
    Blockchain-->>Wallet: 決済完了
    Wallet-->>System: 結果通知
    System->>Gate: 解錠指示
    Gate->>Car: ゲート開放
    System->>Phone: 決済完了通知<br/>(領収書)
```

### 4. チップ機能（P2P投げ銭）

```mermaid
sequenceDiagram
    participant CarA as 🚗 車両A<br/>(送信者)
    participant Camera as 📷 カメラ/UI
    participant System as 💾 システム
    participant WalletA as 👛 Wallet A
    participant WalletB as 💰 Wallet B
    participant CarB as 🚙 車両B<br/>(受信者)
    participant Blockchain as ⛓️ Base L2

    Note over CarA,CarB: 道を譲ってもらった場面
    CarA->>Camera: 相手ナンバー認識<br/>または音声入力
    Camera->>System: ナンバープレート情報
    System->>System: アドレス変換
    CarA->>System: チップ送信指示<br/>(金額選択)
    System->>WalletA: 送金リクエスト
    WalletA->>Blockchain: トランザクション送信
    Blockchain->>WalletB: チップ受信
    Blockchain-->>WalletA: 送信完了
    WalletB->>CarB: 受信通知<br/>(「ありがとう」)
    System->>CarA: 送信完了通知
    Note over CarA,CarB: 感謝の気持ちを<br/>ブロックチェーンで伝達
```

### 5. 車両価値トークン化フロー

```mermaid
sequenceDiagram
    participant User as 👤 ユーザー
    participant System as 💾 システム
    participant AI as 🤖 査定AI
    participant Oracle as 🔮 価格Oracle
    participant Contract as 📜 Contract
    participant Blockchain as ⛓️ Base L2

    User->>System: 車両登録<br/>(ナンバー・車種情報)
    System->>AI: 査定リクエスト
    AI->>Oracle: 市場価格取得
    Oracle-->>AI: 現在の相場データ
    AI->>AI: 車両評価額算出<br/>(年式・走行距離等)
    AI->>System: 査定結果
    System->>Contract: トークン化リクエスト
    Contract->>Blockchain: ERC20トークン発行
    Blockchain-->>Contract: トークンID
    Contract->>System: ローン枠設定<br/>(査定額ベース)
    System->>User: 登録完了通知<br/>+ 利用可能額
    Note over User,Blockchain: 「わ」「れ」ナンバーは<br/>レンタカーのため対象外
```

## 将来構想

自動車の走行履歴や自動車間のトランザクションのやり取りを分散型ナレッジグラフネットワークに書き込み、社会の実情を反映した渋滞予測などのプログラムを作成することに繋げる。

本取り組みはその足がかりとなるもの。

## 技術スタック
| カテゴリ | 技術 |
|---------|------|
| **フロントエンド** | Next.js<br/>TypeScript<br/>TailwindCSS<br/> Shadcn/ui<br/>React Bits<br/>biome |
| **バックエンド** | laravel<br/> php<br/> flask<br/> python <br/> Hono <br/> TypeScript|
| **AI** | Qwen<br/> allenai/Molmo2-8B <br/> MCP|
| **Web3** | Base Sepolia<br/>AA<br/> SmartAccount<br/> ゼロ知識証明<br/> Solidity<br/> Circom<br/> x402 |

## 動かし方

### セットアップ

#### 1. リポジトリのクローンと依存関係のインストール
```bash
git clone <repository-url>
cd car
pnpm install
```

#### 2. 環境変数の設定
`pkgs/contract/.env` ファイルを作成し、以下を設定：
```bash
PRIVATE_KEY=<your-wallet-private-key>
ALCHMEY_API_KEY=<your-alchemy-api-key>
BASESCAN_API_KEY=<your-basescan-api-key>
```

### フロントエンド

#### 開発サーバーの起動
```bash
pnpm frontend dev
```

ブラウザで http://localhost:3000 にアクセス

#### 本番ビルド
```bash
pnpm frontend build
pnpm frontend start
```

#### PWAアイコン生成
```bash
pnpm frontend generate:icons
```

### サーキット（ZK証明回路）

#### 完全な実行フロー
```bash
# 1. 回路のコンパイル（.circom → R1CS, WASM, C++）
pnpm circuit compile

# 2. 入力データの生成
pnpm circuit generateInput

# 3. Witness（証人）の生成
pnpm circuit generateWitness

# 4. Groth16証明の生成と検証
pnpm circuit executeGroth16

# 5. テストの実行
pnpm circuit test
```

#### 生成ファイルの配布
```bash
# Verifierコントラクトをcontractパッケージにコピー
pnpm circuit cp:verifier

# ZKファイル（WASM, zkey）をbackend/frontendにコピー
pnpm circuit cp:zk
```

### コントラクト（スマートコントラクト）

#### 開発フロー
```bash
# コンパイル
pnpm contract compile

# テストの実行
pnpm contract test

# カバレッジ取得
pnpm contract coverage
```

#### デプロイ（Base Sepolia）
```bash
# PasswordHashVerifierのデプロイ＆検証
pnpm contract deploy:PasswordHashVerifier

# デプロイ済みコントラクトの検証
pnpm contract verify
```

#### ローカル開発
```bash
# ローカルHardhatノードの起動
pnpm contract local

# アカウント残高確認
pnpm contract getBalance

# チェーン情報取得
pnpm contract getChainInfo
```

### コード品質チェック

プロジェクトルートで以下を実行：
```bash
# コードフォーマット
pnpm format

# リント（修正含む）
pnpm lint
```

### x402サーバー

#### ローカルでx402サーバーを起動すること

```bash
pnpm x402server dev
```

### MCPサーバー

#### MCPサーバーのビルド

```bash
pnpm mcp build
```

#### MCPサーバーの起動

```bash
pnpm mcp dev
```

### バックエンド・API
/laravel/
上記フォルダ以下にlaravel11のプロジェクトを展開。
DBのマイグレーションは必ずlaravelで行うこと。
DBはmysql8をインストールしてある
APIも基本はこちらで作ること
APIのルートは/api/以下にするように
php側で追加で作るAPIゲート開閉APIを作る。今回Sesame Web APIにアクセスしてロックを動かす機能を実装

### バッチ・バックエンド・API
/python/
上記フォルダにpythonで作られたソースは置くこと。
フレームワークは必須ではないが、使うならflaskを使うこと。
pythonでAPI作る場合はこちらに作ること。
APIのルートは/papi/以下にすること
python側で追加で作るAPI、会話用プロンプトからqwenのMCPサーバーを呼び出す機能を実装

### ドキュメント
APIのドキュメントは/docs/以下に置くこと
APIを更新したらAPIドキュメントを記載すること。
APIのドキュメントはphp側とpython側で別けるのみで、細かく分けないこと。

## デプロイ・検証実績 (Base Sepolia)

本プロジェクトのコントラクトデプロイおよび動作検証の結果です。

| 項目 | アドレス / ハッシュ | エクスプローラーリンク |
|:---|:---|:---|
| **Deployer** | `0x51908F598A5e0d8F1A3bAbFa6DF76F9704daD072` | [View on Basescan](https://sepolia.basescan.org/address/0x51908F598A5e0d8F1A3bAbFa6DF76F9704daD072) |
| **Factory Address** | `0xbc95fBAc440546f7D2294Ae7E1F7ea23b5c87A9E` | [View on Basescan](https://sepolia.basescan.org/address/0xbc95fBAc440546f7D2294Ae7E1F7ea23b5c87A9E) |
| **Plate Commitment** | `0x51247c3efce7c9c34957505920296dca29c9a91904671265305d6ae5efd911de` | - |
| **Predicted Wallet** | `0x3617953dc0b3B98B52beF82cF4c6a6629f379389` | [View on Basescan](https://sepolia.basescan.org/address/0x3617953dc0b3B98B52beF82cF4c6a6629f379389) |
| **MockERC20** | `0x3e39DaaC436990E8eCb72849D43f81F3b9E7E610` | [View on Basescan](https://sepolia.basescan.org/address/0x3e39DaaC436990E8eCb72849D43f81F3b9E7E610) |
| **Transfer Transaction** | `0x19110d1c2c32ffffb4f5a14289d800250414ab443516abf58cb96e54315536dd` | [View on Basescan](https://sepolia.basescan.org/tx/0x19110d1c2c32ffffb4f5a14289d800250414ab443516abf58cb96e54315536dd) |

