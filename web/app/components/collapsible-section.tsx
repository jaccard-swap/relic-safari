import type { ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  onHelp?: () => void;
  summary?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, icon, expanded, onToggle, onHelp, summary, action, children }: CollapsibleSectionProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-900/30 bg-stone-800/50">
      <div onClick={onToggle} className="w-full cursor-pointer p-2 text-left">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-amber-300">
            {icon} {title}
          </h2>
          <div className="flex items-center gap-2">
            {onHelp && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHelp();
                }}
                className="text-[10px] text-stone-500 hover:text-amber-300"
              >
                ?
              </button>
            )}
            <svg
              className={`h-3 w-3 text-stone-500 transition-transform ${expanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center justify-between px-1">{summary}</div>
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
        </div>
      </div>

      <div className={`grid transition-all duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-stone-700/50 px-2 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
