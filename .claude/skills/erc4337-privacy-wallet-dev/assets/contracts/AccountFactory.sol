// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./PrivacyProtectedAccount.sol";

/**
 * @title AccountFactory
 * @notice Factory for deploying PrivacyProtectedAccount contracts with deterministic addresses
 * @dev Uses CREATE2 for deterministic address generation based on vehicle data hash
 *
 * Privacy Features:
 * - Deterministic address generation from vehicle commitment (without exposing raw data)
 * - Predictable addresses across all EVM chains
 * - No storage of sensitive vehicle information
 *
 * Usage Pattern:
 * 1. Off-chain: Compute vehicle commitment = keccak256(abi.encodePacked(plateNumber, salt))
 * 2. Off-chain: Derive owner address (e.g., from vehicle data + user seed)
 * 3. Call: createAccount(owner, vehicleCommitment, salt)
 * 4. Result: Get deterministic account address
 */
contract AccountFactory {
    /// @notice Implementation contract for proxies
    PrivacyProtectedAccount public immutable accountImplementation;

    event AccountCreated(
        address indexed account,
        address indexed owner,
        bytes32 indexed vehicleCommitment,
        uint256 salt
    );

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new PrivacyProtectedAccount(_entryPoint);
    }

    /**
     * @notice Create an account with deterministic address
     * @param owner The owner address
     * @param vehicleCommitment Hash of vehicle data (keccak256(abi.encodePacked(plateNumber, userSalt)))
     * @param salt Additional salt for address generation
     * @return account The created account address
     *
     * @dev Security Notes:
     * - vehicleCommitment should NEVER be the raw plate number
     * - salt adds an extra layer of privacy by making commitment unique per user
     * - Same (owner, vehicleCommitment, salt) triplet always produces same address
     */
    function createAccount(
        address owner,
        bytes32 vehicleCommitment,
        uint256 salt
    ) public returns (PrivacyProtectedAccount account) {
        address addr = getAddress(owner, vehicleCommitment, salt);
        uint256 codeSize = addr.code.length;

        if (codeSize > 0) {
            return PrivacyProtectedAccount(payable(addr));
        }

        account = PrivacyProtectedAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(
                        PrivacyProtectedAccount.initialize,
                        (owner, vehicleCommitment)
                    )
                )
            )
        );

        emit AccountCreated(address(account), owner, vehicleCommitment, salt);
    }

    /**
     * @notice Compute the counterfactual address of an account
     * @param owner The owner address
     * @param vehicleCommitment Hash of vehicle data
     * @param salt Salt for address generation
     * @return The counterfactual address
     *
     * @dev Can be called off-chain to know the address before deployment
     *      Useful for receiving funds before account creation
     */
    function getAddress(
        address owner,
        bytes32 vehicleCommitment,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(
                                PrivacyProtectedAccount.initialize,
                                (owner, vehicleCommitment)
                            )
                        )
                    )
                )
            );
    }

    /**
     * @notice Helper function to compute vehicle commitment off-chain pattern
     * @param plateNumber Vehicle license plate number
     * @param userSalt User-specific salt for privacy
     * @return Commitment hash
     *
     * @dev WARNING: Do NOT call this on-chain with real plate numbers
     *      This is a reference implementation for off-chain computation
     *      Use this pattern in your frontend/backend:
     *      - commitment = keccak256(abi.encodePacked(plateNumber, userSalt))
     */
    function computeVehicleCommitment(
        string memory plateNumber,
        bytes32 userSalt
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(plateNumber, userSalt));
    }

    /**
     * @notice Batch create accounts for multiple vehicles
     * @param owners Array of owner addresses
     * @param vehicleCommitments Array of vehicle commitments
     * @param salts Array of salts
     * @return accounts Array of created account addresses
     */
    function createAccountBatch(
        address[] calldata owners,
        bytes32[] calldata vehicleCommitments,
        uint256[] calldata salts
    ) external returns (PrivacyProtectedAccount[] memory accounts) {
        require(
            owners.length == vehicleCommitments.length &&
            owners.length == salts.length,
            "AccountFactory: array length mismatch"
        );

        accounts = new PrivacyProtectedAccount[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            accounts[i] = createAccount(
                owners[i],
                vehicleCommitments[i],
                salts[i]
            );
        }

        return accounts;
    }

    /**
     * @notice Get addresses for batch creation (counterfactual)
     * @param owners Array of owner addresses
     * @param vehicleCommitments Array of vehicle commitments
     * @param salts Array of salts
     * @return addresses Array of counterfactual addresses
     */
    function getAddressBatch(
        address[] calldata owners,
        bytes32[] calldata vehicleCommitments,
        uint256[] calldata salts
    ) external view returns (address[] memory addresses) {
        require(
            owners.length == vehicleCommitments.length &&
            owners.length == salts.length,
            "AccountFactory: array length mismatch"
        );

        addresses = new address[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            addresses[i] = getAddress(
                owners[i],
                vehicleCommitments[i],
                salts[i]
            );
        }

        return addresses;
    }
}
