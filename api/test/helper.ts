// E2E test helper - hits running API server

import jwt from 'jsonwebtoken'

export const API_BASE = process.env.API_URL || 'http://localhost:3000'

// Mirrors the fallback in src/plugins/siwe-auth.ts - tests run against the
// same server process, so this only works because both sides fall back to
// the same dev secret when JWT_SECRET is unset.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

// Signs a session token for a given address without going through the real
// SIWE challenge/verify flow - routes only care that the token decodes to a
// valid session (see siwe-auth.ts's requireAuth), not how it was obtained.
export function testToken(address: string, type: 'user' | 'admin' = 'user'): string {
  return jwt.sign({ address: address.toLowerCase(), type }, JWT_SECRET)
}

export async function api(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res
}

export async function apiJson<T = any>(path: string, options?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await api(path, options)
  const body = await res.json() as T
  return { status: res.status, body }
}
