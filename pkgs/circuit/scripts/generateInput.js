const circomlibjs = require("circomlibjs");

/**
 * Generate input data for the circuit
 */
const main = async () => {
  const input = "serverless";
  const poseidon = await circomlibjs.buildPoseidon();

  // Convert string to bytes and then to BigInt array
  const inputBytes = Buffer.from(input, "utf8");
  const inputNumber = BigInt(`0x${inputBytes.toString("hex")}`);

  const hash = poseidon.F.toString(poseidon([inputNumber]));

  console.log("InputData:", {
    input: input,
    inputNumber: inputNumber.toString(),
    hash: hash,
  });
};

main();
