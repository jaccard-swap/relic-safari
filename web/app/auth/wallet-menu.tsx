import { useEffect, useRef, useState } from "react";
import { useAccount, useChains, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ConnectorList } from "./connector-list";
import { useLogout, useSession, useSiweLogin } from "./use-auth";

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

export function WalletMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { address, chain, chainId, isConnected, connector: activeConnector } = useAccount();
  const { connectors } = useConnect();
  const chains = useChains();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { data: session } = useSession();
  const login = useSiweLogin();
  const logout = useLogout();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAuthed = isConnected && session?.authenticated;

  if (!isAuthed) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            // Wallet's already connected (e.g. a stale/expired SIWE token) -
            // just re-sign with the connector already in use.
            if (isConnected && activeConnector) {
              login.mutate(activeConnector);
              return;
            }
            if (connectors.length <= 1) {
              const connector = connectors[0];
              if (connector) login.mutate(connector);
              return;
            }
            setOpen((v) => !v);
          }}
          disabled={login.isPending}
          className="rounded border border-amber-900/30 bg-stone-800/50 px-3 py-1.5 text-sm font-medium text-amber-200/80 hover:bg-stone-700/50 disabled:opacity-60"
        >
          {login.isPending ? "Signing in…" : isConnected ? "Sign in" : "Connect Wallet"}
        </button>

        {open && !isConnected && connectors.length > 1 && (
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] rounded border border-amber-900/40 bg-stone-800 p-3 shadow-lg">
            <ConnectorList
              connectors={connectors}
              disabled={login.isPending}
              onSelect={(connector) => {
                login.mutate(connector);
                setOpen(false);
              }}
            />
          </div>
        )}

        {login.isError && (
          <p className="absolute right-0 top-full mt-1.5 w-48 text-right text-[13px] text-red-400">
            {login.error instanceof Error ? login.error.message : "Sign-in failed"}
          </p>
        )}
      </div>
    );
  }

  const walletMismatch = chain === undefined && chainId !== undefined;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-amber-900/30 bg-stone-800/50 px-3 py-1.5 text-sm font-medium text-amber-200/80 hover:bg-stone-700/50"
      >
        {walletMismatch && <span title="Wallet is on an unsupported network">⚠️</span>}
        <span className="font-mono">{chain?.name ?? "Unsupported"}</span>
        <span className="text-stone-500">·</span>
        <span className="font-mono">{address && shortAddress(address)}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded border border-amber-900/40 bg-stone-800 p-3 shadow-lg">
          <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Network</p>
          <div className="flex flex-col gap-1">
            {chains.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  switchChain({ chainId: c.id });
                  setOpen(false);
                }}
                disabled={isSwitchingChain}
                className={`rounded px-3 py-1.5 text-left text-sm font-medium disabled:opacity-50 ${
                  c.id === chainId ? "bg-amber-900/30 text-amber-300" : "text-amber-200/70 hover:bg-stone-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              disconnect();
              setOpen(false);
            }}
            className="mt-3 w-full rounded px-3 py-1.5 text-left text-sm font-medium text-red-400 hover:bg-red-950"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
