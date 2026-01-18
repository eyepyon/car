import type { LicensePlateData } from "@/types/license-plate";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    createPublicClient,
    createWalletClient,
    custom,
    encodeAbiParameters,
    formatEther,
    formatUnits,
    parseUnits,
    publicActions,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
    createRandomFieldSalt,
    encodeLicensePlateToChars,
} from "./plate-encoding";
import { ERC20_ABI, LICENSE_PLATE_FACTORY_ABI } from "./wallet-abi";
import { generateLicensePlateProof } from "./zk-proof";

const DEFAULT_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_LICENSE_PLATE_FACTORY_ADDRESS ||
  "0xbc95fBAc440546f7D2294Ae7E1F7ea23b5c87A9E";

const DEFAULT_WASM_URL = "/zk/LicensePlateCommitment.wasm";
const DEFAULT_ZKEY_URL = "/zk/LicensePlateCommitment_final.zkey";
const DEFAULT_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_CVTT_ADDRESS ||
  "0x3e39DaaC436990E8eCb72849D43f81F3b9E7E610";
const DEFAULT_TOKEN_DECIMALS = 18;
const DEFAULT_TOKEN_SYMBOL = "CVTT";

export type WalletCreationStatus =
  | "idle"
  | "connecting"
  | "proving"
  | "submitting"
  | "success"
  | "error";

export type MintStatus = "idle" | "submitting" | "success" | "error";

export interface UsePlateWalletOptions {
  factoryAddress?: Hex;
  wasmUrl?: string;
  zkeyUrl?: string;
}

export interface WalletCreationResult {
  status: WalletCreationStatus;
  owner?: Hex;
  txHash?: Hex;
  commitment?: Hex;
  accountAddress?: Hex;
  balance?: string;
  tokenBalance?: string;
  tokenSymbol?: string;
  mintStatus: MintStatus;
  mintTxHash?: Hex;
  mintError?: string;
  error?: string;
  connect: () => Promise<void>;
  createWallet: (plate: LicensePlateData) => Promise<void>;
  refreshBalance: () => Promise<void>;
  mintTokens: (amount: string, to?: Hex) => Promise<void>;
}

function formatHex(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

export function usePlateWalletCreation(
  options: UsePlateWalletOptions = {},
): WalletCreationResult {
  const factoryAddress = (options.factoryAddress ||
    DEFAULT_FACTORY_ADDRESS) as Hex;
  const wasmUrl = options.wasmUrl || DEFAULT_WASM_URL;
  const zkeyUrl = options.zkeyUrl || DEFAULT_ZKEY_URL;
  const tokenAddress = DEFAULT_TOKEN_ADDRESS as Hex;
  const tokenDecimals = DEFAULT_TOKEN_DECIMALS;
  const tokenSymbol = DEFAULT_TOKEN_SYMBOL;

  const walletClientRef = useRef<ReturnType<typeof createWalletClient> | null>(
    null,
  );
  const publicClientRef = useRef<ReturnType<typeof createPublicClient> | null>(
    null,
  );

  const [status, setStatus] = useState<WalletCreationStatus>("idle");
  const [owner, setOwner] = useState<Hex | undefined>(undefined);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [commitment, setCommitment] = useState<Hex | undefined>(undefined);
  const [accountAddress, setAccountAddress] = useState<Hex | undefined>(
    undefined,
  );
  const [balance, setBalance] = useState<string | undefined>(undefined);
  const [tokenBalance, setTokenBalance] = useState<string | undefined>(
    undefined,
  );
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [mintTxHash, setMintTxHash] = useState<Hex | undefined>(undefined);
  const [mintError, setMintError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const ensureWalletClient = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMaskが見つかりません");
    }

    if (!walletClientRef.current) {
      walletClientRef.current = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });
    }

    try {
      await walletClientRef.current.switchChain({ id: baseSepolia.id });
    } catch {
      // ユーザーが手動で切り替えるケースもあるため握りつぶす
    }

    return walletClientRef.current;
  }, []);

  const ensurePublicClient = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMaskが見つかりません");
    }

    if (!publicClientRef.current) {
      publicClientRef.current = createPublicClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      }).extend(publicActions);
    }

    return publicClientRef.current;
  }, []);

  /**
   * 既存のSmart Accountをチェックする関数
   * @param ownerAddress EOAアドレス
   * @returns 既存のアカウントアドレス、または undefined
   */
  const checkExistingAccount = useCallback(
    async (ownerAddress: Hex): Promise<Hex | undefined> => {
      try {
        const publicClient = await ensurePublicClient();

        // LocalStorageから保存されたcommitmentとsaltを取得
        const storageKey = `wallet_${ownerAddress.toLowerCase()}`;
        const storedData = localStorage.getItem(storageKey);

        if (storedData) {
          try {
            const { commitment, salt } = JSON.parse(storedData);
            const normalizedSalt =
              typeof salt === "string"
                ? BigInt(salt)
                : typeof salt === "number"
                  ? BigInt(salt)
                  : (salt as bigint);
            console.log("LocalStorageから取得:", { commitment, salt: normalizedSalt });

            // アドレスを予測
            const predictedAddress = (await publicClient.readContract({
              address: factoryAddress,
              abi: LICENSE_PLATE_FACTORY_ABI,
              functionName: "getAddressFromPlate",
              args: [ownerAddress, commitment as Hex, normalizedSalt],
            })) as Hex;

            // コードが存在するかチェック（デプロイ済みかどうか）
            const code = await publicClient.getCode({ address: predictedAddress });

            if (code && code !== "0x" && code.length > 2) {
              console.log("既存のSmart Accountが見つかりました:", predictedAddress);
              return predictedAddress;
            }

            console.warn(
              "Smart Accountのコードが見つかりませんでしたが、予測アドレスを使用します:",
              predictedAddress,
            );
            return predictedAddress;
          } catch (parseErr) {
            console.error("LocalStorageデータのパースに失敗:", parseErr);
          }
        } else {
          console.log("LocalStorageにデータが見つかりませんでした");
        }

        return undefined;
      } catch (err) {
        console.error("既存アカウントのチェックに失敗:", err);
        return undefined;
      }
    },
    [ensurePublicClient, factoryAddress],
  );

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(undefined);

    try {
      const walletClient = await ensureWalletClient();
      const [address] = await walletClient.requestAddresses();
      setOwner(address);

      // 既存のSmart Accountをチェック
      const existingAccount = await checkExistingAccount(address);
      if (existingAccount) {
        setAccountAddress(existingAccount);
        // 残高も取得
        const publicClient = await ensurePublicClient();
        const ethBalance = await publicClient.getBalance({
          address: existingAccount,
        });
        setBalance(formatEther(ethBalance));

        const tokenBal = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [existingAccount],
        });
        setTokenBalance(formatUnits(tokenBal, tokenDecimals));
      }

      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "ウォレット接続に失敗しました",
      );
    }
  }, [ensureWalletClient, ensurePublicClient, checkExistingAccount, tokenAddress, tokenDecimals]);

  const createWallet = useCallback(
    async (plate: LicensePlateData) => {
      setError(undefined);
      setTxHash(undefined);

      try {
        const walletClient = await ensureWalletClient();
        let currentOwner = owner;

        if (!currentOwner) {
          setStatus("connecting");
          const [address] = await walletClient.requestAddresses();
          currentOwner = address;
          setOwner(address);
        }

        setStatus("proving");
        const plateChars = encodeLicensePlateToChars(plate);
        const salt = createRandomFieldSalt();

        const proof = await generateLicensePlateProof({
          plateChars,
          salt,
          wasmUrl,
          zkeyUrl,
        });

        const proofBytes = encodeAbiParameters(
          [
            { type: "uint256[2]" },
            { type: "uint256[2][2]" },
            { type: "uint256[2]" },
          ],
          [proof.a, proof.b, proof.c],
        );

        const commitmentHex = formatHex(proof.publicSignals[0]);
        setCommitment(commitmentHex);

        const publicClient = await ensurePublicClient();
        const predictedAddress = (await publicClient.readContract({
          address: factoryAddress,
          abi: LICENSE_PLATE_FACTORY_ABI,
          functionName: "getAddressFromPlate",
          args: [currentOwner, commitmentHex, salt],
        })) as Hex;
        setAccountAddress(predictedAddress);

        // LocalStorageにcommitmentとsaltを保存
        const storageKey = `wallet_${currentOwner.toLowerCase()}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({ commitment: commitmentHex, salt: salt.toString() }),
        );
        console.log("LocalStorageに保存しました:", { commitment: commitmentHex, salt });

        setStatus("submitting");
        const hash = await walletClient.writeContract({
          address: factoryAddress,
          abi: LICENSE_PLATE_FACTORY_ABI,
          functionName: "createAccountFromPlate",
          args: [currentOwner, commitmentHex, salt, proofBytes],
          account: currentOwner,
          chain: baseSepolia,
        });

        setTxHash(hash);
        setStatus("success");
        const nextBalance = await publicClient.getBalance({
          address: predictedAddress,
        });
        setBalance(formatEther(nextBalance));
        const nextTokenBalance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [predictedAddress],
        });
        setTokenBalance(formatUnits(nextTokenBalance, tokenDecimals));
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "ウォレット作成に失敗しました",
        );
      }
    },
    [
      ensureWalletClient,
      ensurePublicClient,
      owner,
      factoryAddress,
      wasmUrl,
      zkeyUrl,
    ],
  );

  const refreshBalance = useCallback(async () => {
    if (!accountAddress && !owner) {
      return;
    }

    try {
      const publicClient = await ensurePublicClient();
      const address = accountAddress || owner;
      if (!address) {
        return;
      }
      const nextBalance = await publicClient.getBalance({ address });
      setBalance(formatEther(nextBalance));
      const nextTokenBalance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      setTokenBalance(formatUnits(nextTokenBalance, tokenDecimals));
    } catch (err) {
      setError(err instanceof Error ? err.message : "残高取得に失敗しました");
    }
  }, [
    accountAddress,
    owner,
    ensurePublicClient,
    tokenAddress,
    tokenDecimals,
  ]);

  const mintTokens = useCallback(
    async (amount: string, to?: Hex) => {
      setMintStatus("submitting");
      setMintTxHash(undefined);
      setMintError(undefined);

      try {
        const walletClient = await ensureWalletClient();
        let currentOwner = owner;

        if (!currentOwner) {
          const [address] = await walletClient.requestAddresses();
          currentOwner = address;
          setOwner(address);
        }

        const targetAddress = to || accountAddress || currentOwner;
        if (!targetAddress) {
          throw new Error("送信先アドレスが見つかりません");
        }

        const amountUnits = parseUnits(amount, tokenDecimals);
        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "mint",
          args: [targetAddress, amountUnits],
          account: currentOwner,
          chain: baseSepolia,
        });

        setMintTxHash(hash);
        setMintStatus("success");

        const publicClient = await ensurePublicClient();
        const nextTokenBalance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [targetAddress],
        });
        setTokenBalance(formatUnits(nextTokenBalance, tokenDecimals));
      } catch (err) {
        setMintStatus("error");
        setMintError(
          err instanceof Error ? err.message : "トークンのミントに失敗しました",
        );
      }
    },
    [
      ensureWalletClient,
      ensurePublicClient,
      owner,
      accountAddress,
      tokenAddress,
      tokenDecimals,
    ],
  );

  return useMemo(
    () => ({
      status,
      owner,
      txHash,
      commitment,
      accountAddress,
      balance,
      tokenBalance,
      tokenSymbol,
      mintStatus,
      mintTxHash,
      mintError,
      error,
      connect,
      createWallet,
      refreshBalance,
      mintTokens,
    }),
    [
      status,
      owner,
      txHash,
      commitment,
      accountAddress,
      balance,
      tokenBalance,
      tokenSymbol,
      mintStatus,
      mintTxHash,
      mintError,
      error,
      connect,
      createWallet,
      refreshBalance,
      mintTokens,
    ],
  );
}
