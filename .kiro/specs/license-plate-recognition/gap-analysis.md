# ギャップ分析: ナンバープレート認識機能

## 1. 分析概要

### スコープ
AIカメラを使用して日本のナンバープレートを高精度で認識し、構造化されたデータとして出力する機能の実装ギャップを分析。

### 主要な発見
- **既存資産**: Qwen-VL APIサンプル実装、Next.jsフロントエンド基盤
- **主要なギャップ**: カメラキャプチャUI、画像品質検証、本番環境対応APIサーバー（Flask/Laravel）が未実装
- **実装アプローチ**: 新規コンポーネント作成を中心に、既存Qwenサンプルを拡張

### 推奨事項
設計フェーズで以下を重点的に検討：
1. カメラライブラリ選定（react-webcam vs ブラウザAPI直接利用）
2. 画像品質検証アルゴリズム（OpenCV.js vs TensorFlow.js vs サーバーサイド）
3. Flask API設計（エンドポイント構造、非同期処理）
4. Qwen-VL精度チューニング戦略（プロンプトエンジニアリング、ファインチューニング可否）

---

## 2. 現状調査

### 2.1 既存のドメイン関連資産

#### AI画像認識基盤
**ファイル**: `pkgs/qwen-sample/src/sample2.ts`
```typescript
const response = await openai.chat.completions.create({
  model: "qwen3-vl-32b-instruct",
  messages: [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "..." } },
        { type: "text", text: "Output the text in the image only and please in japanese." }
      ]
    }
  ]
});
```

**再利用可能な要素**:
- Qwen-VL API統合パターン（OpenAI互換インターフェース）
- 画像URL→テキスト抽出の基本フロー
- DashScope API認証（環境変数`DASHSCOPE_API_KEY`）

**制約**:
- サンプルコードのため堅牢性不足
  - エラーハンドリング未実装
  - リトライ機構なし
  - タイムアウト設定なし
- Base64画像対応が未確認
- 認識精度の検証データなし

**ギャップ**:
- ❌ プロダクション品質のエラーハンドリング
- ❌ ナンバープレート特化のプロンプト最適化
- ❌ 認識結果の構造化処理
- ❌ 複数ナンバープレート形式対応（白、黄色、緑、青）
- ❌ 認識信頼度スコア算出

#### フロントエンド基盤
**ファイル**: `pkgs/frontend/`
- Next.js 16 (App Router)
- React 19
- PWA対応

**再利用可能な要素**:
- ビルドパイプライン
- UIコンポーネントライブラリ（shadcn/ui）
- PWA機能（カメラ権限リクエスト、オフライン対応）

**ギャップ**:
- ❌ カメラライブラリ未導入（react-webcam等）
- ❌ カメラキャプチャコンポーネント
- ❌ リアルタイムプレビューUI
- ❌ 画像表示・トリミング機能

#### バックエンドAPI
**現状**: Laravel/Flaskディレクトリが存在しない

**ギャップ**:
- ❌ Flask APIサーバー（`/papi/recognize`）
- ❌ Laravel APIサーバー（`/api/plates`）
- ❌ 画像アップロードエンドポイント
- ❌ 認識結果保存・検索API
- ❌ キャッシュ機構

### 2.2 既存のアーキテクチャパターン

#### モノレポ構造
- 新規パッケージ追加が容易（`pkgs/` 以下に配置）
- pnpm workspaceによる依存管理

#### API呼び出しパターン
- フロントエンド → バックエンド: REST API（予定）
- バックエンド → Qwen AI: OpenAI互換API

#### 命名規則
- **API Route**: `/api/` (Laravel), `/papi/` (Flask)
- **コンポーネント**: PascalCase
- **ファイル**: kebab-case (TypeScript), PascalCase (React)

### 2.3 統合ポイント

#### データモデル（未定義）
```typescript
// 必要な型定義
interface LicensePlateData {
  region: string;         // 地名（品川、横浜）
  classification: string; // 分類番号（300、500）
  hiragana: string;       // ひらがな（あ、か、さ）
  serialNumber: string;   // 一連番号（1234）
  fullText: string;       // 完全文字列（品川330あ1234）
  confidence: number;     // 信頼度（0-100%）
}

interface RecognitionRequest {
  image: string;          // Base64エンコード画像
  mode: 'single' | 'realtime';
}

interface RecognitionResponse {
  success: boolean;
  data?: LicensePlateData;
  error?: {
    code: string;
    message: string;
    action: string;       // 推奨アクション
  };
}
```

#### API仕様（未定義）
```
POST /papi/recognize
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,...",
  "mode": "single"
}

Response:
{
  "success": true,
  "data": {
    "region": "品川",
    "classification": "330",
    "hiragana": "あ",
    "serialNumber": "1234",
    "fullText": "品川330あ1234",
    "confidence": 98.5
  }
}
```

---

## 3. 要件実現可能性分析

### 3.1 技術要件とギャップ

#### 要件1: カメラ画像キャプチャ

**必要な機能**:
- カメラデバイスアクセス（`navigator.mediaDevices.getUserMedia`）
- リアルタイムプレビュー（`<video>`要素）
- シングルショットキャプチャ（Canvas APIでBase64変換）
- 権限リクエストハンドリング

**既存資産**:
- ✅ React 19（Suspenseでローディング処理）
- ✅ PWA対応（カメラ権限管理）

**ギャップ**:
- ❌ カメラライブラリ（react-webcam推奨）
- ❌ Camera_Capture_Component実装
- ❌ デバイス選択UI（複数カメラ対応）
- ❌ 最小解像度検証（640x480）

**複雑度シグナル**: 低〜中（標準的なブラウザAPI、既存ライブラリ活用）

**研究必要**: react-webcam vs カスタム実装の比較

#### 要件2: 画像品質検証

**必要な機能**:
- ぼやけ検出（Laplacian variance）
- 角度検出（エッジ検出 + Hough変換）
- 照明条件チェック（ヒストグラム分析）

**既存資産**:
- ❌ なし（完全新規実装）

**ギャップ**:
- ❌ 画像処理ライブラリ（OpenCV.js or カスタムアルゴリズム）
- ❌ Image_Validator実装
- ❌ 検証基準値の決定（実験データ必要）

**複雑度シグナル**: 中〜高（画像処理アルゴリズム、パフォーマンス考慮）

**研究必要**: 
- クライアントサイド vs サーバーサイド処理
- OpenCV.js導入のバンドルサイズ影響
- TensorFlow.js利用可能性

#### 要件3: AI認識処理

**必要な機能**:
- Qwen-VL API呼び出し
- プロンプト最適化（ナンバープレート特化）
- 認識精度98%達成
- 150ms以内のレスポンス

**既存資産**:
- ✅ Qwen-VL APIサンプル実装

**ギャップ**:
- ❌ プロンプトエンジニアリング
  - 現在: "Output the text in the image only and please in japanese."
  - 必要: ナンバープレート構造を明示、フォーマット指定
- ❌ エラーハンドリング（接続失敗、タイムアウト）
- ❌ リトライ機構（指数バックオフ）
- ❌ 認識精度検証データセット

**複雑度シグナル**: 中（API統合は簡単、精度チューニングが課題）

**研究必要**:
- Qwen-VL最適プロンプト設計
- Few-shot learning効果検証
- ファインチューニング可否（Alibaba Cloud制約）

#### 要件4: ナンバープレートデータ構造化

**必要な機能**:
- AI出力のパース処理
- 正規表現による抽出
- 信頼度スコア算出

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ パーサー実装
- ❌ 正規表現パターン定義
  ```typescript
  const platePattern = /^([\u4e00-\u9fa5]+)(\d{3})([あ-ん])(\d{4})$/;
  ```
- ❌ 信頼度計算ロジック
  - Qwen APIレスポンスに信頼度がない場合の対処

**複雑度シグナル**: 低〜中（文字列処理、正規表現）

#### 要件5: 日本のナンバープレート形式対応

**必要な機能**:
- 色ベース分類（白、黄色、緑、青）
- 特殊ナンバー検出（「わ」「れ」）
- 形式ごとの認識最適化

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ 色検出アルゴリズム（HSV色空間変換）
- ❌ プレート形式データベース
- ❌ 形式別プロンプト（必要に応じて）

**複雑度シグナル**: 中（色検出は標準的、形式分類のロジック設計）

**研究必要**: Qwen-VLが色情報を考慮するか検証

#### 要件6: エラーハンドリング

**必要な機能**:
- リトライ機構（最大3回、指数バックオフ）
- タイムアウト設定（5秒）
- 構造化されたエラーレスポンス
- ロギング

**既存資産**:
- ❌ なし（サンプルコードにエラー処理なし）

**ギャップ**:
- ❌ リトライライブラリ（axios-retry等）
- ❌ エラーコード体系
  ```typescript
  enum RecognitionErrorCode {
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    NO_PLATE_FOUND = 'NO_PLATE_FOUND',
    PARTIAL_RECOGNITION = 'PARTIAL_RECOGNITION',
    INVALID_IMAGE = 'INVALID_IMAGE',
  }
  ```
- ❌ ロギングシステム（Winston, Pino等）

**複雑度シグナル**: 低〜中（標準的なエラーハンドリングパターン）

#### 要件7: リアルタイム認識モード

**必要な機能**:
- 継続的フレームキャプチャ（500ms間隔）
- 自動ナンバープレート検出
- 重複抑制
- ハイライト表示

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ フレーム間隔制御（setInterval or requestAnimationFrame）
- ❌ オブジェクト検出（YOLO? or Qwen-VLの検出能力利用）
- ❌ 重複抑制ロジック（ハッシュ比較）
- ❌ Canvas描画によるハイライト

**複雑度シグナル**: 中〜高（リアルタイム処理、パフォーマンス最適化）

**研究必要**:
- Qwen-VLのバウンディングボックス出力可否
- 500ms間隔でのAPI呼び出しコスト（月間試算）
- クライアントサイドでの物体検出（TensorFlow.js COCO-SSD）

#### 要件8: パフォーマンス要件

**必要な機能**:
- 平均150ms処理時間
- 同時100リクエスト処理
- 画像最適化（圧縮、リサイズ）
- キャッシュ機構

**既存資産**:
- ❌ なし

**ギャップ**:
- ❌ 画像圧縮ライブラリ（browser-image-compression）
- ❌ APIレート制限（Flask側で実装）
- ❌ Redisキャッシュ
- ❌ パフォーマンス測定・監視

**複雑度シグナル**: 中（最適化技術、インフラ設定）

**研究必要**:
- Qwen-VL実際の処理時間測定
- 最適な画像サイズ・品質バランス

---

## 4. 実装アプローチオプション

### オプションA: 既存コンポーネント拡張

**適用範囲**: Qwenサンプルの拡張のみ

**拡張対象ファイル**:
- `pkgs/qwen-sample/src/sample2.ts` → `pkgs/qwen-sample/src/license-plate-recognition.ts`

**内容**:
- プロンプト最適化
- エラーハンドリング追加
- レスポンスパース処理

**互換性評価**:
- ✅ 既存のDashScope API設定を再利用
- ✅ OpenAI SDKの型定義活用
- ⚠️ サンプルコードから本番コードへの昇格

**複雑度と保守性**:
- **認知負荷**: 低（既存パターン踏襲）
- **単一責任**: 維持可能（認識ロジックのみ）
- **ファイルサイズ**: 問題なし

**トレードオフ**:
- ✅ 最小変更で動作確認可能
- ✅ 学習コスト低
- ❌ サンプルとプロダクションコードの混在
- ❌ テスト体制が未整備

### オプションB: 新規コンポーネント作成（推奨）

**適用範囲**: カメラUI、APIサーバー、画像処理

**新規作成の根拠**:
1. **カメラコンポーネント**: フロントエンドに完全新規機能
2. **Flask APIサーバー**: バックエンドディレクトリ自体が未存在
3. **画像品質検証**: 独立した責任

**新規パッケージ/ファイル**:
```
pkgs/frontend/
  ├── components/
  │   ├── CameraCapture.tsx           # カメラキャプチャUI
  │   ├── LicensePlatePreview.tsx     # プレビュー表示
  │   └── RecognitionResult.tsx       # 認識結果表示
  ├── lib/
  │   ├── camera.ts                   # カメラAPI wrapper
  │   ├── image-validator.ts          # 画像品質検証
  │   └── plate-recognition-api.ts    # Flask API呼び出し

python/                                # 新規ディレクトリ
  ├── app.py                           # Flask アプリ
  ├── services/
  │   ├── qwen_client.py              # Qwen-VL統合
  │   └── plate_parser.py             # 構造化処理
  ├── validators/
  │   └── image_validator.py          # 画像品質検証（サーバーサイド）
  └── requirements.txt
```

**統合ポイント**:
- **Frontend ←→ Flask**: REST API (`POST /papi/recognize`)
- **Flask ←→ Qwen**: DashScope API

**責任境界**:
- **Frontend**: UI、カメラ制御、結果表示
- **Flask**: AI推論、画像処理、ビジネスロジック
- **Qwen**: 文字認識

**トレードオフ**:
- ✅ 責任分離明確
- ✅ 独立テスト可能
- ✅ スケーラビリティ（Flask水平スケール）
- ❌ 初期開発コスト高
- ❌ デプロイ複雑化

### オプションC: ハイブリッドアプローチ（推奨）

**戦略**:
1. **Phase 1 - Flask API構築**: Qwenサンプル拡張 + Flask API
2. **Phase 2 - フロントエンド基本UI**: カメラキャプチャ + API連携
3. **Phase 3 - 高度な機能**: 画像品質検証、リアルタイムモード

**フェーズ別詳細**:

#### Phase 1: Flask API構築（1-2週）
**新規作成**:
- `python/app.py`: Flaskアプリケーション
- `python/services/qwen_client.py`: Qwen統合
- `python/services/plate_parser.py`: パース処理

**拡張**:
- `pkgs/qwen-sample/` のコードを `python/` にマイグレーション

**成果物**: `POST /papi/recognize` エンドポイント動作

#### Phase 2: フロントエンド基本UI（1-2週）
**新規作成**:
- `pkgs/frontend/components/CameraCapture.tsx`
- `pkgs/frontend/lib/camera.ts`
- `pkgs/frontend/lib/plate-recognition-api.ts`
- `pkgs/frontend/app/recognize/page.tsx`: 認識画面

**依存追加**:
- `react-webcam` or カスタムカメラフック

**成果物**: ユーザーが写真撮影→認識結果表示まで動作

#### Phase 3: 高度な機能（1-2週）
**新規作成**:
- `pkgs/frontend/lib/image-validator.ts`: クライアント画像検証
- `python/validators/image_validator.py`: サーバー画像検証
- リアルタイムモード実装

**最適化**:
- キャッシュ機構（Redis）
- パフォーマンスチューニング

**成果物**: 本番環境デプロイ可能な完全機能

**リスク軽減**:
- **増分ロールアウト**: 各フェーズで動作検証
- **フィーチャーフラグ**: リアルタイムモードをON/OFF可能
- **ロールバック**: Phase 2のみでも基本機能提供可能

**トレードオフ**:
- ✅ リスク分散
- ✅ 段階的な価値提供
- ✅ 柔軟な優先順位調整
- ❌ Phase間の依存管理
- ❌ 長期スケジュール

---

## 5. 実装複雑度とリスク評価

### 5.1 工数見積もり（Effort）

| コンポーネント | サイズ | 根拠 |
|---------------|-------|------|
| Camera_Capture_Component | S (1-3日) | react-webcam使用、標準的なブラウザAPI |
| Image_Validator (Client) | M (3-7日) | 画像処理アルゴリズム、基準値調整 |
| Flask APIサーバー構築 | M (3-7日) | 基本的なREST API、Qwen統合 |
| Qwen_VL_Client (本番対応) | M (3-7日) | エラーハンドリング、リトライ、プロンプト最適化 |
| Plate_Parser | S (1-3日) | 正規表現、文字列処理 |
| 日本ナンバープレート形式対応 | M (3-7日) | 色検出、形式分類、テストデータ作成 |
| リアルタイム認識モード | L (1-2週) | フレーム処理、オブジェクト検出、最適化 |
| パフォーマンス最適化 | M (3-7日) | 画像圧縮、キャッシュ、測定 |
| エラーハンドリング・ロギング | S (1-3日) | 標準的なパターン適用 |
| **合計** | **約5-8週** | フルスタック開発者1名想定 |

### 5.2 リスク評価

#### 高リスク項目

**1. Qwen-VL認識精度98%達成**
- **理由**: AI精度は外部依存、プロンプトチューニングに時間
- **緩和策**:
  - 初期: 精度測定用データセット作成（100枚）
  - プロンプトエンジニアリング（Few-shot examples）
  - Qwen-VL-Maxモデル使用（高精度版、コスト高）
  - フォールバック: 複数回認識→多数決
- **影響**: システム全体の信頼性に直結

**2. リアルタイム認識モードのコスト**
- **理由**: 500ms間隔でAPI呼び出し = 120リクエスト/分
- **コスト試算**:
  - 1ユーザー × 5分利用 = 600リクエスト
  - 1000ユーザー/日 = 60万リクエスト/月
  - Qwen-VL-Plus: ¥0.1/req → ¥60,000/月
- **緩和策**:
  - クライアントサイド物体検出（TensorFlow.js）で事前フィルタ
  - API呼び出し間隔を1秒に変更（半減）
  - リアルタイムモードを有料機能化
- **影響**: 運用コスト、収益性

**3. 画像品質検証の誤検出**
- **理由**: 基準値設定が難しい、環境依存
- **緩和策**:
  - 実験データで基準値チューニング
  - ユーザーフィードバック収集（「この画像でも認識できなかった」）
  - 検証を緩和モードと厳格モードで切り替え
- **影響**: UX低下（過度な再撮影要求）

#### 中リスク項目

**4. Qwen-VL API可用性**
- **理由**: Alibaba Cloud障害、レート制限
- **緩和策**:
  - リトライ機構（最大3回）
  - タイムアウト設定（5秒）
  - フォールバック: OCR.space等の代替API
- **影響**: サービス停止

**5. 画像処理のパフォーマンス（クライアントサイド）**
- **理由**: OpenCV.jsのバンドルサイズ大、ブラウザ負荷
- **緩和策**:
  - 軽量な画像処理ライブラリ検討（Jimp、sharp-browserify）
  - サーバーサイド処理に移行
  - Web Worker使用
- **影響**: 初期ロード時間、UX

**6. 複数ナンバープレート形式の網羅性**
- **理由**: テストデータ収集の困難さ
- **緩和策**:
  - 段階的リリース（最初は普通車のみ → 軽自動車 → 特殊車両）
  - ユーザーからのフィードバック収集
  - 形式ごとの認識精度ダッシュボード
- **影響**: 対応車両の限定

#### 低リスク項目

**7. カメラUIの実装**
- **理由**: 標準的な機能、既存ライブラリ豊富
- **緩和策**: 不要
- **影響**: 限定的

**8. Flask APIサーバー構築**
- **理由**: 標準的なWeb API開発
- **緩和策**: 不要
- **影響**: 限定的

### 5.3 技術調査項目（設計フェーズで実施）

| 項目 | 目的 | 優先度 |
|------|------|--------|
| Qwen-VL精度実測 | プロンプト最適化、98%達成可否確認 | 高 |
| Qwen-VL API料金・制限調査 | コスト試算、スケール戦略 | 高 |
| カメラライブラリ比較 | react-webcam vs カスタム実装 | 中 |
| 画像品質検証手法調査 | OpenCV.js vs TensorFlow.js vs サーバーサイド | 中 |
| リアルタイム物体検出手法 | TensorFlow.js COCO-SSD、YOLO.js | 中 |
| 画像圧縮最適化 | サイズ・品質バランス、認識精度影響 | 中 |

---

## 6. 推奨事項と次ステップ

### 6.1 設計フェーズへの推奨事項

#### 優先的に決定すべき事項

**1. Qwen-VL統合戦略**
- **決定事項**:
  - プロンプト設計（Few-shot examples含む）
  - モデル選定（qwen-vl-plus vs qwen-vl-max）
  - コスト上限設定
- **調査必要**: 
  - 100枚のテストデータでの精度測定
  - プロンプトA/Bテスト

**推奨プロンプト例**:
```
日本のナンバープレートの文字を読み取り、以下のJSON形式で出力してください:
{
  "region": "地名（例：品川）",
  "classification": "分類番号（例：330）",
  "hiragana": "ひらがな（例：あ）",
  "serialNumber": "一連番号（例：1234）"
}

例:
- 品川330あ1234 → {"region":"品川","classification":"330","hiragana":"あ","serialNumber":"1234"}
- 横浜501さ5678 → {"region":"横浜","classification":"501","hiragana":"さ","serialNumber":"5678"}
```

**2. 画像品質検証アーキテクチャ**
- **選択肢**:
  - A. クライアントサイド（OpenCV.js）: 即座フィードバック、バンドルサイズ大
  - B. サーバーサイド（Python OpenCV）: バンドルサイズ小、ネットワーク遅延
  - C. ハイブリッド: 簡易検証（Client）+ 詳細検証（Server）
- **推奨**: C（ハイブリッド）
  - Client: 解像度チェック、明るさチェック
  - Server: ぼやけ、角度チェック

**3. Flask APIアーキテクチャ**
- **決定事項**:
  - 非同期処理（Celery使用?）
  - キャッシュ戦略（Redis）
  - レート制限設定
- **推奨**:
  - 初期: 同期処理（シンプル）
  - スケール後: Celeryで非同期化

**4. リアルタイムモード実装方針**
- **決定事項**:
  - 物体検出手法（Qwen vs TensorFlow.js）
  - API呼び出し頻度（500ms vs 1秒）
  - 有料化の有無
- **推奨**:
  - Phase 3で実装（後回し）
  - TensorFlow.js COCO-SSDで事前フィルタ
  - API呼び出し: 1秒間隔

#### アーキテクチャ図（推奨構成）

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (Next.js PWA)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Camera     │  │   Image      │  │   Result     │  │
│  │   Capture    │  │   Validator  │  │   Display    │  │
│  │              │  │  (Client)    │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                  │
           │ (Base64 image)   │
           ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│              Flask API (/papi/recognize)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Image      │  │   Qwen-VL    │  │   Plate      │  │
│  │   Validator  │  │   Client     │  │   Parser     │  │
│  │  (Server)    │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Qwen-VL API         │
                   │  (Alibaba Cloud)     │
                   └──────────────────────┘
```

### 6.2 次のステップ

#### 即時実行（設計フェーズ開始前）
1. ✅ ギャップ分析完了
2. ⏭️ `/kiro:spec-design license-plate-recognition` 実行

#### 設計フェーズで実施
1. Qwen-VL精度検証（テストデータ100枚、2-3日）
2. プロンプトエンジニアリング（A/Bテスト、2日）
3. カメラライブラリ選定（PoC作成、1日）
4. 画像品質検証手法決定（実験、2日）
5. Flask API設計（仕様書作成、1日）

#### 実装フェーズ移行判断基準
- ✅ Qwen-VL精度95%以上達成（暫定目標）
- ✅ プロンプト確定
- ✅ アーキテクチャ設計承認
- ✅ API仕様確定

---

## 7. 付録

### 7.1 参考実装リンク

- [react-webcam](https://github.com/mozmorris/react-webcam)
- [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html)
- [TensorFlow.js COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
- [Qwen-VL Documentation](https://help.aliyun.com/zh/model-studio/getting-started/qwen-vl)
- [Flask Best Practices](https://flask.palletsprojects.com/en/3.0.x/)

### 7.2 既存コードベース参照パス

```
car/
├── pkgs/
│   ├── qwen-sample/
│   │   └── src/
│   │       ├── sample2.ts              # Qwen-VL参考実装
│   │       └── index.ts                # Qwen Agent参考
│   └── frontend/
│       ├── app/page.tsx                # フロントエンド基盤
│       └── components/                 # UIコンポーネント
└── .kiro/
    └── steering/                       # プロジェクトコンテキスト
```

### 7.3 用語集

| 用語 | 説明 |
|-----|------|
| Qwen-VL | Alibaba Cloudのマルチモーダル生成AIモデル |
| DashScope | Alibaba CloudのAIモデルAPIプラットフォーム |
| Base64 | バイナリデータをテキスト形式にエンコードする方式 |
| OCR | Optical Character Recognition（光学文字認識） |
| Canvas API | HTML5のグラフィック描画API |
| getUserMedia | ブラウザのカメラ・マイクアクセスAPI |
| Laplacian variance | 画像のぼやけを検出するアルゴリズム |
| Hough変換 | 画像から直線や円を検出するアルゴリズム |

---

**作成日**: 2026-01-17  
**分析者**: Claude (Serena AI Agent)  
**ステータス**: 設計フェーズ移行待ち
