import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import { testToken } from '../helper'

const API_BASE = process.env.API_URL || 'http://localhost:3000'
const TEST_WALLET = '0x111111111111111111111111111111111111111f'
const AUTH_HEADER = { Authorization: `Bearer ${testToken(TEST_WALLET)}` }

describe('faucet routes (e2e)', async () => {

  test('POST /faucet - rejects invalid address', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        recipient: 'invalid-address',
        chainId: 11155111
      })
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.error, 'Invalid recipient address')
  })

  test('POST /faucet - rejects missing chainId', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890'
      })
    })

    assert.equal(res.status, 400)
  })

  test('POST /faucet - rejects unsupported chain', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        chainId: 999999
      })
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.match(body.error, /Unsupported chain/)
  })

  test('POST /faucet - rejects unauthenticated request', async () => {
    const res = await fetch(`${API_BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        chainId: 11155111
      })
    })

    assert.equal(res.status, 401)
  })
})
