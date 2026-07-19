import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "./api";

export interface NftMetadata {
  name: string;
  [key: string]: string | number | undefined;
}

export interface Nft {
  id: string;
  tokenId: string;
  chainId: number;
  contractAddress: string;
  metadata: NftMetadata;
  minHash: string[];
  txHash: string;
  createdAt: string;
  status?: string;
}

async function fetchNfts(address: string, chainId?: number): Promise<Nft[]> {
  const params = chainId ? `?chainId=${chainId}` : "";
  // The API already excludes consumed NFTs server-side.
  const data = await apiJson<{ nfts: Nft[] }>(`/nft/by-owner/${address}${params}`);
  return data.nfts;
}

export function useNfts() {
  const { address, chainId, isConnected } = useAccount();
  return useQuery({
    queryKey: ["nfts", address, chainId],
    queryFn: () => fetchNfts(address!, chainId),
    enabled: isConnected && !!address,
  });
}

export function useInvalidateNfts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["nfts"] });
}
