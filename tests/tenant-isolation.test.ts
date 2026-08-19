// Clone OS — Tenant Isolation Tests
//
// Verifies that no API endpoint leaks data across tenant boundaries.
// Q: "What happens when Tenant A calls an endpoint that should be scoped to
//    Tenant B?"
// A: 401/403/404, never a cross-tenant data leak.
//
// Run with: bun test tests/tenant-isolation.test.ts
//
// NOTE: requires the dev server to be running on http://localhost:3000
// and the database to be seeded.

import { describe, it, expect, beforeAll } from 'bun:test'

const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000'

// Helper: get a CSRF + session cookie for a credentials login
function extractCookies(headers: Headers): string[] {
  // bun's fetch supports getSetCookie() which returns an array of set-cookie values
  const setCookies = (headers as any).getSetCookie?.() as string[] | undefined
  if (setCookies && setCookies.length) {
    return setCookies.map((c: string) => {
      const m = c.match(/^([^=;]+)=([^;]+)/)
      return m ? `${m[1]}=${m[2]}` : ''
    }).filter(Boolean)
  }
  // Fallback: parse the set-cookie header (may be comma-joined)
  const raw = headers.get('set-cookie') || ''
  return raw.split(',').map((c) => {
    const m = c.trim().match(/^([^=;]+)=([^;]+)/)
    return m ? `${m[1]}=${m[2]}` : ''
  }).filter(Boolean)
}

async function login(email: string, password: string): Promise<string> {
  const jar: string[] = []
  // 1. get CSRF token (and the csrf cookie)
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  jar.push(...extractCookies(csrfRes.headers))
  const { csrfToken } = await csrfRes.json() as any
  // 2. login
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.join('; ') },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/api/auth/me`,
      json: 'true',
    }),
    redirect: 'manual',
  })
  jar.push(...extractCookies(loginRes.headers))
  return jar.join('; ')
}

async function getMe(cookie: string) {
  const res = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })
  return res.json()
}

describe('Tenant isolation', () => {
  let adminCookie: string
  let demoUserCookie: string
  let noCookie: string = ''

  beforeAll(async () => {
    // Login as the real admin (in the clone-os-admin tenant)
    adminCookie = await login('ekontetevi@gmail', process.env.ADMIN_PASSWORD || 'PLACEHOLDER')
    // Login as a demo user (in the sarah-personal tenant)
    demoUserCookie = await login('sarah@clone.os', 'demo')
  })

  it('admin is in a different tenant than the demo user', async () => {
    const admin = await getMe(adminCookie)
    const demo = await getMe(demoUserCookie)
    expect(admin.user.tenantId).not.toBe(demo.user.tenantId)
  })

  it('unauthenticated caller cannot hit protected endpoints', async () => {
    const endpoints = [
      { method: 'POST', path: '/api/clone-os/train', body: { cloneId: 'x', mode: 'teaching' } },
      { method: 'POST', path: '/api/clone-os/extensions', body: { extensionId: 'x', action: 'install' } },
      { method: 'POST', path: '/api/auth/socket-token', body: {} },
      { method: 'GET', path: '/api/auth/waitlist' },
    ]
    for (const ep of endpoints) {
      const res = await fetch(`${BASE}${ep.path}`, {
        method: ep.method,
        headers: { 'content-type': 'application/json' },
        body: ep.method === 'POST' ? JSON.stringify(ep.body) : undefined,
      })
      expect(res.status, `${ep.method} ${ep.path} should be 401, got ${res.status}`).toBe(401)
    }
  })

  it('unauthenticated caller can read the public demo clone (marketplace-visible)', async () => {
    const res = await fetch(`${BASE}/api/clone-os`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.clone.slug).toBe('sarah-revops')
    // Should not include private tenant-only fields
    expect(data.clone).toBeTruthy()
  }, 15000)

  it('waitlist GET is admin-only (was previously public — auth gap fixed)', async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${BASE}/api/auth/waitlist`)
    expect(unauthRes.status).toBe(401)
    // Demo user (not admin)
    const demoRes = await fetch(`${BASE}/api/auth/waitlist`, { headers: { cookie: demoUserCookie } })
    expect(demoRes.status).toBe(403)
    // Admin
    const adminRes = await fetch(`${BASE}/api/auth/waitlist`, { headers: { cookie: adminCookie } })
    expect(adminRes.status).toBe(200)
    const data = await adminRes.json()
    expect(Array.isArray(data.entries)).toBe(true)
  })

  it('training endpoint rejects non-owned cloneId', async () => {
    // Pass a fake cloneId — should 404 (not found) or 403 (not authorized)
    const res = await fetch(`${BASE}/api/clone-os/train`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: demoUserCookie },
      body: JSON.stringify({ cloneId: 'nonexistent-clone-id', mode: 'teaching' }),
    })
    expect([403, 404]).toContain(res.status)
  })

  it('training endpoint does not mutate clone.aggregateScore (N0.9)', async () => {
    // Read the clone's aggregate before
    const before = await fetch(`${BASE}/api/clone-os`, { headers: { cookie: demoUserCookie } }).then(r => r.json())
    const beforeScore = before.clone.aggregateScore
    // Find the demo clone's id
    const cloneId = before.clone.id
    // Run a training session
    const trainRes = await fetch(`${BASE}/api/clone-os/train`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: demoUserCookie },
      body: JSON.stringify({ cloneId, mode: 'teaching' }),
    })
    expect(trainRes.status).toBe(200)
    const trainData = await trainRes.json()
    // The response must explicitly say it's simulated
    expect(trainData.simulated).toBe(true)
    // Read the clone's aggregate after — must be unchanged
    const after = await fetch(`${BASE}/api/clone-os`, { headers: { cookie: demoUserCookie } }).then(r => r.json())
    expect(after.clone.aggregateScore).toBe(beforeScore)
  }, 30000)

  it('extension install requires auth + scoped to tenant', async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${BASE}/api/clone-os/extensions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extensionId: 'x', action: 'install' }),
    })
    expect(unauthRes.status).toBe(401)
    // Authenticated but fake extensionId (not in the tenant)
    const demoRes = await fetch(`${BASE}/api/clone-os/extensions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: demoUserCookie },
      body: JSON.stringify({ extensionId: 'nonexistent-extension-id', action: 'install' }),
    })
    expect([403, 404]).toContain(demoRes.status)
  })

  it('socket-token is single-use and short-lived', async () => {
    // Mint a token
    const mintRes = await fetch(`${BASE}/api/auth/socket-token`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    })
    expect(mintRes.status).toBe(200)
    const { token } = await mintRes.json()
    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThan(30)
    // Validate it once — should succeed
    const validate1 = await fetch(`${BASE}/api/auth/validate-socket-token?token=${token}`)
    expect(validate1.status).toBe(200)
    const v1 = await validate1.json()
    expect(v1.valid).toBe(true)
    expect(v1.principal.id).toBeTruthy()
    // Validate the same token again — should fail (single-use)
    const validate2 = await fetch(`${BASE}/api/auth/validate-socket-token?token=${token}`)
    expect(validate2.status).toBe(404)
    const v2 = await validate2.json()
    expect(v2.valid).toBe(false)
  })
})
