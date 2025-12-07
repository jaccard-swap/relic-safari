import { toHex } from 'viem'

export function formatTimeLeft(endTime: string): string {
  const end = new Date(endTime).getTime()
  const now = Date.now()
  const diff = end - now

  if (diff <= 0) return 'Ended'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${mins}m ${secs}s`
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function randomSalt(): `0x${string}` {
  return toHex(Math.floor(Math.random() * 0xffffffff), { size: 4 })
}

export function splitSignature(sig: `0x${string}`) {
  const sigNoPrefix = sig.slice(2)
  const r = ('0x' + sigNoPrefix.slice(0, 64)) as `0x${string}`
  const s = ('0x' + sigNoPrefix.slice(64, 128)) as `0x${string}`
  const v = parseInt(sigNoPrefix.slice(128, 130), 16)
  return { v, r, s }
}

