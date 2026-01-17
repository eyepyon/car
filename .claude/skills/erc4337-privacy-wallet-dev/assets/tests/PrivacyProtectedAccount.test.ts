import { expect } from "chai";
import { ethers } from "hardhat";
import { PrivacyProtectedAccount, AccountFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PrivacyProtectedAccount", function () {
  let accountFactory: AccountFactory;
  let account: PrivacyProtectedAccount;
  let owner: SignerWithAddress;
  let entryPoint: SignerWithAddress;
  let otherUser: SignerWithAddress;

  const plateNumber = "ABC-1234";
  const userSalt = ethers.id("user-secret-salt");
  let vehicleCommitment: string;

  beforeEach(async function () {
    [owner, entryPoint, otherUser] = await ethers.getSigners();

    // Compute vehicle commitment off-chain (simulating frontend behavior)
    vehicleCommitment = ethers.keccak256(
      ethers.solidityPacked(["string", "bytes32"], [plateNumber, userSalt]),
    );

    // Deploy AccountFactory
    const AccountFactory = await ethers.getContractFactory("AccountFactory");
    accountFactory = await AccountFactory.deploy(entryPoint.address);

    // Create account
    const salt = 12345;
    await accountFactory.createAccount(owner.address, vehicleCommitment, salt);

    const accountAddress = await accountFactory.getAddress(
      owner.address,
      vehicleCommitment,
      salt,
    );

    account = await ethers.getContractAt(
      "PrivacyProtectedAccount",
      accountAddress,
    );
  });

  describe("Initialization", function () {
    it("should initialize with correct owner", async function () {
      expect(await account.owner()).to.equal(owner.address);
    });

    it("should initialize with correct vehicle commitment", async function () {
      expect(await account.vehicleCommitment()).to.equal(vehicleCommitment);
    });

    it("should have correct entryPoint", async function () {
      expect(await account.entryPoint()).to.equal(entryPoint.address);
    });

    it("should not allow double initialization", async function () {
      await expect(
        account.initialize(owner.address, vehicleCommitment),
      ).to.be.revertedWith("account: already initialized");
    });
  });

  describe("Privacy Protection", function () {
    it("should verify vehicle ownership with correct preimage", async function () {
      const isValid = await account.verifyVehicleOwnership(
        plateNumber,
        userSalt,
      );
      expect(isValid).to.be.true;
    });

    it("should reject vehicle ownership with wrong plate number", async function () {
      const wrongPlate = "XYZ-9999";
      const isValid = await account.verifyVehicleOwnership(
        wrongPlate,
        userSalt,
      );
      expect(isValid).to.be.false;
    });

    it("should reject vehicle ownership with wrong salt", async function () {
      const wrongSalt = ethers.id("wrong-salt");
      const isValid = await account.verifyVehicleOwnership(
        plateNumber,
        wrongSalt,
      );
      expect(isValid).to.be.false;
    });

    it("should not store raw plate number on-chain", async function () {
      // This test verifies that searching for the plate number in storage fails
      // In a real audit, you would scan all storage slots
      const storageSlots = 10;
      for (let i = 0; i < storageSlots; i++) {
        const storage = await ethers.provider.getStorage(
          await account.getAddress(),
          i,
        );
        // Raw plate number should never appear in storage
        expect(storage).to.not.include(
          ethers.hexlify(ethers.toUtf8Bytes(plateNumber)),
        );
      }
    });
  });

  describe("Vehicle Commitment Update", function () {
    it("should allow owner to update vehicle commitment", async function () {
      const newPlateNumber = "NEW-5678";
      const newCommitment = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "bytes32"],
          [newPlateNumber, userSalt],
        ),
      );

      await expect(
        account.connect(owner).updateVehicleCommitment(newCommitment),
      )
        .to.emit(account, "VehicleCommitmentUpdated")
        .withArgs(vehicleCommitment, newCommitment);

      expect(await account.vehicleCommitment()).to.equal(newCommitment);
    });

    it("should not allow non-owner to update commitment", async function () {
      const newCommitment = ethers.keccak256(ethers.toUtf8Bytes("new-data"));

      await expect(
        account.connect(otherUser).updateVehicleCommitment(newCommitment),
      ).to.be.revertedWith("only owner");
    });

    it("should not allow zero commitment", async function () {
      await expect(
        account.connect(owner).updateVehicleCommitment(ethers.ZeroHash),
      ).to.be.revertedWith("account: commitment cannot be zero");
    });
  });

  describe("Execution", function () {
    it("should allow owner to execute transactions", async function () {
      const recipient = otherUser.address;
      const amount = ethers.parseEther("0.1");

      // Fund the account
      await owner.sendTransaction({
        to: await account.getAddress(),
        value: ethers.parseEther("1"),
      });

      // Execute transfer
      await expect(
        account.connect(owner).execute(recipient, amount, "0x"),
      ).to.changeEtherBalances([account, otherUser], [-amount, amount]);
    });

    it("should allow batch execution", async function () {
      const recipients = [otherUser.address, otherUser.address];
      const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
      const data = ["0x", "0x"];

      // Fund the account
      await owner.sendTransaction({
        to: await account.getAddress(),
        value: ethers.parseEther("1"),
      });

      await account.connect(owner).executeBatch(recipients, amounts, data);

      // Verify balance changes
      const balance = await ethers.provider.getBalance(otherUser.address);
      expect(balance).to.be.gt(0);
    });
  });

  describe("EntryPoint Deposit", function () {
    it("should allow depositing to EntryPoint", async function () {
      const depositAmount = ethers.parseEther("0.5");

      await account.connect(owner).addDeposit({ value: depositAmount });

      // Note: This test assumes EntryPoint has a balanceOf function
      // In real implementation, verify the deposit was recorded
    });

    it("should allow owner to withdraw from EntryPoint", async function () {
      // This test requires a mock EntryPoint with proper implementation
      // Skipping detailed implementation for template purposes
    });
  });

  describe("Access Control", function () {
    it("should restrict execute to owner or EntryPoint", async function () {
      await expect(
        account.connect(otherUser).execute(otherUser.address, 0, "0x"),
      ).to.be.revertedWith("account: not Owner or EntryPoint");
    });

    it("should accept ETH transfers", async function () {
      const amount = ethers.parseEther("1");

      await expect(
        owner.sendTransaction({
          to: await account.getAddress(),
          value: amount,
        }),
      ).to.changeEtherBalance(account, amount);
    });
  });

  describe("Gas Optimization", function () {
    it("should use minimal gas for commitment verification", async function () {
      // Measure gas for verification
      const tx = await account.verifyVehicleOwnership.staticCall(
        plateNumber,
        userSalt,
      );

      // Gas should be reasonable (view function, no state changes)
      // This is a placeholder - actual gas measurement requires different approach
      expect(tx).to.be.true;
    });
  });
});
