import { useCallback } from 'react'
import { useErc20Faucet } from '../hooks/useFaucet'
import { useFaucetBalances } from '../hooks/useFaucetBalances'

const ERC20Faucet = () => {
  const { tokenBalance, refetchTokenData, isConnected } = useFaucetBalances()

  // Refetch balance after tx confirmed (status=1)
  const handleSuccess = useCallback(() => {
    console.log('✅ ERC20 faucet confirmed, refetching balance')
    refetchTokenData()
  }, [refetchTokenData])

  const {
    claimFaucetErc20,
    isPending: erc20Pending,
    isConfirming: erc20Confirming,
    isConfirmed: erc20Confirmed,
    isConnected: erc20Connected,
    error: erc20Error
  } = useErc20Faucet(handleSuccess)

  return (
    <button
      onClick={claimFaucetErc20}
      disabled={!erc20Connected || erc20Pending || erc20Confirming}
      className={`group relative px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 text-center glow-cyan disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
        erc20Error ? 'from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500' : ''
      }`}
    >
      <div className="text-2xl mb-1">💰</div>
      <div className="text-lg font-bold mb-1 text-white">
        {erc20Pending ? 'Sign...' : erc20Confirming ? 'Mining...' : erc20Error ? 'Failed' : 'Claim ERC20'}
      </div>
      <div className="text-white/80 text-xs">
        {erc20Error ? 
          (erc20Error.message?.includes('rejected') || erc20Error.message?.includes('denied') ? 
            'Transaction rejected' : 'Transaction failed'
          ) : isConnected ? 
            `Balance: ${tokenBalance?.formatted?.toFixed(2) ?? '0.00'} ${tokenBalance?.symbol ?? 'Tokens'}` : 'Get Test Tokens'
        }
      </div>
      {erc20Confirmed && (
        <div className="absolute top-1 right-1 text-green-400 text-sm">✅</div>
      )}
      {erc20Error && (
        <div className="absolute top-1 right-1 text-red-400 text-sm">❌</div>
      )}
    </button>
  )
}

export default ERC20Faucet