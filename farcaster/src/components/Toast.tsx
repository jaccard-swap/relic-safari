import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string
  icon?: string
  type?: 'success' | 'error' | 'info' | 'loading'
  duration?: number // ms, 0 = permanent
  onClose?: () => void
}

export function Toast({ message, icon, type = 'info', duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setExiting(true)
        setTimeout(() => {
          setVisible(false)
          onClose?.()
        }, 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!visible) return null

  const bgColor = {
    success: 'bg-emerald-900/90 border-emerald-600',
    error: 'bg-red-900/90 border-red-600',
    info: 'bg-stone-800/90 border-stone-600',
    loading: 'bg-amber-900/90 border-amber-600',
  }[type]

  const textColor = {
    success: 'text-emerald-300',
    error: 'text-red-300',
    info: 'text-stone-300',
    loading: 'text-amber-300',
  }[type]

  const defaultIcon = {
    success: '✨',
    error: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
  }[type]

  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className={`px-3 py-2 rounded-lg shadow-lg border ${bgColor}`}>
        <div className="flex items-center gap-2 text-xs">
          <span className={type === 'loading' ? 'animate-pulse' : ''}>
            {icon || defaultIcon}
          </span>
          <span className={textColor}>{message}</span>
          {duration > 0 && onClose && (
            <button 
              onClick={() => {
                setExiting(true)
                setTimeout(() => {
                  setVisible(false)
                  onClose()
                }, 300)
              }}
              className="ml-2 text-stone-500 hover:text-stone-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook for managing multiple toasts
export function useToast() {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([])

  const showToast = (props: ToastProps) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...props, id }])
    return id
  }

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const ToastContainer = () => (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div 
          key={toast.id}
          style={{ transform: `translateY(-${index * 8}px)` }}
        >
          <Toast 
            {...toast} 
            onClose={() => hideToast(toast.id)}
          />
        </div>
      ))}
    </div>
  )

  return { showToast, hideToast, ToastContainer }
}

