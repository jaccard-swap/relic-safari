import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';
import { parseEther, toHex } from 'viem';
import { setupFixtures } from './utils/index.js';

const { provider, networkHelpers } = await network.connect();
const { deployAll } = setupFixtures(provider);

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

describe("JaccardSwapDiamond", () => {
  const hundred = parseEther('100');
  const oneHour = 3600;

  describe('Basic Diamond Functionality', () => {
    it('should support ERC1155 interface', async () => {
      const { env, JaccardDiamond } = await networkHelpers.loadFixture(deployAll);
      
      // ERC1155 interface ID
      const supportsERC1155 = await env.read(JaccardDiamond, {
        functionName: 'supportsInterface',
        args: ['0xd9b67a26'],
      });
      
      assert.equal(supportsERC1155, true);
    });

    it('should mint NFT via faucet', async () => {
      const { env, JaccardDiamond, namedAccounts } = await networkHelpers.loadFixture(deployAll);
      const { deployer } = namedAccounts;

      const dummyMinHash: readonly `0x${string}`[] = [
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000000000000000000000000000003',
        '0x0000000000000000000000000000000000000000000000000000000000000004',
        '0x0000000000000000000000000000000000000000000000000000000000000005',
      ] as const;

      const nftTokenId = await env.read(JaccardDiamond, {
        functionName: 'faucet',
        args: [deployer, 1n, dummyMinHash],
        account: deployer,
      });

      await env.execute(JaccardDiamond, {
        functionName: 'faucet',
        args: [deployer, 1n, dummyMinHash],
        account: deployer,
      });

      // Check balance
      const balance = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [deployer, nftTokenId],
      });

      assert.equal(balance, 1n);
    });

    it('should get MinHash by tokenId', async () => {
      const { env, JaccardDiamond, namedAccounts } = await networkHelpers.loadFixture(deployAll);
      const { deployer } = namedAccounts;

      const expectedMinHash: readonly `0x${string}`[] = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555555555555555555555555555',
      ] as const;

      const nftTokenId = await env.read(JaccardDiamond, {
        functionName: 'faucet',
        args: [deployer, 1n, expectedMinHash],
        account: deployer,
      });

      await env.execute(JaccardDiamond, {
        functionName: 'faucet',
        args: [deployer, 1n, expectedMinHash],
        account: deployer,
      });

      const storedMinHash = await env.read(JaccardDiamond, {
        functionName: 'getMinHashByTokenId',
        args: [nftTokenId],
      }) as readonly `0x${string}`[];

      for (let i = 0; i < 5; i++) {
        assert.equal(storedMinHash[i], expectedMinHash[i]);
      }
    });
  });

  describe('Essence ERC20', () => {
    it('should have correct name and symbol', async () => {
      const { env, JaccardDiamond } = await networkHelpers.loadFixture(deployAll);

      const name = await env.read(JaccardDiamond, {
        functionName: 'name',
        args: [],
      });

      const symbol = await env.read(JaccardDiamond, {
        functionName: 'symbol',
        args: [],
      });

      assert.equal(name, 'Essence');
      assert.equal(symbol, 'ESS');
    });

    it('should mint essence via owner', async () => {
      const { env, JaccardDiamond, namedAccounts } = await networkHelpers.loadFixture(deployAll);
      const { deployer } = namedAccounts;

      await env.execute(JaccardDiamond, {
        functionName: 'mint',
        args: [deployer, parseEther('1000')],
        account: deployer,
      });

      // balanceOf(address) is ERC20
      const balance = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [deployer],
      });

      assert.equal(balance, parseEther('1000'));
    });
  });

  describe('Auction Settlement', () => {
    it('settles an auction with similarity matching', async () => {
      const { env, JaccardDiamond, MockERC20, namedAccounts, unnamedAccounts } = 
        await networkHelpers.loadFixture(deployAll);
      const { deployer } = namedAccounts;
      const auctioneer = unnamedAccounts[0];
      const bidder = unnamedAccounts[1];

      const { viem } = await network.connect();
      const publicClient = await viem.getPublicClient();
      const walletClients = await viem.getWalletClients();
      const auctioneerWallet = walletClients.find(w => w.account?.address === auctioneer);
      const bidderWallet = walletClients.find(w => w.account?.address === bidder);

      if (!auctioneerWallet || !bidderWallet) {
        throw new Error('Could not find wallet clients');
      }

      const chainId = await publicClient.getChainId();
      const diamondAddr = JaccardDiamond.address as `0x${string}`;
      const tokenAddr = MockERC20.address as `0x${string}`;

      // Unified domain for diamond
      const diamondDomain = {
        name: 'JaccardDiamond',
        version: '1',
        chainId,
        verifyingContract: diamondAddr,
      };

      const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);

      // Mint NFT to auctioneer
      const nftMinHash: readonly `0x${string}`[] = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555555555555555555555555555',
      ] as const;

      const nftTokenId = await env.read(JaccardDiamond, {
        functionName: 'faucet',
        args: [auctioneer, 1n, nftMinHash],
        account: deployer,
      }) as bigint;

      await env.execute(JaccardDiamond, {
        functionName: 'faucet',
        args: [auctioneer, 1n, nftMinHash],
        account: deployer,
      });

      // Give bidder tokens via MockERC20 faucet
      await env.execute(MockERC20, {
        functionName: 'faucet',
        args: [],
        account: bidder,
      });

      // 1. Auctioneer signs NFT permit
      const nftPermitData = {
        owner: auctioneer,
        spender: diamondAddr,
        tokenId: nftTokenId,
        amount: 1n,
        deadline,
        salt: randomSalt(),
      };

      const nftPermitSig = await auctioneerWallet.signTypedData({
        account: auctioneerWallet.account!,
        domain: diamondDomain,
        types: JaccardERC1155PermitTypes,
        primaryType: 'JaccardERC1155Permit',
        message: nftPermitData,
      });

      // 2. Auctioneer signs Auction
      const auctionData = {
        salt: randomSalt(),
        deadline,
        nft: diamondAddr,
        token: tokenAddr,
        reservePrice: hundred,
        nftPermit: nftPermitData,
        nftPermitSignature: nftPermitSig,
      };

      const auctionSig = await auctioneerWallet.signTypedData({
        account: auctioneerWallet.account!,
        domain: diamondDomain,
        types: AuctionTypes,
        primaryType: 'Auction',
        message: auctionData,
      });

      // 3. Bidder signs ERC20 permit
      const bidderNonce = await env.read(MockERC20, {
        functionName: 'nonces',
        args: [bidder],
      }) as bigint;

      const erc20PermitSig = await bidderWallet.signTypedData({
        account: bidderWallet.account!,
        domain: {
          name: 'MockERC20',
          version: '1',
          chainId,
          verifyingContract: tokenAddr,
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
          owner: bidder,
          spender: diamondAddr,
          value: hundred,
          nonce: bidderNonce,
          deadline,
        },
      });

      const { v, r, s } = splitSignature(erc20PermitSig);

      // 4. Bidder signs Bid (exact match 5/5)
      const bidData = {
        salt: randomSalt(),
        deadline,
        targetMinHash: [...nftMinHash] as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
        minMatches: 5,
        permit: {
          owner: bidder,
          spender: diamondAddr,
          value: hundred,
          deadline,
          v,
          r,
          s,
        },
      };

      const bidSig = await bidderWallet.signTypedData({
        account: bidderWallet.account!,
        domain: diamondDomain,
        types: BidTypes,
        primaryType: 'Bid',
        message: bidData,
      });

      // 5. Build and execute auction
      const fullAuction = {
        ...auctionData,
        bids: [bidData],
        bidSignatures: [bidSig],
      };

      // Get balances before
      const bidderNftBefore = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [bidder, nftTokenId],
      }) as bigint;

      // Execute auction
      await env.execute(JaccardDiamond, {
        functionName: 'consumeAuction',
        args: [fullAuction, auctionSig],
        account: deployer,
      });

      // Verify NFT transferred
      const bidderNftAfter = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [bidder, nftTokenId],
      }) as bigint;

      assert.equal(bidderNftAfter - bidderNftBefore, 1n, 'Bidder should have received NFT');
    });

    it('accepts bid with partial similarity (3/5 bands match)', async () => {
      const { env, JaccardDiamond, MockERC20, namedAccounts, unnamedAccounts } = 
        await networkHelpers.loadFixture(deployAll);
      const { deployer } = namedAccounts;
      const auctioneer = unnamedAccounts[0];
      const bidder = unnamedAccounts[1];

      const { viem } = await network.connect();
      const publicClient = await viem.getPublicClient();
      const walletClients = await viem.getWalletClients();
      const auctioneerWallet = walletClients.find(w => w.account?.address === auctioneer);
      const bidderWallet = walletClients.find(w => w.account?.address === bidder);

      if (!auctioneerWallet || !bidderWallet) {
        throw new Error('Could not find wallet clients');
      }

      const chainId = await publicClient.getChainId();
      const diamondAddr = JaccardDiamond.address as `0x${string}`;
      const tokenAddr = MockERC20.address as `0x${string}`;

      const diamondDomain = {
        name: 'JaccardDiamond',
        version: '1',
        chainId,
        verifyingContract: diamondAddr,
      };

      const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);

      // NFT with specific MinHash
      const nftMinHash: readonly `0x${string}`[] = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555555555555555555555555555',
      ] as const;

      // Bidder wants 3/5 match (different bands 0 and 1)
      const bidderTargetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // different
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // different
        '0x3333333333333333333333333333333333333333333333333333333333333333', // same
        '0x4444444444444444444444444444444444444444444444444444444444444444', // same
        '0x5555555555555555555555555555555555555555555555555555555555555555', // same
      ];

      const nftTokenId = await env.read(JaccardDiamond, {
        functionName: 'faucet',
        args: [auctioneer, 1n, nftMinHash],
        account: deployer,
      }) as bigint;

      await env.execute(JaccardDiamond, {
        functionName: 'faucet',
        args: [auctioneer, 1n, nftMinHash],
        account: deployer,
      });

      await env.execute(MockERC20, {
        functionName: 'faucet',
        args: [],
        account: bidder,
      });

      // Create auction and bid with 3/5 similarity requirement
      const nftPermitData = {
        owner: auctioneer,
        spender: diamondAddr,
        tokenId: nftTokenId,
        amount: 1n,
        deadline,
        salt: randomSalt(),
      };

      const nftPermitSig = await auctioneerWallet.signTypedData({
        account: auctioneerWallet.account!,
        domain: diamondDomain,
        types: JaccardERC1155PermitTypes,
        primaryType: 'JaccardERC1155Permit',
        message: nftPermitData,
      });

      const auctionData = {
        salt: randomSalt(),
        deadline,
        nft: diamondAddr,
        token: tokenAddr,
        reservePrice: hundred,
        nftPermit: nftPermitData,
        nftPermitSignature: nftPermitSig,
      };

      const auctionSig = await auctioneerWallet.signTypedData({
        account: auctioneerWallet.account!,
        domain: diamondDomain,
        types: AuctionTypes,
        primaryType: 'Auction',
        message: auctionData,
      });

      const bidderNonce = await env.read(MockERC20, {
        functionName: 'nonces',
        args: [bidder],
      }) as bigint;

      const erc20PermitSig = await bidderWallet.signTypedData({
        account: bidderWallet.account!,
        domain: {
          name: 'MockERC20',
          version: '1',
          chainId,
          verifyingContract: tokenAddr,
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
          owner: bidder,
          spender: diamondAddr,
          value: hundred,
          nonce: bidderNonce,
          deadline,
        },
      });

      const { v, r, s } = splitSignature(erc20PermitSig);

      const bidData = {
        salt: randomSalt(),
        deadline,
        targetMinHash: bidderTargetMinHash,
        minMatches: 3, // Only require 3/5 similarity
        permit: {
          owner: bidder,
          spender: diamondAddr,
          value: hundred,
          deadline,
          v,
          r,
          s,
        },
      };

      const bidSig = await bidderWallet.signTypedData({
        account: bidderWallet.account!,
        domain: diamondDomain,
        types: BidTypes,
        primaryType: 'Bid',
        message: bidData,
      });

      const fullAuction = {
        ...auctionData,
        bids: [bidData],
        bidSignatures: [bidSig],
      };

      const bidderNftBefore = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [bidder, nftTokenId],
      }) as bigint;

      await env.execute(JaccardDiamond, {
        functionName: 'consumeAuction',
        args: [fullAuction, auctionSig],
        account: deployer,
      });

      const bidderNftAfter = await env.read(JaccardDiamond, {
        functionName: 'balanceOf',
        args: [bidder, nftTokenId],
      }) as bigint;

      assert.equal(bidderNftAfter - bidderNftBefore, 1n, 'Bidder should have received NFT with 3/5 similarity');
    });
  });
});

