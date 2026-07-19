// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibAppStorage, AppStorage, ERC20PermitData, JaccardERC1155Permit, Bid, Auction } from "../libraries/LibAppStorage.sol";
import { LibEIP712 } from "../libraries/LibEIP712.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title JaccardSwapFacet
/// @notice Auction settlement with MinHash similarity matching
contract JaccardSwapFacet {
    using ECDSA for bytes32;

    // ============ Events ============

    event AuctionSettled(
        address indexed nft,
        address indexed token,
        uint256 indexed nftId,
        uint256 amount,
        address auctioneer,
        address winner,
        uint8 similarityMatches
    );

    // ============ Type Hashes ============

    bytes32 public constant ERC20_PERMIT_TYPEHASH = keccak256(
        "ERC20PermitData(address owner,address spender,uint256 value,uint256 deadline)"
    );
    
    bytes32 public constant BID_TYPEHASH = keccak256(
        "Bid(bytes4 salt,uint256 deadline,bytes8[20] targetMinHash,uint8 minMatches,ERC20PermitData permit)ERC20PermitData(address owner,address spender,uint256 value,uint256 deadline)"
    );

    bytes32 public constant JACCARD_PERMIT_TYPEHASH = keccak256(
        "JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)"
    );
    
    bytes32 public constant AUCTION_TYPEHASH = keccak256(
        "Auction(bytes4 salt,uint256 deadline,address nft,address token,uint256 reservePrice,JaccardERC1155Permit nftPermit,bytes nftPermitSignature)JaccardERC1155Permit(address owner,address spender,uint256 tokenId,uint256 amount,uint256 deadline,bytes4 salt)"
    );

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
        // Listing all 20 elements individually (as the array grew from 5 -> 13 -> 20)
        // overflows the EVM's 16-slot stack ("stack too deep"); encodePacked
        // takes the calldata array directly instead.
        bytes32 minHashHash = keccak256(abi.encodePacked(bid.targetMinHash));
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
        return LibEIP712.hashTypedDataV4(structHash);
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
        return LibEIP712.hashTypedDataV4(structHash);
    }

    // ============ Similarity Matching ============

    function countMatches(
        bytes8[20] calldata targetMinHash,
        bytes8[20] memory nftMinHash
    ) public pure returns (uint8 matches) {
        for (uint8 i = 0; i < 20; i++) {
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

    // ============ Auction Settlement ============

    function consumeAuction(
        Auction calldata auction,
        bytes calldata auctionSignature
    ) external {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        require(auction.deadline >= block.timestamp, "Auction expired");
        require(auction.nftPermit.deadline >= block.timestamp, "NFT permit expired");
        
        bytes32 auctionHash = hashAuction(auction);
        address auctioneer = auctionHash.recover(auctionSignature);
        require(auctioneer == auction.nftPermit.owner, "Auction signer must be NFT owner");
        require(!s.usedAuctions[auctionHash], "Auction already settled");
        require(auction.nftPermit.spender == address(this), "NFT permit not for this contract");

        require(auction.bids.length > 0, "No bids");
        require(auction.bids.length == auction.bidSignatures.length, "Bid/sig length mismatch");
        
        for (uint256 i = 1; i < auction.bids.length; i++) {
            require(auction.bids[i].permit.value <= auction.bids[i-1].permit.value, "Bids must be ordered highest to lowest");
        }

        // Get the NFT's MinHash for similarity matching
        bytes8[20] memory nftMinHash = s.minHashes[auction.nftPermit.tokenId];

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
                s.usedBids[hashBid(auction.bids[i])] = true;
                s.usedAuctions[auctionHash] = true;
                
                // Internal transfer within diamond
                _transferNft(auction.nftPermit, bidder);

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

    // ============ View Functions ============

    function usedBids(bytes32 bidHash) external view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.usedBids[bidHash];
    }

    function usedAuctions(bytes32 auctionHash) external view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.usedAuctions[auctionHash];
    }

    // ============ Internal Functions ============

    function _transferNft(JaccardERC1155Permit calldata permit, address to) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        // Validate permit
        require(permit.deadline >= block.timestamp, "JaccardERC1155Permit: Permit expired");
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                LibEIP712.domainSeparatorV4(),
                keccak256(
                    abi.encode(
                        JACCARD_PERMIT_TYPEHASH,
                        permit.owner,
                        permit.spender,
                        permit.tokenId,
                        permit.amount,
                        permit.deadline,
                        permit.salt
                    )
                )
            )
        );
        require(!s.usedJaccardERC1155Permits[digest], "JaccardERC1155Permit: Permit already used");
        
        // Mark permit as used
        s.usedJaccardERC1155Permits[digest] = true;
        
        // Transfer via AppStorage (internal)
        uint256 fromBalance = s._erc1155balances[permit.tokenId][permit.owner];
        require(fromBalance >= permit.amount, "Insufficient balance");
        
        unchecked {
            s._erc1155balances[permit.tokenId][permit.owner] = fromBalance - permit.amount;
        }
        s._erc1155balances[permit.tokenId][to] += permit.amount;
    }

    function _isBidValid(
        Bid calldata bid,
        bytes calldata bidSig,
        uint256 reservePrice,
        bytes8[20] memory nftMinHash
    ) internal view returns (bool valid, address bidder, uint8 matches) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (bid.permit.value < reservePrice) return (false, address(0), 0);
        if (bid.deadline < block.timestamp) return (false, address(0), 0);
        if (bid.permit.deadline < block.timestamp) return (false, address(0), 0);
        // Bidder-tunable similarity gate, out of 20 hash functions -- kept
        // wide (2-20) so relic-safari swaps can dial from loose to exact.
        if (bid.minMatches < 2 || bid.minMatches > 20) return (false, address(0), 0);
        
        matches = countMatches(bid.targetMinHash, nftMinHash);
        if (matches < bid.minMatches) return (false, address(0), 0);

        bytes32 bidHash = hashBid(bid);
        bidder = bidHash.recover(bidSig);
        if (bidder != bid.permit.owner) return (false, address(0), 0);
        if (bid.permit.spender != address(this)) return (false, address(0), 0);
        if (s.usedBids[bidHash]) return (false, address(0), 0);

        return (true, bidder, matches);
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

}
