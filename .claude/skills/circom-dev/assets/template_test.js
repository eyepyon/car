const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
const fs = require("fs");
const path = require("path");

/**
 * Test template for circom circuits
 *
 * This template demonstrates:
 * 1. Computing witness
 * 2. Generating proof
 * 3. Verifying proof
 */

async function testCircuit() {
  console.log("Starting circuit test...\n");

  // Configuration
  const circuitName = "your_circuit_name"; // TODO: Update circuit name
  const buildDir = path.join(__dirname, "../build");
  const wasmPath = path.join(
    buildDir,
    `${circuitName}_js`,
    `${circuitName}.wasm`,
  );
  const zkeyPath = path.join(buildDir, "zkey", `${circuitName}.zkey`);
  const vkeyPath = path.join(buildDir, "zkey", "verification_key.json");

  try {
    // Step 1: Prepare inputs
    const input = {
      // TODO: Add your circuit inputs
      in: 10,
    };
    console.log("Input:", JSON.stringify(input, null, 2));

    // Step 2: Calculate witness and generate proof
    console.log("\nGenerating proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath,
    );
    console.log("✓ Proof generated successfully");
    console.log("Public signals:", publicSignals);

    // Optional: Save proof and public signals
    fs.writeFileSync(
      path.join(buildDir, "proof.json"),
      JSON.stringify(proof, null, 2),
    );
    fs.writeFileSync(
      path.join(buildDir, "public.json"),
      JSON.stringify(publicSignals, null, 2),
    );

    // Step 3: Verify proof
    console.log("\nVerifying proof...");
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (isValid) {
      console.log("✓ Proof verification SUCCESSFUL");
      return true;
    } else {
      console.error("✗ Proof verification FAILED");
      return false;
    }
  } catch (error) {
    console.error("Error during test:", error);
    throw error;
  }
}

// Helper function: Calculate hash using Poseidon (example)
async function calculatePoseidonHash(input) {
  const poseidon = await circomlibjs.buildPoseidon();
  const hash = poseidon.F.toString(poseidon([input]));
  return hash;
}

// Run test
if (require.main === module) {
  testCircuit()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { testCircuit, calculatePoseidonHash };
