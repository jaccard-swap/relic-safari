import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { network } from 'hardhat';
import { parseEther, toHex, type WalletClient, type PublicClient } from 'viem';

// EIP-712 Type definitions
const ERC20PermitDataTypes = {
  ERC20PermitData: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ]
} as const;

const BidTypes = {
  Bid: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'targetMinHash', type: 'bytes32[5]' },
    { name: 'minMatches', type: 'uint8' },
    { name: 'permit', type: 'ERC20PermitData' },
  ],
  ...ERC20PermitDataTypes
} as const;

const JaccardERC1155PermitTypes = {
  JaccardERC1155Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'salt', type: 'bytes4' },
  ]
} as const;

const AuctionTypes = {
  Auction: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nft', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'reservePrice', type: 'uint256' },
    { name: 'nftPermit', type: 'JaccardERC1155Permit' },
    { name: 'nftPermitSignature', type: 'bytes' },
  ],
  ...JaccardERC1155PermitTypes
} as const;

// Helper to generate random salt
function randomSalt(): `0x${string}` {
  return toHex(Math.floor(Math.random() * 0xffffffff), { size: 4 });
}

// Helper to split signature into v, r, s
function splitSignature(sig: `0x${string}`) {
  const sigNoPrefix = sig.slice(2);
  const r = ('0x' + sigNoPrefix.slice(0, 64)) as `0x${string}`;
  const s = ('0x' + sigNoPrefix.slice(64, 128)) as `0x${string}`;
  const v = parseInt(sigNoPrefix.slice(128, 130), 16);
  return { v, r, s };
}

describe("JaccardSwap", () => {
  const thousand = parseEther('1000');
  const hundred = parseEther('100');
  const oneHour = 3600;
  
  let chainId: number;
  let auctionDomain: any;
  let nftDomain: any;
  let tokenDomain: any;
  
  let jaccardSwapAddr: `0x${string}`;
  let exampleTokenAddr: `0x${string}`;
  let jaccardNftAddr: `0x${string}`;
  
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let auctioneer: WalletClient;
  let bidder1: WalletClient;
  let bidder2: WalletClient;
  
  let exampleToken: any;
  let jaccardNft: any;
  let jaccardSwap: any;

  before(async () => {
    const { viem } = await network.connect();
    publicClient = await viem.getPublicClient();
    [deployer, auctioneer, bidder1, bidder2] = await viem.getWalletClients();
    
    chainId = await publicClient.getChainId();

    // Deploy contracts
    jaccardSwap = await viem.deployContract('JaccardSwap');
    exampleToken = await viem.deployContract('MockERC20');
    jaccardNft = await viem.deployContract('JaccardERC1155');

    jaccardSwapAddr = jaccardSwap.address;
    exampleTokenAddr = exampleToken.address;
    jaccardNftAddr = jaccardNft.address;

    // EIP-712 domains
    auctionDomain = {
      name: 'JaccardSwap',
      version: '1',
      chainId,
      verifyingContract: jaccardSwapAddr,
    };

    nftDomain = {
      name: 'JaccardERC1155',
      version: '1',
      chainId,
      verifyingContract: jaccardNftAddr,
    };

    // Mint NFT to auctioneer (with dummy minHash)
    const dummyMinHash: readonly `0x${string}`[] = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000000000000000000000000000004',
      '0x0000000000000000000000000000000000000000000000000000000000000005',
    ] as const;
    
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 1n, dummyMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 1n, dummyMinHash]);

    // Give bidders tokens via faucet
    await exampleToken.write.faucet([], { account: bidder1.account! });
    await exampleToken.write.faucet([], { account: bidder2.account! });

    console.log('JaccardSwap:', jaccardSwapAddr);
    console.log('ExampleToken:', exampleTokenAddr);
    console.log('JaccardERC1155:', jaccardNftAddr);

    // Store for use in tests
    (globalThis as any).firstNftTokenId = nftTokenId;
  });

  it("settles an auction with ERC20 permit (no pre-approvals)", async () => {
    const nftTokenId = (globalThis as any).firstNftTokenId as bigint;
    const bidAmount = hundred;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);

    // Get initial balances
    const bidder1TokenBefore = await exampleToken.read.balanceOf([bidder1.account!.address]);
    const auctioneerTokenBefore = await exampleToken.read.balanceOf([auctioneer.account!.address]);
    const bidder1NftBefore = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    const auctioneerNftBefore = await jaccardNft.read.balanceOf([auctioneer.account!.address, nftTokenId]);

    // 1. Auctioneer signs NFT permit (for JaccardERC1155)
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    // 2. Auctioneer creates and signs Auction
    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice: hundred,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // 4. Bidder signs ERC20 permit (for ExampleToken which has ERC20Permit)
    const bidderNonce = await exampleToken.read.nonces([bidder1.account!.address]);
    
    const erc20PermitSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        nonce: bidderNonce,
        deadline,
      },
    });

    const { v, r, s } = splitSignature(erc20PermitSig);

    // 5. Bidder creates and signs Bid
    // Get the NFT's MinHash to bid on it (exact match = 5/5)
    const nftMinHash = await jaccardNft.read.getMinHashByTokenId([nftTokenId]) as readonly `0x${string}`[];
    
    const bidData = {
      salt: randomSalt(),
      deadline,
      targetMinHash: [...nftMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
      minMatches: 5, // Exact match required
      permit: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        deadline,
        v,
        r,
        s,
      },
    };

    const bidSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bidData,
    });

    // 6. Build full auction with bids and execute
    const fullAuction = {
      ...auctionData,
      bids: [bidData],
      bidSignatures: [bidSig],
    };

    // Anyone can call consumeAuction
    await jaccardSwap.write.consumeAuction([fullAuction, auctionSig]);

    // Verify balances changed correctly
    const bidder1TokenAfter = await exampleToken.read.balanceOf([bidder1.account!.address]);
    const auctioneerTokenAfter = await exampleToken.read.balanceOf([auctioneer.account!.address]);
    const bidder1NftAfter = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    const auctioneerNftAfter = await jaccardNft.read.balanceOf([auctioneer.account!.address, nftTokenId]);

    assert.equal(bidder1TokenBefore - bidder1TokenAfter, bidAmount);
    assert.equal(auctioneerTokenAfter - auctioneerTokenBefore, bidAmount);
    assert.equal(bidder1NftAfter - bidder1NftBefore, 1n);
    assert.equal(auctioneerNftBefore - auctioneerNftAfter, 1n);
  });

  it("rejects bid below reserve price", async () => {
    // Mint another NFT to auctioneer
    const dummyMinHash: readonly `0x${string}`[] = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000000000000000000000000000004',
      '0x0000000000000000000000000000000000000000000000000000000000000005',
    ] as const;
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 1n, dummyMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 1n, dummyMinHash]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);
    const reservePrice = thousand;
    const bidAmount = hundred; // Below reserve!

    // Create NFT permit
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    // Create auction with high reserve
    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // Create low bid
    const bidderNonce = await exampleToken.read.nonces([bidder1.account!.address]);
    const erc20PermitSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        nonce: bidderNonce,
        deadline,
      },
    });

    const { v, r, s } = splitSignature(erc20PermitSig);

    // Get NFT's MinHash for the bid
    const nftMinHash = await jaccardNft.read.getMinHashByTokenId([nftTokenId]) as readonly `0x${string}`[];

    const bidData = {
      salt: randomSalt(),
      deadline,
      targetMinHash: [...nftMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
      minMatches: 5,
      permit: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        deadline,
        v,
        r,
        s,
      },
    };

    const bidSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bidData,
    });

    const fullAuction = {
      ...auctionData,
      bids: [bidData],
      bidSignatures: [bidSig],
    };

    await assert.rejects(
      jaccardSwap.write.consumeAuction([fullAuction, auctionSig]),
      /No valid bids/
    );
  });

  it("prevents double-settlement of same auction", async () => {
    // Mint another NFT
    const dummyMinHash: readonly `0x${string}`[] = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000000000000000000000000000004',
      '0x0000000000000000000000000000000000000000000000000000000000000005',
    ] as const;
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 2n, dummyMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 2n, dummyMinHash]); // mint 2

    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);
    const bidAmount = hundred;

    // Create auction
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice: hundred,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // Get NFT's MinHash for bidding
    const nftMinHash = await jaccardNft.read.getMinHashByTokenId([nftTokenId]) as readonly `0x${string}`[];

    // Create two bids from different bidders
    const createBid = async (bidder: WalletClient) => {
      const bidderNonce = await exampleToken.read.nonces([bidder.account!.address]);
      const erc20PermitSig = await bidder.signTypedData({
        account: bidder.account!,
        domain: {
          name: 'MockERC20',
          version: '1',
          chainId,
          verifyingContract: exampleTokenAddr,
        },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: {
          owner: bidder.account!.address,
          spender: jaccardSwapAddr,
          value: bidAmount,
          nonce: bidderNonce,
          deadline,
        },
      });

      const { v, r, s } = splitSignature(erc20PermitSig);

      const bidData = {
        salt: randomSalt(),
        deadline,
        targetMinHash: [...nftMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
        minMatches: 5,
        permit: {
          owner: bidder.account!.address,
          spender: jaccardSwapAddr,
          value: bidAmount,
          deadline,
          v,
          r,
          s,
        },
      };

      const bidSig = await bidder.signTypedData({
        account: bidder.account!,
        domain: auctionDomain,
        types: BidTypes,
        primaryType: 'Bid',
        message: bidData,
      });

      return { bidData, bidSig };
    };

    const { bidData: bid1Data, bidSig: bid1Sig } = await createBid(bidder1);
    const { bidData: bid2Data, bidSig: bid2Sig } = await createBid(bidder2);

    const fullAuction1 = {
      ...auctionData,
      bids: [bid1Data],
      bidSignatures: [bid1Sig],
    };

    const fullAuction2 = {
      ...auctionData,
      bids: [bid2Data],
      bidSignatures: [bid2Sig],
    };

    // First settlement should succeed
    await jaccardSwap.write.consumeAuction([fullAuction1, auctionSig]);

    // Second settlement should fail (auction already used)
    await assert.rejects(
      jaccardSwap.write.consumeAuction([fullAuction2, auctionSig]),
      /Auction already settled/
    );
  });

  it("falls back to next highest bid when highest bidder's permit fails", async () => {
    // Mint another NFT
    const dummyMinHash: readonly `0x${string}`[] = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000000000000000000000000000004',
      '0x0000000000000000000000000000000000000000000000000000000000000005',
    ] as const;
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 1n, dummyMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 1n, dummyMinHash]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);
    const highBidAmount = parseEther('200');
    const lowBidAmount = hundred;

    // Record initial balances
    const bidder1TokenBefore = await exampleToken.read.balanceOf([bidder1.account!.address]);
    const bidder2TokenBefore = await exampleToken.read.balanceOf([bidder2.account!.address]);
    const auctioneerTokenBefore = await exampleToken.read.balanceOf([auctioneer.account!.address]);
    const bidder1NftBefore = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    const bidder2NftBefore = await jaccardNft.read.balanceOf([bidder2.account!.address, nftTokenId]);

    // Create NFT permit
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice: hundred,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // Create HIGH bid from bidder1 (will fail - we'll invalidate the permit)
    const bidder1Nonce = await exampleToken.read.nonces([bidder1.account!.address]);
    const erc20PermitSig1 = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: highBidAmount,
        nonce: bidder1Nonce,
        deadline,
      },
    });

    const { v: v1, r: r1, s: s1 } = splitSignature(erc20PermitSig1);

    const bid1Data = {
      salt: randomSalt(),
      deadline,
      targetMinHash: [...dummyMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
      minMatches: 5,
      permit: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: highBidAmount,
        deadline,
        v: v1,
        r: r1,
        s: s1,
      },
    };

    const bid1Sig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bid1Data,
    });

    // Create LOW bid from bidder2 (will succeed as fallback)
    const bidder2Nonce = await exampleToken.read.nonces([bidder2.account!.address]);
    const erc20PermitSig2 = await bidder2.signTypedData({
      account: bidder2.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder2.account!.address,
        spender: jaccardSwapAddr,
        value: lowBidAmount,
        nonce: bidder2Nonce,
        deadline,
      },
    });

    const { v: v2, r: r2, s: s2 } = splitSignature(erc20PermitSig2);

    const bid2Data = {
      salt: randomSalt(),
      deadline,
      targetMinHash: [...dummyMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
      minMatches: 5,
      permit: {
        owner: bidder2.account!.address,
        spender: jaccardSwapAddr,
        value: lowBidAmount,
        deadline,
        v: v2,
        r: r2,
        s: s2,
      },
    };

    const bid2Sig = await bidder2.signTypedData({
      account: bidder2.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bid2Data,
    });

    // INVALIDATE bidder1's permit by using it (increment nonce)
    // We do this by having bidder1 approve someone else, which uses the nonce
    await exampleToken.write.approve([deployer.account!.address, 1n], { account: bidder1.account! });
    // Now sign a self-permit to burn the nonce
    const burnerPermitSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: bidder1.account!.address, // self
        value: 1n,
        nonce: bidder1Nonce, // same nonce as bid1
        deadline,
      },
    });
    const { v: vBurn, r: rBurn, s: sBurn } = splitSignature(burnerPermitSig);
    // Execute the permit to burn the nonce
    await exampleToken.write.permit([
      bidder1.account!.address,
      bidder1.account!.address,
      1n,
      deadline,
      vBurn,
      rBurn,
      sBurn,
    ]);

    // Build auction with both bids (high bid first, low bid second)
    const fullAuction = {
      ...auctionData,
      bids: [bid1Data, bid2Data], // ordered high to low
      bidSignatures: [bid1Sig, bid2Sig],
    };

    // Execute - should fall back to bidder2
    await jaccardSwap.write.consumeAuction([fullAuction, auctionSig]);

    // Verify bidder2 won (not bidder1)
    const bidder1TokenAfter = await exampleToken.read.balanceOf([bidder1.account!.address]);
    const bidder2TokenAfter = await exampleToken.read.balanceOf([bidder2.account!.address]);
    const auctioneerTokenAfter = await exampleToken.read.balanceOf([auctioneer.account!.address]);
    const bidder1NftAfter = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    const bidder2NftAfter = await jaccardNft.read.balanceOf([bidder2.account!.address, nftTokenId]);

    // Bidder1 should NOT have paid (permit was invalid)
    assert.equal(bidder1TokenBefore, bidder1TokenAfter, "Bidder1 should not have paid");
    assert.equal(bidder1NftAfter, bidder1NftBefore, "Bidder1 should not have received NFT");

    // Bidder2 SHOULD have paid and received NFT
    assert.equal(bidder2TokenBefore - bidder2TokenAfter, lowBidAmount, "Bidder2 should have paid");
    assert.equal(bidder2NftAfter - bidder2NftBefore, 1n, "Bidder2 should have received NFT");

    // Auctioneer should have received payment from bidder2
    assert.equal(auctioneerTokenAfter - auctioneerTokenBefore, lowBidAmount, "Auctioneer should have received payment");
  });

  it("accepts bid with partial similarity (3/5 bands match)", async () => {
    // Mint NFT with specific MinHash
    const nftMinHash: readonly `0x${string}`[] = [
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444444444444444444444444444',
      '0x5555555555555555555555555555555555555555555555555555555555555555',
    ] as const;
    
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 1n, nftMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 1n, nftMinHash]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);
    const bidAmount = hundred;

    // Bidder wants artifacts with 3/5 matching bands (different bands 0 and 1)
    const bidderTargetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] = [
      '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // different
      '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // different
      '0x3333333333333333333333333333333333333333333333333333333333333333', // same
      '0x4444444444444444444444444444444444444444444444444444444444444444', // same
      '0x5555555555555555555555555555555555555555555555555555555555555555', // same
    ];

    // Create auction
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice: hundred,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // Create bid requiring only 3/5 similarity
    const bidderNonce = await exampleToken.read.nonces([bidder1.account!.address]);
    const erc20PermitSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        nonce: bidderNonce,
        deadline,
      },
    });

    const { v, r, s } = splitSignature(erc20PermitSig);

    const bidData = {
      salt: randomSalt(),
      deadline,
      targetMinHash: bidderTargetMinHash,
      minMatches: 3, // Only require 3/5 similarity!
      permit: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        deadline,
        v,
        r,
        s,
      },
    };

    const bidSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bidData,
    });

    const fullAuction = {
      ...auctionData,
      bids: [bidData],
      bidSignatures: [bidSig],
    };

    // Record balances
    const bidder1NftBefore = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    
    // Execute - should succeed with 3/5 similarity
    await jaccardSwap.write.consumeAuction([fullAuction, auctionSig]);

    // Verify bidder received NFT
    const bidder1NftAfter = await jaccardNft.read.balanceOf([bidder1.account!.address, nftTokenId]);
    assert.equal(bidder1NftAfter - bidder1NftBefore, 1n, "Bidder should have received NFT with 3/5 similarity");
    
    console.log('✓ Auction settled with 3/5 similarity match!');
  });

  it("rejects bid when similarity threshold not met", async () => {
    // Mint NFT with specific MinHash
    const nftMinHash: readonly `0x${string}`[] = [
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444444444444444444444444444',
      '0x5555555555555555555555555555555555555555555555555555555555555555',
    ] as const;
    
    const { result: nftTokenId } = await jaccardNft.simulate.faucet([auctioneer.account!.address, 1n, nftMinHash]);
    await jaccardNft.write.faucet([auctioneer.account!.address, 1n, nftMinHash]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);
    const bidAmount = hundred;

    // Bidder target has only 2/5 matching bands
    const bidderTargetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] = [
      '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // different
      '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // different
      '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', // different
      '0x4444444444444444444444444444444444444444444444444444444444444444', // same
      '0x5555555555555555555555555555555555555555555555555555555555555555', // same
    ];

    // Create auction
    const nftPermitData = {
      owner: auctioneer.account!.address,
      spender: jaccardSwapAddr,
      tokenId: nftTokenId,
      amount: 1n,
      deadline,
      salt: randomSalt(),
    };

    const nftPermitSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: nftDomain,
      types: JaccardERC1155PermitTypes,
      primaryType: 'JaccardERC1155Permit',
      message: nftPermitData,
    });

    const auctionData = {
      salt: randomSalt(),
      deadline,
      nft: jaccardNftAddr,
      token: exampleTokenAddr,
      reservePrice: hundred,
      nftPermit: nftPermitData,
      nftPermitSignature: nftPermitSig,
    };

    const auctionSig = await auctioneer.signTypedData({
      account: auctioneer.account!,
      domain: auctionDomain,
      types: AuctionTypes,
      primaryType: 'Auction',
      message: auctionData,
    });

    // Create bid requiring 3/5 similarity but only having 2/5
    const bidderNonce = await exampleToken.read.nonces([bidder1.account!.address]);
    const erc20PermitSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: {
        name: 'MockERC20',
        version: '1',
        chainId,
        verifyingContract: exampleTokenAddr,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        nonce: bidderNonce,
        deadline,
      },
    });

    const { v, r, s } = splitSignature(erc20PermitSig);

    const bidData = {
      salt: randomSalt(),
      deadline,
      targetMinHash: bidderTargetMinHash,
      minMatches: 3, // Requires 3/5 but only 2/5 match
      permit: {
        owner: bidder1.account!.address,
        spender: jaccardSwapAddr,
        value: bidAmount,
        deadline,
        v,
        r,
        s,
      },
    };

    const bidSig = await bidder1.signTypedData({
      account: bidder1.account!,
      domain: auctionDomain,
      types: BidTypes,
      primaryType: 'Bid',
      message: bidData,
    });

    const fullAuction = {
      ...auctionData,
      bids: [bidData],
      bidSignatures: [bidSig],
    };

    // Should fail - similarity threshold not met
    await assert.rejects(
      jaccardSwap.write.consumeAuction([fullAuction, auctionSig]),
      /No valid bids/
    );
  });
});
