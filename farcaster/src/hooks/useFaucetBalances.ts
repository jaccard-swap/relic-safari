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

    const tokenBalance = scripRaw !== undefined ? {
        value: scripRaw,
        formatted: parseFloat(formatEther(scripRaw))
    } : null

    const essenceBalance = essenceRaw !== undefined ? {
        value: essenceRaw,
        formatted: parseFloat(formatEther(essenceRaw))
    } : null

    return {
        tokenBalance,
        essenceBalance,
        refetchTokenData,
        refetchEssenceData,
        isConnected,
        chainId
    }
}
