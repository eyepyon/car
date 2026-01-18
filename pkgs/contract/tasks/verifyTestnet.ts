import * as fs from "fs";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";

task("verifyTestnet", "Verify vehicle wallet on testnet").setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer address:", deployer.address);

    // Load deployed addresses
    const deploymentsDir = path.join(__dirname, "../ignition/deployments/chain-84532");
    const addressesPath = path.join(deploymentsDir, "deployed_addresses.json");

    if (!fs.existsSync(addressesPath)) {
      throw new Error(`Deployment addresses not found at ${addressesPath}`);
    }

    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    const factoryAddress = addresses["LicensePlateAccountFactoryModule#LicensePlateAccountFactory"];
    console.log("Factory Address:", factoryAddress);

    const factory = await hre.ethers.getContractAt("LicensePlateAccountFactory", factoryAddress);

    // 1. Create/Get Vehicle Wallet
    const plateNumber = "TEST-PLATE-TASK-1234";
    const userSalt = hre.ethers.id("test-salt-task-testnet");
    const deploymentSalt = BigInt(Math.floor(Math.random() * 100000));

    const commitment = await factory.computePlateCommitment(plateNumber, userSalt);
    console.log("Plate Commitment:", commitment);

    const predictedAddress = await factory.getAddressFromPlate(deployer.address, commitment, deploymentSalt);
    console.log("Predicted Wallet Address:", predictedAddress);

    console.log("Creating/Getting account...");
    const createTx = await factory.createAccountFromPlate(deployer.address, commitment, deploymentSalt, "0x");
    await createTx.wait();
    console.log("Account created/ready at:", predictedAddress);

    // 2. Deploy MockERC20
    console.log("Deploying MockERC20...");
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("CarValueTokenTask", "CVTT");
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log("MockERC20 deployed at:", mockTokenAddress);

    // 3. Mint tokens to Vehicle Wallet
    const marketValue = hre.ethers.parseEther("777");
    console.log(`Minting ${hre.ethers.formatEther(marketValue)} CVTT to wallet...`);
    const mintTx = await mockToken.mint(predictedAddress, marketValue);
    await mintTx.wait();

    const balance = await mockToken.balanceOf(predictedAddress);
    console.log("Wallet Balance:", hre.ethers.formatEther(balance), "CVTT");

    // 4. Execute transfer via Vehicle Wallet
    const transferAmount = hre.ethers.parseEther("770");
    console.log(`Transferring ${hre.ethers.formatEther(transferAmount)} CVTT from wallet to deployer...`);

    const accountContract = await hre.ethers.getContractAt("PrivacyProtectedAccount", predictedAddress);
    const transferData = mockToken.interface.encodeFunctionData("transfer", [deployer.address, transferAmount]);

    // execute(dest, value, func)
    const executeTx = await accountContract.execute(mockTokenAddress, 0n, transferData);
    const receipt = await executeTx.wait();
    console.log("Execute Transaction Hash:", receipt?.hash);

    // 5. Final verification
    const finalWalletBalance = await mockToken.balanceOf(predictedAddress);
    const finalDeployerBalance = await mockToken.balanceOf(deployer.address);

    console.log("--- Final Results ---");
    console.log("Final Wallet Balance:", hre.ethers.formatEther(finalWalletBalance), "CVTT");
    console.log("Final Deployer Balance:", hre.ethers.formatEther(finalDeployerBalance), "CVTT");
    console.log("Verification Successful via Task!");
  }
);
