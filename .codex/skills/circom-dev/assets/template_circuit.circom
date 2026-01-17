pragma circom 2.0.0;

// Import common circomlib components as needed
// include "node_modules/circomlib/circuits/poseidon.circom";
// include "node_modules/circomlib/circuits/comparators.circom";

/**
 * TODO: Add circuit description
 *
 * Inputs:
 *   - TODO: Describe inputs
 *
 * Outputs:
 *   - TODO: Describe outputs
 *
 * Constraints:
 *   - TODO: Describe key constraints
 */
template YourCircuitName() {
    // Define signals
    signal input in;
    signal output out;

    // TODO: Add your circuit logic here
    // Example: Basic constraint
    // out <== in * in;

    // Example: Using a component
    // component hasher = Poseidon(1);
    // hasher.inputs[0] <== in;
    // out <== hasher.out;
}

// Specify public inputs in curly braces if needed
// component main {public [publicInput]} = YourCircuitName();
component main = YourCircuitName();
