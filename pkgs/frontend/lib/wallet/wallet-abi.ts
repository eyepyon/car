export const LICENSE_PLATE_FACTORY_ABI = [
  {
    type: "function",
    name: "createAccountFromPlate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "vehicleCommitment", type: "bytes32" },
      { name: "salt", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
] as const;
