import { useCallback } from 'react'
import { useErc20Faucet, useErc1155Faucet } from '../hooks/useFaucet'
import { useFaucetBalances } from '../hooks/useFaucetBalances'

const FaucetIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C11.5 2 11 2.19 10.59 2.59L7.29 5.88C6.5 6.67 6.5 7.95 7.29 8.74L8.71 10.16C9.5 10.95 10.78 10.95 11.57 10.16L12 9.73L12.43 10.16C13.22 10.95 14.5 10.95 15.29 10.16L16.71 8.74C17.5 7.95 17.5 6.67 16.71 5.88L13.41 2.59C13 2.19 12.5 2 12 2M12 4.41L14.88 7.29C14.88 7.29 14.59 7.59 14.59 7.59L12 10.17L9.41 7.59C9.41 7.59 9.12 7.29 9.12 7.29L12 4.41M5 12V14H7C7.55 14 8 14.45 8 15V19C8 19.55 7.55 20 7 20H5V22H19V20H17C16.45 20 16 19.55 16 19V15C16 14.45 16.45 14 17 14H19V12H5Z"/>
  </svg>
)

const NftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="12" y1="22.08" x2="12" y2="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

interface FaucetBoxProps {
  onNftMinted?: () => void
}

export const FaucetBox = ({ onNftMinted }: FaucetBoxProps) => {
  const { tokenBalance, nftBalance, refetchBalances, isConnected } = useFaucetBalances()

  // Refetch balances on tx confirmation
  const handleErc20Success = useCallback(() => {
    console.log('✅ ERC20 faucet confirmed, refetching balances')
    refetchBalances()
  }, [refetchBalances])

  const handleErc1155Success = useCallback(() => {
    console.log('✅ ERC1155 faucet confirmed, refetching balances')
    refetchBalances()
    onNftMinted?.()
  }, [refetchBalances, onNftMinted])

  const {
    claimFaucetErc20,
    isPending: erc20Pending,
    isConfirming: erc20Confirming,
    isConfirmed: erc20Confirmed,
    error: erc20Error
  } = useErc20Faucet(handleErc20Success)

  const {
    claimFaucetErc1155,
    isPending: erc1155Pending,
    isConfirmed: erc1155Confirmed,
    error: erc1155Error
  } = useErc1155Faucet(handleErc1155Success)

  return (
    <>
      {/* Funding - claim research credits */}
      <button
        onClick={claimFaucetErc20}
        disabled={!isConnected || erc20Pending || erc20Confirming}
        className={`flex-1 max-w-[80px] relative px-2 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 text-white font-medium rounded-lg transition-all duration-300 text-center disabled:opacity-50 disabled:cursor-not-allowed ${
          erc20Error ? 'from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500' : ''
        }`}
      >
        <FaucetIcon className="w-4 h-4 mx-auto" />
        <div className="text-xs font-semibold">
          {erc20Pending ? '✍️' : erc20Confirming ? '⏳' : erc20Error ? '!' : 'Funds'}
        </div>
        <div className="text-white/80 text-[10px]">
          {erc20Error ? 'err' : `${tokenBalance?.formatted?.toFixed(0) ?? '0'}`}
        </div>
        {erc20Confirmed && <div className="absolute -top-0.5 -right-0.5 text-green-400 text-[10px]">✓</div>}
        {erc20Error && <div className="absolute -top-0.5 -right-0.5 text-red-400 text-[10px]">✗</div>}
      </button>

      {/* Excavate - uncover artifacts */}
      <button
        onClick={claimFaucetErc1155}
        disabled={!isConnected || erc1155Pending}
        className={`flex-1 max-w-[80px] relative px-2 py-1.5 bg-gradient-to-r from-stone-600 to-amber-800 hover:from-stone-500 hover:to-amber-700 text-white font-medium rounded-lg transition-all duration-300 text-center disabled:opacity-50 disabled:cursor-not-allowed ${
          erc1155Error ? 'from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500' : ''
        }`}
      >
        <NftIcon className="w-4 h-4 mx-auto" />
        <div className="text-xs font-semibold">
          {erc1155Pending ? '⛏️' : erc1155Error ? '!' : 'Dig'}
        </div>
        <div className="text-white/80 text-[10px]">
          {erc1155Error ? 'err' : `${nftBalance?.count ?? 0}`}
        </div>
        {erc1155Confirmed && <div className="absolute -top-0.5 -right-0.5 text-green-400 text-[10px]">✓</div>}
        {erc1155Error && <div className="absolute -top-0.5 -right-0.5 text-red-400 text-[10px]">✗</div>}
      </button>
    </>
  )
}

