import { expect } from "chai";
import { ethers } from "hardhat";
import { AccountFactory, PrivacyProtectedAccount } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccountFactory", function () {
  let factory: AccountFactory;
  let owner: SignerWithAddress;
  let entryPoint: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const plateNumber1 = "ABC-1234";
  const plateNumber2 = "XYZ-9999";
  const userSalt = ethers.id("user-secret-salt");

  beforeEach(async function () {
    [owner, entryPoint, user1, user2] = await ethers.getSigners();

    const AccountFactory = await ethers.getContractFactory("AccountFactory");
    factory = await AccountFactory.deploy(entryPoint.address);
  });

  describe("Deployment", function () {
    it("should deploy with correct implementation", async function () {
      const implementationAddress = await factory.accountImplementation();
      expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should set correct EntryPoint in implementation", async function () {
      const implementation = await factory.accountImplementation();
      const accountImpl = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        implementation,
      );
      expect(await accountImpl.entryPoint()).to.equal(entryPoint.address);
    });
  });

  describe("Deterministic Address Generation", function () {
    it("should generate deterministic addresses", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      const predictedAddress = await factory.getAddress(
        user1.address,
        commitment,
        salt,
      );

      await factory.createAccount(user1.address, commitment, salt);

      const account = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        predictedAddress,
      );

      expect(await account.owner()).to.equal(user1.address);
    });

    it("should generate same address for same parameters", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      const address1 = await factory.getAddress(
        user1.address,
        commitment,
        salt,
      );
      const address2 = await factory.getAddress(
        user1.address,
        commitment,
        salt,
      );

      expect(address1).to.equal(address2);
    });

    it("should generate different addresses for different parameters", async function () {
      const commitment1 = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const commitment2 = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber2, userSalt]),
      );
      const salt = 12345;

      const address1 = await factory.getAddress(
        user1.address,
        commitment1,
        salt,
      );
      const address2 = await factory.getAddress(
        user1.address,
        commitment2,
        salt,
      );

      expect(address1).to.not.equal(address2);
    });

    it("should generate different addresses for different salts", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );

      const address1 = await factory.getAddress(user1.address, commitment, 111);
      const address2 = await factory.getAddress(user1.address, commitment, 222);

      expect(address1).to.not.equal(address2);
    });
  });

  describe("Account Creation", function () {
    it("should create account with correct parameters", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      await expect(factory.createAccount(user1.address, commitment, salt))
        .to.emit(factory, "AccountCreated")
        .withArgs(
          await factory.getAddress(user1.address, commitment, salt),
          user1.address,
          commitment,
          salt,
        );
    });

    it("should return existing account if already created", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      const tx1 = await factory.createAccount(user1.address, commitment, salt);
      const receipt1 = await tx1.wait();

      // Create again with same parameters
      const tx2 = await factory.createAccount(user1.address, commitment, salt);
      const receipt2 = await tx2.wait();

      // Second creation should not emit event (account already exists)
      expect(receipt2?.logs.length).to.equal(0);
    });

    it("should create multiple accounts for different users", async function () {
      const commitment1 = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const commitment2 = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber2, userSalt]),
      );
      const salt = 12345;

      await factory.createAccount(user1.address, commitment1, salt);
      await factory.createAccount(user2.address, commitment2, salt);

      const address1 = await factory.getAddress(
        user1.address,
        commitment1,
        salt,
      );
      const address2 = await factory.getAddress(
        user2.address,
        commitment2,
        salt,
      );

      const account1 = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        address1,
      );
      const account2 = await ethers.getContractAt(
        "PrivacyProtectedAccount",
        address2,
      );

      expect(await account1.owner()).to.equal(user1.address);
      expect(await account2.owner()).to.equal(user2.address);
    });
  });

  describe("Privacy Features", function () {
    it("should compute vehicle commitment correctly", async function () {
      const commitment = await factory.computeVehicleCommitment(
        plateNumber1,
        userSalt,
      );

      const expectedCommitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );

      expect(commitment).to.equal(expectedCommitment);
    });

    it("should produce different commitments for different plate numbers", async function () {
      const commitment1 = await factory.computeVehicleCommitment(
        plateNumber1,
        userSalt,
      );
      const commitment2 = await factory.computeVehicleCommitment(
        plateNumber2,
        userSalt,
      );

      expect(commitment1).to.not.equal(commitment2);
    });

    it("should produce different commitments for different salts", async function () {
      const salt1 = ethers.id("salt1");
      const salt2 = ethers.id("salt2");

      const commitment1 = await factory.computeVehicleCommitment(
        plateNumber1,
        salt1,
      );
      const commitment2 = await factory.computeVehicleCommitment(
        plateNumber1,
        salt2,
      );

      expect(commitment1).to.not.equal(commitment2);
    });
  });

  describe("Batch Operations", function () {
    it("should create multiple accounts in batch", async function () {
      const owners = [user1.address, user2.address];
      const commitments = [
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "bytes32"],
            [plateNumber1, userSalt],
          ),
        ),
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "bytes32"],
            [plateNumber2, userSalt],
          ),
        ),
      ];
      const salts = [111, 222];

      const accounts = await factory.createAccountBatch.staticCall(
        owners,
        commitments,
        salts,
      );

      expect(accounts.length).to.equal(2);
      expect(accounts[0]).to.not.equal(accounts[1]);
    });

    it("should get addresses for batch", async function () {
      const owners = [user1.address, user2.address];
      const commitments = [
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "bytes32"],
            [plateNumber1, userSalt],
          ),
        ),
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "bytes32"],
            [plateNumber2, userSalt],
          ),
        ),
      ];
      const salts = [111, 222];

      const addresses = await factory.getAddressBatch(
        owners,
        commitments,
        salts,
      );

      expect(addresses.length).to.equal(2);
      expect(addresses[0]).to.equal(
        await factory.getAddress(owners[0], commitments[0], salts[0]),
      );
      expect(addresses[1]).to.equal(
        await factory.getAddress(owners[1], commitments[1], salts[1]),
      );
    });

    it("should revert batch operations with mismatched array lengths", async function () {
      const owners = [user1.address];
      const commitments = [
        ethers.keccak256(ethers.toUtf8Bytes("commitment1")),
        ethers.keccak256(ethers.toUtf8Bytes("commitment2")),
      ];
      const salts = [111];

      await expect(
        factory.createAccountBatch(owners, commitments, salts),
      ).to.be.revertedWith("AccountFactory: array length mismatch");

      await expect(
        factory.getAddressBatch(owners, commitments, salts),
      ).to.be.revertedWith("AccountFactory: array length mismatch");
    });
  });

  describe("Cross-chain Determinism", function () {
    it("should maintain determinism across deployments", async function () {
      // Deploy second factory
      const AccountFactory = await ethers.getContractFactory("AccountFactory");
      const factory2 = await AccountFactory.deploy(entryPoint.address);

      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      const address1 = await factory.getAddress(
        user1.address,
        commitment,
        salt,
      );
      const address2 = await factory2.getAddress(
        user1.address,
        commitment,
        salt,
      );

      // Addresses should be the same across different factory instances
      expect(address1).to.equal(address2);
    });
  });

  describe("Gas Efficiency", function () {
    it("should create account with reasonable gas", async function () {
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
      );
      const salt = 12345;

      const tx = await factory.createAccount(user1.address, commitment, salt);
      const receipt = await tx.wait();

      // Gas usage should be reasonable (< 500k gas)
      expect(receipt?.gasUsed).to.be.lt(500000);
    });
  });
});
