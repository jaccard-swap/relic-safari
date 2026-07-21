import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiJson, clearAuthToken, getAuthToken } from "../lib/api";
import { buildSiweMessage, fetchSiweNonce, loginWithSiwe } from "./siwe";

export interface Session {
  authenticated: boolean;
  address?: string;
  type?: "user" | "admin";
}

async function fetchSession(): Promise<Session> {
  // Skip the round-trip when there's no token to send - the endpoint would
  // just report unauthenticated anyway.
  if (!getAuthToken()) return { authenticated: false };
  return apiJson<Session>("/auth/session");
}

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });
}

// Deliberately separate from wallet connection - popping a signature request
// the instant a wallet connects is a phishing-adjacent pattern users are
// trained to distrust. This only ever signs for the already-connected
// account; the caller (WalletMenu) gates it behind its own explicit "Sign
// In" button that only appears once a wallet is connected.
export function useSiweLogin() {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  return useMutation({
    mutationFn: async () => {
      if (!address || !chainId) {
        throw new Error("Connect a wallet before signing in.");
      }

      const nonce = await fetchSiweNonce();
      const message = buildSiweMessage({ address, chainId, nonce });
      const signature = await signMessageAsync({ account: address, message });
      return loginWithSiwe(message, signature, nonce);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return function logout() {
    clearAuthToken();
    queryClient.setQueryData(["auth", "session"], { authenticated: false });
  };
}
