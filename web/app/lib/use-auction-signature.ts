import { useSignTypedData } from "wagmi";
import { AuctionTypes, BidTypes, ERC20PermitTypes, JaccardERC1155PermitTypes, EIP712_DOMAINS } from "@shared/constants";
import { getContract } from "./contracts";

export interface SplitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

// Builds a fixed-length 20-tuple type so it lines up with the ABI's
// `bytes8[20]` fixed-size array (wagmi's typed-data inference requires an
// exact-length tuple, not just `\`0x${string}\`[]`).
type Tuple<T, N extends number, R extends readonly T[] = []> = R["length"] extends N ? R : Tuple<T, N, readonly [T, ...R]>;
export type MinHashTuple = Tuple<`0x${string}`, 20>;

// A 65-byte ECDSA signature as three fields, the shape every on-chain permit
// struct here expects (v,r,s) rather than the packed hex string wagmi hands back.
export function splitSignature(signature: `0x${string}`): SplitSignature {
  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);
  return { v, r, s };
}

// computeMinHash() (and API responses) hand back a plain `\`0x${string}\`[]`
// - assert the length here, once, rather than trusting every call site to
// have gotten the right band count (the exact bug that broke bidding in the
// old app when the scheme grew from 5 to 20 bands).
export function asMinHashTuple(minHash: readonly `0x${string}`[]): MinHashTuple {
  if (minHash.length !== 20) {
    throw new Error(`Expected a 20-band MinHash, got ${minHash.length}`);
  }
  return minHash as unknown as MinHashTuple;
}

export function randomSalt4(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

// All EIP-712 signing for the auction/bid system, centralized so every
// caller derives verifyingContract from getContract() (synchronous, current
// chain) rather than each hook re-deriving its own domain. Every domain here
// uses the JaccardSwap (diamond) address - EIP712_DOMAINS documents the
// diamond as a single unified domain across facets, and the deployed
// JaccardSwapFacet's hashBid/hashAuction both call LibEIP712.hashTypedDataV4()
// off the diamond's own domain separator, not a per-facet one.
export function useAuctionSignature(chainId: number) {
  const { signTypedDataAsync } = useSignTypedData();
  const jaccardSwap = getContract(chainId, "JaccardSwap");
  const scrip = getContract(chainId, "Scrip");

  async function signErc20Permit(params: {
    owner: `0x${string}`;
    spender: `0x${string}`;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
  }): Promise<SplitSignature> {
    if (!scrip) throw new Error(`Scrip contract not available on chain ${chainId}`);
    const signature = await signTypedDataAsync({
      domain: { name: EIP712_DOMAINS.SCRIP, version: "1", chainId, verifyingContract: scrip.address },
      types: ERC20PermitTypes,
      primaryType: "Permit",
      message: params,
    });
    return splitSignature(signature);
  }

  async function signNftPermit(params: {
    owner: `0x${string}`;
    spender: `0x${string}`;
    tokenId: bigint;
    amount: bigint;
    deadline: bigint;
    salt: `0x${string}`;
  }): Promise<`0x${string}`> {
    if (!jaccardSwap) throw new Error(`JaccardSwap contract not available on chain ${chainId}`);
    return signTypedDataAsync({
      domain: { name: EIP712_DOMAINS.JACCARD_ERC1155, version: "1", chainId, verifyingContract: jaccardSwap.address },
      types: JaccardERC1155PermitTypes,
      primaryType: "JaccardERC1155Permit",
      message: params,
    });
  }

  async function signAuction(params: {
    salt: `0x${string}`;
    deadline: bigint;
    nft: `0x${string}`;
    token: `0x${string}`;
    reservePrice: bigint;
    nftPermit: {
      owner: `0x${string}`;
      spender: `0x${string}`;
      tokenId: bigint;
      amount: bigint;
      deadline: bigint;
      salt: `0x${string}`;
    };
    nftPermitSignature: `0x${string}`;
  }): Promise<`0x${string}`> {
    if (!jaccardSwap) throw new Error(`JaccardSwap contract not available on chain ${chainId}`);
    return signTypedDataAsync({
      domain: { name: EIP712_DOMAINS.JACCARD_SWAP, version: "1", chainId, verifyingContract: jaccardSwap.address },
      types: AuctionTypes,
      primaryType: "Auction",
      message: params,
    });
  }

  async function signBid(params: {
    salt: `0x${string}`;
    deadline: bigint;
    targetMinHash: MinHashTuple;
    minMatches: number;
    permit: {
      owner: `0x${string}`;
      spender: `0x${string}`;
      value: bigint;
      deadline: bigint;
    };
  }): Promise<`0x${string}`> {
    if (!jaccardSwap) throw new Error(`JaccardSwap contract not available on chain ${chainId}`);
    return signTypedDataAsync({
      domain: { name: EIP712_DOMAINS.JACCARD_SWAP, version: "1", chainId, verifyingContract: jaccardSwap.address },
      types: BidTypes,
      primaryType: "Bid",
      message: params,
    });
  }

  return { signErc20Permit, signNftPermit, signAuction, signBid };
}
