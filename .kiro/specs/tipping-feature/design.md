# 設計書

## 概要

本設計書は、チップ機能（P2P投げ銭）の技術的な実装方針を定義します。この機能は、ナンバープレート認識機能とウォレットアドレス変換機能を統合し、**x402 MCPプロトコル + Next.js Server Components + Qwen AI（OpenAI SDK）**を使用してBase L2ブロックチェーン上で車両間のP2P決済を実現するシステムを構築します。

**アーキテクチャ方針**: Laravel APIは使用せず、すべての投げ銭ロジックをNext.js内で完結させます。x402 MCPサーバーと通信してブロックチェーントランザクションを実行し、Qwen AIを使用した音声処理により安全なハンズフリー操作を提供します。

### 設計目標

- ナンバープレート認識からトランザクション完了まで10秒以内
- 2%の手数料計算の正確性
- ハザードランプ連動による安全な自動トリガー
- 音声確認によるハンズフリー操作
- プライバシー保護（ナンバープレートの部分マスク）
- PWAプッシュ通知による受信通知

## アーキテクチャ

### システム構成図

```mermaid
graph TB
    subgraph Frontend["フロントエンド (Next.js PWA)"]
        TipUI[Tipping UI - Client Component]
        AmountSelector[Amount Selector - Client Component]
        VoiceHandler[Voice Handler - Client Component]
        HistoryView[History View - Client Component]
        NotificationUI[Notification UI - Client Component]
    end

    subgraph ServerComponents["Next.js Server Components"]
        TipService[Tipping Service]
        TransactionExecutor[Transaction Executor]
        QwenService[Qwen AI Service]
        NotificationService[Notification Service]
        HistoryService[History Service]
    end

    subgraph Integration["統合レイヤー"]
        LPRecognition[License Plate Recognition - Flask API]
        WalletDeriver[Wallet Address Deriver - Laravel API]
        HazardDetector[Hazard Lamp Detector - OBD-II]
    end

    subgraph MCPLayer["x402 MCP Layer"]
        MCPClient[x402 MCP Client - Node.js]
        x402Server[x402 Server - Hono]
    end

    subgraph Blockchain["ブロックチェーン (Base Sepolia)"]
        SmartAccount[ERC4337 SmartAccount]
        Paymaster[Paymaster]
    end

    subgraph External["外部サービス"]
        OBD2[OBD-II Device]
        QwenAPI[Qwen AI - OpenAI SDK]
        PushService[Push Notification Service]
    end

    TipUI --> TipService
    AmountSelector --> TipService
    VoiceHandler --> QwenService
    TipService --> LPRecognition
    TipService --> WalletDeriver
    TipService --> TransactionExecutor
    TransactionExecutor --> MCPClient
    MCPClient --> x402Server
    x402Server --> SmartAccount
    SmartAccount --> Paymaster
    QwenService --> QwenAPI
    TransactionExecutor --> NotificationService
    NotificationService --> PushService
    HistoryService --> SmartAccount
    HistoryView --> HistoryService
    HazardDetector --> OBD2
    HazardDetector --> TipUI
```

### データフロー

```mermaid
sequenceDiagram
    participant User
    participant TipUI as Tipping UI (Client)
    participant LPR as License Plate Recognition (Flask)
    participant WAD as Wallet Address Deriver (Laravel)
    participant TipSvc as Tipping Service (Server Component)
    participant Fee as Fee Calculator
    participant Voice as Qwen AI Service (Server Component)
    participant MCP as x402 MCP Client
    participant x402 as x402 Server (Hono)
    participant BC as Blockchain (Base L2)
    participant Notify as Notification Service (Server Component)

    User->>TipUI: カメラでナンバープレート撮影
    TipUI->>LPR: 画像認識リクエスト (Flask /papi/)
    LPR-->>TipUI: License Plate Data
    TipUI->>WAD: アドレス導出リクエスト (Laravel /api/)
    WAD-->>TipUI: Wallet Address

    User->>TipUI: 金額選択（¥100/¥500/¥1,000/カスタム）
    TipUI->>Fee: 手数料計算（Client側）
    Fee-->>TipUI: 送金額 + 手数料 + 合計

    alt 音声確認モード
        TipUI->>Voice: 音声ガイダンス要求 (Server Action)
        Voice->>Voice: Qwen AI (OpenAI SDK) で音声合成
        Voice-->>User: 「[金額]円を送りますか？」
        User->>Voice: 「はい」/「いいえ」
        Voice->>Voice: Qwen AI (OpenAI SDK) で音声認識
        Voice-->>TipUI: 確認結果
    else 手動確認モード
        User->>TipUI: 送金ボタンクリック
    end

    TipUI->>TipSvc: 送金リクエスト (Server Action)
    TipSvc->>MCP: x402 MCP経由でトランザクション作成
    MCP->>x402: /tip エンドポイント呼び出し
    x402->>BC: ERC4337トランザクション実行
    BC-->>x402: Transaction Hash
    x402-->>MCP: Transaction Hash
    MCP-->>TipSvc: Transaction Hash
    TipSvc->>Notify: 受信者に通知 (Server Component)
    Notify-->>User: プッシュ通知 (PWA)
    TipSvc-->>TipUI: 成功レスポンス
```

## コンポーネントとインターフェース

### フロントエンドコンポーネント

#### TippingService (Server Component)

投げ銭機能のメインサービス。Next.js Server Actionsとして実装。

```typescript
// pkgs/frontend/app/actions/tipping.ts
'use server';

import { x402MCPClient } from '@/lib/x402/mcp-client';
import { recognizeLicensePlate } from '@/lib/api/flask';
import { deriveWalletAddress } from '@/lib/api/laravel';

interface TippingServiceConfig {
  x402ServerUrl: string;
  maxDailyLimit: number;      // デフォルト: 50000 (¥50,000)
  minTransactionInterval: number; // デフォルト: 30000 (30秒)
}

interface TipRequest {
  recipientPlate: LicensePlateData;
  recipientAddress: `0x${string}`;
  amount: number;             // 円
  fee: number;                // 円
  message?: string;
}

interface TipResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  error?: TipError;
}

interface TipError {
  code: TipErrorCode;
  message: string;
  suggestion: string;
}

type TipErrorCode =
  | 'PLATE_NOT_RECOGNIZED'
  | 'WALLET_NOT_REGISTERED'
  | 'INSUFFICIENT_BALANCE'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TRANSACTION_FAILED'
  | 'TRANSACTION_TIMEOUT'
  | 'USER_CANCELLED';

/**
 * Server Action: ナンバープレートから受信者情報を取得
 */
export async function recognizeRecipient(image: string): Promise<RecipientInfo> {
  const plateData = await recognizeLicensePlate(image);
  const walletAddress = await deriveWalletAddress(plateData);
  return {
    plateData,
    plateMasked: maskLicensePlate(plateData),
    walletAddress,
    isRegistered: !!walletAddress,
  };
}

/**
 * Server Action: x402 MCP経由で投げ銭を送信
 */
export async function sendTip(request: TipRequest): Promise<TipResult> {
  try {
    // レート制限チェック（Server-side validation）
    if (!canSendTip()) {
      throw new Error('RATE_LIMITED');
    }

    // x402 MCP Client経由でトランザクション実行
    const txHash = await x402MCPClient.sendTip({
      recipientAddress: request.recipientAddress,
      amount: request.amount,
      fee: request.fee,
    });

    // 通知送信（Server Component）
    await sendNotification({
      recipientAddress: request.recipientAddress,
      amount: request.amount,
      senderPlateMasked: maskLicensePlate(request.recipientPlate),
      transactionHash: txHash,
    });

    return {
      success: true,
      transactionHash: txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: parseError(error),
    };
  }
}

/**
 * Server Action: 投げ銭履歴を取得（ブロックチェーン + ローカル）
 */
export async function getHistory(
  address: `0x${string}`,
  filter?: HistoryFilter
): Promise<TipHistory[]> {
  // viem/wagmiでブロックチェーンイベントログを取得
  const blockchainHistory = await fetchBlockchainHistory(address, filter);
  // IndexedDBから暗号化された履歴を読み込み（Client側でマージ）
  return blockchainHistory;
}

function canSendTip(): boolean {
  // 日次上限・間隔チェック（Server-side）
  return true; // 実装省略
}
```

#### TipAmountSelector

金額選択UIコンポーネント。

```typescript
// pkgs/frontend/components/tipping/TipAmountSelector.tsx

interface TipAmountSelectorProps {
  onAmountSelect: (amount: number, fee: number, total: number) => void;
  onError: (error: string) => void;
  exchangeRate: number;       // JPY to USDC
}

interface AmountBreakdown {
  amount: number;             // 送金額（円）
  fee: number;                // 手数料（円）
  total: number;              // 合計（円）
  usdcEquivalent: number;     // USDC相当額
}

const PRESET_AMOUNTS = [100, 500, 1000] as const;
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100000;
const FEE_RATE = 0.02;        // 2%
const MIN_FEE = 1;            // 最小手数料¥1
```

#### VoiceConfirmationHandler (Client Component)

音声確認処理コンポーネント。Qwen AI Serviceを呼び出す。

```typescript
// pkgs/frontend/components/tipping/VoiceConfirmationHandler.tsx
'use client';

import { requestVoiceConfirmation } from '@/app/actions/qwen-voice';

interface VoiceConfirmationConfig {
  timeout: number;            // デフォルト: 10000 (10秒)
  language: string;           // デフォルト: 'ja-JP'
}

interface VoiceConfirmationResult {
  confirmed: boolean;
  cancelled: boolean;
  timedOut: boolean;
  transcript?: string;
}

const CONFIRM_PHRASES = ['はい', '送る', 'OK', 'オーケー', '送って'];
const CANCEL_PHRASES = ['いいえ', 'キャンセル', 'やめる', '止める'];

/**
 * Client Component: 音声確認UIとServer Actionの橋渡し
 */
export function VoiceConfirmationHandler({ config }: { config: VoiceConfirmationConfig }) {
  async function handleConfirmation(amount: number): Promise<VoiceConfirmationResult> {
    // Server Action経由でQwen AIを呼び出し
    return await requestVoiceConfirmation(amount, config.timeout);
  }

  return { handleConfirmation };
}
```

#### x402_MCP_Client (Server Component)

x402 MCPサーバーと通信してブロックチェーントランザクションを実行。

```typescript
// pkgs/frontend/lib/x402/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface TipTransactionRequest {
  recipientAddress: `0x${string}`;
  amount: number;             // 円
  fee: number;                // 円
}

interface TipTransactionResponse {
  transactionHash: `0x${string}`;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
}

class X402MCPClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(serverCommand: string, serverArgs: string[]) {
    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });
    this.client = new Client({
      name: 'tipping-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  /**
   * x402 MCPサーバーの /tip エンドポイントを呼び出し
   */
  async sendTip(request: TipTransactionRequest): Promise<`0x${string}`> {
    const response = await this.client.callTool({
      name: 'send_tip',
      arguments: {
        recipient: request.recipientAddress,
        amount: request.amount.toString(),
        fee: request.fee.toString(),
      },
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No response from x402 server');
    }

    const result = JSON.parse(response.content[0].text) as TipTransactionResponse;
    return result.transactionHash;
  }

  /**
   * トランザクションステータスを確認
   */
  async getTransactionStatus(txHash: `0x${string}`): Promise<TipTransactionResponse> {
    const response = await this.client.callTool({
      name: 'get_transaction_status',
      arguments: { txHash },
    });

    return JSON.parse(response.content[0].text) as TipTransactionResponse;
  }
}

export const x402MCPClient = new X402MCPClient(
  'node',
  ['pkgs/x402server/dist/index.js']
);
```

#### Qwen_AI_Service (Server Component)

Qwen AIをOpenAI SDK経由で呼び出して音声認識・音声合成を実行。

```typescript
// pkgs/frontend/app/actions/qwen-voice.ts
'use server';

import OpenAI from 'openai';

const qwen = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

interface VoiceConfirmationRequest {
  amount: number;
  timeout: number;
}

interface VoiceConfirmationResult {
  confirmed: boolean;
  cancelled: boolean;
  timedOut: boolean;
  transcript?: string;
}

const CONFIRM_PHRASES = ['はい', '送る', 'OK', 'オーケー', '送って'];
const CANCEL_PHRASES = ['いいえ', 'キャンセル', 'やめる', '止める'];

/**
 * Server Action: Qwen AIで音声確認を実行
 */
export async function requestVoiceConfirmation(
  amount: number,
  timeout: number = 10000
): Promise<VoiceConfirmationResult> {
  try {
    // 音声ガイダンス生成（Qwen AI Text-to-Speech）
    const guidance = `前方の車両に${amount}円を送りますか？`;
    const audioBuffer = await synthesizeSpeech(guidance);

    // ユーザーに音声を再生（Client側で実行）
    // ここではServer Actionなので、音声データを返してClient側で再生

    // 音声認識（Qwen AI Speech-to-Text）
    const transcript = await recognizeSpeech(timeout);

    // 確認・キャンセル判定
    if (CONFIRM_PHRASES.some(phrase => transcript.includes(phrase))) {
      return { confirmed: true, cancelled: false, timedOut: false, transcript };
    } else if (CANCEL_PHRASES.some(phrase => transcript.includes(phrase))) {
      return { confirmed: false, cancelled: true, timedOut: false, transcript };
    } else {
      return { confirmed: false, cancelled: false, timedOut: false, transcript };
    }
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      return { confirmed: false, cancelled: false, timedOut: true };
    }
    throw error;
  }
}

/**
 * Qwen AI Text-to-Speech（OpenAI SDK経由）
 */
async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await qwen.audio.speech.create({
    model: 'qwen-audio-turbo',
    voice: 'nova',
    input: text,
  });

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Qwen AI Speech-to-Text（OpenAI SDK経由、Streaming API使用）
 */
async function recognizeSpeech(timeout: number): Promise<string> {
  // 実装はクライアント側で音声入力を収集し、Server Actionに送信
  // ここでは簡略化
  return ''; // 実装省略
}
```

#### HazardLampDetector

ハザードランプ検知コンポーネント。

```typescript
// pkgs/frontend/lib/tipping/hazard-detector.ts

interface HazardDetectorConfig {
  detectionWindow: number;    // デフォルト: 5000 (5秒)
  requiredFlashes: number;    // デフォルト: 2
  enabled: boolean;
}

interface HazardEvent {
  timestamp: number;
  flashCount: number;
}

class HazardLampDetector {
  constructor(config: HazardDetectorConfig);

  async connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  onTrigger(callback: () => void): void;
  setEnabled(enabled: boolean): void;
}
```

### x402 Server (Hono) エンドポイント

#### Tipping Endpoint

```typescript
// pkgs/x402server/src/routes/tipping.ts

import { Hono } from 'hono';
import { viem } from 'viem';
import { baseSepolia } from 'viem/chains';

const app = new Hono();

// POST /tip - 投げ銭トランザクションを実行
interface TipRequest {
  recipientAddress: `0x${string}`;
  amount: string;             // Wei単位（USDC）
  fee: string;                // Wei単位（USDC）
}

interface TipResponse {
  transactionHash: `0x${string}`;
  status: 'pending' | 'confirmed';
}

app.post('/tip', async (c) => {
  const { recipientAddress, amount, fee } = await c.req.json<TipRequest>();

  // ERC4337 SmartAccount経由でトランザクション実行
  const txHash = await sendTipTransaction({
    recipient: recipientAddress,
    amount: BigInt(amount),
    fee: BigInt(fee),
  });

  return c.json<TipResponse>({
    transactionHash: txHash,
    status: 'pending',
  });
});

// GET /tip/status/:txHash - トランザクションステータスを取得
app.get('/tip/status/:txHash', async (c) => {
  const txHash = c.req.param('txHash') as `0x${string}`;
  
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  
  return c.json({
    transactionHash: txHash,
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
    blockNumber: receipt.blockNumber,
  });
});

export default app;
```

### Next.js Server Actions

投げ銭機能のビジネスロジックは Next.js Server Actions で実装します（Laravel API は使用しません）。

```typescript
// pkgs/frontend/app/actions/notification.ts
'use server';

interface NotificationRequest {
  recipientAddress: `0x${string}`;
  amount: number;
  senderPlateMasked: string;  // 例: 品川330あ****
  transactionHash: `0x${string}`;
}

/**
 * Server Action: PWAプッシュ通知を送信
 */
export async function sendNotification(request: NotificationRequest): Promise<void> {
  // PWA Push APIを使用して通知送信
  const payload = {
    title: '投げ銭を受け取りました',
    body: `${request.senderPlateMasked} から ¥${request.amount} を受け取りました`,
    data: {
      transactionHash: request.transactionHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${request.transactionHash}`,
    },
  };

  await sendPushNotification(request.recipientAddress, payload);
}
```

```typescript
// pkgs/frontend/app/actions/history.ts
'use server';

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

/**
 * Server Action: viem/wagmiでブロックチェーンイベントログから履歴を取得
 */
export async function fetchBlockchainHistory(
  address: `0x${string}`,
  filter?: HistoryFilter
): Promise<TipHistory[]> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // SmartAccountコントラクトのイベントログを取得
  const logs = await publicClient.getLogs({
    address: SMART_ACCOUNT_ADDRESS,
    event: parseAbiItem('event TipSent(address indexed sender, address indexed recipient, uint256 amount)'),
    fromBlock: 'earliest',
    toBlock: 'latest',
  });

  return logs.map(log => ({
    id: log.transactionHash,
    type: log.args.sender === address ? 'sent' : 'received',
    transactionHash: log.transactionHash,
    counterpartyPlateMasked: '品川330あ****', // プライバシー保護のためマスク
    amount: Number(log.args.amount) / 1e18, // Wei → JPY変換
    timestamp: Date.now(), // ブロックタイムスタンプから取得
    explorerUrl: `https://sepolia.basescan.org/tx/${log.transactionHash}`,
  }));
}
```

#### FeeCalculator

```typescript
// pkgs/x402server/src/lib/fee-calculator.ts

interface FeeCalculation {
  amount: number;
  fee: number;
  total: number;
  platformFee: number;
}

const FEE_RATE = 0.02;
const MIN_FEE = 1;
const PLATFORM_WALLET = process.env.PLATFORM_WALLET as `0x${string}`;

function calculateFee(amount: number): FeeCalculation {
  const rawFee = amount * FEE_RATE;
  const fee = Math.max(Math.ceil(rawFee), MIN_FEE);
  return {
    amount,
    fee,
    total: amount + fee,
    platformFee: fee,
  };
}
```

### 共通データ型

#### TipTransaction

```typescript
// pkgs/frontend/types/tipping.ts

interface TipTransaction {
  id: string;
  transactionHash: `0x${string}`;
  senderAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amount: number;
  fee: number;
  total: number;
  senderPlateMasked: string;
  recipientPlateMasked: string;
  message?: string;
  status: TransactionStatus;
  createdAt: number;
  confirmedAt?: number;
}

type TransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'failed';
```

#### TipHistory

```typescript
// pkgs/frontend/types/tipping.ts

interface TipHistory {
  id: string;
  type: 'sent' | 'received';
  transactionHash: `0x${string}`;
  counterpartyPlateMasked: string;
  amount: number;
  fee?: number;               // 送信時のみ
  timestamp: number;
  explorerUrl: string;
}

interface HistoryFilter {
  type?: 'sent' | 'received' | 'all';
  startDate?: Date;
  endDate?: Date;
}
```

#### RecipientInfo

```typescript
// pkgs/frontend/types/tipping.ts

interface RecipientInfo {
  plateData: LicensePlateData;
  plateMasked: string;        // 例: 品川330あ****
  walletAddress: `0x${string}`;
  isRegistered: boolean;
}
```

## データモデル

### ナンバープレートマスキング

```typescript
// プライバシー保護のためのマスキングロジック
function maskLicensePlate(plate: LicensePlateData): string {
  // 一連番号を****でマスク
  return `${plate.region}${plate.classificationNumber}${plate.hiragana}****`;
}

// 例: 品川330あ1234 → 品川330あ****
```

### ローカルストレージ暗号化

```typescript
// pkgs/frontend/lib/tipping/encrypted-storage.ts

interface EncryptedHistoryStorage {
  encrypt(history: TipHistory[]): string;
  decrypt(encrypted: string): TipHistory[];
  save(history: TipHistory[]): void;
  load(): TipHistory[];
}

// AES-GCM暗号化を使用
// キーはユーザーのウォレットアドレスから派生
```

### レート制限データ

```typescript
interface RateLimitData {
  dailySpent: number;
  lastTransactionTime: number;
  transactionCount: number;
}

// ローカルストレージに保存
// 日付が変わるとリセット
```


## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 投げ銭フロー統合

*任意の* 有効なナンバープレート画像に対して、Tipping_Serviceは以下の順序で処理を実行すること：
1. License_Plate_Recognition_Serviceを呼び出してナンバープレートを認識
2. 認識成功時、Wallet_Address_Deriverを呼び出してウォレットアドレスを取得
3. アドレス取得成功時、送金先情報（ナンバープレート表示、ウォレットアドレス）をUIに表示

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: 金額範囲検証

*任意の* カスタム金額入力に対して、Tip_Amount_Selectorは金額が最小値（¥10）以上かつ最大値（¥100,000）以下であることを検証し、範囲外の場合はエラーを返すこと。

**Validates: Requirements 2.3**

### Property 3: 手数料計算の正確性

*任意の* 有効な送金額に対して、Fee_Calculatorは以下の条件を満たす手数料を計算すること：
1. 手数料 = ceil(金額 × 0.02)
2. 手数料 >= ¥1（最小手数料）
3. 合計 = 金額 + 手数料

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 4: トランザクションハッシュの返却

*任意の* 成功したトランザクションに対して、Transaction_Executorは有効なトランザクションハッシュ（0x + 64桁の16進数）を返すこと。

**Validates: Requirements 4.4**

### Property 5: 通知のプライバシーマスキング

*任意の* 投げ銭通知に対して、Notification_Serviceは送信者のナンバープレートを部分マスク形式（例：品川330あ****）で表示し、一連番号を公開しないこと。

**Validates: Requirements 5.6**

### Property 6: ハザードランプ検知タイミング

*任意の* ハザードランプ点灯イベントに対して、Hazard_Lamp_Detectorは5秒以内に2回の点灯を検知した場合にのみ投げ銭画面をトリガーすること。5秒を超えた場合はカウントをリセットすること。

**Validates: Requirements 6.2, 6.3**

### Property 7: 音声コマンド認識

*任意の* 音声入力に対して、Voice_Confirmation_Handlerは以下の動作を行うこと：
1. 確認フレーズ（「はい」「送る」「OK」）を認識した場合、投げ銭を実行
2. キャンセルフレーズ（「いいえ」「キャンセル」）を認識した場合、投げ銭をキャンセル

**Validates: Requirements 7.3, 7.4**

### Property 8: 音声タイムアウト動作

*任意の* 音声確認セッションに対して、Voice_Confirmation_Handlerは10秒のタイムアウト後に自動的にキャンセル処理を実行すること。

**Validates: Requirements 7.7, 7.8**

### Property 9: 履歴データ構造の完全性

*任意の* 保存された投げ銭履歴に対して、TipHistoryは以下の全フィールドを含むこと：
- id, type, transactionHash, counterpartyPlateMasked, amount, timestamp, explorerUrl
また、履歴は最新のものから時系列順（降順）でソートされていること。

**Validates: Requirements 8.3, 8.4**

### Property 10: レート制限の適用

*任意の* 送金リクエストに対して、Tipping_Serviceは以下のレート制限を適用すること：
1. 1日あたりの送金合計が上限（デフォルト¥50,000）を超えない
2. 連続送金の間隔が最低30秒以上

**Validates: Requirements 9.2, 9.3**

### Property 11: エラーレスポンス構造

*任意の* エラーが発生した場合、Tipping_Serviceはcode、message、suggestionの全フィールドを含むエラーレスポンスを返すこと。

**Validates: Requirements 10.4**

### Property 12: リトライメカニズム

*任意の* 失敗したトランザクションに対して、Tipping_Serviceは最大3回の自動リトライを実行し、全て失敗した場合にのみエラーを返すこと。

**Validates: Requirements 10.6**

## エラーハンドリング

### エラーコード一覧

| エラーコード | 説明 | 推奨アクション |
|------------|------|--------------|
| `PLATE_NOT_RECOGNIZED` | ナンバープレートが認識できない | カメラをナンバープレートに向けて再撮影してください |
| `WALLET_NOT_REGISTERED` | 車両がシステムに未登録 | この車両はシステムに登録されていません |
| `INSUFFICIENT_BALANCE` | 残高不足 | ウォレットに残高を追加してください |
| `DAILY_LIMIT_EXCEEDED` | 1日の送金上限超過 | 明日以降に再試行してください |
| `RATE_LIMITED` | 連続送金制限 | 30秒後に再試行してください |
| `NETWORK_ERROR` | ネットワーク接続エラー | ネットワーク接続を確認してください |
| `TRANSACTION_FAILED` | トランザクション失敗 | 再試行してください |
| `TRANSACTION_TIMEOUT` | トランザクションタイムアウト | ネットワーク接続を確認して再試行してください |
| `USER_CANCELLED` | ユーザーによるキャンセル | - |
| `VOICE_NOT_RECOGNIZED` | 音声が認識できない | もう一度お話しください |
| `VOICE_TIMEOUT` | 音声確認タイムアウト | 再度投げ銭を開始してください |

### リトライ戦略

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,  // ms
  maxDelay: 5000,      // ms
  backoffMultiplier: 2,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < config.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  throw lastError!;
}
```

### タイムアウト設定

```typescript
const TIMEOUT_CONFIG = {
  plateRecognition: 5000,     // ナンバープレート認識: 5秒
  addressDerivation: 3000,    // アドレス導出: 3秒
  transaction: 30000,         // トランザクション: 30秒
  voiceConfirmation: 10000,   // 音声確認: 10秒
  notification: 5000,         // 通知送信: 5秒
};
```

## テスト戦略

### テストフレームワーク

- **フロントエンド**: Vitest + React Testing Library + fast-check
- **バックエンド**: Vitest + fast-check
- **E2E**: Playwright

### ユニットテスト

#### FeeCalculator

```typescript
// pkgs/x402server/__tests__/tipping/fee-calculator.test.ts

describe('FeeCalculator', () => {
  it('should calculate 2% fee for ¥1000', () => {
    const result = calculateFee(1000);
    expect(result.fee).toBe(20);
    expect(result.total).toBe(1020);
  });

  it('should apply minimum fee of ¥1', () => {
    const result = calculateFee(10);
    // 10 * 0.02 = 0.2 → ceil → 1
    expect(result.fee).toBe(1);
    expect(result.total).toBe(11);
  });

  it('should ceil fractional fees', () => {
    const result = calculateFee(150);
    // 150 * 0.02 = 3 → ceil → 3
    expect(result.fee).toBe(3);
    expect(result.total).toBe(153);
  });
});
```

#### VoiceConfirmationHandler

```typescript
// pkgs/frontend/__tests__/tipping/voice-confirmation.test.ts

describe('VoiceConfirmationHandler', () => {
  it('should confirm on "はい"', async () => {
    const handler = new VoiceConfirmationHandler({ timeout: 10000 });
    mockSpeechRecognition('はい');
    const result = await handler.requestConfirmation(500);
    expect(result.confirmed).toBe(true);
  });

  it('should cancel on "キャンセル"', async () => {
    const handler = new VoiceConfirmationHandler({ timeout: 10000 });
    mockSpeechRecognition('キャンセル');
    const result = await handler.requestConfirmation(500);
    expect(result.cancelled).toBe(true);
  });

  it('should timeout after 10 seconds', async () => {
    const handler = new VoiceConfirmationHandler({ timeout: 10000 });
    mockSpeechRecognitionTimeout();
    const result = await handler.requestConfirmation(500);
    expect(result.timedOut).toBe(true);
  });
});
```

### プロパティベーステスト

```typescript
// pkgs/x402server/__tests__/tipping/fee-calculator.property.test.ts
import * as fc from 'fast-check';

describe('FeeCalculator Properties', () => {
  // Feature: tipping-feature, Property 3: 手数料計算の正確性
  it('should always calculate fee as ceil(amount * 0.02) with minimum ¥1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100000 }),
        (amount) => {
          const result = calculateFee(amount);
          const expectedFee = Math.max(Math.ceil(amount * 0.02), 1);
          return (
            result.fee === expectedFee &&
            result.total === amount + result.fee &&
            result.fee >= 1
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// pkgs/frontend/__tests__/tipping/amount-selector.property.test.ts
import * as fc from 'fast-check';

describe('TipAmountSelector Properties', () => {
  // Feature: tipping-feature, Property 2: 金額範囲検証
  it('should validate amount within range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 200000 }),
        (amount) => {
          const result = validateAmount(amount);
          if (amount >= 10 && amount <= 100000) {
            return result.isValid === true;
          } else {
            return result.isValid === false && result.error !== undefined;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// pkgs/frontend/__tests__/tipping/privacy.property.test.ts
import * as fc from 'fast-check';

describe('Privacy Properties', () => {
  // Feature: tipping-feature, Property 5: 通知のプライバシーマスキング
  it('should mask serial number in license plate', () => {
    fc.assert(
      fc.property(
        validLicensePlateDataArbitrary(),
        (plate) => {
          const masked = maskLicensePlate(plate);
          // マスクされた文字列は一連番号を含まない
          return (
            masked.includes(plate.region) &&
            masked.includes(plate.classificationNumber) &&
            masked.includes(plate.hiragana) &&
            masked.includes('****') &&
            !masked.includes(plate.serialNumber)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// pkgs/frontend/__tests__/tipping/rate-limit.property.test.ts
import * as fc from 'fast-check';

describe('Rate Limiting Properties', () => {
  // Feature: tipping-feature, Property 10: レート制限の適用
  it('should enforce daily limit', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 10, max: 10000 }), { minLength: 1, maxLength: 20 }),
        (amounts) => {
          const service = new TippingService({ maxDailyLimit: 50000 });
          let totalSpent = 0;

          for (const amount of amounts) {
            const canSend = service.canSendTip();
            if (totalSpent + amount <= 50000) {
              // 上限内なら送金可能
              if (canSend) {
                service.recordTransaction(amount);
                totalSpent += amount;
              }
            } else {
              // 上限超過なら送金不可
              return !canSend || service.getDailySpent() <= 50000;
            }
          }
          return service.getDailySpent() <= 50000;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce minimum interval between transactions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 60000 }), { minLength: 2, maxLength: 10 }),
        (intervals) => {
          const service = new TippingService({ minTransactionInterval: 30000 });
          let lastTime = 0;

          for (const interval of intervals) {
            const currentTime = lastTime + interval;
            const canSend = service.canSendTipAt(currentTime);

            if (interval < 30000 && lastTime > 0) {
              // 30秒未満なら送金不可
              if (canSend) return false;
            }

            if (canSend) {
              lastTime = currentTime;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// pkgs/frontend/__tests__/tipping/voice-confirmation.property.test.ts
import * as fc from 'fast-check';

describe('Voice Confirmation Properties', () => {
  // Feature: tipping-feature, Property 7: 音声コマンド認識
  it('should recognize confirm and cancel phrases correctly', () => {
    const confirmPhrases = ['はい', '送る', 'OK', 'オーケー', '送って'];
    const cancelPhrases = ['いいえ', 'キャンセル', 'やめる', '止める'];

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...confirmPhrases),
          fc.constantFrom(...cancelPhrases)
        ),
        (phrase) => {
          const result = parseVoiceCommand(phrase);
          if (confirmPhrases.includes(phrase)) {
            return result.action === 'confirm';
          } else {
            return result.action === 'cancel';
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// pkgs/frontend/__tests__/tipping/history.property.test.ts
import * as fc from 'fast-check';

describe('History Properties', () => {
  // Feature: tipping-feature, Property 9: 履歴データ構造の完全性
  it('should have complete history data structure', () => {
    fc.assert(
      fc.property(
        tipHistoryArbitrary(),
        (history) => {
          return (
            typeof history.id === 'string' &&
            (history.type === 'sent' || history.type === 'received') &&
            /^0x[0-9a-f]{64}$/i.test(history.transactionHash) &&
            typeof history.counterpartyPlateMasked === 'string' &&
            history.counterpartyPlateMasked.includes('****') &&
            typeof history.amount === 'number' &&
            history.amount > 0 &&
            typeof history.timestamp === 'number' &&
            typeof history.explorerUrl === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sort history by timestamp descending', () => {
    fc.assert(
      fc.property(
        fc.array(tipHistoryArbitrary(), { minLength: 2, maxLength: 20 }),
        (histories) => {
          const sorted = sortHistoryByTimestamp(histories);
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i - 1].timestamp < sorted[i].timestamp) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### テストデータ生成

```typescript
// pkgs/frontend/__tests__/arbitraries/tipping.ts
import * as fc from 'fast-check';

export const tipHistoryArbitrary = () =>
  fc.record({
    id: fc.uuid(),
    type: fc.constantFrom('sent', 'received'),
    transactionHash: fc.hexaString({ minLength: 64, maxLength: 64 }).map(h => `0x${h}` as `0x${string}`),
    counterpartyPlateMasked: fc.constantFrom(
      '品川330あ****',
      '横浜500か****',
      '名古屋300さ****'
    ),
    amount: fc.integer({ min: 10, max: 100000 }),
    timestamp: fc.integer({ min: 1700000000000, max: 1800000000000 }),
    explorerUrl: fc.constant('https://sepolia.basescan.org/tx/'),
  }).map(h => ({
    ...h,
    explorerUrl: `${h.explorerUrl}${h.transactionHash}`,
  }));

export const validLicensePlateDataArbitrary = () =>
  fc.record({
    region: fc.constantFrom('品川', '横浜', '名古屋', '大阪', '神戸'),
    classificationNumber: fc.stringOf(
      fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
      { minLength: 3, maxLength: 3 }
    ),
    hiragana: fc.constantFrom('あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く'),
    serialNumber: fc.stringOf(
      fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
      { minLength: 1, maxLength: 4 }
    ),
  });
```

### テストカバレッジ目標

- ユニットテスト: 80%以上
- プロパティテスト: 全ての正確性プロパティをカバー
- E2Eテスト: 主要なユーザーフローをカバー
