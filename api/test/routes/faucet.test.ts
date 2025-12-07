import { test, describe } from 'node:test'
import * as assert from 'node:assert'

const API_BASE = process.env.API_URL || 'http://localhost:3000'

describe('faucet routes (e2e)', async () => {

  test('POST /faucet - rejects invalid address', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: 'invalid-address',
        chainId: 84532
      })
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.error, 'Invalid recipient address')
  })

  test('POST /faucet - rejects missing chainId', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890'
      })
    })

    assert.equal(res.status, 400)
  })

  test('POST /faucet - rejects unsupported chain', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        chainId: 999999
      })
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.match(body.error, /Unsupported chain/)
  })
})
