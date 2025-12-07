import { useEffect, useCallback } from 'react'
import { 
  useWaitForTransactionReceipt,
  useWriteContract,
  useReadContract,
  useConnection
} from 'wagmi'
import { useStaticData } from './useStaticData'

export function useApproveERC1155(nftContract?: `0x${string}`, onApprovalConfirmed?: () => void) {
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

  // Read current approval status
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: nftContract,
    abi: staticData?.jaccardErc1155Abi,
    functionName: 'isApprovedForAll',
    args: address && nftContract && staticData ? [address, staticData.jaccardSwapAddr as `0x${string}`] : undefined,
    query: {
      enabled: !!(address && nftContract && staticData)
    }
  })

  // Refetch approval and balances when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      refetchApproval()
      onApprovalConfirmed?.()
    }
  }, [isConfirmed, refetchApproval, onApprovalConfirmed])

  const approveERC1155 = useCallback((contractAddress: `0x${string}`) => {
    if (!staticData) return
    
    writeContract({
      address: contractAddress,
      abi: staticData.jaccardErc1155Abi,
      functionName: 'setApprovalForAll',
      args: [staticData.jaccardSwapAddr as `0x${string}`, true],
    })
  }, [writeContract, staticData])

  return {
    approveERC1155,
    isApproved: isApproved as boolean | undefined,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    refetchApproval
  }
} 