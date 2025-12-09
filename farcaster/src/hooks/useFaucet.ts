import * as React from 'react'
import { 
  useWaitForTransactionReceipt,
  useWriteContract,
  useWatchContractEvent,
  useConnection
} from 'wagmi'
import { zeroAddress } from 'viem'
import { useStaticData } from './useStaticData'
import { authFetch } from '../lib/auth'

export function useErc20Faucet(onSuccess?: () => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  const [mintedAmount, setMintedAmount] = React.useState<string | null>(null)
  const [awaitingMint, setAwaitingMint] = React.useState(false)
  
  const { 
    data: hash, 
    isPending, 
    writeContract,
    error: writeError,
    reset
  } = useWriteContract() 

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({ hash })

  // Watch for Transfer events (mint = from zero to user)
  useWatchContractEvent({
    address: staticData?.scripAddr as `0x${string}`,
    abi: staticData?.scripAbi,
    eventName: 'Transfer',
    args: {
      from: zeroAddress,
      to: address,
    },
    enabled: awaitingMint && !!staticData && !!address,
    onLogs(logs) {
      const log = logs[0]
      if (log?.args?.value) {
        setMintedAmount(log.args.value.toString())
        setAwaitingMint(false)
        onSuccess?.()
      }
    },
  })

  // Stop waiting when confirmed (fallback if event missed)
  React.useEffect(() => {
    if (isConfirmed) {
      setAwaitingMint(false)
    }
  }, [isConfirmed])

  const claimFaucetErc20 = React.useCallback(() => {
    if (!address || !staticData) return
    reset()
    setMintedAmount(null)
    setAwaitingMint(true)
    
    writeContract({
      address: staticData.scripAddr as `0x${string}`,
      abi: staticData.scripAbi,
      functionName: 'faucet',
      args: [],
    })
  }, [writeContract, address, staticData, reset])

  return {
    claimFaucetErc20,
    hash,
    mintedAmount,
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
      const response = await authFetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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