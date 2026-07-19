import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useSignMessage, type Connector } from "wagmi";
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

// Combines wallet-connect + SIWE sign + API login into one action, matching
// the original app's single-click "connect and sign in" gesture.
export function useSiweLogin() {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();

  return useMutation({
    mutationFn: async (connector: Connector) => {
      let activeAddress = address;
      let activeChainId = chainId;
      if (!activeAddress) {
        const result = await connectAsync({ connector });
        activeAddress = result.accounts[0];
        activeChainId = result.chainId;
      }
      if (!activeAddress || !activeChainId) {
        throw new Error("No wallet connected.");
      }

      const nonce = await fetchSiweNonce();
      const message = buildSiweMessage({ address: activeAddress, chainId: activeChainId, nonce });
      const signature = await signMessageAsync({ account: activeAddress, message });
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
