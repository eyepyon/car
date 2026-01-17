// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VehicleRegistry
 * @notice Privacy-preserving registry for vehicle-to-wallet mappings
 * @dev Stores only commitments and metadata, never raw vehicle identification data
 *
 * Privacy Design:
 * - Stores vehicle commitment (hash) instead of actual plate number
 * - Supports ZK-proof verification (extensible)
 * - Enables selective disclosure of vehicle attributes
 * - No reverse lookup from commitment to raw data possible
 *
 * Use Cases:
 * - Verify vehicle ownership without revealing plate number
 * - Link vehicle to wallet address privately
 * - Enable privacy-preserving vehicle services (parking, tolls, insurance)
 * - Support regulatory compliance with privacy protection
 */
contract VehicleRegistry is Ownable {
    struct VehicleRecord {
        bytes32 commitment; // keccak256(abi.encodePacked(plateNumber, salt))
        address walletAddress; // Associated AA wallet
        uint256 registeredAt; // Registration timestamp
        bool isActive; // Status flag
        bytes32 metadataHash; // Hash of additional metadata (model, year, etc.)
    }

    /// @notice Mapping from commitment to vehicle record
    mapping(bytes32 => VehicleRecord) public vehicles;

    /// @notice Mapping from wallet address to commitment (one-to-one)
    mapping(address => bytes32) public walletToVehicle;

    /// @notice Authorized verifiers (e.g., parking operators, toll systems)
    mapping(address => bool) public authorizedVerifiers;

    event VehicleRegistered(
        bytes32 indexed commitment,
        address indexed walletAddress,
        uint256 timestamp
    );

    event VehicleUpdated(
        bytes32 indexed oldCommitment,
        bytes32 indexed newCommitment,
        address indexed walletAddress
    );

    event VehicleDeactivated(
        bytes32 indexed commitment,
        address indexed walletAddress
    );

    event VerifierAuthorized(address indexed verifier, bool authorized);

    modifier onlyAuthorizedVerifier() {
        require(
            authorizedVerifiers[msg.sender] || msg.sender == owner(),
            "VehicleRegistry: not authorized verifier"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a vehicle with its commitment
     * @param commitment Hash of vehicle data (keccak256(abi.encodePacked(plateNumber, salt)))
     * @param walletAddress Associated AA wallet address
     * @param metadataHash Hash of vehicle metadata (optional)
     *
     * @dev CRITICAL: commitment must be computed off-chain
     *      Never pass raw plate number to any on-chain function
     */
    function registerVehicle(
        bytes32 commitment,
        address walletAddress,
        bytes32 metadataHash
    ) external {
        require(commitment != bytes32(0), "VehicleRegistry: invalid commitment");
        require(walletAddress != address(0), "VehicleRegistry: invalid wallet");
        require(
            vehicles[commitment].commitment == bytes32(0),
            "VehicleRegistry: already registered"
        );
        require(
            walletToVehicle[walletAddress] == bytes32(0),
            "VehicleRegistry: wallet already linked"
        );

        vehicles[commitment] = VehicleRecord({
            commitment: commitment,
            walletAddress: walletAddress,
            registeredAt: block.timestamp,
            isActive: true,
            metadataHash: metadataHash
        });

        walletToVehicle[walletAddress] = commitment;

        emit VehicleRegistered(commitment, walletAddress, block.timestamp);
    }

    /**
     * @notice Update vehicle commitment (e.g., when changing privacy parameters)
     * @param oldCommitment Current commitment
     * @param newCommitment New commitment
     *
     * @dev Only the associated wallet can update
     */
    function updateVehicleCommitment(
        bytes32 oldCommitment,
        bytes32 newCommitment
    ) external {
        require(
            vehicles[oldCommitment].walletAddress == msg.sender,
            "VehicleRegistry: not vehicle owner"
        );
        require(
            vehicles[oldCommitment].isActive,
            "VehicleRegistry: vehicle not active"
        );
        require(
            vehicles[newCommitment].commitment == bytes32(0),
            "VehicleRegistry: new commitment already exists"
        );

        address walletAddress = vehicles[oldCommitment].walletAddress;
        VehicleRecord memory record = vehicles[oldCommitment];

        // Create new record
        vehicles[newCommitment] = VehicleRecord({
            commitment: newCommitment,
            walletAddress: walletAddress,
            registeredAt: record.registeredAt,
            isActive: true,
            metadataHash: record.metadataHash
        });

        // Deactivate old record
        vehicles[oldCommitment].isActive = false;

        // Update reverse mapping
        walletToVehicle[walletAddress] = newCommitment;

        emit VehicleUpdated(oldCommitment, newCommitment, walletAddress);
    }

    /**
     * @notice Deactivate a vehicle record
     * @param commitment Vehicle commitment to deactivate
     *
     * @dev Only the associated wallet can deactivate
     */
    function deactivateVehicle(bytes32 commitment) external {
        require(
            vehicles[commitment].walletAddress == msg.sender,
            "VehicleRegistry: not vehicle owner"
        );
        require(
            vehicles[commitment].isActive,
            "VehicleRegistry: already inactive"
        );

        vehicles[commitment].isActive = false;
        delete walletToVehicle[msg.sender];

        emit VehicleDeactivated(commitment, msg.sender);
    }

    /**
     * @notice Verify if a commitment is registered and active
     * @param commitment Vehicle commitment to verify
     * @return isRegistered True if registered and active
     */
    function verifyVehicleRegistration(bytes32 commitment)
        external
        view
        onlyAuthorizedVerifier
        returns (bool isRegistered)
    {
        return vehicles[commitment].isActive;
    }

    /**
     * @notice Get vehicle record by commitment
     * @param commitment Vehicle commitment
     * @return record Vehicle record
     *
     * @dev Only authorized verifiers can access
     */
    function getVehicleRecord(bytes32 commitment)
        external
        view
        onlyAuthorizedVerifier
        returns (VehicleRecord memory record)
    {
        require(
            vehicles[commitment].commitment != bytes32(0),
            "VehicleRegistry: vehicle not found"
        );
        return vehicles[commitment];
    }

    /**
     * @notice Get commitment by wallet address
     * @param walletAddress Wallet address
     * @return commitment Vehicle commitment
     */
    function getCommitmentByWallet(address walletAddress)
        external
        view
        returns (bytes32 commitment)
    {
        require(
            msg.sender == walletAddress || authorizedVerifiers[msg.sender] || msg.sender == owner(),
            "VehicleRegistry: not authorized"
        );
        return walletToVehicle[walletAddress];
    }

    /**
     * @notice Verify vehicle ownership with proof
     * @param commitment Claimed vehicle commitment
     * @param walletAddress Claimed wallet address
     * @return isValid True if claim is valid
     *
     * @dev This is a simple verification. For ZK proofs, extend this function
     */
    function verifyOwnership(
        bytes32 commitment,
        address walletAddress
    ) external view onlyAuthorizedVerifier returns (bool isValid) {
        return vehicles[commitment].walletAddress == walletAddress &&
               vehicles[commitment].isActive;
    }

    /**
     * @notice Authorize or revoke verifier
     * @param verifier Address to authorize/revoke
     * @param authorized True to authorize, false to revoke
     *
     * @dev Only owner can manage verifiers
     */
    function setVerifierAuthorization(address verifier, bool authorized)
        external
        onlyOwner
    {
        authorizedVerifiers[verifier] = authorized;
        emit VerifierAuthorized(verifier, authorized);
    }

    /**
     * @notice Batch register vehicles
     * @param commitments Array of vehicle commitments
     * @param walletAddresses Array of wallet addresses
     * @param metadataHashes Array of metadata hashes
     */
    function registerVehicleBatch(
        bytes32[] calldata commitments,
        address[] calldata walletAddresses,
        bytes32[] calldata metadataHashes
    ) external {
        require(
            commitments.length == walletAddresses.length &&
            commitments.length == metadataHashes.length,
            "VehicleRegistry: array length mismatch"
        );

        for (uint256 i = 0; i < commitments.length; i++) {
            // Note: This will revert if any registration fails
            // Consider implementing a version that continues on error if needed
            this.registerVehicle(
                commitments[i],
                walletAddresses[i],
                metadataHashes[i]
            );
        }
    }

    /**
     * @notice Update metadata hash for a vehicle
     * @param commitment Vehicle commitment
     * @param newMetadataHash New metadata hash
     */
    function updateMetadata(bytes32 commitment, bytes32 newMetadataHash)
        external
    {
        require(
            vehicles[commitment].walletAddress == msg.sender,
            "VehicleRegistry: not vehicle owner"
        );
        require(
            vehicles[commitment].isActive,
            "VehicleRegistry: vehicle not active"
        );

        vehicles[commitment].metadataHash = newMetadataHash;
    }
}
