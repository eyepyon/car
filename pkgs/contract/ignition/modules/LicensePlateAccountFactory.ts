import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * ERC-4337ナンバープレートウォレットシステム用Hardhat Ignitionモジュール
 *
 * デプロイ内容:
 * 1. AccountFactory - PrivacyProtectedAccountのベースファクトリ
 * 2. LicensePlateCommitmentVerifier - ZK証明検証器 (Groth16)
 * 3. LicensePlateAccountFactory - ZK証明サポート付き拡張ファクトリ
 * 4. VehicleRegistry - 車両とウォレットのマッピングのためのオプションのレジストリ
 *
 * ネットワーク: Base Sepolia (テストネット) / Base Mainnet
 * EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 (ERC-4337 v0.6)
 *
 * ZK回路: LicensePlateOwnership.circom
 * - 公開入力: publicCommitment (Poseidonハッシュ)
 * - 秘密入力: plateChars[8], salt
 * - 証明内容: Poseidon(plateChars, salt) == publicCommitment
 */
const LicensePlateAccountFactoryModule = buildModule(
  "LicensePlateAccountFactoryModule",
  (m) => {
    // EntryPointアドレス（公式 ERC-4337 v0.6 - 全ネットワーク共通）
    const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    // AccountFactoryをデプロイ
    const accountFactory = m.contract("AccountFactory", [ENTRYPOINT_ADDRESS], {
      id: "AccountFactory",
    });

    // ZK検証器(Groth16)をデプロイ
    const zkVerifier = m.contract("LicensePlateCommitmentVerifier", [], {
      id: "LicensePlateCommitmentVerifier",
    });

    // LicensePlateAccountFactoryをデプロイ
    const licensePlateAccountFactory = m.contract(
      "LicensePlateAccountFactory",
      [ENTRYPOINT_ADDRESS],
      {
        id: "LicensePlateAccountFactory",
      },
    );

    // VehicleRegistryをデプロイ
    const vehicleRegistry = m.contract("VehicleRegistry", [], {
      id: "VehicleRegistry",
    });

    // オプション: ファクトリにZK検証器を設定（デプロイ後に実行可能）
    m.call(licensePlateAccountFactory, "setZKVerifier", [zkVerifier]);

    return {
      accountFactory,
      zkVerifier,
      licensePlateAccountFactory,
      vehicleRegistry,
    };
  },
);

export default LicensePlateAccountFactoryModule;
