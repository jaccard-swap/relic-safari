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

// MinHash fingerprint: 20 independent hash functions, 8 bytes (64-bit) each.
// bytes8[20] tight-packs to exactly 5 storage slots (4 elements/slot, zero
// padding) -- the previous bytes32[5] layout used 5 slots for only 5 hash
// functions. 64 bits/hash is already far past the birthday-bound needed to
// avoid spurious collisions at any realistic collection size, so widening to
// bytes16/bytes32 buys no extra accuracy, only wasted slots; accuracy instead
// comes from the *count* of hash functions (lower-variance Jaccard estimate).
//
// A further gas-golfed layout (not done here -- optimizing for readability
// over squeezing out the last bit of gas) would concatenate 4 bytes8 hashes
// by hand into each bytes32 word (mapping(uint256 => bytes32[5])) and extract
// lanes via (word >> (i*64)) & type(uint64).max when comparing. Storage cost
// is identical (5 slots either way, since bytes8[20] already packs for free)
// but hand-packing avoids two costs the compiler doesn't optimize away for
// arrays of sub-word elements:
//   1. copying bytes8[20] storage->memory unpacks every element into its own
//      32-byte memory word (20 MSTOREs + a shift/mask per element) instead of
//      a straight 5-word copy.
//   2. ABI encoding of bytes8[20] in calldata (faucet(), Bid.targetMinHash)
//      pads every element to a full 32-byte word -- 640 bytes on the wire vs.
//      160 bytes if pre-packed into bytes32[5]. Fixed-size arrays of value
//      types are never tightly packed in calldata/memory, only in storage.
struct Bid {
    bytes4 salt;
    uint256 deadline;
    bytes8[20] targetMinHash;
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
    // See gas-optimization note on Bid.targetMinHash above.
    mapping(uint256 => bytes8[20]) minHashes;
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

    // ---- Badges / Collections State ----
    // cupboardKey = keccak256(site, age, material), computed off-chain (see
    // shared/constants getCupboardKey) - a cupboard is complete once its
    // owner holds one fully-upgraded artifact per Form value sharing that
    // Site+Age+Material combination.
    mapping(uint256 => address) badgeOwner;
    mapping(uint256 => bool) badgeLocked;
    mapping(uint256 => bytes32) badgeCupboard;
    mapping(address => uint256) ownerBadgeCount;
    uint256 nextBadgeId;
    mapping(address => mapping(bytes32 => bool)) cupboardCompleted;
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

