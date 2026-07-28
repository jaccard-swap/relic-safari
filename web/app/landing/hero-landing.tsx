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

// The hero mascot - a pith-helmeted, monocled explorer built from plain
// positioned divs (no image assets), pointing the way onward. Every child
// coordinate below is relative to its nearest positioned ancestor, so the
// face is laid out in the 80x80 head box, the jacket details in the
// 100x64 torso box, and the hand/motion-lines in the sleeve's own box (so
// they rotate together with the arm for free).
function SafariGentleman() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-44 w-36 select-none [animation:safari-sway_4s_ease-in-out_infinite]">
      {/* hat */}
      <div className="absolute left-[8px] top-[14px] h-[12px] w-[112px] -rotate-6 rounded-full bg-amber-100 shadow-sm" />
      <div className="absolute left-[28px] top-0 h-[36px] w-[64px] rounded-t-full bg-amber-50">
        <div className="absolute left-1/2 top-[2px] h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-amber-700" />
      </div>

      {/* head */}
      <div className="absolute left-[32px] top-[32px] h-[80px] w-[80px] rounded-full bg-[#e8b48c]">
        <div className="absolute left-[43px] top-[19px] h-[4px] w-[18px] -rotate-12 rounded-full bg-stone-800" />
        <div className="absolute left-[50px] top-[34px] h-[6px] w-[6px] rounded-full bg-stone-900" />
        <div className="absolute left-[42px] top-[26px] h-[26px] w-[26px] overflow-hidden rounded-full border-2 border-stone-200">
          <div className="absolute inset-0 [animation:monocle-glint_3.5s_ease-in-out_infinite] bg-gradient-to-tr from-transparent via-white/70 to-transparent" />
        </div>
        <div className="absolute left-[66px] top-[48px] h-[22px] w-[1.5px] origin-top rotate-[35deg] bg-stone-300" />
        <div className="absolute left-[66px] top-[42px] h-[8px] w-[8px] rounded-full bg-[#d9a276]" />
        <div className="absolute left-[44px] top-[52px] h-[10px] w-[26px]">
          <div className="absolute left-[2px] top-[3px] h-[5px] w-[22px] rounded-full bg-stone-800" />
          <div className="absolute left-[-2px] top-0 h-[8px] w-[8px] rounded-full bg-stone-800" />
          <div className="absolute right-[-2px] top-0 h-[8px] w-[8px] rounded-full bg-stone-800" />
        </div>
        <div className="absolute left-[52px] top-[64px] h-[2px] w-[12px] rounded-full bg-stone-700" />
      </div>

      {/* neck + jacket */}
      <div className="absolute left-[58px] top-[104px] h-[14px] w-[24px] bg-[#e8b48c]" />
      <div className="absolute left-[22px] top-[112px] h-[64px] w-[100px] rounded-t-2xl bg-stone-300">
        <div className="absolute left-1/2 top-[-4px] h-[12px] w-[12px] -translate-x-1/2 rotate-45 bg-teal-600" />
        <div className="absolute left-[14px] top-[26px] h-[12px] w-[16px] rounded-sm border border-stone-400/60" />
      </div>

      {/* pointing arm - hand/finger/motion-lines live inside so they swing with it */}
      <div
        className="absolute left-[100px] top-[118px] h-[64px] w-[16px] origin-bottom rounded-full bg-stone-300 [animation:safari-point_2.6s_ease-in-out_infinite]"
      >
        <div className="absolute left-[-2px] top-[6px] h-[10px] w-[20px] rounded-full bg-stone-400" />
        <div className="absolute left-[-2px] top-[-18px] h-[20px] w-[20px] rounded-full bg-[#e8b48c]" />
        <div className="absolute left-[6px] top-[-30px] h-[14px] w-[6px] rounded-full bg-[#e8b48c]" />
        <div className="absolute left-[-10px] top-[-24px] h-[2px] w-[10px] rounded-full bg-amber-300 [animation:safari-motion-line_2.6s_ease-in-out_infinite]" />
        <div className="absolute left-[-16px] top-[-16px] h-[2px] w-[8px] rounded-full bg-amber-300/80 [animation:safari-motion-line_2.6s_ease-in-out_infinite] [animation-delay:-0.3s]" />
      </div>
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
      <div className="relative overflow-hidden rounded-lg border border-amber-900/30 bg-gradient-to-b from-stone-800/80 to-stone-800/30 px-4 py-10">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="flex justify-center sm:w-1/2">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-b from-sky-900/60 via-sky-700/25 to-amber-500/30">
              {/* sky sun */}
              <div className="absolute left-1/2 top-5 h-16 w-16 -translate-x-1/2 rounded-full bg-amber-200/30 blur-2xl" />
              <div className="absolute left-1/2 top-6 h-8 w-8 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-100 to-amber-300 opacity-90" />

              {/* horizon */}
              <div className="absolute inset-x-0 bottom-14 h-px bg-amber-200/20" />

              {/* small bush, far left */}
              <div className="absolute bottom-11 left-2 h-3 w-10 rounded-[50%] bg-stone-900/60" />

              {/* acacia tree, standing back-right behind the mascot */}
              <div className="absolute bottom-11 right-6 h-14 w-1.5 -rotate-3 rounded-full bg-stone-900/70" />
              <div className="absolute bottom-[92px] right-0 h-4 w-28 rounded-[50%] bg-stone-900/70" />
              <div className="absolute bottom-[84px] right-3 h-3 w-20 rounded-[50%] bg-stone-900/60" />

              {/* golden grassland */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-amber-600/50 to-transparent" />
              <div className="absolute bottom-0 left-2 h-3 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-700/70" />
              <div className="absolute bottom-0 left-6 h-4 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-600/70" />
              <div className="absolute bottom-0 left-10 h-2.5 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-800/70" />
              <div className="absolute bottom-0 left-1/2 h-3 w-1.5 -translate-x-1/2 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-700/70" />
              <div className="absolute bottom-0 right-10 h-3 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-700/70" />
              <div className="absolute bottom-0 right-6 h-4 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-600/70" />
              <div className="absolute bottom-0 right-2 h-2.5 w-1.5 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] bg-amber-800/70" />

              <div className="absolute inset-x-0 bottom-0 flex justify-center">
                <SafariGentleman />
              </div>
            </div>
          </div>
          <div className="text-center sm:w-1/2 sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-amber-200">Relic Safari</h1>
            <ul className="mx-auto mt-3 max-w-xs space-y-1.5 sm:mx-0 sm:max-w-none">
              <li className="text-sm font-extrabold uppercase tracking-tight text-amber-300">🏆 Become the greatest relic hunter</li>
              <li className="text-sm font-extrabold uppercase tracking-tight text-teal-300">🎖️ Earn points. Complete your collection.</li>
              <li className="text-sm font-extrabold uppercase tracking-tight text-purple-300">🧩 Max out every artifact slot</li>
              <li className="text-sm font-extrabold uppercase tracking-tight text-amber-300">⛏️ Dig it · ⚗️ fuse it · 🏪 buy it</li>
            </ul>
            <div className="mt-6 flex justify-center sm:justify-start">
              <ConnectCta label="Connect Wallet & Start Digging" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          title="🏪 Trade"
          accent="text-amber-300"
        >
          List in the Bazaar with a signature — no gas until it sells. Or drop a standing bid and let matching artifacts come find you.
        </Pillar>

        <Pillar
          icon={
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="text-3xl">🏺</span>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl [animation:dig-spark_1.4s_ease-in-out_infinite]">✨</span>
            </div>
          }
          title="🏆 Collect"
          accent="text-teal-300"
        >
          Fill a Museum cupboard with a fully-repaired artifact for every Form in its Site+Age+Material — then freeze it into a soulbound badge
          for leaderboard points.
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
