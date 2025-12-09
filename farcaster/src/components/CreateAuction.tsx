import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useCreateAuction, type AuctionPrefill } from '../hooks/useCreateAuction'
import { useStaticData } from '../hooks/useStaticData'

interface CreateAuctionProps {
  showCreateForm: boolean
  setShowCreateForm: (show: boolean) => void
  prefill?: AuctionPrefill | null
  onClearPrefill?: () => void
}

export function CreateAuction({
  showCreateForm,
  setShowCreateForm,
  prefill,
  onClearPrefill
}: CreateAuctionProps) {
  const { createAuction, isReady } = useCreateAuction()
  const { staticData } = useStaticData()
  const navigate = useNavigate()
  const [signingStep, setSigningStep] = useState<'idle' | 'signing' | 'creating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const form = useForm({
    defaultValues: {
      title: prefill?.title || 'Artifact Auction',
      description: 'Ancient relic from the ruins',
      nftContract: prefill?.nftContract || staticData?.jaccardErc1155Addr || '',
      nftTokenId: prefill?.nftTokenId || '',
      tokenContract: staticData?.scripAddr || '',
      startingBid: '5.236',
      durationHours: 24
    },
    onSubmit: async ({ value }) => {
      setErrorMessage('')
      try {
        setSigningStep('signing')
        const result = await createAuction({
          title: value.title,
          description: value.description,
          nftContract: value.nftContract,
          nftTokenId: value.nftTokenId,
          tokenContract: value.tokenContract,
          startingBid: value.startingBid,
          durationHours: value.durationHours,
          nftId: prefill?.nftId,
        })
        
        if (result) {
          setSigningStep('success')
          setTimeout(() => {
            handleClose()
            navigate({ to: '/auction/$auctionId', params: { auctionId: result.id } })
          }, 800)
        }
      } catch (error) {
        console.error('Auction error:', error)
        setSigningStep('error')
        setErrorMessage(error instanceof Error ? error.message : 'Failed')
      }
    }
  })

  useEffect(() => {
    if (prefill) {
      if (prefill.nftContract) form.setFieldValue('nftContract', prefill.nftContract)
      if (prefill.nftTokenId) form.setFieldValue('nftTokenId', prefill.nftTokenId)
      if (prefill.title) form.setFieldValue('title', prefill.title)
    }
  }, [prefill])

  useEffect(() => {
    if (staticData) {
      if (!prefill?.nftContract && staticData.jaccardErc1155Addr) {
        form.setFieldValue('nftContract', staticData.jaccardErc1155Addr)
      }
      if (staticData.scripAddr) {
        form.setFieldValue('tokenContract', staticData.scripAddr)
      }
    }
  }, [staticData, prefill])

  const handleClose = () => {
    form.reset()
    setSigningStep('idle')
    setErrorMessage('')
    setShowCreateForm(false)
    onClearPrefill?.()
  }

  const isFormDisabled = signingStep !== 'idle' && signingStep !== 'error'

  if (!showCreateForm) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={handleClose}>
      <div className="bg-stone-800 border border-amber-900/50 rounded-lg w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30">
          <div className="flex items-center gap-2">
            <span>🏛️</span>
            <h2 className="text-sm font-semibold text-amber-200">List Auction</h2>
          </div>
          <button onClick={handleClose} className="text-stone-400 hover:text-amber-200 text-sm">✕</button>
        </div>

        {prefill && (
          <div className="px-3 py-1.5 bg-amber-900/20 border-b border-amber-900/30 text-[10px] text-amber-300/70">
            📦 {prefill.title}
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); form.handleSubmit() }} className="p-3 space-y-2">
          {/* Title */}
          <form.Field name="title">
            {(field) => (
              <div>
                <label className="text-[10px] text-stone-400">Title</label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  disabled={isFormDisabled}
                  className="w-full px-2 py-1 text-xs bg-stone-900/50 border border-stone-700 rounded text-white disabled:opacity-50"
                />
              </div>
            )}
          </form.Field>

          {/* Description */}
          <form.Field name="description">
            {(field) => (
              <div>
                <label className="text-[10px] text-stone-400">Description</label>
                <textarea
                  rows={2}
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  disabled={isFormDisabled}
                  className="w-full px-2 py-1 text-xs bg-stone-900/50 border border-stone-700 rounded text-white resize-none disabled:opacity-50"
                />
              </div>
            )}
          </form.Field>

          {/* NFT Contract - hidden if prefilled */}
          {!prefill?.nftContract && (
            <form.Field name="nftContract">
              {(field) => (
                <div>
                  <label className="text-[10px] text-stone-400">NFT Contract</label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full px-2 py-1 text-[10px] bg-stone-900/50 border border-stone-700 rounded text-white font-mono disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>
          )}

          {/* Token ID - hidden if prefilled */}
          {!prefill?.nftTokenId && (
            <form.Field name="nftTokenId">
              {(field) => (
                <div>
                  <label className="text-[10px] text-stone-400">Token ID</label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full px-2 py-1 text-xs bg-stone-900/50 border border-stone-700 rounded text-white font-mono disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>
          )}

          {/* Starting Bid & Duration row */}
          <div className="flex gap-2">
            <form.Field name="startingBid">
              {(field) => (
                <div className="flex-1">
                  <label className="text-[10px] text-stone-400">Starting Bid (SCRIP)</label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full px-2 py-1 text-xs bg-stone-900/50 border border-stone-700 rounded text-white disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="durationHours">
              {(field) => (
                <div className="w-20">
                  <label className="text-[10px] text-stone-400">Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={field.state.value}
                    onChange={e => field.handleChange(Number(e.target.value))}
                    disabled={isFormDisabled}
                    className="w-full px-2 py-1 text-xs bg-stone-900/50 border border-stone-700 rounded text-white disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* Status messages */}
          {errorMessage && signingStep === 'error' && (
            <div className="text-[10px] text-red-400 bg-red-900/20 rounded px-2 py-1">⚠️ {errorMessage}</div>
          )}
          {signingStep === 'success' && (
            <div className="text-[10px] text-green-400 bg-green-900/20 rounded px-2 py-1">✅ Listed!</div>
          )}
          {signingStep === 'signing' && (
            <div className="text-[10px] text-amber-300 bg-amber-900/20 rounded px-2 py-1">📝 Sign in wallet...</div>
          )}
          {!isReady && (
            <div className="text-[10px] text-stone-400 bg-stone-900/50 rounded px-2 py-1">Connect wallet first</div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={signingStep === 'signing'}
              className="flex-1 py-1.5 text-xs bg-stone-700 hover:bg-stone-600 text-white rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isFormDisabled || !isReady}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                signingStep === 'success' ? 'bg-green-700 text-white' :
                signingStep === 'error' ? 'bg-red-700 text-white' :
                'bg-amber-700 hover:bg-amber-600 text-white'
              }`}
            >
              {signingStep === 'signing' ? '✍️...' : signingStep === 'success' ? '✓' : signingStep === 'error' ? 'Retry' : 'List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
