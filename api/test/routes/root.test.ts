import { test } from 'node:test'
import * as assert from 'node:assert'

const API_BASE = process.env.API_URL || 'http://localhost:3000'

test('default root route', async () => {
  const res = await fetch(`${API_BASE}/`)
  const body = await res.json()
  assert.deepStrictEqual(body, { root: true })
})
