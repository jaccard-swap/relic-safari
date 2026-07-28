import { MINHASH_BANDS } from "@shared/constants";

interface TopicProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function Topic({ title, icon, children }: TopicProps) {
  return (
    <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
      <h2 className="text-xs font-semibold text-amber-300">
        {icon} {title}
      </h2>
      <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-stone-300">{children}</div>
    </div>
  );
}

function Entry({ term, accent = "text-amber-300" }: { term: string; accent?: string }) {
  return <strong className={accent}>{term}</strong>;
}

// Was a single-column accordion (one section open at a time) built for the
// old Farcaster frame's narrow, short embed. A standalone browser tab has
// room for all of it at once, so this drops the expand/collapse state
// entirely for a scannable grid, and trims the copy down to what you'd
// actually want mid-session rather than a first read.
export function HelpPage() {
  return (
    <div className="space-y-3">
      <Topic title="Goal & How to Play" icon="🎯">
        <p>
          Become the greatest relic hunter. <Entry term="Leaderboard" accent="text-teal-300" /> points come from one place only: freezing
          completed <Entry term="Museum" accent="text-teal-300" /> collections into soulbound badges.
        </p>
        <p className="text-stone-400">
          The loop: claim your <Entry term="Stipend" /> → dig in the <Entry term="Quarry" /> → grow artifacts with{" "}
          <Entry term="Forge" accent="text-orange-300" /> or <Entry term="Polymerase" accent="text-purple-300" /> → assemble a matching set of
          7 → freeze it in the <Entry term="Museum" accent="text-teal-300" /> for points.
        </p>
        <p className="text-stone-400">
          Missing a piece? Buy it in the <Entry term="Bazaar" />, or swap currencies in the <Entry term="Exchange" />.
        </p>
      </Topic>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Topic title="Vault" icon="🎒">
          <p>Your balances — SCRIP, Essence, and Leaderboard Points — plus every artifact you own, as a list or card grid.</p>
          <p>
            Tap an artifact to expand it. <Entry term="🏛️ Auction" /> jumps straight to listing it in the Bazaar. It's a hub, not an action
            page — everything else happens in Excavation, Forge, or the Museum.
          </p>
        </Topic>

        <Topic title="Excavation" icon="⛏️">
          <p>
            <Entry term="Stipend" />: free SCRIP every 12 hours (unlimited on the local dev network).
          </p>
          <p>
            <Entry term="Quarry" />: dig for a relic with 1–8 random traits. 5 digs per rolling 24 hours.
          </p>
          <p>
            <Entry term="Polymerase" accent="text-purple-300" />: fuse a target artifact with a catalyst sharing at least{" "}
            <Entry term={`4/${MINHASH_BANDS}`} /> MinHash bands. Matching upgradeable traits level up on the target for free — everything else
            (plus the catalyst itself) converts to <Entry term="Essence" accent="text-purple-300" />, more per fusion the higher the match count.
            The catalyst is burned.
          </p>
        </Topic>

        <Topic title="Forge" icon="🔨">
          <p>
            Spend <Entry term="Essence" accent="text-purple-300" /> directly on one artifact to level up a single trait — no second artifact,
            no chance of failure. Costs more than fusing the same trait via Polymerase; you're paying for certainty and speed.
          </p>
          <p className="text-stone-400">
            Once every trait is maxed, extra Essence can still go into <Entry term="Overflow" accent="text-orange-300" /> — a pure prestige
            sink with rising cost and no further trait effect.
          </p>
        </Topic>

        <Topic title="Bazaar & Auctions" icon="🏪">
          <p>
            <Entry term="List" />: pick an artifact, a starting bid, and a duration (1h/6h/24h/3d/7d). Signature-only — no gas until it sells.
          </p>
          <p>
            <Entry term="Bid" />: sign an SCRIP permit for more than the current highest bid. Nothing moves until settlement, so losing bids
            just expire.
          </p>
          <p>
            <Entry term="Settle" />: anyone can trigger it once the auction ends — the highest valid bid's payment and the artifact swap
            atomically.
          </p>
          <p>
            <Entry term="Standing bids" />: set desired traits + a minimum band-match threshold ahead of time; matching auctions attach
            automatically for 7 days.
          </p>
        </Topic>

        <Topic title="Exchange" icon="⚖️">
          <p>
            A live Uniswap V2 pool swapping <Entry term="SCRIP" /> ↔ <Entry term="Essence" accent="text-purple-300" /> directly, both
            directions. Quotes come straight from the pool, with the standard 0.3% pool fee plus a 2% slippage buffer built in.
          </p>
          <p className="text-stone-400">
            The one page that's a real signed transaction, not gasless — you're trading against the pool, not the game's backend.
          </p>
        </Topic>

        <Topic title="Museum" icon="🏺">
          <p>
            Drill down Site → Age → Material to find a <Entry term="cupboard" accent="text-teal-300" />: 7 pedestal slots, one per Form. Each
            slot only accepts a fully-maxed artifact (every upgradeable trait at max level) matching that exact combination.
          </p>
          <p>
            Fill all 7 and <Entry term="Freeze Collection" accent="text-teal-300" /> burns them and mints a permanent, soulbound badge. Rarer
            Site+Age+Material combos are worth more Leaderboard points. Each cupboard can only ever be completed once.
          </p>
        </Topic>

        <Topic title="Leaderboard" icon="🏆">
          <p>Ranked purely by total points from frozen Museum badges — nothing else counts. Badge count is shown alongside as a tiebreaker at a glance.</p>
        </Topic>

        <Topic title="MinHash Similarity" icon="🧬">
          <p>
            Traits hash into <Entry term={`${MINHASH_BANDS} independent bands`} /> on-chain. Shared traits land on shared bands — that's{" "}
            <a href="https://en.wikipedia.org/wiki/MinHash" target="_blank" rel="noopener noreferrer" className="text-amber-400/80 underline hover:text-amber-300">
              MinHash
            </a>
            , estimating Jaccard similarity without comparing traits one-by-one.
          </p>
          <p className="text-stone-400">
            Polymerase and standing bids use a band-match threshold. Direct bids need an exact {MINHASH_BANDS}/{MINHASH_BANDS}.
          </p>
        </Topic>
      </div>
    </div>
  );
}
