# ギャップ分析: ウォレットアドレス変換機能

## 1. 分析概要

### スコープ
ナンバープレート情報からZK証明を使用して決定論的にERC4337 SmartAccountのウォレットアドレスを導出する機能の実装ギャップを分析。

### 主要な発見
- **既存資産**: ZK証明の基礎実装（PasswordHash回路）、Qwen AI統合サンプル、Next.jsフロントエンド基盤が存在
- **主要なギャップ**: Web3統合（wagmi/viem）、ERC4337実装、ナンバープレート専用ZK回路、バックエンドAPI（Laravel/Flask）が未実装
- **実装アプローチ**: ハイブリッドアプローチを推奨（既存パターンの拡張 + 新規コンポーネント作成）

### 推奨事項
設計フェーズで以下を重点的に検討：
1. ERC4337 SmartAccount実装戦略（外部ライブラリ vs 自前実装）
2. ZK回路設計（ナンバープレートデータ構造、フィールド制約）
3. Web3統合アーキテクチャ（wagmi設定、ウォレット接続フロー）
4. バックエンドAPI設計（Laravel vs Flask役割分担）

---

## 2. 現状調査

### 2.1 既存のドメイン関連資産

#### ZK証明基盤
**ファイル**: `pkgs/circuit/src/PasswordHash.circom`
- Circom 2.0によるZK回路の基本実装
- Poseidonハッシュを使用したプライベート入力検証
- Groth16証明スキーム採用
- コンパイル・テスト・デプロイのワークフロー確立済み

**関連ファイル**:
- `pkgs/contract/contracts/PasswordHashVerifier.sol`: オンチェーン検証コントラクト
- `pkgs/circuit/scripts/*.sh`: コンパイル・証明生成スクリプト

**再利用可能な要素**:
- Poseidonハッシュライブラリ（circomlib）
- 証明生成・検証フロー
- ZKファイル配布スクリプト（`cp:verifier`, `cp:zk`）

**制約**:
- 現在の回路はパスワード検証専用（ナンバープレート用に再設計必要）
- 入力形式が単一値（ナンバープレートは複数フィールド）

#### AI画像認識基盤
**ファイル**: `pkgs/qwen-sample/src/sample2.ts`
- Qwen-VL APIを使用した画像からテキスト抽出
- OpenAI互換APIによる実装
- 画像URLからOCR処理

**再利用可能な要素**:
- Qwen API統合パターン（認証、リクエスト形式）
- 画像→テキスト変換の基本フロー

**制約**:
- サンプルコードのため本番環境での堅牢性が未検証
- エラーハンドリング、リトライ機構が不足
- ナンバープレート特化の精度チューニング未実施

#### フロントエンド基盤
**ファイル**: `pkgs/frontend/`
- Next.js 16 (App Router)
- React 19
- TailwindCSS + shadcn/ui
- PWA対応（next-pwa）

**再利用可能な要素**:
- ビルド・デプロイパイプライン
- UIコンポーネントライブラリ
- PWA設定（オフライン対応、プッシュ通知）

**制約**:
- Web3ライブラリ未統合（wagmi、viem、RainbowKit）
- ウォレット接続UI未実装

#### スマートコントラクト基盤
**ファイル**: `pkgs/contract/`
- Hardhat開発環境
- Base Sepoliaネットワーク設定
- Hardhat Ignitionデプロイシステム

**再利用可能な要素**:
- コントラクトコンパイル・テストフロー
- Base Sepoliaデプロイ設定
- 検証スクリプト（Basescan）

**制約**:
- ERC4337関連コントラクト未実装
- OpenZeppelinのAccount Abstractionライブラリ未導入

#### 決済基盤
**ファイル**: `pkgs/x402server/`, `pkgs/mcp/`
- x402決済プロトコル実装
- Honoサーバー（有料APIエンドポイント）
- MCPクライアント（Claude Desktop統合）

**再利用可能な要素**:
- ステーブルコイン決済フロー
- 自動支払いインターセプター

**制約**:
- x402はMCP特化（汎用的なWeb3決済には別実装必要）

### 2.2 既存のアーキテクチャパターン

#### プロジェクト構造パターン
- **モノレポ構成**: pnpm workspaceによるパッケージ分離
- **パッケージ命名**: `pkgs/<domain>`（frontend, contract, circuit, etc.）
- **独立ビルド**: 各パッケージが独立してビルド・テスト可能

#### 依存関係パターン
```
circuit (Circom)
  ↓ (コンパイル)
PasswordHashVerifier.sol
  ↓ (コピー)
contract (Hardhat)
  ↓ (デプロイ)
Base Sepolia
  ↑ (検証)
frontend (Next.js)
```

#### 命名規則
- **ファイル**: PascalCase（コンポーネント・コントラクト・回路）、camelCase（TypeScript）
- **関数**: camelCase
- **コントラクト**: PascalCase
- **インターフェース**: `I<Name>`（Solidity）

#### テスト配置
- **Circuit**: `pkgs/circuit/test/verify.test.js`
- **Contract**: `pkgs/contract/test/*.test.ts`
- Mocha/Chai使用

### 2.3 統合ポイント

#### データモデル
**不明**: ナンバープレートデータ構造の定義が未存在
- 地名、分類番号、ひらがな、一連番号の型定義
- データベーススキーマ
- API入出力形式

#### API/サービス
**欠落**: バックエンドAPIが未実装
- Laravel APIサーバー（`/api/`）
- Flask APIサーバー（`/papi/`）
- ナンバープレート認識エンドポイント
- ウォレットアドレス検索エンドポイント

#### 認証機構
**欠落**: ユーザー認証・認可システム
- ウォレット接続による認証
- セッション管理
- 権限管理

---

## 3. 要件実現可能性分析

### 3.1 技術要件とギャップ

#### 要件1: ナンバープレートデータのZK入力変換

**必要な機能**:
- License_Plate_Dataの型定義
- UTF-8バイト列→数値エンコーディング
- Scalar field範囲チェック（約254ビット制約）
- 決定論的変換保証

**既存資産**:
- ✅ Circom開発環境
- ✅ TypeScriptユーティリティ関数（`pkgs/circuit/scripts/generateInput.js`）

**ギャップ**:
- ❌ ナンバープレート専用エンコーディングロジック
- ❌ UTF-8→数値変換関数
- ❌ Scalar field検証関数

**複雑度シグナル**: 中程度のアルゴリズミックロジック（エンコーディング変換）

#### 要件2: ZK証明の生成

**必要な機能**:
- ナンバープレート用Circom回路
- Poseidonハッシュによるコミットメント
- Groth16証明生成（5秒以内）
- ブラウザ・Node.js両対応

**既存資産**:
- ✅ Circom回路テンプレート（PasswordHash.circom）
- ✅ Poseidonライブラリ（circomlib）
- ✅ 証明生成スクリプト（executeGroth16.sh）

**ギャップ**:
- ❌ ナンバープレート専用回路設計
- ❌ 複数フィールド入力対応（地名、分類番号、ひらがな、一連番号）
- ❌ ブラウザ環境での証明生成実装（snarkjs統合）

**複雑度シグナル**: 中〜高（ZK回路設計の専門知識必要）

#### 要件3: ウォレットアドレスの導出

**必要な機能**:
- パブリック出力→Ethereumアドレス変換
- CREATE2による決定論的アドレス計算
- ERC4337互換性

**既存資産**:
- ❌ なし（完全新規実装）

**ギャップ**:
- ❌ CREATE2計算ロジック
- ❌ ERC4337 SmartAccount Factory
- ❌ アドレス導出テストケース

**複雑度シグナル**: 中程度（標準的なEthereumアドレス計算）

**研究必要**: ERC4337実装ライブラリの選定（eth-infinitism vs ZeroDev vs カスタム）

#### 要件4: オンチェーン証明検証

**必要な機能**:
- Groth16検証コントラクト
- ガスコスト最適化（300,000ガス以内）
- 検証結果イベント発行

**既存資産**:
- ✅ Verifierコントラクトテンプレート（PasswordHashVerifier.sol）
- ✅ Hardhatデプロイシステム

**ギャップ**:
- ❌ ナンバープレート用Verifier（回路変更に伴い自動生成必要）
- ❌ イベント定義・発行ロジック

**複雑度シグナル**: 低（回路コンパイル時に自動生成）

#### 要件5: ERC4337 SmartAccountの作成・取得

**必要な機能**:
- ERC4337準拠SmartAccount実装
- SmartAccount Factory
- Counterfactual address計算
- Paymaster統合

**既存資産**:
- ❌ なし（完全新規実装）

**ギャップ**:
- ❌ ERC4337ライブラリ統合（@account-abstraction/contracts）
- ❌ SmartAccount実装
- ❌ Factoryコントラクト
- ❌ Paymaster実装

**複雑度シグナル**: 高（ERC4337仕様理解とセキュリティ考慮が必須）

**研究必要**: 
- ERC4337実装戦略（既存ライブラリ vs 自前実装）
- Paymasterサービスプロバイダー選定

#### 要件6: レンタカー・カーシェアナンバーの特別処理

**必要な機能**:
- ひらがな「わ」「れ」検出
- 有効期限管理（12時間）
- オンチェーン有効期限記録
- 通知システム（残り1時間）

**既存資産**:
- ❌ なし（完全新規実装）

**ギャップ**:
- ❌ レンタカーフラグロジック
- ❌ 有効期限管理システム
- ❌ 通知システム（プッシュ通知？）

**複雑度シグナル**: 中程度（ビジネスロジック + 時間ベース処理）

#### 要件7: セキュリティとプライバシー

**必要な機能**:
- ローカル処理（外部送信禁止）
- メモリ安全消去
- ハッシュによるデータ保存

**既存資産**:
- ✅ ZK証明によるプライバシー保護パターン

**ギャップ**:
- ❌ メモリ消去実装
- ❌ セキュリティ監査

**複雑度シグナル**: 中〜高（セキュリティベストプラクティス適用）

#### 要件8: パフォーマンス要件

**必要な機能**:
- License_Plate_Converter: 100ms以内
- ZK_Proof_Generator: 5秒以内
- Wallet_Address_Deriver: 50ms以内
- オンチェーン検証: 1ブロック以内

**既存資産**:
- ✅ Base L2（2秒ブロック時間）

**ギャップ**:
- ❌ パフォーマンス測定・最適化

**複雑度シグナル**: 中程度（計測・プロファイリング・最適化）

### 3.2 制約とリスク

#### 技術制約
1. **Scalar Field制約**: ZK入力は約254ビット以内（BN254曲線）
2. **ガスコスト**: Base L2でも検証コストは考慮必要
3. **証明生成時間**: ブラウザ環境で5秒は厳しい可能性（回路複雑度次第）

#### 外部依存
1. **Qwen API**: 画像認識の精度・レイテンシが外部サービス依存
2. **Base L2**: ネットワーク停止リスク
3. **ERC4337エコシステム**: Bundler、Paymasterの成熟度

#### 既存アーキテクチャ制約
1. **モノレポ構造**: 新規パッケージ追加時の依存関係管理
2. **pnpm workspace**: パッケージ間の型共有戦略
3. **ZKファイルコピー**: circuit→contract/frontendのビルド順序依存

---

## 4. 実装アプローチオプション

### オプションA: 既存コンポーネント拡張

**適用範囲**:
- ZK回路の拡張（PasswordHash.circom → LicensePlateHash.circom）
- フロントエンド機能追加（page.tsx拡張）

**拡張対象ファイル**:
- `pkgs/circuit/src/`: 新規回路ファイル追加
- `pkgs/contract/contracts/`: 新規Verifier追加
- `pkgs/frontend/app/`: 新規ページ・コンポーネント追加

**互換性評価**:
- ✅ 既存のビルドスクリプトをそのまま使用可能
- ✅ 回路コンパイルワークフローは変更不要
- ⚠️ 複数の回路を管理する仕組みが必要

**複雑度と保守性**:
- **認知負荷**: 低（既存パターンに従う）
- **単一責任**: 各回路が独立したファイルで維持される
- **ファイルサイズ**: 問題なし

**トレードオフ**:
- ✅ 学習コスト低（既存パターン踏襲）
- ✅ ビルドインフラ再利用
- ❌ 複数回路の管理複雑度増加
- ❌ circuit→contract/frontendのコピースクリプト拡張必要

### オプションB: 新規コンポーネント作成

**適用範囲**:
- バックエンドAPI（Laravel/Flask）
- Web3統合レイヤー
- ERC4337実装

**新規作成の根拠**:
1. **Laravel/Flask**: 完全新規ドメイン（既存コードなし）
2. **Web3レイヤー**: 既存フロントエンドにWeb3統合なし、明確な責任分離
3. **ERC4337**: 既存コントラクトと異なる責任

**統合ポイント**:
- **フロントエンド ←→ Laravel API**: `/api/` エンドポイント
- **フロントエンド ←→ Flask API**: `/papi/` エンドポイント
- **コントラクト ←→ Frontend**: wagmi/viem経由のRPC通信

**責任境界**:
- **Laravel**: ナンバープレート→ウォレット検索、ユーザー管理、トランザクション履歴
- **Flask**: AI推論（Qwen-VL）、バッチ処理
- **Web3レイヤー**: ウォレット接続、トランザクション署名、コントラクト操作

**トレードオフ**:
- ✅ 責任分離明確
- ✅ 独立テスト可能
- ✅ スケーラビリティ向上
- ❌ ファイル数増加
- ❌ 統合テスト複雑化

### オプションC: ハイブリッドアプローチ（推奨）

**戦略**:
1. **Phase 1 - 基礎実装**: 既存パターン拡張
   - ZK回路追加（LicensePlateHash.circom）
   - Verifierコントラクト追加
   - フロントエンド基本UI（ナンバープレート入力画面）

2. **Phase 2 - 新規コンポーネント**: 独立機能追加
   - Laravel APIサーバー構築
   - Flask AI推論サーバー構築
   - Web3統合レイヤー（wagmi設定）

3. **Phase 3 - ERC4337統合**: 高度な機能
   - SmartAccount Factory実装
   - Paymaster統合
   - レンタカー処理ロジック

**フェーズ別詳細**:

#### Phase 1詳細
**拡張するファイル**:
- `pkgs/circuit/src/LicensePlateHash.circom`: ナンバープレート回路
- `pkgs/frontend/app/wallet/page.tsx`: ウォレットアドレス変換UI
- `pkgs/frontend/components/LicensePlateInput.tsx`: 入力コンポーネント

**新規作成**:
- `pkgs/frontend/lib/license-plate.ts`: エンコーディングロジック
- `pkgs/frontend/lib/zk-proof.ts`: ブラウザ証明生成

**成果物**: ローカル動作するZK証明生成デモ

#### Phase 2詳細
**新規パッケージ**:
- `laravel/`: Laravel 11プロジェクト
- `python/`: Flask APIプロジェクト

**統合**:
- フロントエンド→Laravel API呼び出し
- フロントエンド→Flask AI推論

**成果物**: ナンバープレート認識→ウォレットアドレス変換の完全フロー

#### Phase 3詳細
**新規コントラクト**:
- `contracts/SmartAccountFactory.sol`
- `contracts/LicensePlateSmartAccount.sol`
- `contracts/RentalPlateManager.sol`

**フロントエンド統合**:
- wagmi設定
- RainbowKit UI
- トランザクション署名フロー

**成果物**: 本番環境デプロイ可能な完全システム

**リスク軽減**:
- **増分ロールアウト**: 各フェーズで動作確認
- **フィーチャーフラグ**: 環境変数で機能ON/OFF
- **ロールバック**: Phase 1のみでも最小動作可能

**トレードオフ**:
- ✅ リスク分散
- ✅ 段階的検証
- ✅ 柔軟性高い
- ❌ 計画複雑
- ❌ 各フェーズの境界明確化が必要

---

## 5. 実装複雑度とリスク評価

### 5.1 工数見積もり（Effort）

| コンポーネント | サイズ | 根拠 |
|---------------|-------|------|
| License_Plate_Converter | S (1-3日) | エンコーディングロジック、既存パターン適用 |
| LicensePlateHash回路 | M (3-7日) | ZK回路設計、複数フィールド対応、テスト |
| ZK_Proof_Generator (Browser) | M (3-7日) | snarkjs統合、WASM読み込み、エラーハンドリング |
| Wallet_Address_Deriver | S (1-3日) | CREATE2計算、標準的なアルゴリズム |
| Proof_Verifier_Contract | S (1-3日) | 回路から自動生成、イベント追加のみ |
| SmartAccount Factory | L (1-2週) | ERC4337仕様理解、セキュリティ監査、テスト |
| Laravel APIサーバー | M (3-7日) | CRUD API、認証、DB設計 |
| Flask AI推論サーバー | M (3-7日) | Qwen統合、エラーハンドリング、最適化 |
| Web3統合（wagmi） | M (3-7日) | 設定、ウォレット接続、トランザクションフロー |
| Rental_Plate_Handler | M (3-7日) | ビジネスロジック、有効期限管理、通知 |
| **合計** | **約6-10週** | フルスタック開発者1名想定 |

### 5.2 リスク評価

#### 高リスク項目

**1. ERC4337 SmartAccount実装**
- **理由**: 複雑な仕様、セキュリティクリティカル、監査必要
- **緩和策**: 
  - eth-infinitismの参照実装を使用
  - OpenZeppelinのライブラリ活用
  - セキュリティ監査を別途実施
- **影響**: プロジェクト全体の信頼性に直結

**2. ZK証明生成パフォーマンス（ブラウザ）**
- **理由**: 5秒以内の要件、回路複雑度次第で達成困難
- **緩和策**:
  - 回路を最小限に設計
  - Web Workerで非同期実行
  - サーバーサイド証明生成のフォールバック
- **影響**: UX低下、ユーザー離脱リスク

**3. Qwen API依存**
- **理由**: 外部サービス障害、レート制限、コスト
- **緩和策**:
  - リトライ機構実装
  - キャッシュ活用
  - セルフホスト検討（スケール後）
- **影響**: システム可用性

#### 中リスク項目

**4. ナンバープレートデータのScalar Field制約**
- **理由**: UTF-8エンコーディング後のサイズが254ビット超える可能性
- **緩和策**:
  - エンコーディング方式最適化
  - フィールド分割（地名、番号を別々にハッシュ）
- **影響**: 設計変更の可能性

**5. 複数回路管理**
- **理由**: PasswordHashとLicensePlateHashの共存、ビルドスクリプト複雑化
- **緩和策**:
  - 回路ごとのディレクトリ分離
  - ビルドスクリプトのパラメータ化
- **影響**: 開発体験、保守コスト

#### 低リスク項目

**6. Laravel/Flask API開発**
- **理由**: 標準的なWeb API開発、実績豊富
- **緩和策**: 不要（標準的なベストプラクティス適用）
- **影響**: 限定的

**7. フロントエンドUI実装**
- **理由**: Next.js + React、既存UIライブラリ活用
- **緩和策**: 不要
- **影響**: 限定的

### 5.3 技術調査項目（設計フェーズで実施）

| 項目 | 目的 | 優先度 |
|------|------|--------|
| ERC4337実装ライブラリ比較 | 最適なライブラリ選定 | 高 |
| Scalar Field制約の詳細調査 | エンコーディング方式決定 | 高 |
| Qwen-VL精度検証 | ナンバープレート認識精度確認 | 高 |
| Base L2 Paymasterサービス調査 | ガスレス取引実現方法 | 中 |
| ブラウザ証明生成パフォーマンス測定 | 実現可能性確認 | 中 |
| レンタカー有効期限管理アーキテクチャ | オンチェーン vs オフチェーン | 中 |

---

## 6. 推奨事項と次ステップ

### 6.1 設計フェーズへの推奨事項

#### 優先的に決定すべき事項

**1. ERC4337実装戦略**
- **選択肢**:
  - A. eth-infinitismの参照実装を使用
  - B. OpenZeppelinのAccount Abstractionライブラリ使用
  - C. カスタム実装（非推奨）
- **判断基準**: セキュリティ、保守性、カスタマイズ性
- **推奨**: Aまたはb（Aを優先）

**2. ZK回路設計**
- **決定事項**:
  - ナンバープレートデータのフィールド分割方法
  - Scalar Field制約対応策
  - パブリック入力の範囲（何をコミットするか）
- **調査必要**: UTF-8エンコーディング後のビット数実測

**3. バックエンドアーキテクチャ**
- **決定事項**:
  - Laravel vs Flask役割分担
  - データベーススキーマ設計
  - API認証方式
- **推奨**: 
  - Laravel: CRUD、認証、トランザクション管理
  - Flask: AI推論、重い計算処理

**4. Web3統合方針**
- **決定事項**:
  - ウォレット接続フロー
  - トランザクション署名UX
  - エラーハンドリング戦略
- **推奨**: RainbowKitでクイックスタート→カスタマイズ

#### アーキテクチャ図（推奨構成）

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Camera     │  │   ZK Proof   │  │   Wallet     │  │
│  │   Input      │  │   Generator  │  │   Connect    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                  │                  │
           │ (image)          │ (proof)          │ (tx)
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐
│  Flask (/papi)   │ │ Laravel (/api)   │ │ Base L2     │
│  - Qwen AI       │ │ - Plate→Wallet   │ │ - Verifier  │
│  - OCR           │ │ - User Auth      │ │ - Factory   │
└──────────────────┘ └──────────────────┘ └─────────────┘
           │                  │                  │
           └──────────────────┴──────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │   MySQL Database    │
                   │   - Users           │
                   │   - Plates          │
                   │   - Wallets         │
                   └─────────────────────┘
```

### 6.2 次のステップ

#### 即時実行（設計フェーズ開始前）
1. ✅ ギャップ分析完了
2. ⏭️ `/kiro:spec-design wallet-address-conversion`実行
   - 上記推奨事項を反映した設計書作成
   - アーキテクチャ図の詳細化
   - API仕様定義

#### 設計フェーズで実施
1. ERC4337実装ライブラリ選定（調査1-2日）
2. ZK回路プロトタイプ作成（PoC 2-3日）
3. Qwen-VL精度検証（実測1日）
4. データベーススキーマ設計（1日）
5. API仕様書作成（2日）

#### 実装フェーズ移行判断基準
- ✅ 技術調査項目（優先度:高）完了
- ✅ アーキテクチャ設計承認
- ✅ データモデル確定
- ✅ リスク緩和策明確化

---

## 7. 付録

### 7.1 参考実装リンク

- [eth-infinitism ERC4337 Reference](https://github.com/eth-infinitism/account-abstraction)
- [OpenZeppelin Account Abstraction](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/account)
- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Browser Usage](https://github.com/iden3/snarkjs#in-the-browser)

### 7.2 既存コードベース参照パス

```
car/
├── pkgs/
│   ├── circuit/
│   │   └── src/PasswordHash.circom          # ZK回路参考実装
│   ├── contract/
│   │   └── contracts/PasswordHashVerifier.sol # Verifier参考
│   ├── frontend/
│   │   ├── app/page.tsx                     # フロントエンド基盤
│   │   └── lib/utils.ts                     # ユーティリティ
│   ├── qwen-sample/
│   │   └── src/sample2.ts                   # Qwen AI参考実装
│   └── x402server/
│       └── src/index.ts                     # 決済サーバー参考
└── .kiro/
    └── steering/                            # プロジェクトコンテキスト
```

### 7.3 用語集

| 用語 | 説明 |
|-----|------|
| Scalar Field | ZK証明で使用できる数値の範囲（BN254曲線では約254ビット） |
| Groth16 | ZK証明スキームの一種（証明サイズ小、検証高速） |
| Poseidon | ZKフレンドリーなハッシュ関数 |
| CREATE2 | Ethereumのオペコード、決定論的アドレス計算 |
| Counterfactual Address | デプロイ前に計算可能なアドレス |
| Paymaster | ERC4337でガス代を代理支払いするコントラクト |

---

**作成日**: 2026-01-17  
**分析者**: Claude (Serena AI Agent)  
**ステータス**: 設計フェーズ移行待ち
