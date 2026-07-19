import { createSiweMessage } from "viem/siwe";
import { apiFetch, apiJson, setAuthToken } from "../lib/api";

interface LoginResponse {
  success: boolean;
  address: string;
  type: "user" | "admin";
  token: string;
}

// GET /auth/nonce replies text/plain, not JSON.
export async function fetchSiweNonce(): Promise<string> {
  const res = await apiFetch("/auth/nonce");
  return (await res.text()).trim();
}

export function buildSiweMessage(params: { address: `0x${string}`; chainId: number; nonce: string }): string {
  return createSiweMessage({
    address: params.address,
    chainId: params.chainId,
    domain: window.location.host,
    nonce: params.nonce,
    uri: window.location.origin,
    version: "1",
    statement: "Sign in to Relic Safari.",
  });
}

// Verifies the signed SIWE message against the API and stores the returned
// bearer token - the API is stateless JWT, there's no session cookie.
export async function loginWithSiwe(message: string, signature: string, nonce: string): Promise<LoginResponse> {
  const result = await apiJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ message, signature, nonce, type: "user" }),
  });
  setAuthToken(result.token);
  return result;
}
