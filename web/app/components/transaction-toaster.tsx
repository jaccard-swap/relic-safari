import { useSyncExternalStore } from "react";
import { getChainName } from "../lib/explorer";
import {
  dismissTransaction,
  getTransactionToasts,
  subscribeToTransactionToasts,
  type TransactionToast,
} from "../lib/transaction-toasts";

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function SpinnerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="animate-spin" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2.5" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 13l4 4L19 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 0 0 3.2 20.6h17.6a1.5 1.5 0 0 0 1.31-2.19l-8.4-14.55a1.5 1.5 0 0 0-2.62 0z"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M14 5h5v5M19 5l-8 8M9 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_META = {
  pending: {
    label: "Pending",
    icon: SpinnerIcon,
    iconClass: "stroke-amber-500",
    badgeClass: "bg-amber-950 text-amber-300",
  },
  success: {
    label: "Confirmed",
    icon: CheckIcon,
    iconClass: "stroke-emerald-400",
    badgeClass: "bg-emerald-950 text-emerald-300",
  },
  error: {
    label: "Failed",
    icon: AlertIcon,
    iconClass: "stroke-red-400",
    badgeClass: "bg-red-950 text-red-300",
  },
} as const;

function ToastCard({ toast }: { toast: TransactionToast }) {
  const meta = STATUS_META[toast.status];
  const Icon = meta.icon;

  return (
    <div className="pointer-events-auto flex w-80 flex-col gap-2 rounded-lg border border-amber-900/30 bg-stone-800 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.badgeClass}`}>
            <Icon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
          </span>
          <div>
            <p className="text-sm font-medium text-amber-100">{toast.label}</p>
            <p className="text-xs text-stone-400">
              {meta.label} · {getChainName(toast.chainId)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismissTransaction(toast.id)}
          aria-label="Dismiss"
          className="shrink-0 text-stone-500 hover:text-stone-300"
        >
          <CloseIcon className="h-4 w-4 stroke-current" />
        </button>
      </div>

      {toast.status === "error" && toast.errorMessage && <p className="text-xs text-red-400">{toast.errorMessage}</p>}

      <div className="flex items-center justify-between gap-2 text-xs">
        {toast.explorerUrl ? (
          <a href={toast.explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-stone-400 hover:text-amber-300">
            {shortHash(toast.hash)}
          </a>
        ) : (
          <span className="font-mono text-stone-400">{shortHash(toast.hash)}</span>
        )}
        {toast.explorerUrl && (
          <a
            href={toast.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-medium text-amber-400 hover:text-amber-300"
          >
            View on explorer
            <ExternalLinkIcon className="h-3 w-3 stroke-current" />
          </a>
        )}
      </div>
    </div>
  );
}

export function TransactionToaster() {
  const toasts = useSyncExternalStore(subscribeToTransactionToasts, getTransactionToasts, getTransactionToasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
