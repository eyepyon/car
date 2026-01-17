# 要件定義書

## はじめに

本ドキュメントは、ナンバープレート連動ウォレットシステムにおける「チップ機能（P2P投げ銭）」の要件を定義します。この機能は、ナンバープレート認識とウォレットアドレス変換機能を統合し、車両間でのP2P決済を実現するコア機能です。

**実装方針**: x402 MCPプロトコルを使用し、Next.js Server Component + Qwen AI（OpenAI SDK）でBase L2ブロックチェーン上のトランザクションを実行します。Laravel APIは使用せず、すべてNext.js内で完結します。

## 用語集

- **Tipping_Service**: 投げ銭トランザクションの作成・送信を管理するNext.js Server Componentサービス
- **x402_MCP_Client**: x402 MCPプロトコルを使用してブロックチェーントランザクションを実行するクライアント（MCPサーバーとの通信）
- **x402_Server**: x402決済エンドポイントを提供するHonoサーバー（投げ銭用エンドポイント追加）
- **Tip_Amount_Selector**: ユーザーが投げ銭金額を選択するUIコンポーネント（Client Component）
- **Transaction_Executor**: x402 MCP経由でブロックチェーントランザクションを実行するServer Component
- **Notification_Service**: 投げ銭の受信者に通知を送信するServer Component
- **Hazard_Lamp_Detector**: OBD-II経由でハザードランプの点灯を検知するClient Component
- **Voice_Confirmation_Handler**: Qwen AI（OpenAI SDK）を使用して音声による投げ銭確認を処理するServer Component
- **Qwen_AI_Service**: OpenAI SDKを使用したQwen AI統合サービス（音声認識・音声合成）
- **Fee_Calculator**: 2%の手数料を計算するユーティリティ関数
- **License_Plate_Recognition_Service**: ナンバープレート認識機能（既存、Flask API）
- **Wallet_Address_Deriver**: ウォレットアドレス変換機能（既存、Laravel API）
- **Tip_Transaction**: 投げ銭トランザクションのデータ構造
- **Tip_History**: 投げ銭履歴のデータ構造（ローカルストレージ + ブロックチェーンイベントログ）

## 要件

### 要件 1: ナンバープレート認識による送金先特定

**ユーザーストーリー:** ユーザーとして、前方の車両のナンバープレートを撮影して送金先を特定したい。これにより、相手の連絡先を知らなくても投げ銭を送ることができる。

#### 受け入れ基準

1. WHEN ユーザーがカメラで前方車両のナンバープレートを撮影する THEN Tipping_Service SHALL License_Plate_Recognition_Serviceを呼び出してナンバープレートを認識する
2. WHEN ナンバープレートが認識される THEN Tipping_Service SHALL Wallet_Address_Deriverを呼び出してウォレットアドレスを取得する
3. WHEN ウォレットアドレスが取得される THEN Tipping_Service SHALL 送金先情報（ナンバープレート表示、ウォレットアドレス）をUIに表示する
4. IF ナンバープレートが認識できない THEN Tipping_Service SHALL 「ナンバープレートを認識できませんでした。再撮影してください」エラーを表示する
5. IF ウォレットアドレスが未登録 THEN Tipping_Service SHALL 「この車両はシステムに登録されていません」メッセージを表示する

### 要件 2: 投げ銭金額の選択

**ユーザーストーリー:** ユーザーとして、プリセット金額またはカスタム金額から投げ銭金額を選択したい。これにより、状況に応じた適切な金額を送ることができる。

#### 受け入れ基準

1. THE Tip_Amount_Selector SHALL プリセット金額（¥100、¥500、¥1,000）をボタンとして表示する
2. THE Tip_Amount_Selector SHALL カスタム金額入力フィールドを提供する
3. WHEN カスタム金額が入力される THEN Tip_Amount_Selector SHALL 最小金額（¥10）と最大金額（¥100,000）の範囲を検証する
4. WHEN 金額が選択される THEN Tip_Amount_Selector SHALL 2%の手数料を含む合計金額を表示する
5. IF 無効な金額が入力される THEN Tip_Amount_Selector SHALL 適切なエラーメッセージを表示する
6. THE Tip_Amount_Selector SHALL 選択された金額をUSDC相当額でも表示する

### 要件 3: 手数料計算

**ユーザーストーリー:** システムとして、投げ銭金額に対して2%の手数料を計算したい。これにより、プラットフォームの運営費用を賄うことができる。

#### 受け入れ基準

1. WHEN 投げ銭金額が確定する THEN Fee_Calculator SHALL 金額の2%を手数料として計算する
2. THE Fee_Calculator SHALL 手数料を小数点以下切り上げで計算する
3. THE Fee_Calculator SHALL 送金額、手数料、合計額を明確に分けて表示する
4. THE Fee_Calculator SHALL 手数料の最小値を¥1とする
5. WHEN トランザクションが実行される THEN Fee_Calculator SHALL 手数料をプラットフォームウォレットに送金する

### 要件 4: x402 MCPによるトランザクション実行

**ユーザーストーリー:** ユーザーとして、安全かつ高速にブロックチェーン上で投げ銭を送金したい。これにより、信頼性の高い決済を実現できる。

#### 受け入れ基準

1. WHEN ユーザーが送金を確認する THEN Transaction_Executor SHALL Next.js Server Componentからx402_MCP_Clientを呼び出してトランザクションを作成する
2. THE Transaction_Executor SHALL x402_Serverの投げ銭エンドポイント（`/tip`）にリクエストを送信する
3. THE x402_Server SHALL Base Sepoliaネットワーク上でトランザクションを実行する
4. THE Transaction_Executor SHALL ERC4337 SmartAccountからの送金をサポートする
5. WHEN トランザクションが送信される THEN Transaction_Executor SHALL トランザクションハッシュをクライアントに返す
6. WHEN トランザクションが確認される THEN Transaction_Executor SHALL 成功メッセージとトランザクション詳細を表示する
7. IF トランザクションが失敗する THEN Transaction_Executor SHALL エラーコードと詳細メッセージを表示する
8. THE Transaction_Executor SHALL ガスレス取引（Paymaster経由）をサポートする
9. THE x402_MCP_Client SHALL MCP SDK for Node.jsを使用してx402_Serverと通信する

### 要件 5: 投げ銭受信通知

**ユーザーストーリー:** 受信者として、投げ銭を受け取ったことを通知で知りたい。これにより、感謝の気持ちを受け取ったことを認識できる。

#### 受け入れ基準

1. WHEN 投げ銭トランザクションが確認される THEN Notification_Service SHALL 受信者にプッシュ通知を送信する
2. THE Notification_Service SHALL 通知に送金額、送信者のナンバープレート（部分マスク）、メッセージを含める
3. THE Notification_Service SHALL 通知をPWAプッシュ通知として送信する
4. WHEN 受信者がアプリを開く THEN Notification_Service SHALL 投げ銭履歴画面に新着マークを表示する
5. IF プッシュ通知が無効 THEN Notification_Service SHALL アプリ内通知として保存する
6. THE Notification_Service SHALL 送信者のプライバシーを保護するためナンバープレートを部分マスク（例：品川330あ****）する

### 要件 6: ハザードランプ連動による自動トリガー

**ユーザーストーリー:** ユーザーとして、ハザードランプを2回点灯させることで投げ銭画面を自動表示したい。これにより、運転中でも安全に操作を開始できる。

#### 受け入れ基準

1. WHEN OBD-IIデバイスが接続されている THEN Hazard_Lamp_Detector SHALL ハザードランプの点灯を検知する
2. WHEN ハザードランプが2回連続で点灯される THEN Hazard_Lamp_Detector SHALL 投げ銭画面を自動的に表示する
3. THE Hazard_Lamp_Detector SHALL 2回点灯の検知間隔を5秒以内とする
4. WHEN 投げ銭画面が表示される THEN Hazard_Lamp_Detector SHALL 前方車両のナンバープレート認識を自動開始する
5. IF OBD-IIデバイスが未接続 THEN Hazard_Lamp_Detector SHALL 手動での投げ銭開始のみを許可する
6. THE Hazard_Lamp_Detector SHALL ハザードランプ検知機能のON/OFF設定を提供する

### 要件 7: Qwen AIによる音声確認ハンズフリー操作

**ユーザーストーリー:** ユーザーとして、運転中に音声で投げ銭を確認・送信したい。これにより、安全に運転しながら操作できる。

#### 受け入れ基準

1. WHEN 投げ銭画面が表示される THEN Voice_Confirmation_Handler SHALL Qwen_AI_Service（OpenAI SDK経由）を使用して音声ガイダンスを再生する
2. THE Voice_Confirmation_Handler SHALL 「前方の車両に[金額]円を送りますか？」と音声で確認する（Qwen AI音声合成）
3. THE Voice_Confirmation_Handler SHALL Next.js Server Componentからx402_MCP_Client経由でQwen AIを呼び出す
4. WHEN ユーザーが「はい」「送る」「OK」と発話する THEN Voice_Confirmation_Handler SHALL Qwen AI音声認識で判定し、投げ銭を実行する
5. WHEN ユーザーが「いいえ」「キャンセル」と発話する THEN Voice_Confirmation_Handler SHALL Qwen AI音声認識で判定し、投げ銭をキャンセルする
6. THE Voice_Confirmation_Handler SHALL 日本語音声認識・音声合成をサポートする（Qwen AI）
7. IF 音声が認識できない THEN Voice_Confirmation_Handler SHALL Qwen AIに再度確認させ「もう一度お話しください」と再生する
8. THE Voice_Confirmation_Handler SHALL 音声確認のタイムアウトを10秒とする
9. WHEN タイムアウトする THEN Voice_Confirmation_Handler SHALL 自動的にキャンセルする
10. THE Qwen_AI_Service SHALL OpenAI SDKのStreaming APIを使用してリアルタイム音声処理を実現する

### 要件 8: 投げ銭履歴管理（Next.js Server Component実装）

**ユーザーストーリー:** ユーザーとして、送受信した投げ銭の履歴を確認したい。これにより、過去の取引を振り返ることができる。

#### 受け入れ基準

1. THE Tipping_Service SHALL Next.js Server Componentで送信した投げ銭の履歴を管理する
2. THE Tipping_Service SHALL ブロックチェーンイベントログから受信した投げ銭の履歴を取得する
3. THE Tipping_Service SHALL 履歴をローカルストレージ（ブラウザIndexedDB）に暗号化して保存する
4. THE Tipping_Service SHALL 履歴に日時、金額、相手のナンバープレート（部分マスク）、トランザクションハッシュを含める
5. WHEN ユーザーが履歴画面を開く THEN Tipping_Service SHALL Server Componentでブロックチェーンイベントとローカルデータを統合し、最新の履歴から時系列で表示する
6. THE Tipping_Service SHALL 履歴のフィルタリング（送信/受信、期間）をClient Componentで提供する
7. THE Tipping_Service SHALL トランザクションハッシュからBasescan（Base L2エクスプローラー）へのリンクを提供する
8. THE Tipping_Service SHALL Server Componentでviem/wagmiを使用してブロックチェーンイベントログを取得する

### 要件 9: セキュリティとプライバシー

**ユーザーストーリー:** ユーザーとして、投げ銭の送受信が安全に行われ、プライバシーが保護されることを期待する。

#### 受け入れ基準

1. THE Tipping_Service SHALL 送金前に必ずユーザー確認を要求する
2. THE Tipping_Service SHALL 1日あたりの送金上限（デフォルト¥50,000）を設定する
3. THE Tipping_Service SHALL 連続送金の間隔を最低30秒とする
4. THE Tipping_Service SHALL 送信者・受信者のナンバープレートを完全には公開しない
5. THE Tipping_Service SHALL トランザクション履歴をローカルストレージに暗号化して保存する
6. WHEN 不審な送金パターンが検出される THEN Tipping_Service SHALL 追加認証を要求する

### 要件 10: エラーハンドリング

**ユーザーストーリー:** ユーザーとして、エラーが発生した場合に明確なフィードバックを受け取りたい。これにより、問題を解決して再試行できる。

#### 受け入れ基準

1. IF ネットワーク接続が失敗する THEN Tipping_Service SHALL 「ネットワークに接続できません」エラーを表示する
2. IF 残高不足 THEN Tipping_Service SHALL 「残高が不足しています。現在の残高: [金額]」エラーを表示する
3. IF トランザクションがタイムアウトする THEN Tipping_Service SHALL 「トランザクションがタイムアウトしました。再試行してください」エラーを表示する
4. WHEN エラーが発生する THEN Tipping_Service SHALL エラーコード、メッセージ、推奨アクションを含むエラーレスポンスを返す
5. THE Tipping_Service SHALL 全てのエラーをログに記録する
6. IF トランザクションが失敗する THEN Tipping_Service SHALL 自動リトライ（最大3回）を実行する

