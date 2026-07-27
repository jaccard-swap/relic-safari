// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { LibEIP712 } from "../libraries/LibEIP712.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Arrays } from "@openzeppelin/contracts/utils/Arrays.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

struct JaccardERC1155Permit {
    address owner;
    address spender;
    uint256 tokenId;
    uint256 amount;
    uint256 deadline;
    bytes4 salt;
}

/// @title JaccardERC1155Facet
/// @notice ERC1155 with MinHash storage for Jaccard similarity matching
contract JaccardERC1155Facet is ERC1155 {
    using Arrays for uint256[];
    using Arrays for address[];
    using ECDSA for bytes32;

    // ============ Constants ============
    
    bytes3 public constant FAUCET_PREFIX = 0xfaace7;
    
    bytes32 public constant JACCARD_ERC1155_PERMIT_TYPEHASH = keccak256(
        "JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)"
    );

    // ============ Events ============

    event JaccardERC1155PermitUsed(
        address indexed owner,
        address indexed spender,
        uint256 tokenId,
        uint256 amount,
        uint256 deadline,
        bytes4 salt,
        bytes signature
    );

    event Polymerized(
        address indexed owner,
        uint256 indexed targetTokenId,
        uint256 indexed consumedTokenId,
        uint256 essenceYield,
        bytes8[20] newMinHash
    );

    event TraitUpgraded(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 essenceCost,
        bytes8[20] newMinHash
    );

    // ============ Constructor ============
    
    constructor() ERC1155("") {}

    // ============ Initializer ============

    function initializeERC1155(string memory uri_) external {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bytes(uri_).length != 0, "Must be nonzero");
        require(bytes(s._uri).length == 0, "Already initialized");
        s._uri = uri_;
    }

    // ============ External Functions ============

    function setURI(string memory newuri) external {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();
        s._uri = newuri;
    }

    function getMinHashByTokenId(uint256 tokenId) external view returns (bytes8[20] memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.minHashes[tokenId];
    }

    function nextFaucetId() public returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(bytes32(abi.encodePacked(FAUCET_PREFIX, ++s.faucetIdCounter)));
    }

    function mintEssence(address to, uint256 amount) external {
        LibDiamond.enforceIsContractOwner();
        _mintEssenceERC20(to, amount);
    }

    function faucet(address to, uint256 amount, bytes8[20] calldata minHash) external returns (uint256) {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 id = nextFaucetId();
        s.minHashes[id] = minHash;
        _mint(to, id, amount, "");
        return id;
    }

    // ============ Permit Functions ============

    function hashPermit(JaccardERC1155Permit calldata permit) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    JACCARD_ERC1155_PERMIT_TYPEHASH,
                    permit.owner,
                    permit.spender,
                    permit.tokenId,
                    permit.amount,
                    permit.deadline,
                    permit.salt
                )
            )
        );
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

    // ============ Polymerase ============

    function polymerase(
        uint256 targetTokenId,
        uint256 consumedTokenId,
        address to,
        uint256 amount,
        bytes8[20] calldata newMinHash,
        uint256 essenceYield
    ) external returns (uint256) {
        // Match-count eligibility (and its tiering) is decided by the API
        // before this is ever called - enforceIsContractOwner means only
        // that trusted backend can reach this function, so there's no one
        // else to check the minHash against. Re-deriving it on-chain would
        // just be spending gas to double-check a caller we already trust.
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(
            balanceOf(to, targetTokenId) >= amount && balanceOf(to, consumedTokenId) >= amount,
            "Polymerase: Insufficient balance"
        );
        require(targetTokenId != consumedTokenId, "Polymerase: Cannot polymerase same token");

        _burn(to, consumedTokenId, amount);
        s.minHashes[targetTokenId] = newMinHash;

        if (essenceYield > 0) {
            _mintEssenceERC20(to, essenceYield);
        }

        emit Polymerized(to, targetTokenId, consumedTokenId, essenceYield, newMinHash);
        return targetTokenId;
    }

    // ============ Direct Essence Upgrade (Forge) ============

    // Spend Essence directly on one artifact - no second NFT consumed.
    // Eligibility (is this trait upgradeable, is it already maxed, what's
    // the correct cost) is decided off-chain by the trusted API, same as
    // polymerase above. For an Overflow spend (all real traits maxed), the
    // API passes the artifact's unchanged minHash through - Overflow isn't a
    // Jaccard-relevant trait, so this function has no opinion on whether
    // newMinHash actually differs from the current one.
    function upgradeTrait(
        uint256 tokenId,
        address owner,
        bytes8[20] calldata newMinHash,
        uint256 essenceCost
    ) external {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(balanceOf(owner, tokenId) >= 1, "Upgrade: not owner");

        _burnEssenceERC20(owner, essenceCost);
        s.minHashes[tokenId] = newMinHash;

        emit TraitUpgraded(owner, tokenId, essenceCost, newMinHash);
    }

    // ============ EIP-712 (shared diamond domain via LibEIP712) ============
    // Note: DOMAIN_SEPARATOR() exposed via EssenceFacet (ERC20Permit)

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return LibEIP712.hashTypedDataV4(structHash);
    }

    // ============ Internal Permit ============

    function _validateAndConsumePermit(
        JaccardERC1155Permit calldata p,
        bytes memory signature
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(p.deadline >= block.timestamp, "JaccardERC1155Permit: Permit expired");
        
        bytes32 digest = hashPermit(p);
        require(!s.usedJaccardERC1155Permits[digest], "JaccardERC1155Permit: Permit already used");

        address signer = digest.recover(signature);
        require(signer == p.owner, "JaccardERC1155Permit: Invalid signature");
        require(balanceOf(p.owner, p.tokenId) >= p.amount, "JaccardERC1155Permit: Insufficient balance");

        s.usedJaccardERC1155Permits[digest] = true;

        emit JaccardERC1155PermitUsed(p.owner, p.spender, p.tokenId, p.amount, p.deadline, p.salt, signature);
    }

    // ============ ERC1155 View Overrides (use LibAppStorage) ============

    function uri(uint256 /* id */) public view override returns (string memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._uri;
    }

    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc1155balances[id][account];
    }
    
    function isApprovedForAll(address account, address operator) public view override returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._operatorApprovals[account][operator];
    }

    /// @notice Check interface support - combines ERC1155 + diamond registered interfaces
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // Check diamond's registered interfaces (IDiamondCut, IDiamondLoupe, IERC173, etc.)
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        if (ds.supportedInterfaces[interfaceId]) {
            return true;
        }
        // Fall back to ERC1155's supportsInterface (IERC1155, IERC1155MetadataURI, IERC165)
        return super.supportsInterface(interfaceId);
    }

    // ============ Essence ERC20 Internal (cross-facet storage access) ============

    /// @dev ERC20 Transfer event for Essence minting
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @dev Mint Essence ERC20 directly via AppStorage (same diamond, shared storage)
    function _mintEssenceERC20(address to, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s._erc20totalSupply += amount;
        unchecked {
            s._erc20balances[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    /// @dev Burn Essence ERC20 directly via AppStorage. Deliberately not a
    /// call into EssenceFacet.burn() - a self-call (address(this).call(...))
    /// would make msg.sender the diamond's own address inside EssenceFacet's
    /// enforceIsContractOwner(), breaking that check. Same reasoning as
    /// _mintEssenceERC20 above: write shared AppStorage directly instead.
    function _burnEssenceERC20(address from, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 balance = s._erc20balances[from];
        require(balance >= amount, "Upgrade: insufficient essence");
        unchecked {
            s._erc20balances[from] = balance - amount;
        }
        s._erc20totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ============ ERC1155 Internal Overrides (use LibAppStorage) ============

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        if (ids.length != values.length) {
            revert ERC1155InvalidArrayLength(ids.length, values.length);
        }

        address operator = _msgSender();

        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids.unsafeMemoryAccess(i);
            uint256 value = values.unsafeMemoryAccess(i);

            if (from != address(0)) {
                uint256 fromBalance = s._erc1155balances[id][from];
                if (fromBalance < value) {
                    revert ERC1155InsufficientBalance(from, fromBalance, value, id);
                }
                unchecked {
                    s._erc1155balances[id][from] = fromBalance - value;
                }
            }

            if (to != address(0)) {
                s._erc1155balances[id][to] += value;
            }
        }

        if (ids.length == 1) {
            uint256 id = ids.unsafeMemoryAccess(0);
            uint256 value = values.unsafeMemoryAccess(0);
            emit TransferSingle(operator, from, to, id, value);
        } else {
            emit TransferBatch(operator, from, to, ids, values);
        }
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal override {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (operator == address(0)) {
            revert ERC1155InvalidOperator(address(0));
        }
        s._operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }
}
