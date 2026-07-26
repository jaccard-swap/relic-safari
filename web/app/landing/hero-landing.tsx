import { useState } from "react";
import { MINHASH_BANDS } from "@shared/constants";
import { useConnect } from "wagmi";
import { ConnectorList } from "../auth/connector-list";

// Example band pattern for the MinHash explainer below - purely illustrative
// (not derived from any real artifact pair), chosen just to read clearly as
// "most, not all, bands lit up".
const EXAMPLE_MATCHED_BANDS = new Set([0, 1, 2, 4, 5, 6, 7, 9, 10, 12, 13, 14, 16, 17, 19]);

function ConnectCta({ label }: { label: string }) {
  const { connectors, connectAsync, isPending } = useConnect();
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (connectors.length <= 1) {
      const connector = connectors[0];
      if (connector) void connectAsync({ connector });
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg bg-gradient-to-r from-amber-600 to-yellow-700 px-8 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-amber-900/40 transition-all hover:scale-105 hover:from-amber-500 hover:to-yellow-600 disabled:opacity-60 disabled:hover:scale-100"
      >
        {isPending ? "Connecting…" : label}
      </button>
      {open && connectors.length > 1 && (
        <div className="w-56 rounded border border-amber-900/40 bg-stone-800 p-3 shadow-lg">
          <ConnectorList
            connectors={connectors}
            disabled={isPending}
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

interface PillarProps {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}

function Pillar({ icon, title, accent, children }: PillarProps) {
  return (
    <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center">{icon}</div>
      <div className={`text-sm font-semibold ${accent}`}>{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-stone-400">{children}</p>
    </div>
  );
}

// Shown in place of the Vault when no wallet is connected (see
// vault-page.tsx) - a marketing splash rather than a dead-end "connect a
// wallet" box, pitching the three-step loop (dig / power up / trade) and the
// MinHash mechanic underneath it. Reuses the exact animation vocabulary
// already established for each of those flows (dig-strike/dig-spark for the
// quarry, alchemy-glow/alchemy-orbit for polymerase) rather than inventing a
// fourth set of keyframes just for this page.
export function HeroLanding() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-amber-900/30 bg-gradient-to-b from-stone-800/80 to-stone-800/30 px-4 py-10 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
        <div className="relative">
          <div className="text-5xl">🏛️</div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-amber-200">Relic Safari</h1>
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-stone-300">
            An on-chain dig site where rarity isn't just flavor text — every artifact's traits are provably comparable, band by band.
          </p>
          <div className="mt-6">
            <ConnectCta label="Connect Wallet & Start Digging" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pillar
          icon={
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="text-3xl [animation:dig-impact_1.4s_ease-in-out_infinite]">🪨</span>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl [animation:dig-spark_1.4s_ease-in-out_infinite]">✨</span>
              <span className="absolute -left-2 -top-2 origin-[85%_85%] text-3xl [animation:dig-strike_1.4s_ease-in-out_infinite]">⛏️</span>
            </div>
          }
          title="⛏️ Excavate"
          accent="text-amber-300"
        >
          Spend your Stipend in the Quarry to unearth artifacts with 1–8 random traits. Five digs a day, every one a gamble.
        </Pillar>

        <Pillar
          icon={
            <div className="relative h-full w-full">
              <span className="absolute inset-0 flex items-center justify-center text-3xl [animation:alchemy-glow_1.6s_ease-in-out_infinite]">⚗️</span>
              <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite]">✨</span>
              <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-0.8s]">✨</span>
              <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-1.6s]">✨</span>
            </div>
          }
          title="⚗️ Power Up"
          accent="text-purple-300"
        >
          Polymerize two similar artifacts — shared traits level up on the target, everything else breaks down into Essence. Science, but make it
          loot.
        </Pillar>

        <Pillar
          icon={
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="text-3xl">🪙</span>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl [animation:dig-spark_1.4s_ease-in-out_infinite]">✨</span>
              <span className="absolute -left-1 -top-3 origin-[80%_80%] text-3xl [animation:dig-strike_1.4s_ease-in-out_infinite]">🔨</span>
            </div>
          }
          title="⚖️ Trade"
          accent="text-amber-300"
        >
          List in the Bazaar with a signature — no gas until it sells. Or drop a standing bid and let matching artifacts come find you.
        </Pillar>
      </div>

      <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
        <div className="text-center text-sm font-semibold text-amber-300">🧬 The Secret Sauce: MinHash</div>
        <p className="mx-auto mt-2 max-w-md text-center text-[13px] leading-relaxed text-stone-300">
          Every artifact's traits compress into <strong className="text-amber-300">{MINHASH_BANDS} independent bands</strong>, stored on-chain.
          Two artifacts that share more traits land on more of the same bands — that's the{" "}
          <a
            href="https://en.wikipedia.org/wiki/MinHash"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400/80 underline hover:text-amber-300"
          >
            MinHash
          </a>{" "}
          trick for estimating similarity without ever comparing traits one-by-one on-chain. Cheap, provable, no oracle required — and it's what
          decides whether two artifacts can fuse, or whether your standing bid just found a match.
        </p>
        <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1">
          {Array.from({ length: MINHASH_BANDS }, (_, i) => (
            <div key={i} className={`h-3 w-3 rounded-sm ${EXAMPLE_MATCHED_BANDS.has(i) ? "bg-amber-500" : "bg-stone-700"}`} />
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-stone-500">15/{MINHASH_BANDS} bands matched — close enough to fuse.</p>
      </div>

      <div className="pb-2 text-center">
        <ConnectCta label="Connect Wallet" />
      </div>
    </div>
  );
}
