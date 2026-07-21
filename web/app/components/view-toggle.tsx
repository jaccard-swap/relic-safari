export type CardView = "list" | "grid";

interface ViewToggleProps {
  view: CardView;
  onChange: (view: CardView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-stone-700 p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        title="List view"
        className={`rounded px-1.5 py-1 transition-colors ${view === "list" ? "bg-stone-700 text-amber-300" : "text-stone-500 hover:text-stone-300"}`}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Grid view"
        className={`rounded px-1.5 py-1 transition-colors ${view === "grid" ? "bg-stone-700 text-amber-300" : "text-stone-500 hover:text-stone-300"}`}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  );
}
