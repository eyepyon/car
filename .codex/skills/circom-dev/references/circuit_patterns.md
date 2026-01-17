# Circom Circuit Implementation Patterns

This document provides common circuit patterns and implementation examples for typical zero-knowledge proof use cases.

## Table of Contents

1. [Authentication Patterns](#authentication-patterns)
2. [Merkle Tree Patterns](#merkle-tree-patterns)
3. [Range Proof Patterns](#range-proof-patterns)
4. [Voting Patterns](#voting-patterns)
5. [Privacy-Preserving Patterns](#privacy-preserving-patterns)

---

## Authentication Patterns

### Pattern 1: Password Authentication

Prove knowledge of a password without revealing it.

```circom
pragma circom 2.0.0;
include "node_modules/circomlib/circuits/poseidon.circom";

/**
 * Proves knowledge of password that hashes to a public hash
 *
 * Private: password
 * Public: passwordHash
 */
template PasswordAuth() {
    signal input password;        // Private
    signal input passwordHash;    // Public

    component hasher = Poseidon(1);
    hasher.inputs[0] <== password;

    // Constrain: hash(password) must equal passwordHash
    passwordHash === hasher.out;
}

component main {public [passwordHash]} = PasswordAuth();
```

**Use case:** Authenticate without exposing password to verifier.

**Test:**
```javascript
const password = 12345;
const poseidon = await circomlibjs.buildPoseidon();
const passwordHash = poseidon.F.toString(poseidon([password]));

const input = { password, passwordHash };
const witness = await circuit.calculateWitness(input);
```

### Pattern 2: Credential Verification

Prove possession of valid credentials.

```circom
template CredentialCheck() {
    signal input userID;           // Private
    signal input credential;       // Private
    signal input credentialHash;   // Public
    signal input minAge;           // Public
    signal input userAge;          // Private

    // Verify credential
    component hasher = Poseidon(2);
    hasher.inputs[0] <== userID;
    hasher.inputs[1] <== credential;
    credentialHash === hasher.out;

    // Verify age requirement
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== userAge;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;
}

component main {public [credentialHash, minAge]} = CredentialCheck();
```

---

## Merkle Tree Patterns

### Pattern 3: Membership Proof

Prove an element is in a Merkle tree without revealing which element.

```circom
pragma circom 2.0.0;
include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/mux1.circom";

template MerkleTreeInclusionProof(levels) {
    signal input leaf;
    signal input pathIndices[levels];
    signal input siblings[levels];
    signal input root;  // Public

    component hashers[levels];
    component mux[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Select hash order based on path
        mux[i] = Mux1();
        mux[i].c[0] <== hashes[i];
        mux[i].c[1] <== siblings[i];
        mux[i].s <== pathIndices[i];

        // Hash current level
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== pathIndices[i] ? hashes[i] : siblings[i];

        hashes[i + 1] <== hashers[i].out;
    }

    // Verify root matches
    root === hashes[levels];
}

component main {public [root]} = MerkleTreeInclusionProof(20);
```

**Use case:** Anonymous authentication, private set membership.

### Pattern 4: Merkle Tree Update

Prove correct update of a Merkle tree.

```circom
template MerkleTreeUpdate(levels) {
    signal input oldLeaf;
    signal input newLeaf;
    signal input pathIndices[levels];
    signal input siblings[levels];
    signal input oldRoot;  // Public
    signal input newRoot;  // Public

    // Verify old root
    component oldProof = MerkleTreeInclusionProof(levels);
    oldProof.leaf <== oldLeaf;
    oldProof.pathIndices <== pathIndices;
    oldProof.siblings <== siblings;
    oldProof.root === oldRoot;

    // Verify new root (same path, new leaf)
    component newProof = MerkleTreeInclusionProof(levels);
    newProof.leaf <== newLeaf;
    newProof.pathIndices <== pathIndices;
    newProof.siblings <== siblings;
    newProof.root === newRoot;
}

component main {public [oldRoot, newRoot]} = MerkleTreeUpdate(20);
```

---

## Range Proof Patterns

### Pattern 5: Value in Range

Prove a value is within a specific range.

```circom
pragma circom 2.0.0;
include "node_modules/circomlib/circuits/comparators.circom";

template RangeProof(bits) {
    signal input value;     // Private
    signal input min;       // Public
    signal input max;       // Public

    // value >= min
    component gte = GreaterEqThan(bits);
    gte.in[0] <== value;
    gte.in[1] <== min;
    gte.out === 1;

    // value <= max
    component lte = LessEqThan(bits);
    lte.in[0] <== value;
    lte.in[1] <== max;
    lte.out === 1;
}

component main {public [min, max]} = RangeProof(32);
```

**Use case:** Prove age > 18 without revealing exact age.

### Pattern 6: Balance Sufficiency

Prove sufficient balance without revealing exact amount.

```circom
template SufficientBalance() {
    signal input balance;           // Private
    signal input requiredAmount;    // Public
    signal input balanceCommitment; // Public

    // Verify balance commitment
    component hasher = Poseidon(1);
    hasher.inputs[0] <== balance;
    balanceCommitment === hasher.out;

    // Verify sufficient balance
    component check = GreaterEqThan(64);
    check.in[0] <== balance;
    check.in[1] <== requiredAmount;
    check.out === 1;
}

component main {public [requiredAmount, balanceCommitment]} = SufficientBalance();
```

---

## Voting Patterns

### Pattern 7: Anonymous Voting

Vote without revealing identity.

```circom
template AnonymousVote(voterCount) {
    signal input voterSecret;       // Private
    signal input voteChoice;        // Private (0 or 1)
    signal input voterCommitment;   // Public
    signal input eligibleVoters[voterCount];  // Public

    // Verify voter commitment
    component hasher = Poseidon(1);
    hasher.inputs[0] <== voterSecret;
    voterCommitment === hasher.out;

    // Verify voter is in eligible list
    component checks[voterCount];
    signal isEligible[voterCount + 1];
    isEligible[0] <== 0;

    for (var i = 0; i < voterCount; i++) {
        checks[i] = IsEqual();
        checks[i].in[0] <== voterCommitment;
        checks[i].in[1] <== eligibleVoters[i];
        isEligible[i + 1] <== isEligible[i] + checks[i].out;
    }

    // At least one match
    component eligible = IsZero();
    eligible.in <== isEligible[voterCount];
    eligible.out === 0;  // Not zero = eligible

    // Constrain vote to 0 or 1
    voteChoice * (1 - voteChoice) === 0;
}

component main {public [voterCommitment, eligibleVoters]} = AnonymousVote(100);
```

### Pattern 8: Weighted Voting

Vote with weight based on holdings.

```circom
template WeightedVote() {
    signal input holderSecret;      // Private
    signal input holdings;          // Private
    signal input voteChoice;        // Private
    signal input holderCommitment;  // Public
    signal input voteWeight;        // Public

    // Verify holder commitment
    component hasher = Poseidon(2);
    hasher.inputs[0] <== holderSecret;
    hasher.inputs[1] <== holdings;
    holderCommitment === hasher.out;

    // Verify vote weight matches holdings
    voteWeight === holdings;

    // Constrain vote to 0 or 1
    voteChoice * (1 - voteChoice) === 0;
}

component main {public [holderCommitment, voteWeight]} = WeightedVote();
```

---

## Privacy-Preserving Patterns

### Pattern 9: Private Transfer

Transfer funds without revealing sender, receiver, or amount.

```circom
template PrivateTransfer() {
    signal input senderSecret;
    signal input recipientSecret;
    signal input amount;
    signal input senderOldBalance;
    signal input recipientOldBalance;

    signal input senderOldCommitment;   // Public
    signal input recipientOldCommitment; // Public
    signal input senderNewCommitment;   // Public
    signal input recipientNewCommitment; // Public

    // Verify old commitments
    component senderOldHash = Poseidon(2);
    senderOldHash.inputs[0] <== senderSecret;
    senderOldHash.inputs[1] <== senderOldBalance;
    senderOldCommitment === senderOldHash.out;

    component recipientOldHash = Poseidon(2);
    recipientOldHash.inputs[0] <== recipientSecret;
    recipientOldHash.inputs[1] <== recipientOldBalance;
    recipientOldCommitment === recipientOldHash.out;

    // Calculate new balances
    signal senderNewBalance;
    signal recipientNewBalance;
    senderNewBalance <== senderOldBalance - amount;
    recipientNewBalance <== recipientOldBalance + amount;

    // Verify sender has sufficient balance
    component check = GreaterEqThan(64);
    check.in[0] <== senderOldBalance;
    check.in[1] <== amount;
    check.out === 1;

    // Verify new commitments
    component senderNewHash = Poseidon(2);
    senderNewHash.inputs[0] <== senderSecret;
    senderNewHash.inputs[1] <== senderNewBalance;
    senderNewCommitment === senderNewHash.out;

    component recipientNewHash = Poseidon(2);
    recipientNewHash.inputs[0] <== recipientSecret;
    recipientNewHash.inputs[1] <== recipientNewBalance;
    recipientNewCommitment === recipientNewHash.out;
}

component main {public [
    senderOldCommitment,
    recipientOldCommitment,
    senderNewCommitment,
    recipientNewCommitment
]} = PrivateTransfer();
```

### Pattern 10: Nullifier Pattern

Prevent double-spending with nullifiers.

```circom
template NullifierCircuit() {
    signal input secret;
    signal input nonce;
    signal input commitment;  // Public
    signal input nullifier;   // Public

    // Verify commitment
    component commitHash = Poseidon(2);
    commitHash.inputs[0] <== secret;
    commitHash.inputs[1] <== nonce;
    commitment === commitHash.out;

    // Generate nullifier
    component nullifierHash = Poseidon(1);
    nullifierHash.inputs[0] <== commitment;
    nullifier === nullifierHash.out;
}

component main {public [commitment, nullifier]} = NullifierCircuit();
```

**Use case:** Prevent double-spending in anonymous systems.

---

## Pattern Best Practices

### 1. Input Naming Convention

```circom
signal input privateValue;      // Private by default
signal input publicValue;       // Declared public in component main
signal input commitment;        // Usually public
signal input secret;            // Usually private
```

### 2. Commitment Pattern

Standard commitment structure:

```circom
commitment = Hash(secret, value)
```

This allows proving knowledge of value without revealing it.

### 3. Public Input Minimization

Only expose necessary information:

```circom
// Good: Only commitment is public
component main {public [commitment]} = Circuit();

// Avoid: Exposing unnecessary data
component main {public [commitment, intermediateValue, debugInfo]} = Circuit();
```

### 4. Constraint Ordering

Order constraints for clarity:

1. Input validation
2. Commitment verification
3. Core logic
4. Output constraints

---

## Testing Patterns

### Unit Testing Template

```javascript
describe("CircuitName", () => {
  let circuit;

  before(async () => {
    circuit = await wasm_tester("circuits/circuit_name.circom");
  });

  it("should accept valid input", async () => {
    const input = {
      privateInput: 123,
      publicInput: 456,
    };
    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
  });

  it("should reject invalid input", async () => {
    const input = {
      privateInput: 999,
      publicInput: 456,
    };
    await expect(circuit.calculateWitness(input)).to.be.rejected;
  });

  it("should have correct public outputs", async () => {
    const input = { /* ... */ };
    const witness = await circuit.calculateWitness(input);
    const publicSignals = witness.slice(1, 1 + numPublicInputs);
    expect(publicSignals[0]).to.equal(expectedValue);
  });
});
```

---

## Additional Resources

- **ZK Patterns**: https://github.com/iden3/circomlib (examples in tests/)
- **0xPARC Learning**: https://learn.0xparc.org/
- **Privacy Pools**: Advanced privacy-preserving patterns
- **Tornado Cash**: Classic mixing circuit implementation
