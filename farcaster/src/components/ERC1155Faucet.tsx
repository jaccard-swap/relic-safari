import { useEffect } from 'react'
import { useErc1155Faucet } from '../hooks/useFaucet'
import { useFaucetBalances } from '../hooks/useFaucetBalances'

const ERC1155Faucet = () => {
  const {
    claimFaucetErc1155,
    isPending: erc1155Pending,
    isConfirming: erc1155Confirming,
    isConfirmed: erc1155Confirmed,
    isConnected: erc1155Connected,
    error: erc1155Error
  } = useErc1155Faucet()

  const { nftBalance, refetchNftData, isConnected } = useFaucetBalances()

  // Refetch balance after successful claim
  useEffect(() => {
    console.log('confirmed erc1155', erc1155Confirmed)
    if (erc1155Confirmed) {
      refetchNftData()
    }
  }, [erc1155Confirmed, refetchNftData])

  return (
    <button
      onClick={claimFaucetErc1155}
      disabled={!erc1155Connected || erc1155Pending || erc1155Confirming}
      className={`group relative px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 text-center glow-purple disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
        erc1155Error ? 'from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500' : ''
      }`}
    >
      <div className="text-2xl mb-1">🎨</div>
      <div className="text-lg font-bold mb-1 text-white">
        {(erc1155Pending || erc1155Confirming) ? 'Mining...' : erc1155Error ? 'Failed' : 'Claim NFT'}
      </div>
      <div className="text-white/80 text-xs">
        {erc1155Error ? 
          (erc1155Error.message?.includes('rejected') || erc1155Error.message?.includes('denied') ? 
            'Transaction rejected' : 'Transaction failed'
          ) : isConnected ? 
            `Balance: ${nftBalance?.count ?? 0} NFTs` : 'Get Thor\'s Hammer'
        }
      </div>
      {erc1155Confirmed && (
        <div className="absolute top-1 right-1 text-green-400 text-sm">✅</div>
      )}
      {erc1155Error && (
        <div className="absolute top-1 right-1 text-red-400 text-sm">❌</div>
      )}
    </button>
  )
}

export default ERC1155Faucet