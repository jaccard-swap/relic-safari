import { useState } from 'react'
import { useConnection } from 'wagmi'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { WalletOptions } from './WalletOptions'
import { Connection } from './Connection'
import { ChainSwitcher } from './ChainSwitcher'

const routes = [
  { path: '/', icon: '🏛️', label: 'Vault' },
  { path: '/bazaar', icon: '⚖️', label: 'Bazaar' },
  { path: '/excavation', icon: '⛏️', label: 'Excavation' },
] as const

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { isConnected } = useConnection()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Get current route info (handle /auction/:id paths)
  const pathKey = location.pathname.startsWith('/auction') ? '/auction' : location.pathname
  const current = routes.find(r => r.path === pathKey) ?? { icon: '📜', label: 'Auction' }

  return (
    <nav className="border-b border-amber-900/30 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="relative flex items-center gap-1 text-sm">
          <Link to="/" className="font-semibold text-amber-200 hover:text-amber-100 transition-colors">
            ⚱️
          </Link>
          <span className="text-stone-500">/</span>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-amber-200/70 hover:text-amber-200 transition-colors"
          >
            <span>{current.icon} {current.label}</span>
            <span className="text-[10px] text-stone-500">{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 bg-stone-800 border border-amber-900/40 rounded shadow-lg min-w-[120px] z-50">
              {routes.map((route) => (
                <button
                  key={route.path}
                  onClick={() => {
                    navigate({ to: route.path })
                    setOpen(false)
                  }}
                  className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-stone-700 ${
                    route.path === pathKey ? 'text-amber-300 font-medium' : 'text-amber-200/70'
                  }`}
                >
                  {route.icon} {route.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <ChainSwitcher />
              <Connection />
            </>
          ) : (
            <WalletOptions />
          )}
        </div>
      </div>
    </nav>
  )
}
