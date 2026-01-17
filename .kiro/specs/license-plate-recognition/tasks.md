# 実装計画: ナンバープレート認識機能

## 概要

本実装計画は、ナンバープレート認識機能を段階的に実装するためのタスクリストです。フロントエンドのカメラキャプチャコンポーネントから始め、バックエンドAPI、AI統合、そしてテストまでを網羅します。

## タスク

- [ ] 1. 共通型定義とユーティリティの作成
  - [ ] 1.1 LicensePlateData型とRecognitionError型を定義する
    - `pkgs/frontend/types/license-plate.ts` を作成
    - PlateType、RecognitionErrorCode等の列挙型を定義
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 1.2 型定義のプロパティテストを作成する
    - **Property 4: 認識結果データ構造の完全性**
    - **Property 5: フルテキストの整合性**
    - **Property 6: 信頼度スコアの範囲**
    - **Validates: Requirements 4.1-4.6**

- [ ] 2. フロントエンド: カメラキャプチャコンポーネント
  - [ ] 2.1 CameraCaptureComponentを実装する
    - `pkgs/frontend/components/license-plate/CameraCapture.tsx` を作成
    - react-webcamを使用してカメラアクセスを実装
    - シングルショットモードとリアルタイムモードをサポート
    - _Requirements: 1.1, 1.4, 7.1_
  - [ ] 2.2 カメラ権限とエラーハンドリングを実装する
    - 権限リクエストダイアログの表示
    - デバイス未検出時のエラーメッセージ
    - _Requirements: 1.2, 1.3_
  - [ ]* 2.3 CameraCaptureComponentのユニットテストを作成する
    - カメラ権限のモックテスト
    - エラーハンドリングのテスト
    - _Requirements: 1.2, 1.3_
  - [ ]* 2.4 画像キャプチャのプロパティテストを作成する
    - **Property 1: 画像キャプチャの有効性**
    - **Validates: Requirements 1.1, 1.5**

- [ ] 3. フロントエンド: 画像検証
  - [ ] 3.1 ImageValidatorを実装する
    - `pkgs/frontend/lib/license-plate/image-validator.ts` を作成
    - ぼやけ検出、角度検出、照明検出を実装
    - ValidationResultとValidationErrorを返す
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 3.2 ImageValidatorのプロパティテストを作成する
    - **Property 2: 画像検証の完全性**
    - **Property 3: 画像品質エラーの適切性**
    - **Validates: Requirements 2.1-2.5**

- [ ] 4. チェックポイント - フロントエンド基盤の確認
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

- [ ] 5. バックエンド: Recognition API
  - [ ] 5.1 Recognition APIエンドポイントを作成する
    - `pkgs/x402server/src/routes/license-plate.ts` を作成
    - POST /api/license-plate/recognize エンドポイントを実装
    - リクエスト/レスポンスのバリデーション
    - _Requirements: 3.1, 3.4_
  - [ ] 5.2 レート制限を実装する
    - 同時リクエスト数の制限
    - レート制限超過時のエラーレスポンス
    - _Requirements: 8.2, 8.4_
  - [ ]* 5.3 レート制限のプロパティテストを作成する
    - **Property 11: レート制限の動作**
    - **Validates: Requirements 8.4**

- [ ] 6. バックエンド: Qwen-VL クライアント
  - [ ] 6.1 QwenVLClientを実装する
    - `pkgs/x402server/src/lib/qwen-vl-client.ts` を作成
    - DashScope APIとの通信を実装
    - 認識結果のパースとLicensePlateDataへの変換
    - _Requirements: 3.1, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 6.2 リトライ機構を実装する
    - 指数バックオフによるリトライ
    - 最大リトライ回数の設定
    - _Requirements: 6.1_
  - [ ]* 6.3 リトライ機構のプロパティテストを作成する
    - **Property 8: リトライ動作**
    - **Validates: Requirements 6.1**
  - [ ] 6.4 タイムアウト処理を実装する
    - 5秒タイムアウトの設定
    - タイムアウトエラーの返却
    - _Requirements: 6.2_

- [ ] 7. バックエンド: エラーハンドリングとログ
  - [ ] 7.1 エラーレスポンス構造を実装する
    - RecognitionErrorの生成
    - エラーコード、メッセージ、推奨アクションの設定
    - _Requirements: 6.3, 6.5_
  - [ ] 7.2 エラーログ機能を実装する
    - 全エラーのログ記録
    - 認識ログの保存
    - _Requirements: 6.4_
  - [ ]* 7.3 エラーレスポンスのプロパティテストを作成する
    - **Property 7: エラーレスポンスの構造**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 8. チェックポイント - バックエンド基盤の確認
  - 全てのテストが通ることを確認
  - 質問があればユーザーに確認

- [ ] 9. バックエンド: キャッシュと最適化
  - [ ] 9.1 認識結果キャッシュを実装する
    - 画像ハッシュをキーとしたキャッシュ
    - 5分間のキャッシュ有効期限
    - _Requirements: 8.5_
  - [ ]* 9.2 キャッシュのプロパティテストを作成する
    - **Property 12: キャッシュの一貫性**
    - **Validates: Requirements 8.5**
  - [ ] 9.3 画像サイズ最適化を実装する
    - 画像の圧縮とリサイズ
    - ネットワーク転送の効率化
    - _Requirements: 8.3_
  - [ ]* 9.4 画像最適化のプロパティテストを作成する
    - **Property 10: 画像サイズ最適化**
    - **Validates: Requirements 8.3**

- [ ] 10. フロントエンド: リアルタイム認識モード
  - [ ] 10.1 リアルタイム認識ロジックを実装する
    - 500ms間隔でのフレームキャプチャ
    - ナンバープレート検出領域のハイライト
    - _Requirements: 7.2, 7.3, 7.5_
  - [ ] 10.2 重複認識抑制を実装する
    - 同一ナンバープレートの連続認識を抑制
    - _Requirements: 7.4_
  - [ ]* 10.3 重複認識抑制のプロパティテストを作成する
    - **Property 9: 重複認識の抑制**
    - **Validates: Requirements 7.4**

- [ ] 11. フロントエンド: 認識結果表示
  - [ ] 11.1 RecognitionResultDisplayコンポーネントを実装する
    - `pkgs/frontend/components/license-plate/RecognitionResult.tsx` を作成
    - 認識結果の構造化表示
    - エラー状態の表示
    - _Requirements: 3.4, 6.3_
  - [ ]* 11.2 RecognitionResultDisplayのユニットテストを作成する
    - 成功時の表示テスト
    - エラー時の表示テスト
    - _Requirements: 3.4, 6.3_

- [ ] 12. 統合とワイヤリング
  - [ ] 12.1 フロントエンドとバックエンドを統合する
    - APIクライアントの作成
    - コンポーネント間の接続
    - _Requirements: 3.1_
  - [ ] 12.2 エンドツーエンドのフローを確認する
    - カメラキャプチャ → 検証 → API呼び出し → 結果表示
    - _Requirements: 1.1, 2.1, 3.1, 3.4_
  - [ ]* 12.3 統合テストを作成する
    - 主要なユースケースのテスト
    - エラーケースのテスト
    - _Requirements: 1.1-8.5_

- [ ] 13. 最終チェックポイント
  - 全てのテストが通ることを確認
  - パフォーマンス要件（150ms以内）の確認
  - 質問があればユーザーに確認

- [ ] 14. Laravel: ゲート開閉API
  - [ ] 14.1 Gate Control APIエンドポイントを作成する
    - `/laravel/` 以下にLaravel 11プロジェクトを構築
    - POST /api/gate/unlock エンドポイントを実装
    - Sesame Web APIとの連携を実装
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ] 14.2 ゲート操作のエラーハンドリングを実装する
    - Sesame API接続失敗時のリトライ処理
    - エラーレスポンスの返却
    - _Requirements: 9.4_
  - [ ] 14.3 ゲート操作ログを実装する
    - 操作ログのDB保存
    - ログの検索・表示機能
    - _Requirements: 9.5_
  - [ ]* 14.4 Gate Control APIのユニットテストを作成する
    - Sesame APIのモックテスト
    - エラーハンドリングのテスト
    - _Requirements: 9.1-9.5_

- [ ] 15. Python: 会話AI連携API
  - [ ] 15.1 Chat APIエンドポイントを作成する
    - `/python/` 以下にFlaskプロジェクトを構築
    - POST /papi/chat エンドポイントを実装
    - Qwen MCPサーバーとの連携を実装
    - _Requirements: 10.1, 10.2_
  - [ ] 15.2 コンテキスト管理を実装する
    - ナンバープレート認識結果をコンテキストに含める
    - 会話履歴の管理
    - _Requirements: 10.3_
  - [ ] 15.3 日本語応答生成を実装する
    - 日本語での応答生成
    - エラー時の適切なメッセージ
    - _Requirements: 10.4, 10.5_
  - [ ]* 15.4 Chat APIのユニットテストを作成する
    - MCP接続のモックテスト
    - 応答生成のテスト
    - _Requirements: 10.1-10.5_

- [ ] 16. 統合チェックポイント - 全機能の確認
  - ナンバープレート認識 → ゲート開閉の連携確認
  - 会話AI連携の動作確認
  - 全てのテストが通ることを確認

## 注意事項

- `*` マークのタスクはオプションで、MVPを優先する場合はスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- プロパティテストは最低100回のイテレーションを実行
- チェックポイントでは必ずテストを実行して品質を確認
