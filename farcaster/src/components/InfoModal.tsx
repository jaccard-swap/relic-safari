import { useEffect } from 'react'

interface InfoModalProps {
  open: boolean
  onClose: () => void
  title: string
  icon: string
  children: React.ReactNode
}

export function InfoModal({ open, onClose, title, icon, children }: InfoModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-stone-800 border border-amber-900/50 rounded-lg shadow-xl max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="text-amber-200 font-semibold">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-amber-200 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-4 text-stone-300 text-sm space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

