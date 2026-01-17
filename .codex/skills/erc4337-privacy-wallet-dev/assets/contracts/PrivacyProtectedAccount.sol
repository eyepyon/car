// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PrivacyProtectedAccount
 * @notice ERC-4337 compliant account with privacy-preserving features for vehicle identity
 * @dev Protects sensitive vehicle information (license plate numbers) by storing only commitments on-chain
 *
 * Security Features:
 * - Stores only keccak256 hash of sensitive data, never raw values
 * - Implements ERC-4337 account abstraction for flexible authentication
 * - Supports deterministic address generation
 * - Enables zero-knowledge proof verification (extensible)
 *
 * Privacy Model:
 * - Vehicle number plate → hash → stored on-chain
 * - Owner can prove possession without revealing actual plate number
 * - Optional: Can integrate ZK-SNARK circuits for selective disclosure
 */
contract PrivacyProtectedAccount is BaseAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice The EntryPoint contract address (singleton)
    IEntryPoint private immutable _entryPoint;

    /// @notice Owner's EOA address (can be derived from vehicle data)
    address public owner;

    /// @notice Commitment to sensitive vehicle data (keccak256 hash)
    /// @dev Never store raw vehicle number plate on-chain
    bytes32 public vehicleCommitment;

    /// @notice Optional: Secondary authentication factor
    bytes32 public secondaryCommitment;

    /// @notice Nonce for replay protection
    uint256 private _nonce;

    event PrivacyProtectedAccountInitialized(
        IEntryPoint indexed entryPoint,
        address indexed owner,
        bytes32 vehicleCommitment
    );

    event VehicleCommitmentUpdated(
        bytes32 indexed oldCommitment,
        bytes32 indexed newCommitment
    );

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        require(
            msg.sender == owner || msg.sender == address(this),
            "only owner"
        );
    }

    /**
     * @notice Initialize the account with owner and vehicle commitment
     * @param anOwner The owner address (can be deterministically derived from vehicle data)
     * @param aVehicleCommitment Hash of vehicle data (e.g., keccak256(abi.encodePacked(plateNumber, salt)))
     * @dev CRITICAL: Never pass raw vehicle data to this function
     */
    function initialize(address anOwner, bytes32 aVehicleCommitment) public virtual {
        _initialize(anOwner, aVehicleCommitment);
    }

    function _initialize(address anOwner, bytes32 aVehicleCommitment) internal virtual {
        require(owner == address(0), "account: already initialized");
        require(anOwner != address(0), "account: owner cannot be zero");
        require(aVehicleCommitment != bytes32(0), "account: commitment cannot be zero");

        owner = anOwner;
        vehicleCommitment = aVehicleCommitment;

        emit PrivacyProtectedAccountInitialized(_entryPoint, anOwner, aVehicleCommitment);
    }

    /**
     * @notice Update vehicle commitment (e.g., when vehicle ownership changes)
     * @param newCommitment New commitment hash
     * @dev Only callable by owner or through EntryPoint
     */
    function updateVehicleCommitment(bytes32 newCommitment) external onlyOwner {
        require(newCommitment != bytes32(0), "account: commitment cannot be zero");

        bytes32 oldCommitment = vehicleCommitment;
        vehicleCommitment = newCommitment;

        emit VehicleCommitmentUpdated(oldCommitment, newCommitment);
    }

    /**
     * @notice Verify that a given preimage matches the stored commitment
     * @param plateNumber The vehicle plate number (sensitive data)
     * @param salt Random salt used during commitment
     * @return True if commitment matches
     * @dev WARNING: This reveals the plate number on-chain if called in a transaction
     *      Only use in view/pure contexts or with additional privacy layers (e.g., ZK proofs)
     */
    function verifyVehicleOwnership(
        string memory plateNumber,
        bytes32 salt
    ) external view returns (bool) {
        bytes32 computedCommitment = keccak256(abi.encodePacked(plateNumber, salt));
        return computedCommitment == vehicleCommitment;
    }

    /// @inheritdoc BaseAccount
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recovered = hash.recover(userOp.signature);

        if (recovered != owner) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @notice Execute a call from this account
     * @param dest Destination address
     * @param value Amount of ETH to send
     * @param func Calldata
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * @notice Execute a batch of calls from this account
     * @param dest Array of destination addresses
     * @param value Array of ETH amounts
     * @param func Array of calldata
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        require(
            dest.length == func.length &&
            (value.length == 0 || value.length == func.length),
            "account: wrong array lengths"
        );

        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Deposit funds to EntryPoint for gas payments
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Withdraw funds from EntryPoint
     * @param withdrawAddress Address to receive withdrawn funds
     * @param amount Amount to withdraw
     */
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == owner,
            "account: not Owner or EntryPoint"
        );
    }

    /**
     * @notice Get deposit info from EntryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * @notice Accept ETH transfers
     */
    receive() external payable {}
}
