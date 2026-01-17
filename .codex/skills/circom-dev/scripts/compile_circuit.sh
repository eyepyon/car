#!/bin/bash

# Circom Circuit Compilation Script
# Compiles .circom files to WASM and R1CS formats

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
CIRCUIT_NAME=""
OUTPUT_DIR="build"
CIRCOM_FLAGS="--wasm --r1cs --sym --c"

# Help message
show_help() {
    cat << EOF
Usage: ./compile_circuit.sh <circuit_file> [options]

Compile circom circuits to WASM and R1CS formats.

Arguments:
    circuit_file        Path to .circom file (required)

Options:
    -o, --output DIR    Output directory (default: build)
    -h, --help         Show this help message

Examples:
    ./compile_circuit.sh circuits/multiplier.circom
    ./compile_circuit.sh circuits/hash.circom -o ./output

Output:
    - {circuit_name}.wasm    WebAssembly witness calculator
    - {circuit_name}.r1cs    Rank-1 Constraint System
    - {circuit_name}.sym     Symbol mapping file
EOF
}

# Parse arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Circuit file is required${NC}"
    show_help
    exit 1
fi

CIRCUIT_FILE="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            OUTPUT_DIR="$2"
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

# Validate circuit file
if [ ! -f "$CIRCUIT_FILE" ]; then
    echo -e "${RED}Error: Circuit file not found: $CIRCUIT_FILE${NC}"
    exit 1
fi

# Extract circuit name
CIRCUIT_NAME=$(basename "$CIRCUIT_FILE" .circom)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}=== Compiling Circom Circuit ===${NC}"
echo "Circuit: $CIRCUIT_FILE"
echo "Output:  $OUTPUT_DIR"
echo ""

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo -e "${RED}Error: circom not found${NC}"
    echo "Please install circom: https://docs.circom.io/getting-started/installation/"
    exit 1
fi

# Compile circuit
echo -e "${YELLOW}Compiling...${NC}"
circom "$CIRCUIT_FILE" $CIRCOM_FLAGS -o "$OUTPUT_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Compilation successful!${NC}"
    echo ""
    echo "Generated files:"
    echo "  - $OUTPUT_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
    echo "  - $OUTPUT_DIR/${CIRCUIT_NAME}.r1cs"
    echo "  - $OUTPUT_DIR/${CIRCUIT_NAME}.sym"

    # Show constraint count
    if [ -f "$OUTPUT_DIR/${CIRCUIT_NAME}.r1cs" ]; then
        echo ""
        echo -e "${YELLOW}Circuit statistics:${NC}"
        npx snarkjs r1cs info "$OUTPUT_DIR/${CIRCUIT_NAME}.r1cs" 2>/dev/null || echo "  (Install snarkjs to see statistics)"
    fi
else
    echo -e "${RED}✗ Compilation failed${NC}"
    exit 1
fi
