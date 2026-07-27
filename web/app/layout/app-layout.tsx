import { Link, Outlet, useLocation } from "react-router";
import { FaGithub, FaDiscord } from "react-icons/fa";
import { WalletMenu } from "../auth/wallet-menu";
import { ContractsMenu } from "./contracts-menu";

const NAV_ITEMS = [
  { to: "/", icon: "🏛️", label: "Vault" },
  { to: "/bazaar", icon: "⚖️", label: "Bazaar" },
  { to: "/excavation", icon: "⛏️", label: "Excavation" },
  { to: "/forge", icon: "🔨", label: "Forge" },
  { to: "/exchange", icon: "⚖️", label: "Exchange" },
  { to: "/museum", icon: "🏺", label: "Museum" },
  { to: "/leaderboard", icon: "🏆", label: "Leaderboard" },
  { to: "/help", icon: "📜", label: "Help" },
] as const;

const SOCIAL_LINKS = [
  { href: "https://github.com/jaccard-swap/relic-safari", label: "GitHub", Icon: FaGithub },
  { href: "https://discord.gg/uDSmzjrK9N", label: "Discord", Icon: FaDiscord },
] as const;

// Persistent tabs, not the old app's click-to-reveal dropdown menu - the
// dropdown hid the other two sections behind an extra click on every visit
// and left a fully-built (but disabled) BottomNav sitting unused instead.
export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-stone-900">
      <nav className="sticky top-0 z-40 border-b border-amber-900/30 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-amber-900/30 text-amber-300" : "text-amber-200/60 hover:text-amber-200"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="text-amber-200/60 transition-colors hover:text-amber-200"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
            <ContractsMenu />
            <WalletMenu />
          </div>
        </div>
      </nav>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
