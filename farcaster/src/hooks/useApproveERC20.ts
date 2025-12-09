import { useEffect, useCallback } from 'react'
import { 
  useWaitForTransactionReceipt,
  useWriteContract,
  useReadContract,
  useConnection
} from 'wagmi'
import { maxUint256 } from 'viem'
import { useStaticData } from './useStaticData'

export function useApproveERC20(tokenContract?: `0x${string}`, onApprovalConfirmed?: () => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  
  const { 
    data: hash, 
    isPending, 
    writeContract 
  } = useWriteContract() 

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    })

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenContract,
    abi: staticData?.scripAbi,
    functionName: 'allowance',
    args: address && tokenContract && staticData ? [address, staticData.jaccardSwapAddr as `0x${string}`] : undefined,
    query: {
      enabled: !!(address && tokenContract && staticData)
    }
  })

  // Refetch allowance and balances when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      refetchAllowance()
      onApprovalConfirmed?.()
    }
  }, [isConfirmed, refetchAllowance, onApprovalConfirmed])

  const approveERC20 = useCallback((contractAddress: `0x${string}`) => {
    if (!address || !staticData) return

    writeContract({
      address: contractAddress,
      abi: staticData.scripAbi,
      functionName: 'approve',
      args: [staticData.jaccardSwapAddr as `0x${string}`, maxUint256],
    })
  }, [writeContract, address, staticData])

  return {
    approveERC20,
    allowance: allowance as bigint | undefined,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    refetchAllowance
  }
} 