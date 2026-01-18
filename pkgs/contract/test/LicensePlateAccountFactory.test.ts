import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  LicensePlateAccountFactory,
  LicensePlateCommitmentVerifier,
  VehicleRegistry,
} from "../typechain-types";

describe("LicensePlateAccountFactory", function () {
  let factory: LicensePlateAccountFactory;
  let registry: VehicleRegistry;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let entryPoint: string;

  const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  /**
   * テストごとに実行されるセットアップ関数
   */
  beforeEach(async function () {
    // アカウントの取得
    [owner, user] = await ethers.getSigners();
    entryPoint = ENTRYPOINT_ADDRESS;

    // LicensePlateAccountFactoryをデプロイ
    const LicensePlateAccountFactory = await ethers.getContractFactory(
      "LicensePlateAccountFactory",
    );
    factory = (await LicensePlateAccountFactory.deploy(
      entryPoint,
    )) as unknown as LicensePlateAccountFactory;
    await factory.waitForDeployment();

    // VehicleRegistryをデプロイ
    const VehicleRegistry = await ethers.getContractFactory("VehicleRegistry");
    registry = (await VehicleRegistry.deploy()) as unknown as VehicleRegistry;
    await registry.waitForDeployment();
  });

  describe("デプロイ", function () {
    it("正常にデプロイされること", async function () {
      expect(factory.target).to.be.properAddress;
    });

    it("正しいEntryPointを持っていること", async function () {
      const accountImpl = await factory.accountImplementation();
      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        accountImpl,
      );
      expect(await account.entryPoint()).to.equal(entryPoint);
    });

    it("初期状態ではZK証明が不要であること", async function () {
      expect(await factory.zkProofRequired()).to.equal(false);
    });
  });

  describe("ナンバープレートコミットメント", function () {
    // 日本のナンバープレートの例(実際にはカメラで読み取って渡す想定)
    const plateNumber = "品川330あ1234";
    let userSalt: string;
    let commitment: string;

    beforeEach(async function () {
      // ソルトを生成（本番環境では、これは暗号学的に安全である必要があります）
      userSalt = ethers.id("user-secret-entropy");

      // コミットメントを計算（これは本番環境ではオフチェーンで行われるべきです）
      commitment = await factory.computePlateCommitment(plateNumber, userSalt);
    });

    it("一貫したコミットメントを計算すること", async function () {
      const commitment2 = await factory.computePlateCommitment(
        plateNumber,
        userSalt,
      );
      expect(commitment).to.equal(commitment2);
    });

    it("異なるソルトに対して異なるコミットメントを計算すること", async function () {
      const differentSalt = ethers.id("different-secret");
      const commitment2 = await factory.computePlateCommitment(
        plateNumber,
        differentSalt,
      );
      expect(commitment).to.not.equal(commitment2);
    });

    it("異なるナンバープレートに対して異なるコミットメントを計算すること", async function () {
      const differentPlate = "横浜501さ5678";
      const commitment2 = await factory.computePlateCommitment(
        differentPlate,
        userSalt,
      );
      expect(commitment).to.not.equal(commitment2);
    });
  });

  describe("アカウント作成", function () {
    const plateNumber = "品川330あ1234";
    let userSalt: string;
    let commitment: string;
    let deploymentSalt: number;

    beforeEach(async function () {
      userSalt = ethers.id("user-secret");
      commitment = await factory.computePlateCommitment(plateNumber, userSalt);
      deploymentSalt = 12345;
    });

    it("ナンバープレートのコミットメントからアカウントを作成すること", async function () {
      // アカウント作成
      const tx = await factory.createAccountFromPlate(
        user.address,
        commitment,
        deploymentSalt,
        "0x", // 証明なし (ZK不要)
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // アカウントが作成されたことを確認(ナンバープレートからアドレスを予測)
      const predictedAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        deploymentSalt,
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        predictedAddress,
      );

      expect(await account.owner()).to.equal(user.address);
      expect(await account.vehicleCommitment()).to.equal(commitment);
    });

    it("デプロイ前に正しいアドレスを予測すること", async function () {
      const predictedAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        deploymentSalt,
      );

      await factory.createAccountFromPlate(
        user.address,
        commitment,
        deploymentSalt,
        "0x",
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        predictedAddress,
      );

      expect(await account.getAddress()).to.equal(predictedAddress);
    });

    it("2回目の呼び出しで既存のアカウントを返すこと", async function () {
      const tx1 = await factory.createAccountFromPlate(
        user.address,
        commitment,
        deploymentSalt,
        "0x",
      );
      await tx1.wait();

      const tx2 = await factory.createAccountFromPlate(
        user.address,
        commitment,
        deploymentSalt,
        "0x",
      );
      await tx2.wait();

      // 失敗せず、既存のアカウントを返すはずです
      const predictedAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        deploymentSalt,
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        predictedAddress,
      );

      expect(await account.owner()).to.equal(user.address);
    });

    it("異なるソルトに対して異なるアカウントを作成すること", async function () {
      const salt1 = 11111;
      const salt2 = 22222;

      await factory.createAccountFromPlate(
        user.address,
        commitment,
        salt1,
        "0x",
      );

      await factory.createAccountFromPlate(
        user.address,
        commitment,
        salt2,
        "0x",
      );

      const address1 = await factory.getAddressFromPlate(
        user.address,
        commitment,
        salt1,
      );
      const address2 = await factory.getAddressFromPlate(
        user.address,
        commitment,
        salt2,
      );

      expect(address1).to.not.equal(address2);
    });
  });

  describe("プライバシー保護", function () {
    const plateNumber = "品川330あ1234";
    let userSalt: string;
    let commitment: string;

    beforeEach(async function () {
      userSalt = ethers.id("user-secret");
      commitment = await factory.computePlateCommitment(plateNumber, userSalt);

      await factory.createAccountFromPlate(
        user.address,
        commitment,
        12345,
        "0x",
      );
    });

    it("ストレージ内でナンバープレート番号を公開しないこと", async function () {
      const accountAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        12345,
      );

      // 最初の20個のストレージスロットを確認
      for (let i = 0; i < 20; i++) {
        const storage = await ethers.provider.getStorage(accountAddress, i);
        const plateBytes = ethers.toUtf8Bytes(plateNumber);
        const plateHex = ethers.hexlify(plateBytes);

        // ストレージには生のナンバープレート番号が含まれていてはならない
        expect(storage.toLowerCase()).to.not.include(
          plateHex.slice(2).toLowerCase(),
        );
      }
    });

    it("正しいプリイメージで所有権を検証すること", async function () {
      const accountAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        12345,
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        accountAddress,
      );

      const isValid = await account.verifyVehicleOwnership(
        plateNumber,
        userSalt,
      );
      expect(isValid).to.be.true;
    });

    it("間違ったナンバープレート番号を拒否すること", async function () {
      const accountAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        12345,
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        accountAddress,
      );

      const isValid = await account.verifyVehicleOwnership(
        "横浜501さ5678", // 間違ったプレート
        userSalt,
      );
      expect(isValid).to.be.false;
    });

    it("間違ったソルトを拒否すること", async function () {
      const accountAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        12345,
      );

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        accountAddress,
      );

      const wrongSalt = ethers.id("wrong-secret");
      const isValid = await account.verifyVehicleOwnership(
        plateNumber,
        wrongSalt,
      );
      expect(isValid).to.be.false;
    });
  });

  describe("ZK証明統合", function () {
    let verifier: LicensePlateCommitmentVerifier;

    beforeEach(async function () {
      // ZK検証器コントラクトをデプロイ
      const LicensePlateCommitmentVerifier = await ethers.getContractFactory(
        "LicensePlateCommitmentVerifier",
      );
      verifier =
        (await LicensePlateCommitmentVerifier.deploy()) as unknown as LicensePlateCommitmentVerifier;
      await verifier.waitForDeployment();
    });

    it("ZK証明要件の有効化を許可すること", async function () {
      await factory.setZKProofRequired(true);
      expect(await factory.zkProofRequired()).to.be.true;
    });

    it("ZK検証器の設定を許可すること", async function () {
      const verifierAddress = await verifier.getAddress();
      await factory.setZKVerifier(verifierAddress);
      expect(await factory.zkVerifier()).to.equal(verifierAddress);
    });

    it("ZKが有効な場合、証明が必要であること", async function () {
      await factory.setZKProofRequired(true);
      await factory.setZKVerifier(await verifier.getAddress());

      const userSalt = ethers.id("user-secret");
      const commitment = await factory.computePlateCommitment(
        "品川330あ1234",
        userSalt,
      );

      // 空の証明は失敗するはずです
      await expect(
        factory.createAccountFromPlate(user.address, commitment, 12345, "0x"),
      ).to.be.revertedWith("LicensePlateAccountFactory: proof required");
    });

    it("ZKが有効な場合、検証器が設定されている必要があること", async function () {
      await factory.setZKProofRequired(true);

      const userSalt = ethers.id("user-secret");
      const commitment = await factory.computePlateCommitment(
        "品川330あ1234",
        userSalt,
      );

      // モック証明データ（検証には失敗しますが、まずは検証器をチェックするはずです）
      const mockProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint[2]", "uint[2][2]", "uint[2]"],
        [
          [1, 2],
          [
            [3, 4],
            [5, 6],
          ],
          [7, 8],
        ],
      );

      // 検証器が設定されていないため失敗するはずです
      await expect(
        factory.createAccountFromPlate(
          user.address,
          commitment,
          12345,
          mockProof,
        ),
      ).to.be.revertedWith("LicensePlateAccountFactory: ZK verifier not set");
    });

    it("無効なZK証明を拒否すること", async function () {
      await factory.setZKProofRequired(true);
      await factory.setZKVerifier(await verifier.getAddress());

      const userSalt = ethers.id("user-secret");
      const commitment = await factory.computePlateCommitment(
        "品川330あ1234",
        userSalt,
      );

      // 無効な証明（ランダム値）
      const invalidProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint[2]", "uint[2][2]", "uint[2]"],
        [
          [1, 2],
          [
            [3, 4],
            [5, 6],
          ],
          [7, 8],
        ],
      );

      // 検証に失敗するはずです（検証器は最初にスカラーフィールドの範囲をチェックします）
      await expect(
        factory.createAccountFromPlate(
          user.address,
          commitment,
          12345,
          invalidProof,
        ),
      ).to.be.reverted; // 様々な検証器エラーメッセージで失敗する可能性があります
    });

    it("不要な場合はZKなしで動作すること", async function () {
      // ZK証明不要（デフォルト）
      expect(await factory.zkProofRequired()).to.be.false;

      const userSalt = ethers.id("user-secret");
      const commitment = await factory.computePlateCommitment(
        "品川330あ1234",
        userSalt,
      );

      // 証明なしで成功するはずです
      const tx = await factory.createAccountFromPlate(
        user.address,
        commitment,
        12345,
        "0x",
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
    });
  });

  describe("バッチ操作", function () {
    it("バッチで複数のアカウントを作成すること", async function () {
      const owners = [user.address, owner.address];
      const commitments = [
        await factory.computePlateCommitment(
          "品川330あ1234",
          ethers.id("salt1"),
        ),
        await factory.computePlateCommitment(
          "横浜501さ5678",
          ethers.id("salt2"),
        ),
      ];
      const salts = [11111, 22222];
      const proofs: string[] = [];

      const tx = await factory.createAccountsFromPlatesBatch(
        owners,
        commitments,
        salts,
        proofs,
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // 両方のアカウントが存在することを確認
      const address1 = await factory.getAddressFromPlate(
        owners[0],
        commitments[0],
        salts[0],
      );
      const address2 = await factory.getAddressFromPlate(
        owners[1],
        commitments[1],
        salts[1],
      );

      const account1 = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        address1,
      );
      const account2 = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        address2,
      );

      expect(await account1.owner()).to.equal(owners[0]);
      expect(await account2.owner()).to.equal(owners[1]);
    });
  });

  describe("市場価値トークンシナリオ", function () {
    let mockToken: MockERC20;
    const plateNumber = "品川330あ1234";
    const userSalt = ethers.id("user-secret");
    const deploymentSalt = 12345;
    let commitment: string;
    let accountAddress: string;

    beforeEach(async function () {
      // MockERC20をデプロイ
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = (await MockERC20.deploy(
        "CarValueToken",
        "CVT",
      )) as unknown as MockERC20;
      await mockToken.waitForDeployment();

      // ナンバープレートコミットメントを計算
      commitment = await factory.computePlateCommitment(plateNumber, userSalt);
    });

    it("アカウント作成時に市場価値分のトークンを発行し、その後送金できること", async function () {
      // 1. 本人確認済みの車両アカウントを作成
      const createTx = await factory.createAccountFromPlate(
        user.address,
        commitment,
        deploymentSalt,
        "0x",
      );
      await createTx.wait();

      accountAddress = await factory.getAddressFromPlate(
        user.address,
        commitment,
        deploymentSalt,
      );

      // 2. 市場価値を取得（モック実装: 例えば1000 CVT）
      const marketValue = ethers.parseEther("1000");

      // 3. 車両アカウントに対して市場価値分のトークンをミント
      await mockToken.mint(accountAddress, marketValue);

      // 残高確認
      expect(await mockToken.balanceOf(accountAddress)).to.equal(marketValue);

      // 4. 車両アカウントから所有者へトークンを送金
      const accountContract = (await ethers.getContractAt(
        "PrivacyProtectedAccount",
        accountAddress,
      )) as unknown as PrivacyProtectedAccount;

      // 送金データを作成 (ERC20 transfer)
      // ownerに送金するが、10だけ残しておく
      const transferData = mockToken.interface.encodeFunctionData("transfer", [
        owner.address,
        marketValue - 10n,
      ]);

      // アカウントを通じて送金を実行 (ユーザーが署名して実行する想定)
      // 注意: userはアカウントのownerなので実行権限がある
      const executeTx = await accountContract
        .connect(user)
        .execute(await mockToken.getAddress(), 0, transferData);
      await executeTx.wait();

      // 5. 最終的な残高を確認
      expect(await mockToken.balanceOf(accountAddress)).to.equal(10n);
      expect(await mockToken.balanceOf(owner.address)).to.equal(
        marketValue - 10n,
      );
    });
  });
});
