// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PasswordHashVerifierModule = buildModule("PasswordHashVerifierModule", (m) => {
  // First deploy the PasswordHashVerifier contract
  const passwordHashVerifier = m.contract("PasswordHashVerifier", []);

  return {
    passwordHashVerifier,
  };
});

export default PasswordHashVerifierModule;
