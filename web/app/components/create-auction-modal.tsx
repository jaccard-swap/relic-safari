import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FORM_EMOJI } from "../lib/artifact-styles";
import { useCreateAuction } from "../lib/use-create-auction";
import type { Nft } from "../lib/use-nfts";

interface CreateAuctionModalProps {
  nft: Nft | null;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function CreateAuctionModal({ nft, onClose }: CreateAuctionModalProps) {
  const navigate = useNavigate();
  const { mutateAsync, isPending, error } = useCreateAuction();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingBid, setStartingBid] = useState("1");
  const [durationHours, setDurationHours] = useState(24);

  useEffect(() => {
    if (nft) {
      setTitle(nft.metadata.name || `Artifact #${nft.tokenId.slice(-6)}`);
      setDescription("");
      setStartingBid("1");
      setDurationHours(24);
    }
  }, [nft]);

  useEffect(() => {
    document.body.style.overflow = nft ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [nft]);

  if (!nft) return null;

  const form = nft.metadata.form as string | undefined;
  const bidValid = /^\d*\.?\d+$/.test(startingBid) && parseFloat(startingBid) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nft || !bidValid) return;
    const result = await mutateAsync({ nft, title: title.trim() || nft.metadata.name || "Untitled artifact", description, startingBid, durationHours });
    onClose();
    void navigate(`/auction/${result.auction.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-amber-900/50 bg-stone-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-amber-900/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}</span>
            <h3 className="font-semibold text-amber-200">List for Auction</h3>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-stone-400 transition-colors hover:text-amber-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-[10px] text-stone-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-1.5 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-stone-400">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={2}
              className="w-full resize-none rounded border border-stone-700 bg-stone-900 px-2 py-1.5 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-stone-400">Starting bid (SCRIP)</label>
            <input
              type="text"
              inputMode="decimal"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-1.5 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
            {!bidValid && startingBid.length > 0 && <p className="mt-1 text-[9px] text-red-400">Enter a positive amount</p>}
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-stone-400">Duration</label>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setDurationHours(opt.hours)}
                  className={`rounded px-1.5 py-1 text-[9px] font-medium transition-colors ${
                    durationHours === opt.hours ? "bg-amber-700 text-white" : "bg-stone-700/50 text-stone-400 hover:bg-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[10px] text-red-400">{error instanceof Error ? error.message : "Failed to create auction"}</p>}

          <button
            type="submit"
            disabled={isPending || !bidValid}
            className="w-full rounded bg-gradient-to-r from-amber-600 to-yellow-700 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {isPending ? "Signing…" : "🏛️ List Artifact"}
          </button>
        </form>
      </div>
    </div>
  );
}
