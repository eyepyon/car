import { expect } from "chai";
import { ethers } from "hardhat";
import { VehicleRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VehicleRegistry", function () {
  let registry: VehicleRegistry;
  let owner: SignerWithAddress;
  let wallet1: SignerWithAddress;
  let wallet2: SignerWithAddress;
  let verifier: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const plateNumber1 = "ABC-1234";
  const plateNumber2 = "XYZ-9999";
  const userSalt = ethers.id("user-secret-salt");
  let commitment1: string;
  let commitment2: string;
  let metadataHash: string;

  beforeEach(async function () {
    [owner, wallet1, wallet2, verifier, unauthorized] =
      await ethers.getSigners();

    // Deploy registry
    const VehicleRegistry = await ethers.getContractFactory("VehicleRegistry");
    registry = await VehicleRegistry.deploy();

    // Compute commitments off-chain
    commitment1 = ethers.keccak256(
      ethers.solidityPacked(["string", "bytes32"], [plateNumber1, userSalt]),
    );
    commitment2 = ethers.keccak256(
      ethers.solidityPacked(["string", "bytes32"], [plateNumber2, userSalt]),
    );
    metadataHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        JSON.stringify({ model: "Tesla Model 3", year: 2024 }),
      ),
    );

    // Authorize verifier
    await registry.setVerifierAuthorization(verifier.address, true);
  });

  describe("Vehicle Registration", function () {
    it("should register vehicle with commitment", async function () {
      await expect(
        registry
          .connect(wallet1)
          .registerVehicle(commitment1, wallet1.address, metadataHash),
      )
        .to.emit(registry, "VehicleRegistered")
        .withArgs(
          commitment1,
          wallet1.address,
          await ethers.provider
            .getBlock("latest")
            .then((b) => b!.timestamp + 1),
        );
    });

    it("should not allow zero commitment", async function () {
      await expect(
        registry
          .connect(wallet1)
          .registerVehicle(ethers.ZeroHash, wallet1.address, metadataHash),
      ).to.be.revertedWith("VehicleRegistry: invalid commitment");
    });

    it("should not allow zero wallet address", async function () {
      await expect(
        registry
          .connect(wallet1)
          .registerVehicle(commitment1, ethers.ZeroAddress, metadataHash),
      ).to.be.revertedWith("VehicleRegistry: invalid wallet");
    });

    it("should not allow duplicate commitment registration", async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);

      await expect(
        registry
          .connect(wallet2)
          .registerVehicle(commitment1, wallet2.address, metadataHash),
      ).to.be.revertedWith("VehicleRegistry: already registered");
    });

    it("should not allow wallet to register multiple vehicles", async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);

      await expect(
        registry
          .connect(wallet1)
          .registerVehicle(commitment2, wallet1.address, metadataHash),
      ).to.be.revertedWith("VehicleRegistry: wallet already linked");
    });
  });

  describe("Vehicle Record Retrieval", function () {
    beforeEach(async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);
    });

    it("should allow verifier to get vehicle record", async function () {
      const record = await registry
        .connect(verifier)
        .getVehicleRecord(commitment1);

      expect(record.commitment).to.equal(commitment1);
      expect(record.walletAddress).to.equal(wallet1.address);
      expect(record.isActive).to.be.true;
      expect(record.metadataHash).to.equal(metadataHash);
    });

    it("should not allow unauthorized to get vehicle record", async function () {
      await expect(
        registry.connect(unauthorized).getVehicleRecord(commitment1),
      ).to.be.revertedWith("VehicleRegistry: not authorized verifier");
    });

    it("should get commitment by wallet address", async function () {
      const commitment = await registry
        .connect(wallet1)
        .getCommitmentByWallet(wallet1.address);
      expect(commitment).to.equal(commitment1);
    });

    it("should allow verifier to get commitment by wallet", async function () {
      const commitment = await registry
        .connect(verifier)
        .getCommitmentByWallet(wallet1.address);
      expect(commitment).to.equal(commitment1);
    });
  });

  describe("Vehicle Commitment Update", function () {
    beforeEach(async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);
    });

    it("should allow owner to update commitment", async function () {
      await expect(
        registry
          .connect(wallet1)
          .updateVehicleCommitment(commitment1, commitment2),
      )
        .to.emit(registry, "VehicleUpdated")
        .withArgs(commitment1, commitment2, wallet1.address);

      // Old commitment should be inactive
      const oldRecord = await registry
        .connect(verifier)
        .getVehicleRecord(commitment1);
      expect(oldRecord.isActive).to.be.false;

      // New commitment should be active
      const newRecord = await registry
        .connect(verifier)
        .getVehicleRecord(commitment2);
      expect(newRecord.isActive).to.be.true;
      expect(newRecord.walletAddress).to.equal(wallet1.address);
    });

    it("should not allow non-owner to update commitment", async function () {
      await expect(
        registry
          .connect(wallet2)
          .updateVehicleCommitment(commitment1, commitment2),
      ).to.be.revertedWith("VehicleRegistry: not vehicle owner");
    });

    it("should not allow update to existing commitment", async function () {
      // Register second vehicle first
      await registry
        .connect(wallet2)
        .registerVehicle(commitment2, wallet2.address, metadataHash);

      await expect(
        registry
          .connect(wallet1)
          .updateVehicleCommitment(commitment1, commitment2),
      ).to.be.revertedWith("VehicleRegistry: new commitment already exists");
    });
  });

  describe("Vehicle Deactivation", function () {
    beforeEach(async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);
    });

    it("should allow owner to deactivate vehicle", async function () {
      await expect(registry.connect(wallet1).deactivateVehicle(commitment1))
        .to.emit(registry, "VehicleDeactivated")
        .withArgs(commitment1, wallet1.address);

      const record = await registry
        .connect(verifier)
        .getVehicleRecord(commitment1);
      expect(record.isActive).to.be.false;

      // Wallet mapping should be cleared
      const walletCommitment = await registry
        .connect(wallet1)
        .getCommitmentByWallet(wallet1.address);
      expect(walletCommitment).to.equal(ethers.ZeroHash);
    });

    it("should not allow non-owner to deactivate vehicle", async function () {
      await expect(
        registry.connect(wallet2).deactivateVehicle(commitment1),
      ).to.be.revertedWith("VehicleRegistry: not vehicle owner");
    });

    it("should not allow double deactivation", async function () {
      await registry.connect(wallet1).deactivateVehicle(commitment1);

      await expect(
        registry.connect(wallet1).deactivateVehicle(commitment1),
      ).to.be.revertedWith("VehicleRegistry: already inactive");
    });
  });

  describe("Verification", function () {
    beforeEach(async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);
    });

    it("should verify active vehicle registration", async function () {
      const isRegistered = await registry
        .connect(verifier)
        .verifyVehicleRegistration(commitment1);
      expect(isRegistered).to.be.true;
    });

    it("should not verify inactive vehicle", async function () {
      await registry.connect(wallet1).deactivateVehicle(commitment1);

      const isRegistered = await registry
        .connect(verifier)
        .verifyVehicleRegistration(commitment1);
      expect(isRegistered).to.be.false;
    });

    it("should verify ownership correctly", async function () {
      const isValid = await registry
        .connect(verifier)
        .verifyOwnership(commitment1, wallet1.address);
      expect(isValid).to.be.true;
    });

    it("should reject invalid ownership claims", async function () {
      const isValid = await registry
        .connect(verifier)
        .verifyOwnership(commitment1, wallet2.address);
      expect(isValid).to.be.false;
    });

    it("should not allow unauthorized verification", async function () {
      await expect(
        registry.connect(unauthorized).verifyVehicleRegistration(commitment1),
      ).to.be.revertedWith("VehicleRegistry: not authorized verifier");
    });
  });

  describe("Verifier Authorization", function () {
    it("should allow owner to authorize verifier", async function () {
      await expect(
        registry.setVerifierAuthorization(unauthorized.address, true),
      )
        .to.emit(registry, "VerifierAuthorized")
        .withArgs(unauthorized.address, true);

      expect(await registry.authorizedVerifiers(unauthorized.address)).to.be
        .true;
    });

    it("should allow owner to revoke verifier", async function () {
      await expect(registry.setVerifierAuthorization(verifier.address, false))
        .to.emit(registry, "VerifierAuthorized")
        .withArgs(verifier.address, false);

      expect(await registry.authorizedVerifiers(verifier.address)).to.be.false;
    });

    it("should not allow non-owner to authorize verifier", async function () {
      await expect(
        registry
          .connect(unauthorized)
          .setVerifierAuthorization(unauthorized.address, true),
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("Metadata Management", function () {
    beforeEach(async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);
    });

    it("should allow owner to update metadata", async function () {
      const newMetadataHash = ethers.keccak256(
        ethers.toUtf8Bytes(
          JSON.stringify({ model: "Tesla Model S", year: 2025 }),
        ),
      );

      await registry
        .connect(wallet1)
        .updateMetadata(commitment1, newMetadataHash);

      const record = await registry
        .connect(verifier)
        .getVehicleRecord(commitment1);
      expect(record.metadataHash).to.equal(newMetadataHash);
    });

    it("should not allow non-owner to update metadata", async function () {
      const newMetadataHash = ethers.keccak256(
        ethers.toUtf8Bytes("new metadata"),
      );

      await expect(
        registry.connect(wallet2).updateMetadata(commitment1, newMetadataHash),
      ).to.be.revertedWith("VehicleRegistry: not vehicle owner");
    });
  });

  describe("Batch Operations", function () {
    it("should register multiple vehicles in batch", async function () {
      const commitments = [commitment1, commitment2];
      const wallets = [wallet1.address, wallet2.address];
      const metadatas = [metadataHash, metadataHash];

      await registry.registerVehicleBatch(commitments, wallets, metadatas);

      const record1 = await registry
        .connect(verifier)
        .getVehicleRecord(commitment1);
      const record2 = await registry
        .connect(verifier)
        .getVehicleRecord(commitment2);

      expect(record1.walletAddress).to.equal(wallet1.address);
      expect(record2.walletAddress).to.equal(wallet2.address);
    });

    it("should revert batch registration with mismatched arrays", async function () {
      const commitments = [commitment1];
      const wallets = [wallet1.address, wallet2.address];
      const metadatas = [metadataHash];

      await expect(
        registry.registerVehicleBatch(commitments, wallets, metadatas),
      ).to.be.revertedWith("VehicleRegistry: array length mismatch");
    });
  });

  describe("Privacy Guarantees", function () {
    it("should not store raw plate number", async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);

      // Verify storage doesn't contain raw plate number
      const storageSlots = 20;
      for (let i = 0; i < storageSlots; i++) {
        const storage = await ethers.provider.getStorage(
          await registry.getAddress(),
          i,
        );
        expect(storage).to.not.include(
          ethers.hexlify(ethers.toUtf8Bytes(plateNumber1)),
        );
      }
    });

    it("should only allow access through authorized interfaces", async function () {
      await registry
        .connect(wallet1)
        .registerVehicle(commitment1, wallet1.address, metadataHash);

      // Unauthorized users should not be able to query records
      await expect(
        registry.connect(unauthorized).getVehicleRecord(commitment1),
      ).to.be.revertedWith("VehicleRegistry: not authorized verifier");
    });
  });
});
