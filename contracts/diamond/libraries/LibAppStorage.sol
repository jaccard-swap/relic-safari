// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// ============ Structs ============

struct ERC20PermitData {
    address owner;
    address spender;
    uint256 value;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

struct JaccardERC1155Permit {
    address owner;
    address spender;
    uint256 tokenId;
    uint256 amount;
    uint256 deadline;
    bytes4 salt;
}

struct Bid {
    bytes4 salt;
    uint256 deadline;
    bytes32[5] targetMinHash;
    uint8 minMatches;
    ERC20PermitData permit;
}

struct Auction {
    bytes4 salt;
    uint256 deadline;
    address nft;
    address token;
    uint256 reservePrice;
    JaccardERC1155Permit nftPermit;
    bytes nftPermitSignature;
    Bid[] bids;
    bytes[] bidSignatures;
}

// ============ App Storage ============

struct AppStorage {
    // ---- ERC1155 State (OZ compatible layout) ----
    mapping(uint256 id => mapping(address account => uint256)) _erc1155balances;
    mapping(address account => mapping(address operator => bool)) _operatorApprovals;
    string _uri;

    // ---- JaccardERC1155 State ----
    mapping(uint256 => bytes32[5]) minHashes;
    mapping(bytes32 => bool) usedJaccardERC1155Permits;
    uint232 faucetIdCounter;

    // ---- JaccardSwap State ----
    mapping(bytes32 => bool) usedBids;
    mapping(bytes32 => bool) usedAuctions;

    // ---- Essence ERC20 State ----
    mapping(address account => uint256) _erc20balances;
    mapping(address account => mapping(address spender => uint256)) _erc20allowances;
    uint256 _erc20totalSupply;
    string _erc20name;
    string _erc20symbol;
    mapping(address account => uint256) _erc20nonces; // for permit
}

// ============ Library ============

library LibAppStorage {
    bytes32 constant DIAMOND_APP_STORAGE_POSITION = keccak256("jaccard.app.storage");

    function diamondStorage() internal pure returns (AppStorage storage ds) {
        bytes32 position = DIAMOND_APP_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}

