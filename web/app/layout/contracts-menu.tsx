import { useEffect, useRef, useState } from "react";
import { SiEthereum } from "react-icons/si";
import { useAccount } from "wagmi";
import { getContract, type ContractName } from "../lib/contracts";
import { getExplorerAddressUrl } from "../lib/explorer";
import { wagmiConfig } from "../lib/wagmi";

const CONTRACTS: { name: ContractName; label: string }[] = [
  { name: "JaccardSwap", label: "JaccardSwap (Diamond)" },
  { name: "Scrip", label: "Scrip" },
];

// Same click-outside-to-close dropdown shape as WalletMenu. JaccardSwap here
// is one of several facet names (see lib/contracts.ts) that all resolve to
// the same diamond proxy address - Scrip is the one genuinely separate
// contract, which is why it needs its own explorer link rather than folding
// into a single "Contract" link like the old single-address version did.
export function ContractsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only one chain is ever configured at a time (see lib/wagmi.ts), so fall
  // back to it when no wallet is connected yet rather than showing nothing.
  const { chainId: connectedChainId } = useAccount();
  const chainId = connectedChainId ?? wagmiConfig.chains[0]?.id;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const links = CONTRACTS.map(({ name, label }) => {
    const address = chainId ? getContract(chainId, name)?.address : undefined;
    const url = address && chainId ? getExplorerAddressUrl(chainId, address) : null;
    return { label, url };
  }).filter((link): link is { label: string; url: string } => !!link.url);

  if (links.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Contracts"
        title="Contracts"
        className="text-amber-200/60 transition-colors hover:text-amber-200"
      >
        <SiEthereum className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] rounded border border-amber-900/40 bg-stone-800 p-3 shadow-lg">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Contracts</p>
          <div className="flex flex-col gap-1">
            {links.map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="rounded px-1 py-1.5 text-left text-sm font-medium text-amber-200/70 hover:bg-stone-700"
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
