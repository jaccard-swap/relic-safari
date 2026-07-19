import { wagmiConfig } from "./wagmi";

// The local hardhat chain has no block explorer configured - callers should
// treat a null return as "don't render a link" rather than a broken one.
export function getExplorerTxUrl(chainId: number, hash: string): string | null {
  const chain = wagmiConfig.chains.find((c) => c.id === chainId);
  const explorerUrl = chain?.blockExplorers?.default.url;
  return explorerUrl ? `${explorerUrl}/tx/${hash}` : null;
}

export function getExplorerAddressUrl(chainId: number, address: string): string | null {
  const chain = wagmiConfig.chains.find((c) => c.id === chainId);
  const explorerUrl = chain?.blockExplorers?.default.url;
  return explorerUrl ? `${explorerUrl}/address/${address}` : null;
}

export function getChainName(chainId: number): string {
  return wagmiConfig.chains.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
}

type ExplorerLinkType = "transaction" | "token" | "address" | "block" | "nft";

// General form for callers that already have a resolved chain (e.g. from
// useChains()) and need more than tx/address links - an NFT permalink needs
// both the contract address and a token id.
export function getExplorerUrlForChain(
  chainId: number | undefined,
  value: string,
  type: ExplorerLinkType,
  tokenId?: string,
): string | null {
  const chain = chainId ? wagmiConfig.chains.find((c) => c.id === chainId) : undefined;
  const baseUrl = chain?.blockExplorers?.default.url;
  if (!baseUrl) return null;
  switch (type) {
    case "transaction":
      return `${baseUrl}/tx/${value}`;
    case "token":
      return `${baseUrl}/token/${value}`;
    case "address":
      return `${baseUrl}/address/${value}`;
    case "block":
      return `${baseUrl}/block/${value}`;
    case "nft":
      return tokenId ? `${baseUrl}/nft/${value}/${tokenId}` : `${baseUrl}/token/${value}`;
  }
}
