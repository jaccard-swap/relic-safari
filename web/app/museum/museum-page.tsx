import { useState } from "react";
import { useAccount } from "wagmi";
import { TRAIT_POOLS } from "@shared/constants";
import { AGE_STYLES, MATERIAL_STYLES, SITE_STYLES, FORM_EMOJI } from "../lib/artifact-styles";
import { InfoModal } from "../components/info-modal";
import { Toast } from "../components/toast";
import { useAuthGate } from "../auth/use-auth-gate";
import { useMuseumProgress, type CupboardState } from "./use-museum-progress";
import { useBadgeCount } from "../lib/use-badges";
import { useCompleteCupboard } from "./use-complete-cupboard";
import { CupboardCompleteModal } from "./cupboard-complete-modal";

const SITES = TRAIT_POOLS.site.values.map((v) => v.value);
const AGES = TRAIT_POOLS.age.values.map((v) => v.value);
const MATERIALS = TRAIT_POOLS.material.values.map((v) => v.value);
const FORMS = TRAIT_POOLS.form.values.map((v) => v.value);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const siteLabel = (s: string) => cap(s.replace(/-/g, " "));

type View = { level: "hall" } | { level: "site"; site: string } | { level: "room"; site: string; age: string };

interface CupboardDetailModalProps {
  site: string;
  age: string;
  material: string;
  cell: CupboardState | null;
  onClose: () => void;
  onFreeze: () => void;
  isFreezing: boolean;
  authenticated: boolean;
}

function CupboardDetailModal({ site, age, material, cell, onClose, onFreeze, isFreezing, authenticated }: CupboardDetailModalProps) {
  const label = `${cap(material)} · ${cap(age)} · ${siteLabel(site)}`;

  if (cell?.alreadyCompleted) {
    return (
      <InfoModal open={true} onClose={onClose} title="Frozen Collection" icon="🏅">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="text-4xl">🏅</span>
          <p className="text-sm text-teal-200">{label}</p>
          <p className="text-xs text-stone-500">This cupboard is permanently sealed - its 7 artifacts were burned into a soulbound badge.</p>
        </div>
      </InfoModal>
    );
  }

  return (
    <InfoModal open={true} onClose={onClose} title={label} icon="🏺">
      <div className="grid grid-cols-4 gap-2 py-2 sm:grid-cols-7">
        {FORMS.map((form) => {
          const filled = cell?.filledForms[form];
          return (
            <div
              key={form}
              className={`flex flex-col items-center gap-1 rounded border p-2 ${
                filled ? "border-emerald-600/40 bg-emerald-950/20" : "border-dashed border-stone-700 bg-stone-900/40 opacity-50"
              }`}
            >
              <span className="text-xl">{FORM_EMOJI[form] ?? "⚱️"}</span>
              <span className="text-[10px] text-stone-400">{cap(form)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between rounded border border-stone-700/50 bg-stone-900/40 p-2">
        <span className="text-xs text-stone-500">Reward</span>
        <span className="text-sm text-teal-300">{cell?.points ?? 0} 🏅 points</span>
      </div>
      <button
        type="button"
        onClick={onFreeze}
        disabled={!cell?.complete || (authenticated && isFreezing)}
        title={cell?.complete && !authenticated ? "Sign in to freeze this collection" : undefined}
        className={`mt-3 w-full rounded py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-400 ${
          cell?.complete && authenticated
            ? "bg-gradient-to-r from-teal-600 to-cyan-700 text-white hover:from-teal-500 hover:to-cyan-600"
            : "bg-stone-800 text-stone-500"
        }`}
      >
        {isFreezing ? "Freezing…" : !cell?.complete ? "Not Yet Complete" : !authenticated ? "🔒 Sign in to freeze" : "Freeze Collection"}
      </button>
    </InfoModal>
  );
}

export function MuseumPage() {
  const { isConnected } = useAccount();
  const authenticated = useAuthGate();
  const [view, setView] = useState<View>({ level: "hall" });
  const [selectedCupboard, setSelectedCupboard] = useState<{ site: string; age: string; material: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data: grid, isLoading } = useMuseumProgress();
  const { badgeCount, refetchBadgeCount } = useBadgeCount();
  const complete = useCompleteCupboard();

  const handleFreeze = async (site: string, age: string, material: string) => {
    if (!authenticated) {
      setToast({ message: "Sign in to freeze this collection", type: "error" });
      return;
    }
    try {
      await complete.mutateAsync({ site, age, material });
    } catch (err) {
      setToast({ message: `Freeze failed: ${err instanceof Error ? err.message : "Unknown error"}`, type: "error" });
    }
  };

  const siteAggregate = (site: string) => {
    let done = 0;
    for (const age of AGES) for (const material of MATERIALS) if (grid?.[site]?.[age]?.[material]?.alreadyCompleted) done++;
    return { done, total: AGES.length * MATERIALS.length };
  };

  const ageAggregate = (site: string, age: string) => {
    let done = 0;
    for (const material of MATERIALS) if (grid?.[site]?.[age]?.[material]?.alreadyCompleted) done++;
    return { done, total: MATERIALS.length };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <span className="text-xs font-semibold text-amber-300">🏺 Museum</span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-sm text-teal-300">{badgeCount ?? 0}</span>
          <span className="text-xs text-stone-500">🏅 badges</span>
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-stone-400">
        Assemble one fully-upgraded artifact for every Form within a Site+Age+Material cupboard, then freeze it into a permanent, soulbound badge.
      </p>

      {!isConnected ? (
        <div className="py-6 text-center text-xs text-stone-500">Connect your wallet to see your collection</div>
      ) : isLoading ? (
        <div className="animate-pulse py-6 text-center text-xs text-stone-500">Loading your collection...</div>
      ) : view.level === "hall" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SITES.map((site) => {
            const { done, total } = siteAggregate(site);
            const s = SITE_STYLES[site];
            return (
              <button
                key={site}
                type="button"
                onClick={() => setView({ level: "site", site })}
                className="flex flex-col items-center gap-1 rounded-lg border border-teal-900/30 bg-gradient-to-b from-stone-900 via-teal-950/20 to-stone-900 p-4 transition-all hover:border-teal-700/50 hover:brightness-110"
              >
                <span className={`text-3xl ${s?.style ?? ""}`}>{s?.emoji ?? "🚪"}</span>
                <span className="text-xs font-medium text-stone-200">{siteLabel(site)}</span>
                <span className="text-[11px] text-stone-500">
                  {done}/{total}
                </span>
              </button>
            );
          })}
        </div>
      ) : view.level === "site" ? (
        <div className="space-y-2">
          <button type="button" onClick={() => setView({ level: "hall" })} className="text-xs text-teal-400 hover:text-teal-300">
            ← Back to Entrance Hall
          </button>
          <div className="mb-1 text-xs font-semibold text-teal-300">
            {SITE_STYLES[view.site]?.emoji} {siteLabel(view.site)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AGES.map((age) => {
              const { done, total } = ageAggregate(view.site, age);
              const a = AGE_STYLES[age];
              return (
                <button
                  key={age}
                  type="button"
                  onClick={() => setView({ level: "room", site: view.site, age })}
                  className="flex flex-col items-center gap-1 rounded-lg border border-teal-900/30 bg-gradient-to-b from-stone-900 via-teal-950/20 to-stone-900 p-4 transition-all hover:border-teal-700/50 hover:brightness-110"
                >
                  <span className={`text-3xl ${a?.style ?? ""}`}>{a?.emoji ?? "🚪"}</span>
                  <span className="text-xs font-medium text-stone-200">{cap(age)}</span>
                  <span className="text-[11px] text-stone-500">
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={() => setView({ level: "site", site: view.site })} className="text-xs text-teal-400 hover:text-teal-300">
            ← Back to {siteLabel(view.site)}
          </button>
          <div className="mb-1 text-xs font-semibold text-teal-300">
            {SITE_STYLES[view.site]?.emoji} {siteLabel(view.site)} · {AGE_STYLES[view.age]?.emoji} {cap(view.age)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MATERIALS.map((material) => {
              const cell = grid?.[view.site]?.[view.age]?.[material];
              const m = MATERIAL_STYLES[material];
              return (
                <button
                  key={material}
                  type="button"
                  onClick={() => setSelectedCupboard({ site: view.site, age: view.age, material })}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all hover:brightness-110 ${
                    cell?.alreadyCompleted
                      ? "border-amber-600/50 bg-gradient-to-b from-amber-950/30 to-stone-900"
                      : cell?.complete
                        ? "border-emerald-600/50 bg-gradient-to-b from-emerald-950/30 to-stone-900"
                        : "border-stone-700/50 bg-stone-900/40"
                  }`}
                >
                  <span className={`text-2xl ${m?.style ?? ""}`}>{cell?.alreadyCompleted ? "🏅" : (m?.emoji ?? "❔")}</span>
                  <span className="text-[11px] font-medium text-stone-300">{cap(material)}</span>
                  <div className="flex gap-0.5">
                    {FORMS.map((form) => (
                      <span key={form} className={`h-1.5 w-1.5 rounded-full ${cell?.filledForms[form] ? "bg-emerald-400" : "bg-stone-700"}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedCupboard && (
        <CupboardDetailModal
          site={selectedCupboard.site}
          age={selectedCupboard.age}
          material={selectedCupboard.material}
          cell={grid?.[selectedCupboard.site]?.[selectedCupboard.age]?.[selectedCupboard.material] ?? null}
          onClose={() => setSelectedCupboard(null)}
          onFreeze={() => {
            const { site, age, material } = selectedCupboard;
            setSelectedCupboard(null);
            void handleFreeze(site, age, material);
          }}
          isFreezing={complete.isPending}
          authenticated={authenticated}
        />
      )}

      <CupboardCompleteModal result={complete.data ?? null} onClose={() => complete.reset()} refetchBadgeCount={refetchBadgeCount} />

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </div>
  );
}
