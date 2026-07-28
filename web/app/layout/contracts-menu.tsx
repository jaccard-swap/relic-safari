import { useEffect, useRef, useState } from "react";
import { SiEthereum } from "react-icons/si";
import { sepolia } from "wagmi/chains";
import { getContract, type ContractName } from "../lib/contracts";

const CONTRACTS: { name: ContractName; label: string }[] = [
  { name: "JaccardSwap", label: "JaccardSwap (Diamond)" },
  { name: "Scrip", label: "Scrip" },
  { name: "ScripEssencePair", label: "Uniswap Pool (SCRIP/Essence)" },
];

// Same click-outside-to-close dropdown shape as WalletMenu. JaccardSwap here
// is one of several facet names (see lib/contracts.ts) that all resolve to
// the same diamond proxy address - Scrip and ScripEssencePair (the Uniswap
// V2 pool pairing SCRIP/Essence) are genuinely separate contracts, which is
// why each needs its own explorer link rather than folding into a single
// "Contract" link like the old single-address version did.
//
// Always links to the deployed Sepolia addresses, regardless of which chain
// (if any) the visitor's wallet is on - a player should be able to inspect
// the real contracts before ever connecting a wallet, and dev's wagmiConfig
// only knows about the local hardhat chain so it can't resolve Sepolia's
// explorer URL anyway.
export function ContractsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const explorerUrl = sepolia.blockExplorers?.default.url;

  const links = CONTRACTS.map(({ name, label }) => {
    const address = getContract(sepolia.id, name)?.address;
    const url = address && explorerUrl ? `${explorerUrl}/address/${address}` : null;
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
