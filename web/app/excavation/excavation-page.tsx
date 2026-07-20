import { useState } from "react";
import { InfoModal } from "../components/info-modal";
import { StipendSection } from "./stipend-section";
import { QuarrySection } from "./quarry-section";
import { PolymeraseSection } from "./polymerase-section";
import { useBalances } from "../lib/use-balances";

export function ExcavationPage() {
  const [stipendModal, setStipendModal] = useState(false);
  const [quarryModal, setQuarryModal] = useState(false);
  const [polymeraseModal, setPolymeraseModal] = useState(false);
  const [reactionsModal, setReactionsModal] = useState(false);

  const [stipendExpanded, setStipendExpanded] = useState(false);
  const [quarryExpanded, setQuarryExpanded] = useState(false);
  const [polymeraseExpanded, setPolymeraseExpanded] = useState(false);

  const { essenceBalance } = useBalances();

  return (
    <div className="space-y-3">
      <StipendSection expanded={stipendExpanded} onToggle={() => setStipendExpanded((v) => !v)} onHelp={() => setStipendModal(true)} />

      <QuarrySection expanded={quarryExpanded} onToggle={() => setQuarryExpanded((v) => !v)} onHelp={() => setQuarryModal(true)} />

      <PolymeraseSection
        expanded={polymeraseExpanded}
        onToggle={() => setPolymeraseExpanded((v) => !v)}
        onHelp={() => setPolymeraseModal(true)}
        onReactionsHelp={() => setReactionsModal(true)}
      />

      <InfoModal open={stipendModal} onClose={() => setStipendModal(false)} title="Explorer's Stipend" icon="💰">
        <p>
          The Archaeological Society provides funding. <strong className="text-amber-300">SCRIP</strong> is used to bid in the Bazaar.
        </p>
        <p>
          <strong className="text-amber-300">φ² (~5.24)</strong> SCRIP on first claim, then <strong className="text-amber-300">φ (~1.62)</strong> for next 3.
        </p>
        <p>
          Resets every <strong className="text-amber-300">12 hours</strong>. Max ~10 SCRIP per window.
        </p>
        <p className="text-xs text-stone-500">Technical: ERC-20 with permit support.</p>
      </InfoModal>

      <InfoModal open={quarryModal} onClose={() => setQuarryModal(false)} title="Quarry" icon="⛏️">
        <p>
          Each excavation unearths a relic with <strong className="text-amber-300">1-8 random traits</strong> (Gaussian distribution).
        </p>
        <p>Traits: rarity, age, quality, material, form, site, inscription.</p>
        <p className="mt-3 text-xs text-amber-400/80">
          ⏳ Rate limit: <strong>3 excavations per hour</strong>
        </p>
        <p className="text-xs text-stone-500">Technical: ERC-1155 with on-chain MinHash.</p>
      </InfoModal>

      <InfoModal open={polymeraseModal} onClose={() => setPolymeraseModal(false)} title="Polymerase" icon="⚗️">
        <p>
          <strong className="text-amber-300">Fuse two artifacts</strong> with shared traits.
        </p>
        <p>
          Matching traits upgrade on target. Non-matching become <strong className="text-purple-300">Essence</strong>.
        </p>
        <p>
          Essence: <strong className="text-purple-300">{essenceBalance?.count ?? 0}</strong> collected
        </p>
        <p className="text-xs text-stone-500">Technical: Jaccard via MinHash. Requires 8/20 band matches.</p>
      </InfoModal>

      <InfoModal open={reactionsModal} onClose={() => setReactionsModal(false)} title="Recent Reactions" icon="🧪">
        <p>
          Your <strong className="text-purple-300">fusion history</strong> shows past polymerizations.
        </p>
        <p>
          <strong className="text-emerald-300">⬆ Upgrades</strong>: Matching upgradeable traits level up.
        </p>
        <p>
          <strong className="text-amber-300">+XP</strong>: Experience toward next level (matching traits that didn't level up).
        </p>
        <p>
          <strong className="text-purple-300">+✨</strong>: Essence from non-matching traits.
        </p>
      </InfoModal>
    </div>
  );
}
