import type { Chain } from 'viem'

type ExplorerType = 'transaction' | 'token' | 'address' | 'block' | 'nft'

export function getExplorerUrl(
  chain: Chain | undefined,
  value: string,
  type: ExplorerType,
  tokenId?: string
): string | null {
  if (!chain?.blockExplorers?.default?.url) {
    return null
  }
  const baseUrl = chain.blockExplorers.default.url.replace(/\/$/, '')
  switch (type) {
    case 'transaction':
      return `${baseUrl}/tx/${value}`
    case 'token':
      return `${baseUrl}/token/${value}`
    case 'address':
      return `${baseUrl}/address/${value}`
    case 'block':
      return `${baseUrl}/block/${value}`
    case 'nft':
      return tokenId ? `${baseUrl}/nft/${value}/${tokenId}` : `${baseUrl}/token/${value}`
  }
}
