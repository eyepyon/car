# 要件定義書

## はじめに

本ドキュメントは、ナンバープレート連動ウォレットシステムにおける「ナンバープレート認識機能」の要件を定義します。この機能は、AIカメラを使用して日本のナンバープレートを高精度で認識し、ウォレットアドレスとの紐付けを可能にするコア機能です。

## 用語集

- **License_Plate_Recognition_Service**: ナンバープレート画像を受け取り、構造化されたナンバープレートデータを返すAI認識サービス
- **Camera_Capture_Component**: USBカメラまたはスマートフォンカメラから画像を取得するフロントエンドコンポーネント
- **License_Plate_Data**: 認識されたナンバープレートの構造化データ（地名、分類番号、ひらがな、一連番号）
- **Recognition_API**: バックエンドのナンバープレート認識エンドポイント
- **Qwen_VL_Client**: Qwen-VL AIモデルとの通信を行うクライアント
- **Image_Validator**: 画像品質を検証するコンポーネント
- **Gate_Control_API**: Sesame Web APIを使用してゲートの開閉を制御するLaravel APIエンドポイント
- **Qwen_MCP_Client**: 会話用プロンプトからQwen MCPサーバーを呼び出すPython APIクライアント

## 要件

### 要件 1: カメラ画像キャプチャ

**ユーザーストーリー:** ユーザーとして、USBカメラまたはスマートフォンカメラからナンバープレートの画像をキャプチャしたい。これにより、認識処理に必要な画像を取得できる。

#### 受け入れ基準

1. WHEN ユーザーがカメラキャプチャボタンをクリックする THEN Camera_Capture_Component SHALL カメラからの画像をキャプチャしBase64形式で返す
2. WHEN カメラへのアクセス権限がない THEN Camera_Capture_Component SHALL 権限リクエストダイアログを表示する
3. WHEN カメラデバイスが利用不可 THEN Camera_Capture_Component SHALL 明確なエラーメッセージを表示する
4. THE Camera_Capture_Component SHALL リアルタイムプレビューモードとシングルショットキャプチャモードの両方をサポートする
5. WHEN 画像がキャプチャされる THEN Camera_Capture_Component SHALL 最小解像度640x480ピクセルを保証する

### 要件 2: 画像品質検証

**ユーザーストーリー:** システムとして、認識処理前に画像品質を検証したい。これにより、低品質な画像による認識失敗を防ぐことができる。

#### 受け入れ基準

1. WHEN 画像がキャプチャされる THEN Image_Validator SHALL ぼやけ、角度、照明条件をチェックする
2. IF 画像がぼやけている THEN Image_Validator SHALL 「画像がぼやけています。再撮影してください」エラーを返す
3. IF 画像の角度が45度を超える THEN Image_Validator SHALL 「角度が急すぎます。正面から撮影してください」エラーを返す
4. IF 画像が暗すぎるまたは明るすぎる THEN Image_Validator SHALL 適切な照明調整を促すエラーを返す
5. WHEN 画像が品質チェックに合格する THEN Image_Validator SHALL 認識処理への続行を許可する

### 要件 3: AI認識処理

**ユーザーストーリー:** システムとして、Qwen-VL AIを使用してナンバープレートを認識したい。これにより、高精度な文字認識を実現できる。

#### 受け入れ基準

1. WHEN 有効な画像がRecognition_APIに送信される THEN License_Plate_Recognition_Service SHALL Qwen-VL AIを使用してナンバープレートを認識する
2. THE License_Plate_Recognition_Service SHALL 98%以上の認識精度を達成する
3. THE License_Plate_Recognition_Service SHALL 150ms以内に認識結果を返す
4. WHEN 認識が成功する THEN License_Plate_Recognition_Service SHALL 構造化されたLicense_Plate_Dataを返す
5. IF ナンバープレートが画像内に検出されない THEN License_Plate_Recognition_Service SHALL 「ナンバープレートが検出されませんでした」エラーを返す

### 要件 4: ナンバープレートデータ構造化

**ユーザーストーリー:** 開発者として、認識結果を構造化されたデータ形式で受け取りたい。これにより、後続の処理（ウォレット検索など）が容易になる。

#### 受け入れ基準

1. THE License_Plate_Data SHALL 地名（例：品川、横浜）を含む
2. THE License_Plate_Data SHALL 分類番号（例：300、500）を含む
3. THE License_Plate_Data SHALL ひらがな（例：あ、か、さ）を含む
4. THE License_Plate_Data SHALL 一連番号（例：1234）を含む
5. WHEN 認識が完了する THEN License_Plate_Recognition_Service SHALL 完全なナンバープレート文字列（例：品川330あ1234）も返す
6. THE License_Plate_Data SHALL 認識信頼度スコア（0-100%）を含む

### 要件 5: 日本のナンバープレート形式対応

**ユーザーストーリー:** システムとして、日本の全てのナンバープレート形式を認識したい。これにより、あらゆる車両に対応できる。

#### 受け入れ基準

1. THE License_Plate_Recognition_Service SHALL 普通自動車ナンバー（白地に緑文字）を認識する
2. THE License_Plate_Recognition_Service SHALL 軽自動車ナンバー（黄色地に黒文字）を認識する
3. THE License_Plate_Recognition_Service SHALL 事業用ナンバー（緑地に白文字）を認識する
4. THE License_Plate_Recognition_Service SHALL レンタカー・カーシェアナンバー（「わ」「れ」ナンバー）を認識する
5. THE License_Plate_Recognition_Service SHALL 外交官ナンバー（青地に白文字）を認識する

### 要件 6: エラーハンドリング

**ユーザーストーリー:** ユーザーとして、認識に失敗した場合に明確なフィードバックを受け取りたい。これにより、問題を解決して再試行できる。

#### 受け入れ基準

1. IF AI APIへの接続が失敗する THEN License_Plate_Recognition_Service SHALL リトライ処理を実行し、最終的に「サービスに接続できません」エラーを返す
2. IF 認識タイムアウト（5秒）が発生する THEN License_Plate_Recognition_Service SHALL 「認識処理がタイムアウトしました」エラーを返す
3. WHEN エラーが発生する THEN License_Plate_Recognition_Service SHALL エラーコード、メッセージ、推奨アクションを含むエラーレスポンスを返す
4. THE License_Plate_Recognition_Service SHALL 全てのエラーをログに記録する
5. IF 部分的な認識のみ成功する THEN License_Plate_Recognition_Service SHALL 認識できた部分と認識できなかった部分を明示する

### 要件 7: リアルタイム認識モード

**ユーザーストーリー:** ユーザーとして、カメラをナンバープレートに向けるだけで自動的に認識を開始したい。これにより、操作が簡単になる。

#### 受け入れ基準

1. WHILE リアルタイムモードが有効 THEN Camera_Capture_Component SHALL 継続的にフレームをキャプチャする
2. WHEN ナンバープレートがフレーム内に検出される THEN License_Plate_Recognition_Service SHALL 自動的に認識処理を開始する
3. THE License_Plate_Recognition_Service SHALL リアルタイムモードでは500ms間隔で認識を実行する
4. WHEN 同じナンバープレートが連続して認識される THEN License_Plate_Recognition_Service SHALL 重複した認識結果を抑制する
5. THE Camera_Capture_Component SHALL リアルタイムモードでナンバープレート検出領域をハイライト表示する

### 要件 8: パフォーマンス要件

**ユーザーストーリー:** システムとして、高速で効率的な認識処理を提供したい。これにより、ユーザー体験を向上させる。

#### 受け入れ基準

1. THE License_Plate_Recognition_Service SHALL 平均処理時間150ms以内を維持する
2. THE Recognition_API SHALL 同時100リクエストを処理できる
3. THE License_Plate_Recognition_Service SHALL 画像サイズを最適化してネットワーク転送を効率化する
4. WHEN 高負荷時 THEN License_Plate_Recognition_Service SHALL レート制限を適用し、適切なエラーレスポンスを返す
5. THE License_Plate_Recognition_Service SHALL 認識結果をキャッシュして重複リクエストを最適化する


### 要件 9: ゲート開閉連携

**ユーザーストーリー:** システムとして、ナンバープレート認識成功後にゲートを自動開閉したい。これにより、シームレスな入退場を実現できる。

#### 受け入れ基準

1. WHEN ナンバープレートが認識される THEN Gate_Control_API SHALL Sesame Web APIを呼び出してゲートを解錠する
2. THE Gate_Control_API SHALL Laravel APIエンドポイント（/api/gate/unlock）として実装する
3. WHEN ゲート解錠に成功する THEN Gate_Control_API SHALL 解錠成功レスポンスを返す
4. IF Sesame Web APIへの接続が失敗する THEN Gate_Control_API SHALL リトライ処理を実行し、最終的にエラーを返す
5. THE Gate_Control_API SHALL ゲート操作ログを記録する

### 要件 10: 会話AI連携

**ユーザーストーリー:** ユーザーとして、音声やテキストで車両情報を問い合わせたい。これにより、ハンズフリーで情報を取得できる。

#### 受け入れ基準

1. WHEN ユーザーが会話プロンプトを送信する THEN Qwen_MCP_Client SHALL Qwen MCPサーバーを呼び出す
2. THE Qwen_MCP_Client SHALL Python APIエンドポイント（/papi/chat）として実装する
3. THE Qwen_MCP_Client SHALL ナンバープレート認識結果をコンテキストとして含める
4. WHEN 会話応答が生成される THEN Qwen_MCP_Client SHALL 日本語で応答を返す
5. IF MCPサーバーへの接続が失敗する THEN Qwen_MCP_Client SHALL 適切なエラーメッセージを返す
