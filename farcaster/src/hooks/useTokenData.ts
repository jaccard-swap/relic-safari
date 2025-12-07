import { useConnection, useReadContracts } from 'wagmi'
import { erc20Abi, erc1155Abi } from 'viem'

export const useTokenData = (auction: any) => {
    const { address, isConnected } = useConnection()
    
    // Get ERC20 token balance for bidding
    const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
        allowFailure: false,
        contracts: [
            {
                address: auction?.tokenContract as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address!],
            },
            {
                address: auction?.tokenContract as `0x${string}`,
                abi: erc20Abi,
                functionName: 'decimals',
            },
            {
                address: auction?.tokenContract as `0x${string}`,
                abi: erc20Abi,
                functionName: 'symbol',
            },
        ],
        query: {
            enabled: isConnected && !!auction?.tokenContract && !!address
        }
    })

    const { data: nftData, refetch: refetchNftData } = useReadContracts({
        allowFailure: false,
        contracts: [
            {
                address: auction?.nftContract as `0x${string}`,
                abi: erc1155Abi,
                functionName: 'balanceOf',
                args: [address!, auction?.nftTokenId as unknown as bigint],
            },
            {
                address: auction?.nftContract as `0x${string}`,
                abi: erc1155Abi,
                functionName: 'uri',
                args: [auction?.nftTokenId as unknown as bigint],
            },
        ],
        query: {
            enabled: isConnected && !!auction?.nftContract && !!address
        }
    })
    
    const tokenBalance = tokenData ? {
        value: tokenData[0] as bigint,
        decimals: tokenData[1] as number,
        symbol: tokenData[2] as string,
    } : null
    
    const nftBalance = nftData ? {
        balance: nftData[0] as bigint,
        uri: nftData[1] as string,
    } : null

    const refetchBalances = () => {
        refetchTokenData()
        refetchNftData()
    }

    return {
        tokenBalance,
        nftBalance,
        refetchTokenData,
        refetchNftData,
        refetchBalances
    }
} 