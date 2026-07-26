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
      <Topic title="About" icon="🏛️">
        <p>
          Dig relics on-chain, fuse the good ones, sell the rest. Every artifact carries a <Entry term="MinHash" /> signature — similarity is
          provable on-chain, not just cosmetic.
        </p>
        <p className="text-stone-400">
          Loop: <Entry term="Stipend" /> → <Entry term="Quarry" /> → <Entry term="Polymerize" accent="text-purple-300" /> → <Entry term="Bazaar" />
        </p>
      </Topic>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Topic title="Vault" icon="🎒">
          <p>Your balances and every artifact you own.</p>
          <p>
            Tap an artifact to expand it. <Entry term="🏛️ Auction" /> lists it in the Bazaar — Fuse and Gift are coming soon.
          </p>
        </Topic>

        <Topic title="Excavation" icon="⛏️">
          <p>
            <Entry term="Stipend" />: SCRIP every 12 hours.
          </p>
          <p>
            <Entry term="Quarry" />: 5 digs/day, each unearths 1–8 random traits.
          </p>
          <p>
            <Entry term="Polymerase" accent="text-purple-300" />: fuse two artifacts sharing{" "}
            <Entry term={`8/${MINHASH_BANDS}`} /> bands. Matches level up on the target; the rest becomes{" "}
            <Entry term="Essence" accent="text-purple-300" />.
          </p>
        </Topic>

        <Topic title="Bazaar & Auctions" icon="⚖️">
          <p>
            <Entry term="List" />: pick an artifact, set a starting bid + duration. Signature-only — no gas until it sells.
          </p>
          <p>
            <Entry term="Bid" />: sign an SCRIP permit + bid. Nothing moves until settlement.
          </p>
          <p>
            <Entry term="Settle" />: auctioneer submits the highest valid bid — payment and artifact swap atomically.
          </p>
          <p>
            <Entry term="Standing bids" />: set trait thresholds ahead of time; matching auctions attach automatically.
          </p>
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
