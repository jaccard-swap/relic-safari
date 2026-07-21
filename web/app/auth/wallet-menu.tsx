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

  const { address, chain, chainId, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
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

  // Not connected yet - this button only connects a wallet, it never signs
  // anything. Signing in is a separate, explicit step below.
  if (!isConnected) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            if (connectors.length <= 1) {
              const connector = connectors[0];
              if (connector) void connectAsync({ connector });
              return;
            }
            setOpen((v) => !v);
          }}
          disabled={isConnecting}
          className="rounded border border-amber-900/30 bg-stone-800/50 px-3 py-1.5 text-sm font-medium text-amber-200/80 hover:bg-stone-700/50 disabled:opacity-60"
        >
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </button>

        {open && connectors.length > 1 && (
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] rounded border border-amber-900/40 bg-stone-800 p-3 shadow-lg">
            <ConnectorList
              connectors={connectors}
              disabled={isConnecting}
              onSelect={(connector) => {
                void connectAsync({ connector });
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Connected, but no (or a stale) SIWE session - require an explicit click
  // to sign rather than popping the signature prompt the moment the wallet
  // connects.
  if (!session?.authenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded border border-stone-700/50 bg-stone-800/30 px-3 py-1.5 font-mono text-sm text-stone-400">
          {address && shortAddress(address)}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => login.mutate()}
            disabled={login.isPending}
            className="rounded border border-amber-900/30 bg-stone-800/50 px-3 py-1.5 text-sm font-medium text-amber-200/80 hover:bg-stone-700/50 disabled:opacity-60"
          >
            {login.isPending ? "Signing in…" : "Sign In"}
          </button>
          {login.isError && (
            <p className="absolute right-0 top-full mt-1.5 w-48 text-right text-[13px] text-red-400">
              {login.error instanceof Error ? login.error.message : "Sign-in failed"}
            </p>
          )}
        </div>
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
