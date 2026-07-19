import { getExplorerTxUrl } from "./explorer";

export interface TransactionToast {
  id: string;
  label: string;
  chainId: number;
  hash: `0x${string}`;
  explorerUrl: string | null;
  status: "pending" | "success" | "error";
  errorMessage?: string;
}

// How long a resolved (success/error) toast lingers before auto-dismissing -
// long enough to notice, short enough not to pile up across a session.
const SUCCESS_DISMISS_MS = 8_000;
const ERROR_DISMISS_MS = 15_000;

let toasts: TransactionToast[] = [];
const listeners = new Set<() => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToTransactionToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTransactionToasts(): TransactionToast[] {
  return toasts;
}

// Called once a hash exists (i.e. the wallet has signed) - not on connect/sign
// rejection, since there's nothing yet for the user to go watch on a block
// explorer at that point.
export function notifyTransaction(params: { chainId: number; hash: `0x${string}`; label: string }): string {
  const id = `${params.hash}-${Math.random().toString(36).slice(2)}`;
  toasts = [
    ...toasts,
    {
      id,
      label: params.label,
      chainId: params.chainId,
      hash: params.hash,
      explorerUrl: getExplorerTxUrl(params.chainId, params.hash),
      status: "pending",
    },
  ];
  emit();
  return id;
}

export function resolveTransaction(id: string, status: "success" | "error", errorMessage?: string): void {
  toasts = toasts.map((toast) => (toast.id === id ? { ...toast, status, errorMessage } : toast));
  emit();

  const timer = setTimeout(() => dismissTransaction(id), status === "success" ? SUCCESS_DISMISS_MS : ERROR_DISMISS_MS);
  dismissTimers.set(id, timer);
}

export function dismissTransaction(id: string): void {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}
