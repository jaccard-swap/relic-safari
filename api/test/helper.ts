// E2E test helper - hits running API server

export const API_BASE = process.env.API_URL || 'http://localhost:3000'

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
