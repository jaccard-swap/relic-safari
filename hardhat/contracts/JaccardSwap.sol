// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// ============ Structs from JaccardERC1155 ============

struct JaccardERC1155Permit {
    address owner;
    address spender;
    uint256 tokenId;
    uint256 amount;
    uint256 deadline;
    bytes4 salt;
}

interface IJaccardERC1155 {
    function transferFromWithPermit(
        JaccardERC1155Permit calldata permit,
        address to,
        bytes memory signature
    ) external;
    
    function getMinHashByTokenId(uint256 tokenId) external view returns (bytes32[5] memory);
}

// ============ ERC20 Permit ============

struct ERC20PermitData {
    address owner;
    address spender;
    uint256 value;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

// ============ Auction Structs ============

// Bid = bidder's intent to buy NFTs matching a MinHash similarity threshold
// Instead of exact tokenId, bidder specifies desired traits as MinHash
struct Bid {
    bytes4 salt;
    uint256 deadline;
    bytes32[5] targetMinHash; // Desired traits as 5-band MinHash
    uint8 minMatches;         // Similarity threshold: 2-5 bands must match
    ERC20PermitData permit;   // Payment authorization (amount = permit.value)
}

// Auction = auctioneer's NFT listing + their NFT permit (nested) + array of bids
struct Auction {
    bytes4 salt;
    uint256 deadline;
    address nft;
    address token;
    uint256 reservePrice;
    JaccardERC1155Permit nftPermit;
    bytes nftPermitSignature;
    Bid[] bids;           // Multiple bids, ordered highest to lowest
    bytes[] bidSignatures; // Corresponding signatures
}

contract JaccardSwap is EIP712 {
    using ECDSA for bytes32;

    event AuctionSettled(
        address indexed nft,
        address indexed token,
        uint256 indexed nftId,
        uint256 amount,
        address auctioneer,
        address winner,
        uint8 similarityMatches  // How many bands matched
    );

    // Type hashes
    bytes32 public constant ERC20_PERMIT_TYPEHASH = keccak256(
        "ERC20PermitData(address owner,address spender,uint256 value,uint256 deadline)"
    );
    
    // bytes32[5] encodes as keccak256(abi.encodePacked(arr[0]...arr[4]))
    bytes32 public constant BID_TYPEHASH = keccak256(
        "Bid(bytes4 salt,uint256 deadline,bytes32[5] targetMinHash,uint8 minMatches,ERC20PermitData permit)ERC20PermitData(address owner,address spender,uint256 value,uint256 deadline)"
    );

    bytes32 public constant JACCARD_PERMIT_TYPEHASH = keccak256(
        "JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)"
    );
    
    bytes32 public constant AUCTION_TYPEHASH = keccak256(
        "Auction(bytes4 salt,uint256 deadline,address nft,address token,uint256 reservePrice,JaccardERC1155Permit nftPermit,bytes nftPermitSignature)JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)"
    );

    mapping(bytes32 => bool) public usedBids;
    mapping(bytes32 => bool) public usedAuctions;

    constructor() EIP712("JaccardSwap", "1") {}

    // ============ Hash Functions ============

    function hashERC20Permit(ERC20PermitData calldata permit) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ERC20_PERMIT_TYPEHASH,
                permit.owner,
                permit.spender,
                permit.value,
                permit.deadline
            )
        );
    }

    function hashJaccardPermit(JaccardERC1155Permit calldata permit) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                JACCARD_PERMIT_TYPEHASH,
                permit.owner,
                permit.spender,
                permit.tokenId,
                permit.amount,
                permit.deadline,
                permit.salt
            )
        );
    }

    function hashBid(Bid calldata bid) public view returns (bytes32) {
        bytes32 permitHash = hashERC20Permit(bid.permit);
        // Fixed-size array: hash as keccak256(abi.encodePacked(...))
        bytes32 minHashHash = keccak256(abi.encodePacked(
            bid.targetMinHash[0],
            bid.targetMinHash[1],
            bid.targetMinHash[2],
            bid.targetMinHash[3],
            bid.targetMinHash[4]
        ));
        bytes32 structHash = keccak256(
            abi.encode(
                BID_TYPEHASH,
                bid.salt,
                bid.deadline,
                minHashHash,
                bid.minMatches,
                permitHash
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function hashAuction(Auction calldata auction) public view returns (bytes32) {
        bytes32 nftPermitHash = hashJaccardPermit(auction.nftPermit);
        bytes32 structHash = keccak256(
            abi.encode(
                AUCTION_TYPEHASH,
                auction.salt,
                auction.deadline,
                auction.nft,
                auction.token,
                auction.reservePrice,
                nftPermitHash,
                keccak256(auction.nftPermitSignature)
            )
        );
        return _hashTypedDataV4(structHash);
    }

    // ============ Similarity Matching ============

    /// @notice Count how many MinHash bands match between bid target and NFT
    function countMatches(
        bytes32[5] calldata targetMinHash,
        bytes32[5] memory nftMinHash
    ) public pure returns (uint8 matches) {
        for (uint8 i = 0; i < 5; i++) {
            if (targetMinHash[i] == nftMinHash[i]) {
                matches++;
            }
        }
    }

    // ============ Verify Functions ============

    function verifyBid(Bid calldata bid, bytes calldata signature) public view returns (address) {
        bytes32 digest = hashBid(bid);
        return digest.recover(signature);
    }

    function _tryPermitAndTransfer(
        address token,
        ERC20PermitData calldata permit,
        address to
    ) internal returns (bool) {
        try IERC20Permit(token).permit(
            permit.owner, permit.spender, permit.value,
            permit.deadline, permit.v, permit.r, permit.s
        ) {
            return IERC20(token).transferFrom(permit.owner, to, permit.value);
        } catch {
            if (IERC20(token).allowance(permit.owner, address(this)) >= permit.value) {
                return IERC20(token).transferFrom(permit.owner, to, permit.value);
            }
            return false;
        }
    }

    /// @dev Check if a bid is valid for the auction (excluding permit transfer)
    function _isBidValid(
        Bid calldata bid,
        bytes calldata bidSig,
        uint256 reservePrice,
        bytes32[5] memory nftMinHash
    ) internal view returns (bool valid, address bidder, uint8 matches) {
        if (bid.permit.value < reservePrice) return (false, address(0), 0);
        if (bid.deadline < block.timestamp) return (false, address(0), 0);
        if (bid.permit.deadline < block.timestamp) return (false, address(0), 0);
        if (bid.minMatches < 2 || bid.minMatches > 5) return (false, address(0), 0);
        
        matches = countMatches(bid.targetMinHash, nftMinHash);
        if (matches < bid.minMatches) return (false, address(0), 0);

        bytes32 bidHash = hashBid(bid);
        bidder = bidHash.recover(bidSig);
        if (bidder != bid.permit.owner) return (false, address(0), 0);
        if (bid.permit.spender != address(this)) return (false, address(0), 0);
        if (usedBids[bidHash]) return (false, address(0), 0);

        return (true, bidder, matches);
    }

    /**
     * @notice Consumes an auction - loops through bids highest to lowest
     * @dev 
     *   - Auctioneer signs Auction (includes their NFT permit)
     *   - Multiple bidders sign Bids (each includes their ERC20 permit)
     *   - Bids specify target MinHash + similarity threshold (minMatches)
     *   - Bids MUST be ordered highest to lowest amount
     *   - First valid bid with sufficient similarity wins
     *   - NO pre-approvals needed from any party!
     */
    function consumeAuction(
        Auction calldata auction,
        bytes calldata auctionSignature
    ) external {
        require(auction.deadline >= block.timestamp, "Auction expired");
        require(auction.nftPermit.deadline >= block.timestamp, "NFT permit expired");
        
        bytes32 auctionHash = hashAuction(auction);
        address auctioneer = auctionHash.recover(auctionSignature);
        require(auctioneer == auction.nftPermit.owner, "Auction signer must be NFT owner");
        require(!usedAuctions[auctionHash], "Auction already settled");
        require(auction.nftPermit.spender == address(this), "NFT permit not for this contract");

        require(auction.bids.length > 0, "No bids");
        require(auction.bids.length == auction.bidSignatures.length, "Bid/sig length mismatch");
        
        for (uint256 i = 1; i < auction.bids.length; i++) {
            require(auction.bids[i].permit.value <= auction.bids[i-1].permit.value, "Bids must be ordered highest to lowest");
        }

        // Get the NFT's MinHash for similarity matching
        bytes32[5] memory nftMinHash = IJaccardERC1155(auction.nft).getMinHashByTokenId(auction.nftPermit.tokenId);

        // Find winning bid
        for (uint256 i = 0; i < auction.bids.length; i++) {
            (bool valid, address bidder, uint8 matches) = _isBidValid(
                auction.bids[i],
                auction.bidSignatures[i],
                auction.reservePrice,
                nftMinHash
            );
            
            if (!valid) continue;

            if (_tryPermitAndTransfer(auction.token, auction.bids[i].permit, auctioneer)) {
                usedBids[hashBid(auction.bids[i])] = true;
                usedAuctions[auctionHash] = true;
                
                IJaccardERC1155(auction.nft).transferFromWithPermit(
                    auction.nftPermit,
                    bidder,
                    auction.nftPermitSignature
                );

                emit AuctionSettled(
                    auction.nft,
                    auction.token,
                    auction.nftPermit.tokenId,
                    auction.bids[i].permit.value,
                    auctioneer,
                    bidder,
                    matches
                );
                return;
            }
        }

        revert("No valid bids");
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
