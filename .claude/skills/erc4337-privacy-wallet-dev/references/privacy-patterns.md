# Privacy Protection Patterns for Vehicle Wallets

## Core Privacy Principles

1. **Minimize On-Chain Data**: Store only what's absolutely necessary
2. **Use Commitments**: Hash sensitive data, store only the hash
3. **Selective Disclosure**: Reveal information only when required
4. **Zero-Knowledge Proofs**: Prove properties without revealing data

## Pattern 1: Commitment Scheme

### Basic Commitment

```solidity
// Compute commitment off-chain
const commitment = keccak256(abi.encodePacked(
    sensitiveData,    // e.g., license plate
    salt              // User-specific random value
));

// Store only commitment on-chain
bytes32 public dataCommitment = commitment;
```

### Benefits
- Sensitive data never touches the blockchain
- Verifiable without revealing original data
- Collision-resistant (keccak256)

### Use Cases
- Vehicle license plates
- Personal identification numbers
- Biometric hashes
- Private keys

## Pattern 2: Salted Hashing

### Why Use Salt?

Without salt:
```solidity
// ❌ Vulnerable to rainbow table attacks
bytes32 commitment = keccak256(abi.encodePacked(plateNumber));
```

With salt:
```solidity
// ✅ Protected against precomputation attacks
bytes32 commitment = keccak256(abi.encodePacked(plateNumber, userSalt));
```

### Salt Generation

```javascript
// Generate cryptographically secure salt
const userSalt = ethers.id(`${userId}-${timestamp}-${randomBytes(32)}`);

// Or derive from user's secret
const userSalt = ethers.keccak256(
    ethers.solidityPacked(['address', 'string'], [userAddress, userSecret])
);
```

## Pattern 3: Merkle Tree for Batch Privacy

For managing multiple vehicles while preserving privacy:

```solidity
contract VehicleMerkleRegistry {
    bytes32 public merkleRoot;

    function updateRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
    }

    function verifyVehicle(
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }
}
```

```javascript
// Off-chain: Build Merkle tree
const vehicles = [
    keccak256(abi.encodePacked(plate1, salt1)),
    keccak256(abi.encodePacked(plate2, salt2)),
    keccak256(abi.encodePacked(plate3, salt3))
];

const merkleTree = new MerkleTree(vehicles, keccak256);
const root = merkleTree.getRoot();

// On-chain: Store only root
await registry.updateRoot(root);

// Verification: Prove ownership without revealing all vehicles
const proof = merkleTree.getProof(vehicles[0]);
await registry.verifyVehicle(vehicles[0], proof);
```

## Pattern 4: Zero-Knowledge Proofs

### ZK-SNARK for Vehicle Ownership

```circom
// Circuit: Prove you know a plate number that hashes to commitment
template VehicleOwnership() {
    // Private inputs (not revealed)
    signal private input plateNumber;
    signal private input salt;

    // Public inputs (revealed)
    signal input commitment;

    // Compute hash
    signal hash;
    hash <== Hash([plateNumber, salt]);

    // Constraint: hash must equal public commitment
    commitment === hash;
}
```

```solidity
// On-chain verification
contract ZKVehicleVerifier {
    IVerifier public zkVerifier;

    function verifyOwnership(
        bytes calldata proof,
        bytes32 commitment
    ) external view returns (bool) {
        // Verify proof without seeing plate number
        return zkVerifier.verifyProof(
            proof,
            [uint256(commitment)]
        );
    }
}
```

## Pattern 5: Selective Disclosure

### Scenario: Prove age of vehicle without revealing exact year

```solidity
contract SelectiveVehicleInfo {
    struct VehicleCommitment {
        bytes32 fullDataHash;    // Hash of all attributes
        bytes32[] attributeHashes; // Hash of each attribute
    }

    function proveAttribute(
        bytes32 fullDataHash,
        string memory attributeName,
        string memory attributeValue,
        bytes32[] memory otherHashes
    ) external pure returns (bool) {
        // Reconstruct full hash from revealed attribute and other hashes
        bytes32 revealedHash = keccak256(
            abi.encodePacked(attributeName, attributeValue)
        );

        bytes32 reconstructed = keccak256(
            abi.encodePacked(revealedHash, otherHashes)
        );

        return reconstructed == fullDataHash;
    }
}
```

## Pattern 6: Timelock for Privacy

Reveal sensitive data only after a specific time:

```solidity
contract TimelockCommitment {
    struct SecretCommitment {
        bytes32 hash;
        uint256 revealTime;
        bool revealed;
    }

    mapping(bytes32 => SecretCommitment) public commitments;

    function commit(bytes32 hash, uint256 lockPeriod) external {
        bytes32 id = keccak256(abi.encodePacked(msg.sender, hash, block.timestamp));

        commitments[id] = SecretCommitment({
            hash: hash,
            revealTime: block.timestamp + lockPeriod,
            revealed: false
        });
    }

    function reveal(
        bytes32 id,
        string memory secret
    ) external returns (bool) {
        SecretCommitment storage c = commitments[id];

        require(block.timestamp >= c.revealTime, "Too early");
        require(!c.revealed, "Already revealed");
        require(keccak256(bytes(secret)) == c.hash, "Invalid secret");

        c.revealed = true;
        return true;
    }
}
```

## Pattern 7: Encrypted Storage with Decentralized Keys

```solidity
contract EncryptedVehicleData {
    // Store encrypted data on-chain
    mapping(bytes32 => bytes) public encryptedData;

    // Public key for encryption (user's or organization's)
    mapping(address => bytes) public publicKeys;

    function storeEncrypted(
        bytes32 id,
        bytes memory encrypted
    ) external {
        encryptedData[id] = encrypted;
    }

    function getEncrypted(bytes32 id) external view returns (bytes memory) {
        // Returns encrypted data - only key holder can decrypt
        return encryptedData[id];
    }
}
```

```javascript
// Off-chain encryption
import { encrypt } from '@metamask/eth-sig-util';

const encryptedData = encrypt({
    publicKey: recipientPublicKey,
    data: JSON.stringify({ plateNumber, model, year }),
    version: 'x25519-xsalsa20-poly1305'
});

await contract.storeEncrypted(vehicleId, encryptedData);
```

## Pattern 8: Ring Signatures for Anonymity

Prove you're one of a group without revealing which one:

```solidity
contract RingSignatureVehicle {
    function verifyRingSignature(
        bytes32 message,
        address[] memory ring,    // Set of possible signers
        bytes memory signature
    ) external pure returns (bool) {
        // Verify signature is from someone in the ring
        // but don't reveal which member
        return verifyRing(message, ring, signature);
    }
}
```

## Anti-Patterns (What to Avoid)

### ❌ Anti-Pattern 1: Storing Raw Sensitive Data

```solidity
// NEVER DO THIS
contract BadVehicleWallet {
    string public licensePlate;  // Publicly visible!
    string public ownerName;     // Privacy violation!
}
```

### ❌ Anti-Pattern 2: Emitting Sensitive Data in Events

```solidity
// NEVER DO THIS
event VehicleRegistered(
    string plateNumber,  // Leaked forever in logs!
    address owner
);
```

### ❌ Anti-Pattern 3: Verification Functions Without View

```solidity
// RISKY - could be called in transaction
function verifyPlate(string memory plate) external returns (bool) {
    // Plate number exposed in transaction data!
}

// BETTER - read-only
function verifyPlate(string memory plate) external view returns (bool) {
    // Still visible to caller, but use off-chain only
}
```

### ❌ Anti-Pattern 4: Insufficient Salt Entropy

```solidity
// WEAK
bytes32 salt = bytes32(block.timestamp);  // Predictable!

// STRONG
bytes32 salt = keccak256(abi.encodePacked(
    userSecret,
    block.timestamp,
    block.prevrandao,
    msg.sender
));
```

## Best Practices Summary

1. **Compute commitments off-chain**: Never pass raw sensitive data to blockchain
2. **Use strong salts**: Combine user secret + random entropy
3. **Prefer view/pure functions**: Minimize on-chain exposure
4. **Minimize events**: Only emit commitments, never raw data
5. **Consider ZK proofs**: For complex verification scenarios
6. **Regular audits**: Use privacy validation tools
7. **Documentation**: Clearly mark which functions handle sensitive data

## Privacy Validation Checklist

- [ ] No `string` storage for sensitive data
- [ ] All commitments use `keccak256` with salt
- [ ] Verification functions are `view` or `pure`
- [ ] Events only emit indexed commitments
- [ ] No console.log in production code
- [ ] Salt has sufficient entropy (≥256 bits)
- [ ] Off-chain computation verified
- [ ] Access control on sensitive functions
- [ ] Regular privacy audits scheduled

## Tools and Libraries

- **OpenZeppelin**: Cryptography utilities, Merkle proofs
- **snarkjs**: ZK-SNARK proof generation and verification
- **circom**: Circuit language for ZK proofs
- **ethers.js**: Hashing, signing, encryption
- **@metamask/eth-sig-util**: Encryption utilities
