# Circom Best Practices and Security Guidelines

This document outlines best practices, common pitfalls, and security considerations for circom circuit development.

## Table of Contents

1. [Circuit Design Principles](#circuit-design-principles)
2. [Constraint Writing](#constraint-writing)
3. [Security Considerations](#security-considerations)
4. [Optimization Techniques](#optimization-techniques)
5. [Testing and Debugging](#testing-and-debugging)
6. [Common Pitfalls](#common-pitfalls)

---

## Circuit Design Principles

### 1. Clear Signal Flow

Design circuits with clear input → computation → output flow.

**Good:**
```circom
template HashCheck() {
    signal input secret;
    signal input expectedHash;
    signal output isValid;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;

    component eq = IsEqual();
    eq.in[0] <== hasher.out;
    eq.in[1] <== expectedHash;
    isValid <== eq.out;
}
```

**Avoid:**
```circom
// Confusing: multiple intermediate signals without clear purpose
signal temp1, temp2, temp3;
temp1 <== a * b;
temp3 <== temp1 + c;
temp2 <== temp3 - d;  // Non-sequential signal usage
```

### 2. Single Responsibility

Each template should have one clear purpose.

**Good:**
```circom
template VerifyMerkleProof(levels) { /* ... */ }
template CheckRange(bits) { /* ... */ }
template Main() {
    component merkle = VerifyMerkleProof(20);
    component range = CheckRange(32);
}
```

**Avoid:**
```circom
// Bad: template doing too many unrelated things
template DoEverything() {
    // Merkle proof + range check + signature + ...
}
```

### 3. Parameterization

Use template parameters for reusability.

```circom
template HashChain(n) {
    signal input start;
    signal output end;

    component hashers[n];
    for (var i = 0; i < n; i++) {
        hashers[i] = Poseidon(1);
        hashers[i].inputs[0] <== (i == 0) ? start : hashers[i-1].out;
    }
    end <== hashers[n-1].out;
}
```

---

## Constraint Writing

### 1. Use Constraint Operators Correctly

**`<==` vs `===` vs `<--`:**

- **`<==`**: Assigns AND constrains (most common)
- **`===`**: Only constrains (no assignment)
- **`<--`**: Only assigns (dangerous, no constraint!)

```circom
// GOOD: Constraint and assignment
out <== in1 * in2;

// GOOD: Explicit constraint (when value already computed)
component comp = SomeComponent();
comp.out === expectedValue;

// DANGEROUS: Assignment without constraint
signal temp;
temp <-- in1 * in2;  // ⚠️ Not constrained! Prover can cheat
```

### 2. Always Constrain Intermediate Signals

**Vulnerable:**
```circom
signal intermediate;
intermediate <-- in * 2;  // Not constrained!
out <== intermediate + 5;
```

**Secure:**
```circom
signal intermediate;
intermediate <== in * 2;  // Constrained
out <== intermediate + 5;
```

### 3. Avoid Under-Constrained Circuits

Every computation must be constrained. Use `<==` for most operations.

**Check constraint count:**
```bash
npx snarkjs r1cs info circuit.r1cs
```

If constraint count is unexpectedly low, signals may be under-constrained.

---

## Security Considerations

### 1. Input Validation

Always validate input ranges and conditions.

**Vulnerable:**
```circom
template Vulnerable() {
    signal input index;
    signal input array[10];
    signal output value;

    // ⚠️ index not constrained to 0-9!
    value <== array[index];
}
```

**Secure:**
```circom
template Secure() {
    signal input index;
    signal input array[10];
    signal output value;

    // Constrain index to valid range
    component range = LessThan(4);  // 4 bits = 0-15
    range.in[0] <== index;
    range.in[1] <== 10;
    range.out === 1;

    value <== array[index];
}
```

### 2. Division Safety

Division requires special handling in circom.

**Vulnerable:**
```circom
signal quotient;
quotient <-- numerator / denominator;  // Unconstrained!
```

**Secure:**
```circom
signal quotient;
signal remainder;

quotient <-- numerator \ denominator;
remainder <-- numerator % denominator;

// Constrain: numerator = quotient * denominator + remainder
numerator === quotient * denominator + remainder;

// Constrain: remainder < denominator
component lt = LessThan(252);
lt.in[0] <== remainder;
lt.in[1] <== denominator;
lt.out === 1;
```

### 3. Private vs Public Signals

Be explicit about what should be public.

```circom
template PasswordProof() {
    signal input password;      // Private by default
    signal input hash;          // Declare as public below

    component hasher = Poseidon(1);
    hasher.inputs[0] <== password;
    hash === hasher.out;
}

// Explicitly mark hash as public
component main {public [hash]} = PasswordProof();
```

**Security rule:** Public inputs are visible to everyone. Only expose what's necessary.

### 4. Avoid Information Leakage

Constraints can leak information about private inputs.

**Potential leak:**
```circom
// If condition is private, this leaks information
component mux = Mux1();
mux.s <== privateCondition;  // Verifier can analyze constraints
```

**Solution:** Use constant-time operations or accept the leakage if acceptable.

---

## Optimization Techniques

### 1. Minimize Constraints

Fewer constraints = faster proving time.

**Less efficient (2 constraints):**
```circom
signal temp;
temp <== a * b;
out <== temp * c;
```

**More efficient (1 constraint):**
```circom
signal temp;
temp <== a * b;
out <== temp * c;  // Can sometimes be combined
```

**Use `assert` for compile-time checks:**
```circom
assert(levels > 0);  // Compile-time only, no runtime constraint
```

### 2. Reuse Components

Component instantiation has overhead.

**Less efficient:**
```circom
component h1 = Poseidon(1);
h1.inputs[0] <== val1;
component h2 = Poseidon(1);  // New component instance
h2.inputs[0] <== val2;
```

**More efficient (if reusable):**
```circom
component hasher = Poseidon(1);
// Reuse in loop or sequence
```

### 3. Optimize Hash Usage

Poseidon is optimized for zkSNARKs but still expensive.

**Minimize hash calls:**
```circom
// Hash once
component h = Poseidon(3);
h.inputs[0] <== a;
h.inputs[1] <== b;
h.inputs[2] <== c;

// Instead of hashing multiple times
// hash(a), hash(b), hash(c)
```

---

## Testing and Debugging

### 1. Unit Test Each Template

Test templates in isolation before integration.

```javascript
const circuit = await wasm_tester("circuits/my_template.circom");
const input = { in: 5 };
const witness = await circuit.calculateWitness(input);
await circuit.assertOut(witness, { out: 25 });
```

### 2. Test Edge Cases

- Zero values
- Maximum values (near field prime)
- Boundary conditions
- Invalid inputs (should fail)

```javascript
describe("RangeCheck", () => {
  it("should accept valid range", async () => {
    await circuit.calculateWitness({ value: 50, max: 100 });
  });

  it("should reject out of range", async () => {
    await expect(
      circuit.calculateWitness({ value: 150, max: 100 })
    ).to.be.rejected;
  });
});
```

### 3. Use Debugging Signals

Add intermediate signals for debugging.

```circom
signal debug1, debug2;
debug1 <== intermediate_step1;
debug2 <== intermediate_step2;
// These will appear in witness
```

### 4. Check Constraint Count

Monitor constraint growth as circuit complexity increases.

```bash
npx snarkjs r1cs info circuit.r1cs | grep "# of Constraints"
```

---

## Common Pitfalls

### 1. Using `<--` Instead of `<==`

**Problem:**
```circom
signal result;
result <-- a * b;  // ⚠️ NOT CONSTRAINED!
```

**Solution:**
```circom
result <== a * b;  // ✓ Constrained
```

### 2. Forgetting to Constrain Equality

**Problem:**
```circom
component comp = SomeComponent();
// Forgot to constrain output!
```

**Solution:**
```circom
component comp = SomeComponent();
comp.out === expectedValue;  // ✓ Constrained
```

### 3. Array Index Out of Bounds

**Problem:**
```circom
signal array[10];
// No constraint on index!
value <== array[userInput];
```

**Solution:**
```circom
component range = LessThan(4);
range.in[0] <== userInput;
range.in[1] <== 10;
range.out === 1;
```

### 4. Division Without Remainder Check

**Problem:**
```circom
quotient <-- numerator / denominator;
numerator === quotient * denominator;  // Incomplete!
```

**Solution:**
```circom
quotient <-- numerator \ denominator;
remainder <-- numerator % denominator;
numerator === quotient * denominator + remainder;
// Also constrain remainder < denominator
```

### 5. Non-Deterministic Computation

**Problem:**
```circom
// Multiple valid solutions
x * x === 4;  // x could be 2 or -2
```

**Solution:**
Add constraints to ensure determinism:
```circom
x * x === 4;
component isPos = GreaterThan(252);
isPos.in[0] <== x;
isPos.in[1] <== 0;
isPos.out === 1;  // Constrain x to be positive
```

---

## Security Checklist

Before deploying a circuit:

- [ ] All signals properly constrained (no `<--` without corresponding constraints)
- [ ] Input ranges validated
- [ ] Division operations properly constrained
- [ ] Public/private signals correctly specified
- [ ] Edge cases tested (0, max values, boundaries)
- [ ] No under-constrained circuits (verify constraint count)
- [ ] Code reviewed by another developer
- [ ] Static analysis tools run (if available)
- [ ] Audit completed for production circuits

---

## Tools and Resources

### Static Analysis
- **Circomspect**: Vulnerability detector for circom
- **PICUS**: Automated verification tool

### Testing
- **circom_tester**: JavaScript testing framework
- **Witness calculator**: Test witness generation

### Auditing
For production circuits, consider professional audits from firms specializing in ZK circuits.

---

## Additional Reading

- [Circom Documentation](https://docs.circom.io/)
- [0xPARC Circom Workshop](https://learn.0xparc.org/)
- [Trail of Bits Circom Security](https://blog.trailofbits.com/2022/04/18/the-challenges-of-writing-secure-circom-circuits/)
