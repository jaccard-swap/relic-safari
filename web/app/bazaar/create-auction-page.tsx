import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArtifactPanel } from "../auction/artifact-panel";
import { useAuthGate } from "../auth/use-auth-gate";
import { Toast } from "../components/toast";
import { useCreateAuction } from "../lib/use-create-auction";
import { useNfts } from "../lib/use-nfts";

const DURATION_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

// Full-page counterpart to the old CreateAuctionModal - a route (not a
// modal) so it can be reached from anywhere an artifact is shown (Vault,
// the dig reveal) without stacking on top of whatever UI got us here, and so
// there's room for ArtifactPanel's full showcase (same component the
// auction room itself uses) alongside the form.
export function CreateAuctionPage() {
  const { nftId } = useParams();
  const navigate = useNavigate();
  const { data: nfts, isLoading } = useNfts();
  const { mutateAsync, isPending, error } = useCreateAuction();
  const authenticated = useAuthGate();

  const nft = nfts?.find((n) => n.id === nftId) ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingBid, setStartingBid] = useState("1");
  const [durationHours, setDurationHours] = useState(24);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (nft) setTitle(nft.metadata.name || `Artifact #${nft.tokenId.slice(-6)}`);
  }, [nft]);

  if (isLoading) {
    return <div className="rounded bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Loading artifact…</div>;
  }

  if (!nft) {
    return (
      <div className="rounded bg-red-900/20 p-4 text-center text-[13px] text-red-400">
        Artifact not found.{" "}
        <Link to="/" className="underline hover:text-red-300">
          Back to Vault
        </Link>
      </div>
    );
  }

  const bidValid = /^\d*\.?\d+$/.test(startingBid) && parseFloat(startingBid) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nft || !bidValid) return;
    if (!authenticated) {
      setToast({ message: "Sign in to list an artifact", type: "error" });
      return;
    }
    const result = await mutateAsync({ nft, title: title.trim() || nft.metadata.name || "Untitled artifact", description, startingBid, durationHours });
    void navigate(`/auction/${result.auction.id}`);
  }

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(260px,380px)_1fr] md:items-start">
      <ArtifactPanel nft={nft} />

      <div className="min-w-0 space-y-3 rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-amber-200">List for Auction</h2>
          <button type="button" onClick={() => navigate(-1)} className="text-lg text-stone-400 transition-colors hover:text-amber-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] text-stone-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-stone-400">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              className="w-full resize-none rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-stone-400">Starting bid (SCRIP)</label>
            <input
              type="text"
              inputMode="decimal"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-200 focus:border-amber-600 focus:outline-none"
            />
            {!bidValid && startingBid.length > 0 && <p className="mt-1.5 text-xs text-red-400">Enter a positive amount</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-stone-400">Duration</label>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setDurationHours(opt.hours)}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    durationHours === opt.hours ? "bg-amber-700 text-white" : "bg-stone-700/50 text-stone-400 hover:bg-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[13px] text-red-400">{error instanceof Error ? error.message : "Failed to create auction"}</p>}

          <button
            type="submit"
            disabled={authenticated && (isPending || !bidValid)}
            title={!authenticated ? "Sign in to list an artifact" : undefined}
            className={`w-full rounded py-3 text-xs font-semibold transition-opacity disabled:opacity-50 ${
              authenticated ? "bg-gradient-to-r from-amber-600 to-yellow-700 text-white" : "bg-stone-800 text-stone-500 opacity-60 hover:opacity-80"
            }`}
          >
            {isPending ? "Signing…" : authenticated ? "🏛️ List Artifact" : "🔒 Sign in to list"}
          </button>
        </form>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </div>
  );
}
