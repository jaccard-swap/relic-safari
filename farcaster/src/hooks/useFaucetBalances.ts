import { useConnection, useReadContract } from 'wagmi'
import { erc20Abi, formatEther } from 'viem'
import { useStaticData } from './useStaticData'

export const useFaucetBalances = () => {
    const { address, isConnected } = useConnection()
    const { staticData, chainId } = useStaticData()

    // SCRIP balance (18 decimals)
    const { data: scripRaw, refetch: refetchTokenData } = useReadContract({
        address: staticData?.scripAddr as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address!],
        query: { enabled: isConnected && !!address && !!staticData }
    })

    // Essence balance (18 decimals)
    const { data: essenceRaw, refetch: refetchEssenceData } = useReadContract({
        address: staticData?.essenceAddr as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address!],
        query: { enabled: isConnected && !!address && !!staticData?.essenceAddr }
    })

    const scripFormatted = scripRaw !== undefined ? parseFloat(formatEther(scripRaw)) : 0
    const essenceFormatted = essenceRaw !== undefined ? parseFloat(formatEther(essenceRaw)) : 0

    const tokenBalance = scripRaw !== undefined ? {
        value: scripRaw,
        formatted: scripFormatted,
        count: Math.floor(scripFormatted)
    } : null

    const essenceBalance = essenceRaw !== undefined ? {
        value: essenceRaw,
        formatted: essenceFormatted,
        count: Math.floor(essenceFormatted)
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
