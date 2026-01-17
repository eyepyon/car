# Circomlib Standard Components Reference

This document provides a reference for commonly used components from circomlib, the standard library for circom circuits.

## Installation

```bash
npm install circomlib
```

## Usage in Circuits

```circom
include "node_modules/circomlib/circuits/[category]/[component].circom";
```

---

## Hash Functions

### Poseidon

Cryptographic hash function optimized for zero-knowledge proofs.

```circom
include "node_modules/circomlib/circuits/poseidon.circom";

template Example() {
    signal input in;
    signal output hash;

    component hasher = Poseidon(1);  // 1 input
    hasher.inputs[0] <== in;
    hash <== hasher.out;
}
```

**Parameters:**
- `nInputs`: Number of inputs (1-16)

**Multiple inputs:**
```circom
component hasher = Poseidon(2);
hasher.inputs[0] <== value1;
hasher.inputs[1] <== value2;
output <== hasher.out;
```

**JavaScript equivalent:**
```javascript
const circomlibjs = require("circomlibjs");
const poseidon = await circomlibjs.buildPoseidon();
const hash = poseidon.F.toString(poseidon([input1, input2]));
```

### MiMC

Alternative hash function (less efficient than Poseidon in most cases).

```circom
include "node_modules/circomlib/circuits/mimcsponge.circom";

component hasher = MiMCSponge(2, 220, 1);
hasher.ins[0] <== input1;
hasher.ins[1] <== input2;
hasher.k <== 0;
output <== hasher.outs[0];
```

---

## Comparators

### IsZero

Check if a value equals zero.

```circom
include "node_modules/circomlib/circuits/comparators.circom";

component isZero = IsZero();
isZero.in <== value;
// isZero.out = 1 if value == 0, else 0
```

### IsEqual

Check if two values are equal.

```circom
component isEqual = IsEqual();
isEqual.in[0] <== a;
isEqual.in[1] <== b;
// isEqual.out = 1 if a == b, else 0
```

### LessThan

Compare two values (less than).

```circom
component lt = LessThan(32);  // 32-bit comparison
lt.in[0] <== a;
lt.in[1] <== b;
// lt.out = 1 if a < b, else 0
```

**Parameters:**
- `n`: Number of bits for comparison

**Related components:**
- `LessEqThan(n)`: a ≤ b
- `GreaterThan(n)`: a > b
- `GreaterEqThan(n)`: a ≥ b

---

## Multiplexers and Selectors

### Mux1

Binary multiplexer (select one of two inputs).

```circom
include "node_modules/circomlib/circuits/mux1.circom";

component mux = Mux1();
mux.c[0] <== option0;
mux.c[1] <== option1;
mux.s <== selector;  // 0 or 1
// mux.out = selector ? option1 : option0
```

### Mux3

Select one of 8 inputs (3-bit selector).

```circom
component mux = Mux3();
for (var i = 0; i < 8; i++) {
    mux.c[i] <== options[i];
}
mux.s[0] <== selector_bit0;
mux.s[1] <== selector_bit1;
mux.s[2] <== selector_bit2;
```

---

## Bitwise Operations

### Num2Bits

Convert number to binary representation.

```circom
include "node_modules/circomlib/circuits/bitify.circom";

component n2b = Num2Bits(8);  // 8 bits
n2b.in <== number;
// n2b.out[0] = LSB, n2b.out[7] = MSB
```

### Bits2Num

Convert binary to number.

```circom
component b2n = Bits2Num(8);
for (var i = 0; i < 8; i++) {
    b2n.in[i] <== bits[i];
}
// b2n.out = number
```

---

## Binary Operations

### AND, OR, NOT

```circom
include "node_modules/circomlib/circuits/binsum.circom";

component andGate = AND();
andGate.a <== bit1;
andGate.b <== bit2;
// andGate.out = bit1 AND bit2

component orGate = OR();
orGate.a <== bit1;
orGate.b <== bit2;

component notGate = NOT();
notGate.in <== bit;
```

---

## Merkle Trees

### SMTVerifier

Sparse Merkle Tree membership verification.

```circom
include "node_modules/circomlib/circuits/smt/smtverifier.circom";

template MerkleProof(levels) {
    signal input leaf;
    signal input root;
    signal input siblings[levels];
    signal input pathIndices[levels];

    component verifier = SMTVerifier(levels);
    verifier.enabled <== 1;
    verifier.root <== root;
    verifier.siblings <== siblings;
    verifier.oldKey <== 0;
    verifier.oldValue <== 0;
    verifier.isOld0 <== 0;
    verifier.key <== leaf;
    verifier.value <== leaf;
    verifier.fnc <== 0;
}
```

---

## Signature Verification

### EdDSAPoseidonVerifier

Verify EdDSA signatures with Poseidon hash.

```circom
include "node_modules/circomlib/circuits/eddsa.circom";

component verifier = EdDSAPoseidonVerifier();
verifier.enabled <== 1;
verifier.Ax <== pubKeyX;
verifier.Ay <== pubKeyY;
verifier.R8x <== signatureR8x;
verifier.R8y <== signatureR8y;
verifier.S <== signatureS;
verifier.M <== message;
```

---

## Arithmetic

### IsNegative

Check if number is negative (> field_size/2).

```circom
include "node_modules/circomlib/circuits/sign.circom";

component isNeg = IsNegative();
isNeg.in <== value;
// isNeg.out = 1 if negative
```

### SafeLessThan

Range-checked less-than comparison.

```circom
component lt = SafeLessThan(252);
lt.in[0] <== a;
lt.in[1] <== b;
```

---

## Best Practices

1. **Import only what you need**: Importing unused components increases compilation time
2. **Check bit widths**: Ensure bit width parameters match your data size
3. **Poseidon over MiMC**: Poseidon is generally more efficient for zkSNARKs
4. **Use SafeLessThan**: For range-checked comparisons to prevent overflow
5. **Test edge cases**: 0, maximum values, boundary conditions

---

## Common Patterns

### Range Check
```circom
component range = LessThan(32);
range.in[0] <== value;
range.in[1] <== maxValue;
range.out === 1;  // Constraint: value must be < maxValue
```

### Conditional Assignment
```circom
component mux = Mux1();
mux.c[0] <== defaultValue;
mux.c[1] <== specialValue;
mux.s <== condition;
output <== mux.out;
```

### Hash Chain
```circom
component hashers[n];
hashers[0] = Poseidon(1);
hashers[0].inputs[0] <== initialValue;

for (var i = 1; i < n; i++) {
    hashers[i] = Poseidon(1);
    hashers[i].inputs[0] <== hashers[i-1].out;
}
finalHash <== hashers[n-1].out;
```

---

## Additional Resources

- **Official circomlib repo**: https://github.com/iden3/circomlib
- **Circuit library**: Browse `node_modules/circomlib/circuits/` for all components
- **Test examples**: `node_modules/circomlib/test/` contains usage examples
