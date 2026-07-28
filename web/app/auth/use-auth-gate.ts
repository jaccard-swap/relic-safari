import { useSession } from "./use-auth";

// Sponsored (backend-signed) actions require a live SIWE session, not just a
// connected wallet - the API's requireAuth preHandler 401s otherwise, which
// previously only surfaced in the console after the user had already signed
// one or two wallet prompts for nothing. Direct on-chain transactions signed
// by the user's own wallet (the SCRIP faucet, Uniswap swaps) don't 401 like
// this and don't need this gate.
export function useAuthGate(): boolean {
  const { data: session } = useSession();
  return session?.authenticated ?? false;
}
