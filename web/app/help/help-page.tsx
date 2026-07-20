import { useState } from "react";
import { MINHASH_BANDS } from "@shared/constants";
import { CollapsibleSection } from "../components/collapsible-section";

export function HelpPage() {
  const [about, setAbout] = useState(true);
  const [vault, setVault] = useState(false);
  const [excavation, setExcavation] = useState(false);
  const [bazaar, setBazaar] = useState(false);
  const [minhash, setMinhash] = useState(false);

  return (
    <div className="space-y-3">
      <CollapsibleSection title="About Relic Safari" icon="🏛️" expanded={about} onToggle={() => setAbout((v) => !v)}>
        <div className="space-y-3 pt-1 text-[13px] text-stone-300">
          <p>
            You're an <strong className="text-amber-300">archaeologist</strong> excavating relics on-chain. Every artifact is an ERC-1155 NFT with
            traits encoded as an on-chain <strong className="text-amber-300">MinHash</strong> signature — the traits themselves live in the trait
            values, but similarity between any two artifacts can be checked cheaply on-chain without comparing traits one by one.
          </p>
          <p>
            The loop: claim your <strong className="text-amber-300">stipend</strong>, spend it in the <strong className="text-amber-300">quarry</strong>{" "}
            to dig up artifacts, <strong className="text-purple-300">polymerize</strong> similar ones together to upgrade traits, then list what
            you don't want in the <strong className="text-amber-300">Bazaar</strong>.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Vault" icon="🎒" expanded={vault} onToggle={() => setVault((v) => !v)}>
        <div className="space-y-3 pt-1 text-[13px] text-stone-300">
          <p>Your home base — SCRIP and Essence balances, plus every artifact you own.</p>
          <p>
            Tap an artifact to expand it. <strong className="text-amber-300">🏛️ Auction</strong> lists it in the Bazaar; Fuse and Gift are coming
            soon.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Excavation" icon="⛏️" expanded={excavation} onToggle={() => setExcavation((v) => !v)}>
        <div className="space-y-3 pt-1 text-[13px] text-stone-300">
          <p>
            <strong className="text-amber-300">Explorer's Stipend</strong>: claim SCRIP every 12 hours to fund digging and bidding.
          </p>
          <p>
            <strong className="text-amber-300">Quarry</strong>: spend an excavation (5/day) to unearth an artifact with 1–8 random traits —
            rarity, age, quality, material, form, site, inscription.
          </p>
          <p>
            <strong className="text-purple-300">Polymerase</strong>: fuse two artifacts that share enough traits. Matching upgradeable traits level
            up on the target; everything else converts to <strong className="text-purple-300">Essence</strong>. Requires{" "}
            <strong className="text-amber-300">8/{MINHASH_BANDS}</strong> band matches.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Bazaar & Auctions" icon="⚖️" expanded={bazaar} onToggle={() => setBazaar((v) => !v)}>
        <div className="space-y-3 pt-1 text-[13px] text-stone-300">
          <p>
            <strong className="text-amber-300">Listing</strong>: from your Vault, pick an artifact, set a starting bid and duration. Listing is
            signature-only — no gas until someone actually wins.
          </p>
          <p>
            <strong className="text-amber-300">Bidding</strong>: also signature-only. Sign an SCRIP permit plus a bid for that specific artifact;
            nothing moves until the auctioneer settles.
          </p>
          <p>
            <strong className="text-amber-300">Settling</strong>: once the timer ends, the auctioneer submits the highest valid bid on-chain in one
            transaction — payment and artifact swap atomically.
          </p>
          <p>
            <strong className="text-amber-300">Standing buy orders</strong>: pick traits you want and sign a bid ahead of time. Any new auction
            matching your threshold attaches your bid automatically — no need to watch the Bazaar.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="MinHash Similarity" icon="🧬" expanded={minhash} onToggle={() => setMinhash((v) => !v)}>
        <div className="space-y-3 pt-1 text-[13px] text-stone-300">
          <p>
            Each artifact's traits hash down to <strong className="text-amber-300">{MINHASH_BANDS} independent bands</strong>. Two artifacts that
            share more traits will match on more bands — that's the{" "}
            <a href="https://en.wikipedia.org/wiki/MinHash" target="_blank" rel="noopener noreferrer" className="text-amber-400/80 underline hover:text-amber-300">
              MinHash
            </a>{" "}
            trick for estimating Jaccard similarity without an on-chain trait-by-trait comparison.
          </p>
          <p>Polymerase and standing buy orders both work off a "band match count" threshold rather than exact trait equality.</p>
          <p>Direct bids on a specific listing always require an exact ({MINHASH_BANDS}/{MINHASH_BANDS}) match, since you're buying that artifact specifically.</p>
        </div>
      </CollapsibleSection>
    </div>
  );
}
