#!/bin/bash

# Circom Proof Key Setup Script
# Downloads ptau file and generates zkey for circuit

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
R1CS_FILE=""
OUTPUT_DIR="build/zkey"
PTAU_DIR="ptau"
CIRCUIT_SIZE=12  # Default: supports circuits up to 2^12 constraints

# Help message
show_help() {
    cat << EOF
Usage: ./setup_keys.sh <r1cs_file> [options]

Generate proving and verification keys for circom circuits.

Arguments:
    r1cs_file           Path to .r1cs file (required)

Options:
    -s, --size N        Circuit size (2^N constraints, default: 12)
    -o, --output DIR    Output directory (default: build/zkey)
    -p, --ptau DIR      ptau files directory (default: ptau)
    -h, --help         Show this help message

Examples:
    ./setup_keys.sh build/multiplier.r1cs
    ./setup_keys.sh build/hash.r1cs -s 14 -o ./keys

Note:
    - Larger circuits require larger ptau files
    - ptau files are downloaded from Hermez network (test use only)
    - For production, use a trusted setup ceremony
EOF
}

# Parse arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: R1CS file is required${NC}"
    show_help
    exit 1
fi

R1CS_FILE="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--size)
            CIRCUIT_SIZE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -p|--ptau)
            PTAU_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validate r1cs file
if [ ! -f "$R1CS_FILE" ]; then
    echo -e "${RED}Error: R1CS file not found: $R1CS_FILE${NC}"
    exit 1
fi

# Extract circuit name
CIRCUIT_NAME=$(basename "$R1CS_FILE" .r1cs)
PTAU_FILE="$PTAU_DIR/powersOfTau28_hez_final_${CIRCUIT_SIZE}.ptau"

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$PTAU_DIR"

echo -e "${GREEN}=== Setting up Proof Keys ===${NC}"
echo "Circuit:   $CIRCUIT_NAME"
echo "R1CS:      $R1CS_FILE"
echo "Size:      2^$CIRCUIT_SIZE constraints"
echo "Output:    $OUTPUT_DIR"
echo ""

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo -e "${RED}Error: snarkjs not found${NC}"
    echo "Install: npm install -g snarkjs"
    exit 1
fi

# Download ptau file if not exists
if [ ! -f "$PTAU_FILE" ]; then
    echo -e "${YELLOW}Downloading ptau file (this may take a while)...${NC}"
    PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${CIRCUIT_SIZE}.ptau"

    if command -v curl &> /dev/null; then
        curl -o "$PTAU_FILE" "$PTAU_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$PTAU_FILE" "$PTAU_URL"
    else
        echo -e "${RED}Error: curl or wget required to download ptau${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Downloaded ptau file${NC}"
else
    echo -e "${BLUE}Using existing ptau file: $PTAU_FILE${NC}"
fi

# Generate zkey (proving key)
echo -e "${YELLOW}Generating proving key...${NC}"
npx snarkjs groth16 setup "$R1CS_FILE" "$PTAU_FILE" "$OUTPUT_DIR/${CIRCUIT_NAME}.zkey"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to generate proving key${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Proving key generated${NC}"

# Export verification key
echo -e "${YELLOW}Exporting verification key...${NC}"
npx snarkjs zkey export verificationkey "$OUTPUT_DIR/${CIRCUIT_NAME}.zkey" "$OUTPUT_DIR/verification_key.json"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to export verification key${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Verification key exported${NC}"

# Optional: Export Solidity verifier
echo -e "${YELLOW}Generating Solidity verifier...${NC}"
npx snarkjs zkey export solidityverifier "$OUTPUT_DIR/${CIRCUIT_NAME}.zkey" "$OUTPUT_DIR/${CIRCUIT_NAME}_verifier.sol"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Solidity verifier generated${NC}"
else
    echo -e "${YELLOW}⚠ Solidity verifier generation skipped${NC}"
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo "Generated files:"
echo "  - $OUTPUT_DIR/${CIRCUIT_NAME}.zkey"
echo "  - $OUTPUT_DIR/verification_key.json"
echo "  - $OUTPUT_DIR/${CIRCUIT_NAME}_verifier.sol"
echo ""
echo -e "${BLUE}Next step: Run tests with these keys${NC}"
