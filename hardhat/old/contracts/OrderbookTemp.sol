// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "../registry/ITokenRegistry.sol";
import "./interfaces/IEIP3009.sol";
import "./OrderbookAccessControl.sol";

struct EIP4494Permit {
    address owner;
    address spender;
    uint256 tokenId;
    uint256 deadline;
    bytes4 salt;
}

struct EIP3009Permit {
    address from;
    address to;
    uint256 value;
    uint256 validAfter;
    uint256 validBefore;
    bytes32 nonce;
}

struct Bid {
    bytes4 salt;
    uint256 deadline;
    uint256 feeBps; // unity = 10000;
    uint256 tokenId;
    EIP3009Permit permit;
    bytes permitSignature;
}

struct Ask {
    bytes4 salt;
    uint256 deadline;
    uint256 usdcAmount;
    EIP4494Permit permit;
    bytes permitSignature;
}

struct Trade {
    bytes4 salt;
    uint256 deadline;
    Bid bid;
    Ask ask;
    bytes bidSignature;
    bytes askSignature;
}

contract Orderbook is EIP712, OrderbookAccessControl {
    
    IERC721 public immutable registryERC721;
    ITokenRegistry public immutable tokenRegistry;
    IEIP3009 public immutable usdc;
    
    //bytes public constant EIP4494_PERMIT_TYPE = "EIP4494Permit(address owner,address spender,uint256 tokenId,uint256 deadline,bytes4 salt)";
    //bytes32 public constant EIP4494_PERMIT_TYPEHASH = keccak256(EIP4494_PERMIT_TYPE);
    bytes32 public constant EIP4494_PERMIT_TYPEHASH = 0xf545647804ae149c37d476ab2cfdbe1089b41916ab144f79326377246a049462; 
    
    //bytes public constant EIP3009_PERMIT_TYPE = "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";
    //bytes32 public constant EIP3009_PERMIT_TYPEHASH = keccak256(EIP3009_PERMIT_TYPE);
    bytes32 public constant EIP3009_PERMIT_TYPEHASH = 0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;
    
    //bytes public constant  Ask_TYPE = "Ask(bytes4 salt,uint256 deadline,uint256 usdcAmount,EIP4494Permit permit,bytes permitSignature)EIP4494Permit(address owner,address spender,uint256 tokenId,uint256 deadline,bytes4 salt)";
    //bytes32 public constant ASK_TYPEHASH = keccak256(Ask_TYPE);
    bytes32 public constant ASK_TYPEHASH = 0xca02aa5d9045779f01725b9928079e26afd9bf4b4d3f58345eb8a89d08808ddd;
    
    //bytes public constant  Bid_TYPE = "Bid(bytes4 salt,uint256 deadline,uint256 feeBps,uint256 tokenId,TransferWithAuthorization permit,bytes permitSignature)TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";
    //bytes32 public constant BID_TYPEHASH = keccak256(Bid_TYPE);
    bytes32 public constant BID_TYPEHASH = 0x45c120e81b7da4509bb2895056143ccc2f68b1b4e577dbce9e71d4a94b8ee1da;
    
    //bytes public constant  Trade_TYPE = "Trade(bytes4 salt,uint256 deadline,Bid bid,Ask ask,bytes bidSignature,bytes askSignature)Ask(bytes4 salt,uint256 deadline,uint256 usdcAmount,EIP4494Permit permit,bytes permitSignature)Bid(bytes4 salt,uint256 deadline,uint256 feeBps,uint256 tokenId,TransferWithAuthorization permit,bytes permitSignature)EIP4494Permit(address owner,address spender,uint256 tokenId,uint256 deadline,bytes4 salt)TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";
    //bytes32 public constant TRADE_TYPEHASH = keccak256(Trade_TYPE); 
    bytes32 public constant TRADE_TYPEHASH = 0xfc4e4262d6c2bcc68c4c7cea6a0e37ded6e9c77f44070d34bb0c2cb0d8dd15c2;

    address public tradeFeeRecipient;
    uint256 public constant BPS_100_PERCENT = 10000;


    mapping(bytes32 => bool) public usedEIP4494Permits;
    mapping(bytes32 => bool) public usedBids;
    mapping(bytes32 => bool) public usedAsks;
    mapping(bytes32 => bool) public usedTrades;

    event EIP4494PermitUsed(
        address indexed owner,
        address indexed spender,
        uint256 indexed tokenId,
        uint256 deadline,
        bytes4 salt,
        bytes signature
    );

    event TradeExecuted(
        address indexed bidder,
        address indexed asker,
        uint256 indexed nftTokenId,
        address erc20Token,
        uint256 amount,
        bytes tradeSignature,
        uint256 feeAccrued
    );

    /**
     * @notice Initializes the Orderbook contract
     * @dev Sets up EIP712 domain separator and contract dependencies
     * @param _registry Address of the NFT registry contract
     * @param name EIP712 domain name for signature verification
     * @param version EIP712 domain version for signature verification
     * @param _usdc Address of the USDC token contract implementing EIP3009
     */
    constructor(
        address _registry,
        string memory name,
        string memory version,
        address _usdc,
        address _tradeFeeRecipient
    ) EIP712(name, version) OrderbookAccessControl()  {
        registryERC721 = IERC721(_registry);
        tokenRegistry = ITokenRegistry(_registry);
        usdc = IEIP3009(_usdc);
        tradeFeeRecipient = _tradeFeeRecipient;
    }

    function setTradeFeeRecipient(address _tradeFeeRecipient) public onlyAdmin {
        tradeFeeRecipient = _tradeFeeRecipient;
    }


    /**
     * @notice Computes the EIP712 hash for an EIP4494 NFT permit
     * @dev Uses the contract's domain separator for proper EIP712 compliance
     * @param eip4494Permit The NFT permit data to hash
     * @return The EIP712 compliant hash of the permit
     */
    function hashPermit(
        EIP4494Permit calldata eip4494Permit
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    EIP4494_PERMIT_TYPEHASH,
                    eip4494Permit.owner,
                    eip4494Permit.spender,
                    eip4494Permit.tokenId,
                    eip4494Permit.deadline,
                    eip4494Permit.salt
                )
            )
        );
    }

    /**
     * @notice Executes an EIP4494 NFT permit to approve token spending
     * @dev Verifies signature, checks ownership, and approves the spender
     * @param eip4494Permit The NFT permit containing approval details
     * @param signature The permit signature from the token owner
     * @custom:security Only callable by trusted traders
     * @custom:security Prevents replay attacks using permit digest tracking
     */
    function permit(
        EIP4494Permit calldata eip4494Permit,
        bytes memory signature
    ) private {
        require(eip4494Permit.deadline >= block.timestamp, "EIP4494Permit: Permit expired");
        
        bytes32 digest = hashPermit(eip4494Permit);
        require(!usedEIP4494Permits[digest], "EIP4494Permit: Permit already used");

        address signer = ECDSA.recover(digest, signature);
        require(signer == eip4494Permit.owner, "EIP4494Permit: Invalid signature");

        bytes32 proofOfIntegrity = tokenRegistry.getTokenProofOfIntegrity(
            eip4494Permit.tokenId
        );
        require(tokenRegistry.ownerOf(proofOfIntegrity) == eip4494Permit.owner, "EIP4494Permit: Not token owner");
        
        usedEIP4494Permits[digest] = true;

        registryERC721.approve(
            eip4494Permit.spender,
            eip4494Permit.tokenId
        );
        emit EIP4494PermitUsed(
            eip4494Permit.owner,
            eip4494Permit.spender,
            eip4494Permit.tokenId,
            eip4494Permit.deadline,
            eip4494Permit.salt,
            signature
        );
    }

    /**
     * @notice Transfers an NFT using an EIP4494 permit
     * @dev Combines permit execution with immediate transfer in one transaction
     * @param eip4494Permit The NFT permit containing transfer authorization
     * @param to The recipient address for the NFT
     * @param signature The permit signature from the token owner
     * @custom:security Only callable by trusted traders
     */
    function transferFromWithPermit(
        EIP4494Permit calldata eip4494Permit,
        address to,
        bytes memory signature
    ) private {
        permit(eip4494Permit, signature);
        registryERC721.transferFrom(
            eip4494Permit.owner,
            to,
            eip4494Permit.tokenId
        );
    }

    /**
     * @notice Validates a bid and its signature
     * @dev Verifies bid deadline, signature authenticity, and prevents replay attacks
     * @param bid The bid data containing payment authorization
     * @param signature The bid signature from the bidder
     * @return The hash of the validated bid for trade verification
     * @custom:security Marks bid as used to prevent replay attacks
     */
    function checkBid(
        Bid calldata bid,
        bytes memory signature
    ) private returns (bytes32) {
        require(bid.deadline >= block.timestamp, "Bid expired");
        // Calculate nested struct hashes for EIP712
        bytes32 bidPermitHash = keccak256(
            abi.encode(
                EIP3009_PERMIT_TYPEHASH,
                bid.permit.from,
                bid.permit.to,
                bid.permit.value,
                bid.permit.validAfter,
                bid.permit.validBefore,
                bid.permit.nonce
            )
        );
        
        bytes32 bidHash = keccak256(
            abi.encode(
                BID_TYPEHASH,
                bid.salt,
                bid.deadline,
                bid.feeBps,
                bid.tokenId,
                bidPermitHash,
                keccak256(bid.permitSignature)
            )
        );

        bytes32 bidDigest = _hashTypedDataV4(bidHash);
        address bidSigner = ECDSA.recover(bidDigest, signature);
        require(bidSigner == bid.permit.from, "Invalid bid signature");
        require(!usedBids[bidDigest], "Bid already used");
        usedBids[bidDigest] = true;
        return bidHash;
    }

    /**
     * @notice Validates an ask and its signature
     * @dev Verifies ask deadline, signature authenticity, and prevents replay attacks
     * @param ask The ask data containing NFT sale authorization
     * @param signature The ask signature from the NFT owner
     * @return The hash of the validated ask for trade verification
     * @custom:security Marks ask as used to prevent replay attacks
     */
    function checkAsk(
        Ask calldata ask,
        bytes memory signature
    ) private returns (bytes32) {
        require(ask.deadline >= block.timestamp, "Ask expired");
        bytes32 askPermitHash = keccak256(
            abi.encode(
                EIP4494_PERMIT_TYPEHASH,
                ask.permit.owner,
                ask.permit.spender,
                ask.permit.tokenId,
                ask.permit.deadline,
                ask.permit.salt
            )
        );
        
        bytes32 askHash = keccak256(
            abi.encode(
                ASK_TYPEHASH,
                ask.salt,
                ask.deadline,
                ask.usdcAmount,
                askPermitHash,
                keccak256(ask.permitSignature)
            )
        );

        bytes32 askDigest = _hashTypedDataV4(askHash);
        address askSigner = ECDSA.recover(askDigest, signature);
        require(askSigner == ask.permit.owner, "Invalid ask signature");
        require(!usedAsks[askDigest], "Ask already used");
        usedAsks[askDigest] = true;
        return askHash;
    }
        
    

    /**
     * @notice Executes a trade between a bid and ask
     * @dev Validates all signatures, transfers USDC and NFT, handles refunds
     * @param trade The complete trade data containing bid, ask, and execution details
     * @param signature The trade signature from the trusted trader
     * @custom:security Only callable by trusted callers
     * @custom:security Validates bid amount covers ask price
     * @custom:security Ensures NFT IDs match between bid and ask
     * @custom:security Automatically refunds excess bid amount to bidder
     * @custom:flow 1. Validates trade parameters and signatures
     * @custom:flow 2. Pulls USDC from bidder using EIP3009 permit
     * @custom:flow 3. Refunds excess amount if bid > ask
     * @custom:flow 4. Transfers ask amount to seller
     * @custom:flow 5. Transfers NFT to bidder using EIP4494 permit
     */
    function executeTrade(
        Trade calldata trade,
        bytes memory signature
    ) public onlyTrustedCaller() {
        require(trade.deadline >= block.timestamp, "Permit expired");
        require(trade.bid.tokenId == trade.ask.permit.tokenId, "NFT ID mismatch");
        require(trade.bid.permit.value >= trade.ask.usdcAmount, "Bid cant cover Ask");
        
        bytes32 bidHash = checkBid(trade.bid, trade.bidSignature); 
        bytes32 askHash = checkAsk(trade.ask, trade.askSignature); 
        
        // Calculate trade digest with proper EIP712 domain separation
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TRADE_TYPEHASH,
                    trade.salt,
                    trade.deadline,
                    bidHash,
                    askHash,
                    keccak256(trade.bidSignature),
                    keccak256(trade.askSignature)
                )
            )
        );
        require(hasTrustedTraderRole(ECDSA.recover(digest, signature)), "Trade: invalid signature");

        // Pull the bidders usdc into the contract
        usdc.transferWithAuthorization(
            trade.bid.permit.from,
            address(this),  // trade.ask.permit.owner should always be the orderbook address
            trade.bid.permit.value,
            trade.bid.permit.validAfter,
            trade.bid.permit.validBefore,
            trade.bid.permit.nonce,
            trade.bid.permitSignature
        );
        
        uint256 refund = trade.bid.permit.value - trade.ask.usdcAmount;
        if (refund > 0) {
            usdc.transfer(trade.bid.permit.from, refund);
        }

        uint256 feeUSDC = 0;
        if (trade.bid.feeBps > 0) {
            // buyback offer courtyard offers to purchase an nft, accepting this trade incurs a transaction fee
            // this transaction fee manifests as deducting the a percentage from the sticker price
            require(trade.bid.feeBps <= BPS_100_PERCENT, "Trade: fee too high");
            feeUSDC = trade.ask.usdcAmount * trade.bid.feeBps / BPS_100_PERCENT;
            uint256 usdcForNftSeller = trade.ask.usdcAmount - feeUSDC;
            usdc.transfer(tradeFeeRecipient, feeUSDC);
            usdc.transfer(trade.ask.permit.owner, usdcForNftSeller);
        } else {
            // provide usdc to the nft seller
            usdc.transfer(trade.ask.permit.owner, trade.ask.usdcAmount);
        }

        // Send the nft to the bidder
        transferFromWithPermit(trade.ask.permit, trade.bid.permit.from, trade.ask.permitSignature);

        emit TradeExecuted(
            trade.bid.permit.from,
            trade.ask.permit.owner,
            trade.ask.permit.tokenId,
            address(usdc),
            trade.ask.usdcAmount,
            signature,
            feeUSDC
        );
    }

    /**
     * @notice Returns the EIP712 domain separator for this contract
     * @dev Used for signature verification and EIP712 compliance
     * @return The domain separator hash
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
