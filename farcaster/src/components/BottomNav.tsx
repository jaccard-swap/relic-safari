import { Link, useLocation } from '@tanstack/react-router'

const tabs = [
  { path: '/', icon: '🏛️', label: 'Vault' },
  { path: '/bazaar', icon: '⚖️', label: 'Bazaar' },
  { path: '/excavation', icon: '⛏️', label: 'Excavation' },
] as const

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="absolute bottom-[3.75%] left-[7.5%] right-[7.5%] z-50 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border border-amber-900/30 rounded-lg">
      <div className="flex justify-between items-center h-10 px-4">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                isActive
                  ? 'text-amber-400'
                  : 'text-stone-400 hover:text-amber-300'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className={`text-xs font-medium ${isActive ? 'text-amber-400' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
