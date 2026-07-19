// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
struct JaccardERC1155Permit {
    address owner;
    address spender;
    uint256 tokenId;
    uint256 amount;
    uint256 deadline;
    bytes4 salt;
}

contract JaccardERC1155 is ERC1155, EIP712, Ownable {
    mapping(bytes32 => bool) public usedJaccardERC1155Permits;
    
    bytes public constant JACCARD_ERC1155_PERMIT_TYPE = "JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)";
    bytes32 public constant JACCARD_ERC1155_PERMIT_TYPEHASH = keccak256(JACCARD_ERC1155_PERMIT_TYPE);

    event JaccardERC1155PermitUsed(
        address indexed owner,
        address indexed spender,
        uint256 tokenId,
        uint256 amount,
        uint256 deadline,
        bytes4 salt,
        bytes signature
    );

    mapping(uint256 => bytes32[5]) minHashes;

    // Token ID 0 = Essence (fungible in-game currency from polymerization)
    uint256 public constant ESSENCE_TOKEN_ID = 0;

    bytes3 public constant FAUCET_PREFIX = 0xfaace7;
    uint232 public faucetIdCounter;

    event Polymerized(
        address indexed owner,
        uint256 indexed targetTokenId,
        uint256 indexed consumedTokenId,
        uint256 essenceYield,
        bytes32[5] newMinHash
    );

    constructor()
     ERC1155("https://game.example/api/item/{id}.json")
     EIP712("JaccardERC1155", "1")
     Ownable(msg.sender)
     {
    }

    function getMinHashByTokenId(uint256 tokenId) public view returns (bytes32[5] memory) {
        return minHashes[tokenId];
    }

    function nextFaucetId() public returns (uint256) {
        return uint256(bytes32(abi.encodePacked(FAUCET_PREFIX, ++faucetIdCounter)));
    }

    /// @notice Mint essence tokens (ID 0) - fungible in-game currency
    function mintEssence(address to, uint256 amount) public onlyOwner {
        _mint(to, ESSENCE_TOKEN_ID, amount, "");
    }

    function faucet(address to, uint256 amount, bytes32[5] calldata minHash) public onlyOwner returns (uint256) {
        uint256 id = nextFaucetId();
        minHashes[id] = minHash;
        _mint(to, id, amount, "");
        return id;
    }

    function hashPermit(
        JaccardERC1155Permit calldata jaccardERC1155Permit
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    JACCARD_ERC1155_PERMIT_TYPEHASH,
                    jaccardERC1155Permit.owner,
                    jaccardERC1155Permit.spender,   
                    jaccardERC1155Permit.tokenId,
                    jaccardERC1155Permit.amount,
                    jaccardERC1155Permit.deadline,
                    jaccardERC1155Permit.salt
                )
            )
        );
    }

    function _validateAndConsumePermit(
        JaccardERC1155Permit calldata p,
        bytes memory signature
    ) internal {
        require(p.deadline >= block.timestamp, "JaccardERC1155Permit: Permit expired");
        
        bytes32 digest = hashPermit(p);
        require(!usedJaccardERC1155Permits[digest], "JaccardERC1155Permit: Permit already used");

        address signer = ECDSA.recover(digest, signature);
        require(signer == p.owner, "JaccardERC1155Permit: Invalid signature");
        require(balanceOf(p.owner, p.tokenId) >= p.amount, "JaccardERC1155Permit: Insufficient balance");

        usedJaccardERC1155Permits[digest] = true;

        emit JaccardERC1155PermitUsed(p.owner, p.spender, p.tokenId, p.amount, p.deadline, p.salt, signature);
    }

    function transferFromWithPermit(
        JaccardERC1155Permit calldata permit,
        address to,
        bytes memory signature
    ) external {
        _validateAndConsumePermit(permit, signature);
        require(msg.sender == permit.spender, "JaccardERC1155Permit: Caller not spender");
        
        _safeTransferFrom(permit.owner, to, permit.tokenId, permit.amount, "");
    }

    /// @notice Polymerize artifact B onto artifact A
    /// @dev Requires 2/5 minhash matches. A survives with updated traits, B is consumed.
    /// @param targetTokenId Artifact A - survives with upgraded traits
    /// @param consumedTokenId Artifact B - consumed, non-matching traits yield essence
    /// @param to Owner of both artifacts
    /// @param amount Amount to process (usually 1)
    /// @param newMinHash New MinHash for target artifact after upgrades
    /// @param essenceYield Amount of essence to mint from non-matching traits
    function polymerase(
        uint256 targetTokenId,
        uint256 consumedTokenId,
        address to,
        uint256 amount,
        bytes32[5] calldata newMinHash,
        uint256 essenceYield
    ) public onlyOwner returns (uint256) {
        // Verify ownership via balance (ERC1155 style)
        require(
            balanceOf(to, targetTokenId) >= amount && balanceOf(to, consumedTokenId) >= amount,
            "Polymerase: Insufficient balance"
        );
        require(targetTokenId != consumedTokenId, "Polymerase: Cannot polymerase same token");

        bytes32[5] memory minHashTarget = minHashes[targetTokenId];
        bytes32[5] memory minHashConsumed = minHashes[consumedTokenId];

        // Count matching minhash bands
        uint256 matches = 0;
        for (uint256 i = 0; i < 5; i++) {
            if (minHashTarget[i] == minHashConsumed[i]) matches++;
        }

        // Require ~40% similarity (2/5 matches) - allows 4/7 shared traits
        require(matches >= 2, "Polymerase: Need 2/5 minhash matches");

        // Burn consumed artifact (B)
        _burn(to, consumedTokenId, amount);

        // Update target artifact's (A) minHash with upgraded traits
        minHashes[targetTokenId] = newMinHash;

        // Mint essence from non-matching upgradeable traits
        if (essenceYield > 0) {
            _mint(to, ESSENCE_TOKEN_ID, essenceYield, "");
        }

        emit Polymerized(to, targetTokenId, consumedTokenId, essenceYield, newMinHash);

        return targetTokenId;
    }
}