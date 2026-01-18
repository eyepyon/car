import { encodeAbiParameters, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { createWalletClient, custom } from "viem";
import type { LicensePlateData } from "@/types/license-plate";
import {
  encodeLicensePlateToChars,
  createRandomFieldSalt,
} from "./plate-encoding";
import { generateLicensePlateProof } from "./zk-proof";
import { LICENSE_PLATE_FACTORY_ABI } from "./wallet-abi";
import { useCallback, useMemo, useRef, useState } from "react";

const DEFAULT_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_LICENSE_PLATE_FACTORY_ADDRESS ||
  "0xbc95fBAc440546f7D2294Ae7E1F7ea23b5c87A9E";

const DEFAULT_WASM_URL = "/zk/LicensePlateCommitment.wasm";
const DEFAULT_ZKEY_URL = "/zk/LicensePlateCommitment_final.zkey";

export type WalletCreationStatus =
  | "idle"
  | "connecting"
  | "proving"
  | "submitting"
  | "success"
  | "error";

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
  error?: string;
  connect: () => Promise<void>;
  createWallet: (plate: LicensePlateData) => Promise<void>;
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

  const walletClientRef = useRef<ReturnType<typeof createWalletClient> | null>(
    null,
  );

  const [status, setStatus] = useState<WalletCreationStatus>("idle");
  const [owner, setOwner] = useState<Hex | undefined>(undefined);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [commitment, setCommitment] = useState<Hex | undefined>(undefined);
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

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(undefined);

    try {
      const walletClient = await ensureWalletClient();
      const [address] = await walletClient.requestAddresses();
      setOwner(address);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "ウォレット接続に失敗しました",
      );
    }
  }, [ensureWalletClient]);

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
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "ウォレット作成に失敗しました",
        );
      }
    },
    [ensureWalletClient, owner, factoryAddress, wasmUrl, zkeyUrl],
  );

  return useMemo(
    () => ({
      status,
      owner,
      txHash,
      commitment,
      error,
      connect,
      createWallet,
    }),
    [status, owner, txHash, commitment, error, connect, createWallet],
  );
}
