# ギャップ分析: チップ機能（P2P投げ銭）

## 1. 分析概要

### スコープ
ナンバープレート認識とウォレットアドレス変換機能を統合し、車両間でのP2P決済を実現する投げ銭機能の実装ギャップを分析。

### 主要な発見
- **既存資産**: x402決済プロトコル実装、Honoサーバー基盤、Next.js PWA（プッシュ通知対応）
- **依存機能**: ナンバープレート認識機能、ウォレットアドレス変換機能（いずれも未実装）
- **主要なギャップ**: Web3統合（wagmi/viem）、OBD-II連携、音声認識・合成、投げ銭UI、履歴管理DBが未実装
- **実装アプローチ**: 新規コンポーネント作成中心、既存x402の拡張、依存機能の完成待ち

### 推奨事項
設計フェーズで以下を重点的に検討：
1. 依存機能の実装順序（ナンバープレート認識 → ウォレット変換 → チップ）
2. Web3統合アーキテクチャ（wagmi設定、トランザクション署名フロー）
3. OBD-II連携実現可能性（市販デバイス対応、代替案）
4. 音声認識実装方針（Web Speech API vs クラウドAPI）

---

## 2. 現状調査

### 2.1 既存のドメイン関連資産

#### x402決済基盤
**ファイル**: `pkgs/x402server/src/index.ts`, `pkgs/mcp/`

**再利用可能な要素**:
- Honoサーバー基盤
- x402決済ミドルウェア（paymentMiddleware）
- ステーブルコイン（USDC）決済フロー
- Base Sepoliaネットワーク設定

**制約**:
- 現在はMCP統合用（Claude Desktop特化）
- 汎用的なP2P決済には未対応
- トランザクション履歴保存機能なし

**ギャップ**:
- ❌ P2P投げ銭用エンドポイント（`/api/tip`）
- ❌ 受信者アドレス指定の決済フロー
- ❌ 手数料計算・分配ロジック
- ❌ トランザクション履歴保存

#### PWA基盤
**ファイル**: `pkgs/frontend/`
- Next.js PWA対応（next-pwa）
- Service Worker設定
- PWAマニフェスト

**再利用可能な要素**:
- プッシュ通知インフラ（Service Worker）
- PWA権限リクエスト（カメラ、通知）
- オフライン対応基盤

**ギャップ**:
- ❌ プッシュ通知購読管理
- ❌ 通知サーバー（Web Push Protocol）
- ❌ 通知UI・ハンドラ

#### 依存機能（未実装）
**必須依存**:
1. **ナンバープレート認識機能**（license-plate-recognition）
   - 前方車両のナンバープレート撮影→認識
   - 現状: 完全未実装
2. **ウォレットアドレス変換機能**（wallet-address-conversion）
   - ナンバープレート→ウォレットアドレス変換
   - 現状: 完全未実装

**影響**: これらの機能が完成するまで投げ銭機能の統合テスト不可

### 2.2 既存のアーキテクチャパターン

#### モノレポ構造
- 新規パッケージ追加容易
- フロントエンド、バックエンド、コントラクトの分離

#### API設計パターン
- `/api/`: Laravel（予定）
- `/papi/`: Flask（予定）
- REST API形式

#### 決済フロー（x402）
```
Client → POST /endpoint (with payment header)
  ↓
x402 middleware → verify payment
  ↓
Handler → process request
  ↓
Response
```

### 2.3 統合ポイント

#### データモデル（未定義）
```typescript
// 投げ銭トランザクション
interface TipTransaction {
  id: string;
  from: {
    walletAddress: string;
    plateNumber: string;  // 部分マスク済み
  };
  to: {
    walletAddress: string;
    plateNumber: string;  // 部分マスク済み
  };
  amount: number;         // 送金額（円）
  fee: number;            // 手数料（円）
  totalAmount: number;    // 合計額（円）
  txHash: string;         // トランザクションハッシュ
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
}

// 投げ銭履歴
interface TipHistory {
  sent: TipTransaction[];
  received: TipTransaction[];
}
```

#### API仕様（未定義）
```
POST /api/tip
Content-Type: application/json

{
  "toPlateNumber": "品川330あ1234",
  "amount": 500,
  "message": "道を譲っていただきありがとうございます"
}

Response:
{
  "success": true,
  "txHash": "0x...",
  "amount": 500,
  "fee": 10,
  "totalAmount": 510
}
```

---

## 3. 要件実現可能性分析

### 3.1 技術要件とギャップ

#### 要件1: ナンバープレート認識による送金先特定

**必要な機能**:
- カメラキャプチャ
- ナンバープレート認識API呼び出し
- ウォレットアドレス変換API呼び出し

**既存資産**:
- ❌ なし（完全に依存機能に依存）

**ギャップ**:
- ❌ **依存**: license-plate-recognition機能
- ❌ **依存**: wallet-address-conversion機能
- ❌ 統合UI（カメラ→認識→ウォレット→投げ銭画面）

**複雑度シグナル**: 低〜中（統合作業、依存機能完成が前提）

**制約**: 依存機能が未完成のため実装開始不可

#### 要件2: 投げ銭金額の選択

**必要な機能**:
- プリセット金額ボタン（¥100、¥500、¥1,000）
- カスタム金額入力
- 金額検証（¥10〜¥100,000）
- USDC換算表示

**既存資産**:
- ✅ Next.js + React 19（UIフレームワーク）
- ✅ shadcn/ui（UIコンポーネント）

**ギャップ**:
- ❌ Tip_Amount_Selector コンポーネント
- ❌ 金額バリデーションロジック
- ❌ JPY→USDC換算API（為替レート取得）

**複雑度シグナル**: 低（標準的なUIコンポーネント）

**研究必要**: JPY→USDC換算レート取得方法（Chainlink Price Feeds?）

#### 要件3: 手数料計算

**必要な機能**:
- 2%手数料計算
- 小数点切り上げ
- 手数料分配（プラットフォームウォレット）

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ Fee_Calculator 実装
- ❌ プラットフォームウォレットアドレス管理
- ❌ 手数料分配トランザクション

**複雑度シグナル**: 低（簡単な計算処理）

#### 要件4: x402プロトコルによるトランザクション実行

**必要な機能**:
- x402プロトコルでのトランザクション作成
- Base Sepoliaネットワーク送金
- ERC4337 SmartAccount対応
- Paymaster統合（ガスレス取引）

**既存資産**:
- ✅ x402決済プロトコル実装（x402server）
- ✅ Base Sepolia設定（contract）

**ギャップ**:
- ❌ Web3統合（wagmi/viem）
  - ウォレット接続
  - トランザクション署名
  - SmartAccount操作
- ❌ P2P投げ銭用のx402拡張
  - 現在: サーバーへの支払い（B2C）
  - 必要: ユーザー間送金（P2P）
- ❌ トランザクション実行UI（確認画面、進捗表示）
- ❌ ERC4337 SmartAccount（**依存**: wallet-address-conversion）
- ❌ Paymaster実装

**複雑度シグナル**: 高（Web3統合、ERC4337、x402の応用）

**研究必要**: 
- x402はP2P決済に対応可能か？（現状はAPI課金モデル）
- 代替: 標準的なERC20 transferの方がシンプル？

#### 要件5: 投げ銭受信通知

**必要な機能**:
- PWAプッシュ通知送信
- 通知内容（金額、送信者ナンバープレート部分マスク）
- アプリ内通知（プッシュ無効時）
- 新着マーク表示

**既存資産**:
- ✅ PWA基盤（next-pwa）
- ✅ Service Worker

**ギャップ**:
- ❌ Web Push Protocol実装
  - プッシュ購読管理（VAPID keys）
  - 通知サーバー（Firebase Cloud Messaging or カスタム）
- ❌ Notification_Service（バックエンド）
- ❌ 通知UI（フロントエンド）
- ❌ プライバシー処理（ナンバープレート部分マスク）

**複雑度シグナル**: 中〜高（Web Push Protocol、セキュリティ考慮）

**研究必要**: 
- Firebase Cloud Messaging vs カスタムWeb Push実装
- VAPIDキー管理

#### 要件6: ハザードランプ連動による自動トリガー

**必要な機能**:
- OBD-IIデバイス接続
- ハザードランプ点灯検知
- 2回連続点灯検知（5秒以内）
- 投げ銭画面自動表示
- ON/OFF設定

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ OBD-II連携ライブラリ
  - Bluetooth OBD-IIアダプタ対応
  - Web Bluetooth API使用
- ❌ Hazard_Lamp_Detector 実装
- ❌ ハザードランプ信号のPID（Parameter ID）特定
- ❌ OBD-II設定UI

**複雑度シグナル**: 高（ハードウェア連携、非標準機能）

**研究必要**:
- OBD-IIでハザードランプ検知は可能か？（車種依存の可能性高）
- Web Bluetooth API対応ブラウザ
- 代替案: 手動トリガーのみでMVP実現

#### 要件7: 音声確認によるハンズフリー操作

**必要な機能**:
- 音声ガイダンス再生
- 日本語音声認識
- 「はい」「いいえ」判定
- タイムアウト処理（10秒）

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ 音声認識（Web Speech API or クラウドAPI）
- ❌ 音声合成（Web Speech API or クラウドAPI）
- ❌ Voice_Confirmation_Handler 実装
- ❌ 音声コマンド辞書（「はい」「送る」「OK」等）

**複雑度シグナル**: 中（Web Speech APIは標準、精度チューニングが課題）

**研究必要**:
- Web Speech API vs Google Cloud Speech-to-Text
- ブラウザ対応状況（Chrome, Safari）

#### 要件8: 投げ銭履歴管理

**必要な機能**:
- 送受信履歴保存
- 履歴表示（時系列）
- フィルタリング（送信/受信、期間）
- ブロックエクスプローラーリンク

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ データベース（MySQL）
  - テーブル設計（tip_transactions）
- ❌ Laravel API（`/api/tips/history`）
- ❌ 履歴取得API
- ❌ 履歴表示UI

**複雑度シグナル**: 低〜中（標準的なCRUD）

#### 要件9: セキュリティとプライバシー

**必要な機能**:
- 送金前ユーザー確認
- 1日送金上限（¥50,000）
- 連続送金間隔制限（30秒）
- ナンバープレート部分マスク
- 履歴暗号化保存
- 不審パターン検出

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ 送金上限管理（DB or スマートコントラクト）
- ❌ レート制限（Redis）
- ❌ 暗号化ライブラリ（crypto-js）
- ❌ 不審パターン検出アルゴリズム

**複雑度シグナル**: 中（セキュリティベストプラクティス）

**研究必要**: 
- オンチェーン vs オフチェーン上限管理
- 不審パターン定義

#### 要件10: エラーハンドリング

**必要な機能**:
- ネットワークエラー
- 残高不足エラー
- タイムアウトエラー
- 自動リトライ（最大3回）
- 構造化エラーレスポンス

**既存資産**:
- ❌ なし（x402にエラーハンドリングあり、要拡張）

**ギャップ**:
- ❌ エラーコード体系
- ❌ リトライ機構
- ❌ エラーUI（ユーザーフレンドリーメッセージ）

**複雑度シグナル**: 低（標準的なエラーハンドリング）

---

## 4. 実装アプローチオプション

### オプションA: 既存コンポーネント拡張

**適用範囲**: x402決済プロトコルの拡張のみ

**拡張対象ファイル**:
- `pkgs/x402server/src/index.ts` → P2P投げ銭エンドポイント追加

**内容**:
- `/tip` エンドポイント追加
- 手数料計算・分配ロジック
- トランザクション履歴保存

**互換性評価**:
- ⚠️ x402は本来API課金用、P2P決済への適用は非標準的
- ⚠️ x402ミドルウェアの大幅改造が必要な可能性

**複雑度と保守性**:
- **認知負荷**: 中〜高（x402の内部理解必要）
- **単一責任**: やや曖昧（API課金とP2P決済の混在）

**トレードオフ**:
- ✅ 既存インフラ再利用
- ❌ x402の適用範囲外の可能性
- ❌ 保守性低下リスク

**推奨度**: 低（x402はAPI課金特化、P2P決済には標準的なERC20 transfer推奨）

### オプションB: 新規コンポーネント作成（推奨）

**適用範囲**: 投げ銭機能全体

**新規作成の根拠**:
1. **投げ銭UI**: フロントエンドに完全新規機能
2. **Web3統合**: wagmi/viemの導入が必須
3. **トランザクション実行**: ERC20 transferで実装（x402不使用）
4. **通知システム**: 完全新規
5. **OBD-II連携**: 完全新規（ハードウェア連携）
6. **音声認識**: 完全新規

**新規パッケージ/ファイル**:
```
pkgs/frontend/
  ├── components/
  │   ├── TippingUI.tsx              # 投げ銭メイン画面
  │   ├── AmountSelector.tsx         # 金額選択
  │   ├── TippingConfirmation.tsx    # 確認画面
  │   └── TipHistory.tsx             # 履歴表示
  ├── lib/
  │   ├── web3.ts                    # wagmi設定
  │   ├── tipping.ts                 # 投げ銭ロジック
  │   ├── fee-calculator.ts          # 手数料計算
  │   ├── voice-handler.ts           # 音声認識・合成
  │   ├── obd2.ts                    # OBD-II連携（オプション）
  │   └── notification.ts            # プッシュ通知
  └── app/
      └── tip/page.tsx               # 投げ銭ページ

laravel/                             # 新規ディレクトリ
  ├── app/
  │   ├── Http/Controllers/
  │   │   └── TipController.php      # 投げ銭API
  │   └── Models/
  │       └── TipTransaction.php     # 履歴モデル
  ├── database/migrations/
  │   └── create_tip_transactions_table.php
  └── routes/api.php

pkgs/contract/                       # ERC20コントラクト（既存でもOK）
  └── contracts/
      └── TippingManager.sol         # 手数料管理（オプション）
```

**統合ポイント**:
- **Frontend ←→ Laravel**: REST API（履歴保存・取得）
- **Frontend ←→ Base L2**: wagmi/viem経由のERC20 transfer
- **Frontend ←→ OBD-II**: Web Bluetooth API
- **Laravel ←→ Web Push**: 通知サーバー

**責任境界**:
- **Frontend**: UI、Web3操作、音声処理、OBD-II連携
- **Laravel**: 履歴管理、通知配信、認証
- **Base L2**: トランザクション実行

**トレードオフ**:
- ✅ 責任分離明確
- ✅ 標準的なERC20 transfer使用（シンプル）
- ✅ 独立テスト可能
- ❌ 初期開発コスト高
- ❌ x402資産を活用できない

### オプションC: ハイブリッドアプローチ（推奨）

**戦略**:
1. **Phase 1 - 基本投げ銭UI**: 依存機能の完成待ち、UIプロトタイプ作成
2. **Phase 2 - Web3統合**: wagmi導入、ERC20 transfer実装
3. **Phase 3 - 高度な機能**: 通知、音声、OBD-II（オプション）

**フェーズ別詳細**:

#### Phase 1: 基本UI（1週、依存機能待ち並行）
**新規作成**:
- `pkgs/frontend/components/AmountSelector.tsx`
- `pkgs/frontend/components/TippingConfirmation.tsx`
- `pkgs/frontend/lib/fee-calculator.ts`

**モック使用**:
- ナンバープレート認識→モックデータ
- ウォレットアドレス変換→モックデータ

**成果物**: 投げ銭画面のUIプロトタイプ（機能なし）

#### Phase 2: Web3統合 + 基本機能（2-3週）
**新規作成**:
- `pkgs/frontend/lib/web3.ts`: wagmi設定
- `pkgs/frontend/lib/tipping.ts`: ERC20 transfer
- `laravel/`: 履歴管理API

**依存機能統合**:
- ナンバープレート認識API呼び出し
- ウォレットアドレス変換API呼び出し

**成果物**: 実際に投げ銭送金可能（手動操作）

#### Phase 3: 高度な機能（2-3週）
**新規作成**:
- `pkgs/frontend/lib/notification.ts`: プッシュ通知
- `pkgs/frontend/lib/voice-handler.ts`: 音声認識
- `pkgs/frontend/lib/obd2.ts`: OBD-II連携（オプション）

**成果物**: 本番環境デプロイ可能な完全機能

**リスク軽減**:
- **段階的リリース**: Phase 2で基本価値提供
- **オプション機能**: OBD-II、音声はPhase 3で追加
- **依存管理**: Phase 1で依存機能完成待ち、並行開発

**トレードオフ**:
- ✅ リスク分散
- ✅ 早期価値提供（Phase 2）
- ✅ オプション機能の柔軟な取捨選択
- ❌ 依存機能の遅延リスク
- ❌ Phase間の調整コスト

---

## 5. 実装複雑度とリスク評価

### 5.1 工数見積もり（Effort）

| コンポーネント | サイズ | 根拠 |
|---------------|-------|------|
| Tip_Amount_Selector + 基本UI | S (1-3日) | 標準的なReactコンポーネント |
| Fee_Calculator | S (1-3日) | 簡単な計算処理 |
| Web3統合（wagmi設定） | M (3-7日) | ウォレット接続、トランザクション署名 |
| ERC20 Transfer実装 | S (1-3日) | 標準的なトランザクション |
| Laravel 履歴管理API | M (3-7日) | CRUD API、DB設計 |
| プッシュ通知システム | L (1-2週) | Web Push Protocol、通知サーバー |
| 音声認識・合成 | M (3-7日) | Web Speech API統合、コマンド処理 |
| OBD-II連携（オプション） | L (1-2週) | ハードウェア連携、非標準機能 |
| セキュリティ・プライバシー機能 | M (3-7日) | 上限管理、レート制限、暗号化 |
| エラーハンドリング | S (1-3日) | 標準的なパターン |
| **合計（OBD-II除く）** | **約6-9週** | フルスタック開発者1名想定 |
| **合計（OBD-II含む）** | **約7-11週** | |

**前提条件**: ナンバープレート認識、ウォレット変換機能が完成していること

### 5.2 リスク評価

#### 高リスク項目

**1. 依存機能の完成遅延**
- **理由**: 投げ銭機能は2つの機能に完全依存
- **影響**: 実装開始・統合テストが不可能
- **緩和策**:
  - Phase 1でUIプロトタイプ先行作成（モック使用）
  - 依存機能チームとの密な連携
  - APIインターフェース早期確定
- **影響**: プロジェクト全体の遅延

**2. OBD-IIハザードランプ検知の実現可能性**
- **理由**: 車種依存、ハザードランプPIDが非標準
- **影響**: 自動トリガー機能が実現不可の可能性
- **緩和策**:
  - MVP: 手動トリガーのみで実装
  - Phase 3: OBD-II対応車種限定でβ版
  - 代替: 音声トリガー（「投げ銭」と発話）
- **判断**: OBD-IIは必須ではない、Phase 3のオプション機能

**3. プッシュ通知の複雑性とコスト**
- **理由**: Web Push Protocol、VAPIDキー管理、通知サーバー運用
- **影響**: 開発コスト、運用コスト
- **緩和策**:
  - Firebase Cloud Messaging使用（無料枠活用）
  - 初期: アプリ内通知のみでMVP
  - Phase 3: プッシュ通知追加
- **影響**: UX低下（リアルタイム性）

#### 中リスク項目

**4. Web3統合の学習曲線**
- **理由**: wagmi/viem未経験、ERC4337対応
- **緩和策**:
  - wagmiドキュメント熟読（1-2日）
  - サンプルコード実装（PoC作成）
  - RainbowKit活用（ウォレット接続簡略化）
- **影響**: 開発速度低下

**5. 音声認識の精度**
- **理由**: Web Speech APIの日本語精度、環境ノイズ
- **緩和策**:
  - コマンドを限定（「はい」「いいえ」のみ）
  - Google Cloud Speech-to-Textのフォールバック
  - 手動操作も並行提供
- **影響**: UX低下（認識失敗）

**6. セキュリティ：送金上限・レート制限の実装**
- **理由**: オンチェーン vs オフチェーンの選択
- **緩和策**:
  - 初期: オフチェーン（Laravel DB）で管理
  - 将来: スマートコントラクトでオンチェーン化
- **影響**: セキュリティレベル

#### 低リスク項目

**7. 投げ銭UI実装**
- **理由**: 標準的なReactコンポーネント
- **緩和策**: 不要
- **影響**: 限定的

**8. 履歴管理API**
- **理由**: 標準的なCRUD
- **緩和策**: 不要
- **影響**: 限定的

### 5.3 技術調査項目（設計フェーズで実施）

| 項目 | 目的 | 優先度 |
|------|------|--------|
| wagmi/viem学習 | Web3統合実装方法確立 | 高 |
| OBD-II実現可能性調査 | ハザードランプ検知可否確認 | 中 |
| Web Push Protocol調査 | 通知システム設計 | 高 |
| Web Speech API精度検証 | 音声認識実現可能性確認 | 中 |
| JPY→USDC換算API調査 | 為替レート取得方法 | 中 |
| ERC4337 SmartAccount対応 | ガスレス取引実現方法 | 高（依存機能） |

---

## 6. 推奨事項と次ステップ

### 6.1 設計フェーズへの推奨事項

#### 優先的に決定すべき事項

**1. 依存機能との調整**
- **決定事項**:
  - APIインターフェース確定（ナンバープレート認識、ウォレット変換）
  - 実装スケジュール調整
  - モックデータ仕様
- **推奨**: 
  - 週次同期ミーティング
  - APIスキーマ早期確定（OpenAPI Spec）

**2. Web3統合アーキテクチャ**
- **決定事項**:
  - wagmi設定（chains, transports, connectors）
  - トランザクション署名フロー
  - エラーハンドリング
- **推奨**:
  - RainbowKit使用（ウォレット接続UI）
  - viem使用（低レベルEthereum操作）
  - Base Sepolia（テスト）→ Base Mainnet（本番）

**3. オプション機能の優先順位**
- **選択肢**:
  - A. OBD-II: 高付加価値、実現困難
  - B. 音声認識: 中付加価値、実現容易
  - C. プッシュ通知: 高付加価値、実現中程度
- **推奨**: Phase 3で B → C → A の順に実装

**4. x402プロトコル使用判断**
- **選択肢**:
  - A. x402使用（P2P決済に拡張）
  - B. 標準的なERC20 transfer使用
- **推奨**: B（標準的なERC20 transfer）
  - x402はAPI課金特化、P2P決済には非標準的
  - ERC20 transferはシンプルで保守性高い

#### アーキテクチャ図（推奨構成）

```
┌─────────────────────────────────────────────────────────┐
│                Frontend (Next.js PWA)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Camera     │  │   Amount     │  │   Voice      │  │
│  │   Capture    │  │   Selector   │  │   Handler    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Tipping Service (React State)            │  │
│  └──────────────────────────────────────────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Plate      │  │   wagmi/viem │  │   OBD-II     │  │
│  │   Recognition│  │   (Web3)     │  │   (Optional) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Flask       │  │  Base L2     │  │  Laravel     │
│  (Plate AI)  │  │  (ERC20)     │  │  (History)   │
└──────────────┘  └──────────────┘  └──────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Notification    │
                │  Server (FCM)    │
                └──────────────────┘
```

### 6.2 次のステップ

#### 即時実行（設計フェーズ開始前）
1. ✅ ギャップ分析完了
2. ⏭️ `/kiro:spec-design tipping-feature` 実行
3. 📋 依存機能チームとのキックオフミーティング

#### 設計フェーズで実施
1. wagmi/viem学習 + PoC作成（2-3日）
2. APIインターフェース確定（依存機能と調整、1日）
3. Web Push Protocol調査（FCM vs カスタム、1日）
4. OBD-II実現可能性調査（市販デバイス、1-2日）
5. 音声認識精度検証（Web Speech API、1日）

#### 実装フェーズ移行判断基準
- ✅ 依存機能のAPIインターフェース確定
- ✅ Web3統合PoC成功
- ✅ アーキテクチャ設計承認
- ✅ 依存機能の実装見通し（スケジュール）

---

## 7. 付録

### 7.1 参考実装リンク

- [wagmi Documentation](https://wagmi.sh/)
- [RainbowKit](https://www.rainbowkit.com/)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

### 7.2 既存コードベース参照パス

```
car/
├── pkgs/
│   ├── x402server/
│   │   └── src/index.ts              # x402決済参考実装
│   ├── mcp/
│   │   └── src/index.ts              # x402 MCP統合参考
│   └── frontend/
│       ├── app/page.tsx              # フロントエンド基盤
│       └── next.config.ts            # PWA設定
└── .kiro/
    ├── specs/
    │   ├── license-plate-recognition/  # 依存機能1
    │   └── wallet-address-conversion/  # 依存機能2
    └── steering/                      # プロジェクトコンテキスト
```

### 7.3 依存関係図

```
tipping-feature
  ├── [依存] license-plate-recognition
  │   └── 前方車両のナンバープレート認識
  ├── [依存] wallet-address-conversion
  │   └── ナンバープレート→ウォレットアドレス変換
  ├── [新規] Web3統合（wagmi/viem）
  ├── [新規] 投げ銭UI
  ├── [新規] 通知システム
  ├── [新規] 音声認識（オプション）
  └── [新規] OBD-II連携（オプション）
```

### 7.4 用語集

| 用語 | 説明 |
|-----|------|
| wagmi | React Hooksベースのイーサリアム開発ライブラリ |
| viem | TypeScript製の低レベルイーサリアム操作ライブラリ |
| RainbowKit | ウォレット接続UIライブラリ |
| Web Push Protocol | ブラウザプッシュ通知の標準プロトコル |
| VAPID | Voluntary Application Server Identification（プッシュ通知認証） |
| OBD-II | On-Board Diagnostics（車載自己診断装置）  |
| PID | Parameter ID（OBD-IIデータ識別子） |
| Web Speech API | ブラウザの音声認識・合成API |
| FCM | Firebase Cloud Messaging |

---

**作成日**: 2026-01-17  
**分析者**: Claude (Serena AI Agent)  
**ステータス**: 設計フェーズ移行待ち（依存機能完成待ち）
