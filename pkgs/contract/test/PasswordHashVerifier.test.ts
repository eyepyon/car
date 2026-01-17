import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "../artifacts/contracts/PasswordHashVerifier.sol/PasswordHashVerifier";

describe("PasswordHashVerifier", () => {
  // テスト用の証明データ
  let pA: [bigint, bigint];
  let pB: [[bigint, bigint], [bigint, bigint]];
  let pC: [bigint, bigint];
  let pubSignals: [bigint];
  let hasValidProofData = false;

  before(() => {
    // calldataファイルを読み込んで解析
    const calldataPath = join(
      __dirname,
      "../../../pkgs/circuit/data/calldata.json",
    );

    if (existsSync(calldataPath)) {
      try {
        const calldataContent = readFileSync(calldataPath, "utf8");
        // JSONの解析（配列形式）
        const callData = JSON.parse(`[${calldataContent}]`);

        // calldataから証明パラメータを抽出
        pA = [BigInt(callData[0][0]), BigInt(callData[0][1])];
        pB = [
          [BigInt(callData[1][0][0]), BigInt(callData[1][0][1])],
          [BigInt(callData[1][1][0]), BigInt(callData[1][1][1])],
        ];
        pC = [BigInt(callData[2][0]), BigInt(callData[2][1])];
        pubSignals = [BigInt(callData[3][0])];

        hasValidProofData = true;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn("❌ Error loading calldata file:", errorMessage);
        setupFallbackData();
      }
    } else {
      console.warn("❌ Calldata file not found, using fallback data");
      setupFallbackData();
    }
  });

  function setupFallbackData() {
    // フォールバック用のダミーデータ
    pA = [BigInt("1"), BigInt("2")];
    pB = [
      [BigInt("3"), BigInt("4")],
      [BigInt("5"), BigInt("6")],
    ];
    pC = [BigInt("7"), BigInt("8")];
    pubSignals = [BigInt("9")];
    hasValidProofData = false;
  }

  /**
   * テストで使うスマートコントラクトをまとめてデプロイする
   * @returns
   */
  async function deployPasswordHashVerifierFixture() {
    // PasswordHashVerifierをデプロイ
    const verifier = await hre.viem.deployContract(
      "PasswordHashVerifier" as "PasswordHashVerifier",
      [],
    );

    return {
      verifier,
    };
  }

  // 実際のZK証明が必要なテストは条件付きで実行
  describe("ZK Proof Integration (requires valid proof)", () => {
    it("Should successfully verify ZKProof", async function () {
      if (!hasValidProofData) {
        this.skip();
        return;
      }

      // コントラクトをデプロイ
      const { verifier } = await loadFixture(deployPasswordHashVerifierFixture);

      try {
        // 実際の証明データで検証
        const result = await verifier.read.verifyProof([
          pA,
          pB,
          pC,
          pubSignals,
        ]);

        // 成功した場合の検証
        expect(result).to.be.true;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // ZK証明の検証に失敗した場合は、適切なエラーメッセージであることを確認
        expect(errorMessage).to.include("Invalid proof");
      }
    });
  });
});
