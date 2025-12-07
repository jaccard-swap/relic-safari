import { test } from 'node:test'
import * as assert from 'node:assert'

const API_BASE = process.env.API_URL || 'http://localhost:3000'

test('example is loaded', async () => {
  const res = await fetch(`${API_BASE}/example`)
  const body = await res.text()
  assert.equal(body, 'this is an example')
})
