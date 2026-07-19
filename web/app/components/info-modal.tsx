import { useEffect } from "react";
import type { ReactNode } from "react";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: ReactNode;
}

export function InfoModal({ open, onClose, title, icon, children }: InfoModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-amber-900/50 bg-stone-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-amber-900/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="font-semibold text-amber-200">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-stone-400 transition-colors hover:text-amber-200">
            ✕
          </button>
        </div>
        <div className="space-y-3 p-4 text-sm text-stone-300">{children}</div>
      </div>
    </div>
  );
}
