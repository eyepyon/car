"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  keccak256,
  parseUnits,
  toHex,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { CameraCapture } from "@/components/license-plate/CameraCapture";
import { RecognitionResultDisplay } from "@/components/license-plate/RecognitionResult";
import { Button } from "@/components/ui/button";
import { useLicensePlateRecognition } from "@/lib/license-plate";
import { ACCOUNT_ABI, ERC20_ABI } from "@/lib/wallet/wallet-abi";
import { useWallet } from "@/lib/wallet/wallet-context";
import type {
  CapturedImage,
  LicensePlateData,
  CaptureError,
} from "@/types/license-plate";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
const DEFAULT_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_CVTT_ADDRESS ||
  "0x3e39DaaC436990E8eCb72849D43f81F3b9E7E610";
const DEFAULT_TOKEN_DECIMALS = 18;
const DEFAULT_TOKEN_SYMBOL = "CVTT";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function toChatContext(plate: LicensePlateData | null, messages: ChatMessage[]) {
  if (!plate) {
    return null;
  }

  return {
    license_plate: {
      region: plate.region,
      classification_number: plate.classificationNumber,
      hiragana: plate.hiragana,
      serial_number: plate.serialNumber,
      full_text: plate.fullText,
      confidence: plate.confidence,
    },
    conversation_history: messages.slice(-8).map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  };
}

function deriveAddressFromPlate(plate: LicensePlateData): Hex {
  const hash = keccak256(toHex(plate.fullText));
  const trimmed = `0x${hash.slice(-40)}`;
  return trimmed as Hex;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "こんにちは。車の情報や送金について話しかけてください。",
    ),
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [tipAmount, setTipAmount] = useState("10");
  const [tipAddress, setTipAddress] = useState<Hex | "">("");
  const [tipStatus, setTipStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [tipTxHash, setTipTxHash] = useState<Hex | undefined>(undefined);
  const [tipError, setTipError] = useState<string | undefined>(undefined);

  const recognitionRef = useRef<any>(null);

  const {
    result: recognitionResult,
    error: recognitionError,
    recognizeImage,
    reset: resetRecognition,
  } = useLicensePlateRecognition({
    mode: "single",
  });

  const { accountAddress, owner, status, connect, createWallet } = useWallet();

  const derivedAddress = useMemo(() => {
    if (!recognitionResult) {
      return "";
    }
    return deriveAddressFromPlate(recognitionResult);
  }, [recognitionResult]);

  const targetAddress = tipAddress || derivedAddress;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("");
      setInput(transcript);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === "undefined") {
        return;
      }
      const synthesis = window.speechSynthesis;
      if (!synthesis) {
        return;
      }
      synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      synthesis.speak(utterance);
    },
    [voiceEnabled],
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return;
      }

      const nextMessages = [...messages, createMessage("user", message.trim())];
      setMessages(nextMessages);
      setInput("");
      setIsSending(true);

      try {
        const response = await fetch(`${DEFAULT_API_BASE_URL}/papi/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message.trim(),
            context: toChatContext(recognitionResult, nextMessages),
          }),
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error("APIレスポンスが不正です");
        }
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error?.message || "AI応答に失敗しました");
        }

        const aiMessage = data?.data?.response || "応答が空です";
        setMessages((prev) => [...prev, createMessage("assistant", aiMessage)]);
        speak(aiMessage);
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : "通信に失敗しました";
        setMessages((prev) => [
          ...prev,
          createMessage(
            "assistant",
            `${fallback}。しばらく待ってからお試しください。`,
          ),
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [messages, recognitionResult, speak],
  );

  const handleVoiceToggle = useCallback(() => {
    if (!speechSupported || !recognitionRef.current) {
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setListening(true);
    recognitionRef.current.start();
  }, [listening, speechSupported]);

  const handleCapture = useCallback(
    (image: CapturedImage) => {
      setCaptureError(null);
      recognizeImage(image);
    },
    [recognizeImage],
  );

  const handleCaptureError = useCallback((err: CaptureError) => {
    setCaptureError(err);
  }, []);

  const handleSendTip = useCallback(async () => {
    if (!targetAddress) {
      setTipError("送金先アドレスが見つかりません");
      setTipStatus("error");
      return;
    }

    if (!accountAddress) {
      setTipError("CarWalletが未作成です");
      setTipStatus("error");
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      setTipError("ウォレットが見つかりません");
      setTipStatus("error");
      return;
    }

    setTipError(undefined);
    setTipStatus("submitting");
    setTipTxHash(undefined);

    try {
      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      const [from] = await walletClient.requestAddresses();
      const amount = parseUnits(tipAmount || "0", DEFAULT_TOKEN_DECIMALS);
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [targetAddress as Hex, amount],
      });

      const hash = await walletClient.writeContract({
        address: accountAddress,
        abi: ACCOUNT_ABI,
        functionName: "execute",
        args: [DEFAULT_TOKEN_ADDRESS as Hex, 0n, transferData],
        account: from,
        chain: baseSepolia,
      });

      setTipTxHash(hash);
      setTipStatus("success");
    } catch (error) {
      setTipStatus("error");
      setTipError(
        error instanceof Error ? error.message : "送金に失敗しました",
      );
    }
  }, [targetAddress, tipAmount, accountAddress]);

  const handleCreateCarWallet = useCallback(async () => {
    if (!recognitionResult) {
      return;
    }
    await createWallet(recognitionResult);
  }, [recognitionResult, createWallet]);

  const plateHeadline = recognitionResult
    ? `${recognitionResult.fullText}（信頼度 ${Math.round(recognitionResult.confidence)}%）`
    : "未検出";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">
            voice camera agent
          </p>
          <h1 className="text-3xl font-semibold">
            カメラ付き音声チャット
          </h1>
          <p className="text-sm text-white/60">
            音声で会話しながら、検出した車両へチップを送金できます。
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">カメラ</h2>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  resetRecognition();
                  setCaptureError(null);
                }}
              >
                リセット
              </Button>
            </div>

            <CameraCapture
              mode="single"
              onCapture={handleCapture}
              onError={handleCaptureError}
              className="rounded-xl overflow-hidden"
            />
            {captureError && (
              <p className="text-xs text-red-200">{captureError.message}</p>
            )}

            <div className="rounded-xl border border-white/10 bg-black/50 p-4">
              <p className="text-xs text-white/60">認識プレート</p>
              <p className="mt-1 text-base font-semibold">{plateHeadline}</p>
              <div className="mt-3">
                <RecognitionResultDisplay
                  result={recognitionResult}
                  isLoading={false}
                  error={recognitionError}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs text-white/60">
                チップ送金（ERC4337車両ウォレット宛て）
              </p>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>送信元</span>
                  <span className="text-white/80">
                    {accountAddress ? "CarWallet" : "未作成"}
                  </span>
                </div>
                {accountAddress && (
                  <p className="text-[10px] text-white/50 break-all">
                    {accountAddress}
                  </p>
                )}
                {!owner && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={connect}
                    disabled={status === "connecting"}
                  >
                    {status === "connecting"
                      ? "ウォレット接続中..."
                      : "MetaMaskを接続"}
                  </Button>
                )}
                {owner && !accountAddress && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={connect}
                    disabled={status === "connecting"}
                  >
                    {status === "connecting"
                      ? "CarWallet読込中..."
                      : "CarWalletを読み込む"}
                  </Button>
                )}
                {!accountAddress && recognitionResult && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleCreateCarWallet}
                    disabled={status === "proving" || status === "submitting"}
                  >
                    {status === "proving" && "ZK証明を生成中..."}
                    {status === "submitting" && "CarWallet作成中..."}
                    {status !== "proving" &&
                      status !== "submitting" &&
                      "CarWalletを作成"}
                  </Button>
                )}
                <div className="grid gap-1">
                  <label className="text-xs text-white/60">送金先</label>
                  <input
                    value={targetAddress}
                    placeholder="0x... (自動入力)"
                    onChange={(event) =>
                      setTipAddress(event.target.value as Hex)
                    }
                    className="rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/90"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-white/60">金額</label>
                  <input
                    value={tipAmount}
                    onChange={(event) => setTipAmount(event.target.value)}
                    className="rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white/90"
                  />
                </div>
                <Button
                  type="button"
                  variant="default"
                  onClick={handleSendTip}
                  disabled={tipStatus === "submitting"}
                >
                  {tipStatus === "submitting" && "送金中..."}
                  {tipStatus === "success" && "送金完了"}
                  {tipStatus === "idle" && `${DEFAULT_TOKEN_SYMBOL}で送金`}
                  {tipStatus === "error" && "再試行"}
                </Button>
                {tipTxHash && (
                  <p className="text-[10px] text-white/60 break-all">
                    Tx: {tipTxHash}
                  </p>
                )}
                {tipError && (
                  <p className="text-xs text-red-200">{tipError}</p>
                )}
              </div>
            </div>
          </section>

          <section className="flex h-[780px] flex-col rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">エージェントチャット</h2>
                <p className="text-xs text-white/60">
                  音声入力を使って会話できます
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setVoiceEnabled((prev) => !prev)}
                >
                  {voiceEnabled ? "音声ON" : "音声OFF"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!speechSupported}
                  onClick={handleVoiceToggle}
                >
                  {listening ? "録音停止" : "話しかける"}
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-white/10 text-white",
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isSending && (
                <div className="max-w-[85%] rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
                  応答中...
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSend(input);
                    }
                  }}
                  placeholder="メッセージを入力、または話しかけてください"
                  className="flex-1 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white"
                />
                <Button
                  type="button"
                  onClick={() => handleSend(input)}
                  disabled={isSending}
                >
                  送信
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                MCP/Qwen連携の会話ログを送信します。検出されたナンバーは自動で文脈に含まれます。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
