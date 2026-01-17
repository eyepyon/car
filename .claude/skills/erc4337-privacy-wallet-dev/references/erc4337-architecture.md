# ERC-4337 Account Abstraction Architecture

## Overview

ERC-4337 introduces Account Abstraction (AA) to Ethereum without requiring protocol-level changes. It enables smart contract wallets with flexible authentication, gas sponsorship, and enhanced security features.

## Core Components

### 1. UserOperation

A `UserOperation` is a higher-level pseudo-transaction that describes what the user wants to execute.

```solidity
struct PackedUserOperation {
    address sender;              // The account making the operation
    uint256 nonce;              // Anti-replay parameter
    bytes initCode;             // Account creation code (if new)
    bytes callData;             // Data to pass to the sender
    bytes32 accountGasLimits;   // Gas limits for verification and execution
    uint256 preVerificationGas; // Gas to compensate bundler
    bytes32 gasFees;            // maxFeePerGas and maxPriorityFeePerGas
    bytes paymasterAndData;     // Paymaster address and data
    bytes signature;            // Signature over the userOp
}
```

### 2. EntryPoint

The EntryPoint is a singleton contract that coordinates UserOperation execution.

**Key Functions:**
- `handleOps()`: Execute a batch of UserOperations
- `handleAggregatedOps()`: Execute operations with signature aggregation
- `depositTo()`: Deposit ETH for gas payment
- `withdrawTo()`: Withdraw deposited ETH

**Address:** `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (canonical address)

### 3. Account Contract (Wallet)

The smart contract wallet that implements the `IAccount` interface.

**Required Interface:**
```solidity
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
```

### 4. Bundler

Off-chain actors that:
- Collect UserOperations from a mempool
- Bundle them into transactions
- Submit to EntryPoint
- Get compensated for gas costs

### 5. Paymaster (Optional)

Contracts that sponsor gas for users, enabling:
- Gasless transactions
- ERC-20 token gas payment
- Subscription models

## Privacy-Protected Account Flow

### Account Creation with Vehicle Data

```
1. Off-chain: Compute commitment
   commitment = keccak256(abi.encodePacked(plateNumber, userSalt))

2. Off-chain: Derive owner address (optional)
   owner = deriveAddress(vehicleData, userSecret)

3. Deploy via Factory
   factory.createAccount(owner, commitment, salt)

4. Result: Deterministic address
   address = CREATE2(factory, salt, initCodeHash)
```

### Transaction Execution

```
1. User wants to execute transaction
   ↓
2. Create UserOperation
   - sender: account address
   - callData: transaction data
   - signature: signed by owner
   ↓
3. Submit to Bundler
   ↓
4. Bundler submits to EntryPoint
   ↓
5. EntryPoint calls account.validateUserOp()
   - Account verifies signature
   - Account pays for gas
   ↓
6. EntryPoint executes callData
   ↓
7. Transaction complete
```

## Key Benefits for Privacy

### 1. Deterministic Addresses

- CREATE2 allows address prediction before deployment
- Same commitment + salt = same address across all chains
- Receive funds before account creation

### 2. Flexible Authentication

- Not limited to ECDSA
- Can use multisig, social recovery, biometrics
- Vehicle data can be part of authentication

### 3. Gas Abstraction

- Paymaster can sponsor transactions
- User never needs ETH for gas
- Privacy-preserving payment methods

### 4. Batching

- Multiple operations in one transaction
- Reduced on-chain footprint
- Lower gas costs

## Security Considerations

### Validation Rules

1. **Time-range validation**: Operations can specify validity period
2. **Aggregation limits**: Prevent DoS via complex aggregation
3. **Gas limits**: Protect bundlers from griefing
4. **Storage access**: Limited during validation phase

### Privacy Best Practices

1. **Never store raw sensitive data**
   ```solidity
   // ❌ Bad
   string public licensePlate;

   // ✅ Good
   bytes32 public vehicleCommitment;
   ```

2. **Use view/pure for verification**
   ```solidity
   // ✅ Good - doesn't expose data on-chain
   function verifyOwnership(string memory plate, bytes32 salt)
       external view returns (bool);
   ```

3. **Minimize event emissions**
   ```solidity
   // ❌ Bad - leaks data
   event VehicleRegistered(string plateNumber);

   // ✅ Good - only commitment
   event VehicleRegistered(bytes32 indexed commitment);
   ```

## Implementation Patterns

### Pattern 1: Commitment-Based Authentication

```solidity
contract PrivacyAccount is BaseAccount {
    bytes32 public dataCommitment;

    function initialize(bytes32 commitment) external {
        dataCommitment = commitment;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        // Verify signature without revealing sensitive data
        return verifyCommitment(userOp.signature, userOpHash);
    }
}
```

### Pattern 2: ZK-Proof Integration

```solidity
contract ZKPrivacyAccount is BaseAccount {
    IZKVerifier public verifier;

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        // Verify ZK proof instead of traditional signature
        (bytes memory proof, bytes memory publicInputs) =
            abi.decode(userOp.signature, (bytes, bytes));

        require(
            verifier.verify(proof, publicInputs),
            "Invalid ZK proof"
        );

        return SIG_VALIDATION_SUCCESS;
    }
}
```

## Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction Documentation](https://docs.erc4337.io/)
- [MynaWallet Implementation](https://github.com/MynaWallet/monorepo)
- [Toyota MON](https://www.toyota-blockchain-lab.org/)
