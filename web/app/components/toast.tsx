import { useEffect, useState } from "react";

export interface ToastProps {
  message: string;
  icon?: string;
  type?: "success" | "error" | "info" | "loading";
  duration?: number; // ms, 0 = permanent
  onClose?: () => void;
}

export function Toast({ message, icon, type = "info", duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const bgColor = {
    success: "bg-emerald-900/90 border-emerald-600",
    error: "bg-red-900/90 border-red-600",
    info: "bg-stone-800/90 border-stone-600",
    loading: "bg-amber-900/90 border-amber-600",
  }[type];

  const textColor = {
    success: "text-emerald-300",
    error: "text-red-300",
    info: "text-stone-300",
    loading: "text-amber-300",
  }[type];

  const defaultIcon = { success: "✨", error: "⚠️", info: "ℹ️", loading: "⏳" }[type];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        exiting ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <div className={`rounded-lg border px-4 py-3 shadow-lg ${bgColor}`}>
        <div className="flex items-center gap-3 text-xs">
          <span className={type === "loading" ? "animate-pulse" : ""}>{icon || defaultIcon}</span>
          <span className={textColor}>{message}</span>
          {duration > 0 && onClose && (
            <button
              type="button"
              onClick={() => {
                setExiting(true);
                setTimeout(() => {
                  setVisible(false);
                  onClose();
                }, 300);
              }}
              className="ml-3 text-stone-500 hover:text-stone-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
