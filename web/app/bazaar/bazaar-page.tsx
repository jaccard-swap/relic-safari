import { useState } from "react";
import { InfoModal } from "../components/info-modal";
import { MINHASH_BANDS } from "@shared/constants";
import { ActiveAuctionsSection } from "./active-auctions-section";
import { StandingBuyOrders } from "./standing-buy-orders";

export function BazaarPage() {
  const [auctionsExpanded, setAuctionsExpanded] = useState(true);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [auctionsModal, setAuctionsModal] = useState(false);
  const [ordersModal, setOrdersModal] = useState(false);

  return (
    <div className="space-y-2">
      <ActiveAuctionsSection expanded={auctionsExpanded} onToggle={() => setAuctionsExpanded((v) => !v)} onHelp={() => setAuctionsModal(true)} />

      <StandingBuyOrders expanded={ordersExpanded} onToggle={() => setOrdersExpanded((v) => !v)} onHelp={() => setOrdersModal(true)} />

      <InfoModal open={auctionsModal} onClose={() => setAuctionsModal(false)} title="Active Auctions" icon="🏛️">
        <p>
          List an artifact from your <strong className="text-amber-300">Vault</strong> to start an auction.
        </p>
        <p>Bidding is signature-only — no gas until the winning bid actually settles.</p>
        <p className="text-xs text-stone-500">Highest valid bid wins when the auctioneer settles.</p>
      </InfoModal>

      <InfoModal open={ordersModal} onClose={() => setOrdersModal(false)} title="Standing Buy Orders" icon="📋">
        <p>
          Pick the traits you want and sign a <strong className="text-amber-300">standing bid</strong> — no auction required yet.
        </p>
        <p>
          Whenever a matching artifact goes up for auction (≥ your match threshold, out of <strong className="text-amber-300">{MINHASH_BANDS}</strong> bands), your
          bid is attached automatically.
        </p>
        <p className="text-xs text-stone-500">Good for 7 days, or until cancelled.</p>
      </InfoModal>
    </div>
  );
}
