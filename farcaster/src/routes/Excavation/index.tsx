import { useState } from 'react'
import { InfoModal } from '../../components/InfoModal'
import { Quarry } from './Quarry'
import { Stipend } from './Stipend'
import { Polymerase } from './Polymerase'
import { useFaucetBalances } from '../../hooks/useFaucetBalances'

export function Excavation() {
  const [stipendModal, setStipendModal] = useState(false)
  const [quarryModal, setQuarryModal] = useState(false)
  const [polymeraseModal, setPolymeraseModal] = useState(false)
  const [reactionsModal, setReactionsModal] = useState(false)
  
  const [stipendExpanded, setStipendExpanded] = useState(false)
  const [quarryExpanded, setQuarryExpanded] = useState(false)
  const [polymeraseExpanded, setPolymeraseExpanded] = useState(false)

  const { essenceBalance } = useFaucetBalances()

  return (
    <div className="p-3 space-y-2">
      
      {/* Explorer's Stipend */}
      <Stipend
        expanded={stipendExpanded}
        onToggle={() => setStipendExpanded(!stipendExpanded)}
        onHelp={() => setStipendModal(true)}
      />

      {/* Quarry */}
      <Quarry
        expanded={quarryExpanded}
        onToggle={() => setQuarryExpanded(!quarryExpanded)}
        onHelp={() => setQuarryModal(true)}
      />

      {/* Polymerase */}
      <Polymerase
        expanded={polymeraseExpanded}
        onToggle={() => setPolymeraseExpanded(!polymeraseExpanded)}
        onHelp={() => setPolymeraseModal(true)}
        onReactionsHelp={() => setReactionsModal(true)}
      />

      {/* Help Modals */}
      <InfoModal open={stipendModal} onClose={() => setStipendModal(false)} title="Explorer's Stipend" icon="💰">
        <p>The Archaeological Society provides funding. <strong className="text-amber-300">SCRIP</strong> is used to bid in the Bazaar.</p>
        <p><strong className="text-amber-300">φ² (~5.24)</strong> SCRIP on first claim, then <strong className="text-amber-300">φ (~1.62)</strong> for next 3.</p>
        <p>Resets every <strong className="text-amber-300">12 hours</strong>. Max ~10 SCRIP per window.</p>
        <p className="text-stone-500 text-xs">Technical: ERC-20 with permit support.</p>
      </InfoModal>

      <InfoModal open={quarryModal} onClose={() => setQuarryModal(false)} title="Quarry" icon="⛏️">
        <p>Each excavation unearths a relic with <strong className="text-amber-300">1-8 random traits</strong> (Gaussian distribution).</p>
        <p>Traits: rarity, age, quality, material, form, site, inscription.</p>
        <p className="text-amber-400/80 text-xs mt-2">⏳ Rate limit: <strong>3 excavations per hour</strong></p>
        <p className="text-stone-500 text-xs">Technical: ERC-1155 with on-chain MinHash.</p>
      </InfoModal>

      <InfoModal open={polymeraseModal} onClose={() => setPolymeraseModal(false)} title="Polymerase" icon="⚗️">
        <p><strong className="text-amber-300">Fuse two artifacts</strong> with shared traits.</p>
        <p>Matching traits upgrade on target. Non-matching become <strong className="text-purple-300">Essence</strong>.</p>
        <p>Essence: <strong className="text-purple-300">{essenceBalance?.count ?? 0}</strong> collected</p>
        <p className="text-stone-500 text-xs">Technical: Jaccard via MinHash. Requires 2/5 band matches.</p>
      </InfoModal>

      <InfoModal open={reactionsModal} onClose={() => setReactionsModal(false)} title="Recent Reactions" icon="🧪">
        <p>Your <strong className="text-purple-300">fusion history</strong> shows past polymerizations.</p>
        <p><strong className="text-emerald-300">⬆ Upgrades</strong>: Matching upgradeable traits level up.</p>
        <p><strong className="text-amber-300">+XP</strong>: Experience toward next level (matching traits that didn't level up).</p>
        <p><strong className="text-purple-300">+✨</strong>: Essence from non-matching traits.</p>
      </InfoModal>
    </div>
  )
}
