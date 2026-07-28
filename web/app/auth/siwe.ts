import { createSiweMessage } from "viem/siwe";
import { SIWE_NONCE_TTL_MS } from "@shared/constants";
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
    // Second, client-signed layer of the same nonce TTL enforced server-side
    // (api/src/routes/auth/index.ts) - viem's verifySiweMessage checks this
    // automatically against the server's own clock, not a client-supplied one.
    expirationTime: new Date(Date.now() + SIWE_NONCE_TTL_MS),
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
