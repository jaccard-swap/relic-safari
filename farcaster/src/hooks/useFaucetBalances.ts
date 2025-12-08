import { useConnection, useReadContracts } from 'wagmi'
import { erc20Abi, erc1155Abi } from 'viem'
import { useStaticData } from './useStaticData'

export const useFaucetBalances = () => {
    const { address, isConnected } = useConnection()
    const { staticData, chainId } = useStaticData()

    // Get ERC20 token balance (SCRIP)
    const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
        allowFailure: false,
        contracts: [
            {
                address: staticData?.mockErc20Addr as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address!],
            },
            {
                address: staticData?.mockErc20Addr as `0x${string}`,
                abi: erc20Abi,
                functionName: 'decimals',
            },
            {
                address: staticData?.mockErc20Addr as `0x${string}`,
                abi: erc20Abi,
                functionName: 'symbol',
            },
        ],
        query: {
            enabled: isConnected && !!address && !!staticData
        }
    })

    // Get ERC1155 Essence balance (token ID 0)
    const { data: essenceData, refetch: refetchEssenceData } = useReadContracts({
        allowFailure: false,
        contracts: [
            {
                address: staticData?.jaccardErc1155Addr as `0x${string}`,
                abi: erc1155Abi,
                functionName: 'balanceOf',
                args: [address!, 0n], // Token ID 0 = Essence
            },
        ],
        query: {
            enabled: isConnected && !!address && !!staticData
        }
    })
    
    const tokenBalance = tokenData ? {
        value: tokenData[0] as bigint,
        decimals: tokenData[1] as number,
        symbol: tokenData[2] as string,
        formatted: Number(tokenData[0]) / Math.pow(10, tokenData[1] as number)
    } : null

    const essenceBalance = essenceData ? {
        value: essenceData[0] as bigint,
        count: Number(essenceData[0])
    } : null

    const refetchBalances = () => {
        refetchTokenData()
        refetchEssenceData()
    }

    return {
        tokenBalance,
        essenceBalance,
        refetchTokenData,
        refetchEssenceData,
        refetchBalances,
        isConnected,
        chainId
    }
}
