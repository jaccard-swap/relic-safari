import * as React from 'react'
import { 
  useWaitForTransactionReceipt,
  useWriteContract,
  useConnection
} from 'wagmi'
import { useStaticData } from './useStaticData'

export function useErc20Faucet(onSuccess?: () => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  
  const { 
    data: hash, 
    isPending, 
    writeContract,
    error: writeError,
    reset
  } = useWriteContract() 

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({ hash })

  // Call onSuccess when confirmed
  React.useEffect(() => {
    if (isConfirmed && onSuccess) {
      onSuccess()
    }
  }, [isConfirmed, onSuccess])

  const claimFaucetErc20 = React.useCallback(() => {
    if (!address || !staticData) return
    reset() // Clear previous state
    
    writeContract({
      address: staticData.mockErc20Addr as `0x${string}`,
      abi: staticData.mockErc20Abi,
      functionName: 'faucet',
      args: [],
    })
  }, [writeContract, address, staticData, reset])

  return {
    claimFaucetErc20,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    isConnected: !!address,
    error: writeError || receiptError
  }
}

interface Erc1155FaucetResult {
  success: boolean
  tokenId?: string
  hash?: string
  chainId?: number
  metadata?: Record<string, string | number>
  error?: string
}

export function useErc1155Faucet(onSuccess?: () => void) {
  const { address, chainId } = useConnection()
  const [isPending, setIsPending] = React.useState(false)
  const [isConfirmed, setIsConfirmed] = React.useState(false)
  const [result, setResult] = React.useState<Erc1155FaucetResult | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  const claimFaucetErc1155 = React.useCallback(async () => {
    if (!address || !chainId) return

    setIsPending(true)
    setError(null)
    setResult(null)
    setIsConfirmed(false)

    try {
      // API waits for tx confirmation before returning
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipient: address, chainId }),
      })

      const data = await response.json() as Erc1155FaucetResult

      if (!response.ok) {
        throw new Error(data.error || 'Faucet request failed')
      }

      // API only returns success:true after tx is mined
      setResult(data)
      setIsConfirmed(true)
      console.log('faucet confirmed', data)
      onSuccess?.()
    } catch (err) {
      console.log('faucet error', err)
      setError(err as Error)
    } finally {
      setIsPending(false)
    }
  }, [address, chainId, onSuccess])

  return {
    claimFaucetErc1155,
    hash: result?.hash as `0x${string}` | undefined,
    tokenId: result?.tokenId,
    metadata: result?.metadata,
    chainId: result?.chainId,
    isPending,
    isConfirming: false, // API handles waiting, so never "confirming" on frontend
    isConfirmed,
    isConnected: !!address && !!chainId,
    error
  }
}