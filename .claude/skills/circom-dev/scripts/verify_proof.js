#!/usr/bin/env node

/**
 * Proof Verification Utility
 * Verifies a zero-knowledge proof against public signals
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function showHelp() {
  console.log(`
Usage: node verify_proof.js [options]

Verify a zero-knowledge proof against public signals.

Options:
    -p, --proof FILE        Proof JSON file (default: build/proof.json)
    -s, --signals FILE      Public signals JSON file (default: build/public.json)
    -v, --vkey FILE         Verification key JSON file (default: build/zkey/verification_key.json)
    -h, --help              Show this help message

Examples:
    node verify_proof.js
    node verify_proof.js -p proof.json -s public.json -v vkey.json
`);
}

async function verifyProof(proofFile, publicFile, vkeyFile) {
  try {
    console.log(`${colors.blue}=== Verifying Proof ===${colors.reset}`);
    console.log(`Proof:          ${proofFile}`);
    console.log(`Public signals: ${publicFile}`);
    console.log(`Verification:   ${vkeyFile}`);
    console.log("");

    // Check if files exist
    if (!fs.existsSync(proofFile)) {
      throw new Error(`Proof file not found: ${proofFile}`);
    }
    if (!fs.existsSync(publicFile)) {
      throw new Error(`Public signals file not found: ${publicFile}`);
    }
    if (!fs.existsSync(vkeyFile)) {
      throw new Error(`Verification key file not found: ${vkeyFile}`);
    }

    // Read files
    const proof = JSON.parse(fs.readFileSync(proofFile, "utf8"));
    const publicSignals = JSON.parse(fs.readFileSync(publicFile, "utf8"));
    const vKey = JSON.parse(fs.readFileSync(vkeyFile, "utf8"));

    console.log(
      `${colors.yellow}Public signals:${colors.reset}`,
      publicSignals,
    );
    console.log("");

    // Verify proof
    console.log(`${colors.yellow}Verifying...${colors.reset}`);
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    console.log("");
    if (isValid) {
      console.log(
        `${colors.green}✓ Proof verification SUCCESSFUL${colors.reset}`,
      );
      console.log("The proof is valid and correctly proves the statement.");
      return true;
    } else {
      console.log(`${colors.red}✗ Proof verification FAILED${colors.reset}`);
      console.log("The proof is invalid or does not match the public signals.");
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    throw error;
  }
}

// Parse command line arguments
function parseArgs(args) {
  const options = {
    proofFile: "build/proof.json",
    publicFile: "build/public.json",
    vkeyFile: "build/zkey/verification_key.json",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-p":
      case "--proof":
        options.proofFile = args[++i];
        break;
      case "-s":
      case "--signals":
        options.publicFile = args[++i];
        break;
      case "-v":
      case "--vkey":
        options.vkeyFile = args[++i];
        break;
      case "-h":
      case "--help":
        showHelp();
        process.exit(0);
      default:
        console.error(`${colors.red}Unknown option: ${args[i]}${colors.reset}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  verifyProof(options.proofFile, options.publicFile, options.vkeyFile)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Fatal error:${colors.reset}`, error);
      process.exit(1);
    });
}

module.exports = { verifyProof };
