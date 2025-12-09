import type { Chain } from 'viem'
import { getExplorerUrl } from '../utils/explorer'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  winnerAddress?: string
  finalBid?: string
  nftName?: string
  txHash?: string
  chain?: Chain
}

export const SuccessModal = ({
  isOpen,
  onClose,
  title,
  message,
  winnerAddress,
  finalBid,
  nftName,
  txHash,
  chain
}: SuccessModalProps) => {
  if (!isOpen) return null
  
  const txUrl = txHash && chain ? getExplorerUrl(chain, txHash, 'transaction') : null
  const winnerUrl = winnerAddress && chain ? getExplorerUrl(chain, winnerAddress, 'address') : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-stone-800 border border-amber-900/50 rounded-lg shadow-xl">
        <div className="p-4">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-stone-400 hover:text-amber-200 transition-colors"
          >
            ✕
          </button>

          {/* Success icon */}
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-amber-700/50 rounded-full flex items-center justify-center text-2xl">
              🏆
            </div>
          </div>

          {/* Title */}
          <h2 className="text-base font-semibold text-center text-amber-200 mb-2">
            {title}
          </h2>

          {/* Message */}
          <p className="text-stone-400 text-center text-xs mb-3">
            {message}
          </p>

          {/* Results */}
          {(winnerAddress || finalBid || nftName) && (
            <div className="bg-stone-900/50 rounded p-2 mb-3 border border-stone-700/50 space-y-1">
              {nftName && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-stone-500">Artifact:</span>
                  <span className="text-amber-200">{nftName}</span>
                </div>
              )}
              
              {winnerAddress && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-stone-500">Winner:</span>
                  {winnerUrl ? (
                    <a 
                      href={winnerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 font-mono hover:text-amber-200 hover:underline"
                    >
                      {winnerAddress.slice(0, 6)}...{winnerAddress.slice(-4)}
                    </a>
                  ) : (
                  <span className="text-amber-300 font-mono">
                    {winnerAddress.slice(0, 6)}...{winnerAddress.slice(-4)}
                  </span>
                  )}
                </div>
              )}
              
              {finalBid && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-stone-500">Final Bid:</span>
                  <span className="text-amber-400 font-medium">{finalBid}</span>
                </div>
              )}
            </div>
          )}

          {/* Tx hash link */}
          {txUrl && (
            <div className="mb-3 text-center">
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-stone-400 hover:text-amber-300 transition-colors"
              >
                View on Explorer ↗
              </a>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
