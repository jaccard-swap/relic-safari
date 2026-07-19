import { Link, Outlet, useLocation } from "react-router";
import { WalletMenu } from "../auth/wallet-menu";

const NAV_ITEMS = [
  { to: "/", icon: "🏛️", label: "Vault" },
  { to: "/bazaar", icon: "⚖️", label: "Bazaar" },
  { to: "/excavation", icon: "⛏️", label: "Excavation" },
  { to: "/help", icon: "📜", label: "Help" },
] as const;

// Persistent tabs, not the old app's click-to-reveal dropdown menu - the
// dropdown hid the other two sections behind an extra click on every visit
// and left a fully-built (but disabled) BottomNav sitting unused instead.
export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-stone-900">
      <nav className="sticky top-0 z-40 border-b border-amber-900/30 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    active ? "bg-amber-900/30 text-amber-300" : "text-amber-200/60 hover:text-amber-200"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <WalletMenu />
        </div>
      </nav>

      <main className="mx-auto max-w-3xl p-3">
        <Outlet />
      </main>
    </div>
  );
}
