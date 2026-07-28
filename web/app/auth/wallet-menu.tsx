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

  // Only one chain is ever configured per environment (hardhat locally,
  // sepolia in prod - see wagmi.ts), so there's exactly one right answer
  // for "which chain should this wallet be on."
  const targetChainId = chains[0]?.id;

  // Nudge a freshly-connected wallet onto that chain automatically rather
  // than leaving it stuck on "Unsupported" until the user notices and opens
  // the network dropdown themselves - the API's /auth/login now rejects a
  // SIWE message signed for the wrong chainId (see api/src/routes/auth),
  // so a mismatched wallet couldn't sign in successfully anyway. Only
  // re-fires when the mismatch itself changes, so declining the wallet's
  // switch prompt once doesn't turn into a repeat-prompt loop on every
  // render - the dropdown below still offers a manual switch either way.
  useEffect(() => {
    if (isConnected && targetChainId && chainId !== targetChainId) {
      switchChain({ chainId: targetChainId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, chainId, targetChainId]);

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

  const authenticated = session?.authenticated ?? false;
  const walletMismatch = chain === undefined && chainId !== undefined;

  // Connected (whether or not signed in yet) - network switching lives here,
  // outside the SIWE gate. A wallet that opens on the wrong chain needs to
  // be able to switch *before* signing, since the SIWE message itself is
  // built from the currently-connected chainId (see useSiweLogin) - signing
  // in on the wrong network then switching after leaves a stale session.
  return (
    <div className="flex items-center gap-2">
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

      {!authenticated && (
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
      )}
    </div>
  );
}
