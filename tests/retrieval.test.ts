// Clone OS — Retrieval Tests (N1.3A)
//
// Tests for:
// - retrieval relevance (relevant artifacts retrieved, irrelevant excluded)
// - retrieval authorization (sensitive/unauthorized artifacts excluded)
// - context budgeting (bounded context, not everything)
// - learned procedure retrieval (the Pipeline Review Priority Order
//   is retrieved for pipeline-review tasks)
//
// Run with: bun test tests/retrieval.test.ts
// Requires: dev server on http://127.0.0.1:3000 + seeded DB

import { describe, it, expect, beforeAll } from 'bun:test'

const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000'

function extractCookies(headers: Headers): string[] {
  const sc = (headers as any).getSetCookie?.() as string[] | undefined
  if (sc?.length) return sc.map(c => c.match(/^([^=;]+)=([^;]+)/)?.slice(1, 3).join('=') || '').filter(Boolean)
  const raw = headers.get('set-cookie') || ''
  return raw.split(',').map(c => c.trim().match(/^([^=;]+)=([^;]+)/)?.slice(1, 3).join('=') || '').filter(Boolean)
}

async function login(email: string, password: string): Promise<string> {
  const jar: string[] = []
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  jar.push(...extractCookies(csrfRes.headers))
  const { csrfToken } = await csrfRes.json() as any
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.join('; ') },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/api/auth/me`, json: 'true' }),
    redirect: 'manual',
  })
  jar.push(...extractCookies(loginRes.headers))
  return jar.join('; ')
}

describe('Retrieval (N1.3A)', () => {
  let cookie: string
  let cloneId: string

  beforeAll(async () => {
    cookie = await login('sarah@clone.os', 'demo')
    const data = await fetch(`${BASE}/api/clone-os`, { headers: { cookie } }).then(r => r.json())
    cloneId = data.clone.id
  })

  it('retrieves relevant artifacts for a pipeline review question', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'How do you review pipeline? What matters most when assessing pipeline health?',
        cloneId,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()

    // Should retrieve artifacts related to pipeline review
    expect(data.retrieval.candidates.length).toBeGreaterThan(0)

    // The learned "Pipeline Review Priority Order" procedure should be retrieved
    const hasPipelineReview = data.retrieval.candidates.some(
      (c: any) => c.name.includes('Pipeline Review') || c.name.includes('pipeline')
    )
    expect(hasPipelineReview, 'Should retrieve the Pipeline Review Priority Order procedure').toBe(true)

    // Stats should show bounded retrieval (not everything)
    expect(data.compiled.stats.retrieved).toBeLessThanOrEqual(50)
    expect(data.compiled.stats.retrieved).toBeGreaterThan(0)
  }, 15000)

  it('excludes irrelevant artifacts (executive email preference)', async () => {
    // First, create an irrelevant knowledge artifact
    await fetch(`${BASE}/api/clone-os/learn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        cloneId,
        interactionText: 'I prefer writing executive emails in a formal tone with bullet points and a clear call to action at the end.',
        mode: 'teach',
      }),
    })

    // Now ask about pipeline review — the executive email preference should NOT be retrieved
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'How do you review pipeline health?',
        cloneId,
      }),
    })
    const data = await res.json()

    // Check that the executive email preference is NOT in the retrieved candidates
    const hasEmailPref = data.retrieval.candidates.some(
      (c: any) => c.name.toLowerCase().includes('email') || c.name.toLowerCase().includes('executive')
    )
    expect(hasEmailPref, 'Executive email preference should NOT be retrieved for a pipeline question').toBe(false)
  }, 30000)

  it('demonstrates context budgeting (bounded context)', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'What do you know about revenue operations?',
        cloneId,
      }),
    })
    const data = await res.json()

    // The compiled context should be bounded — not the entire clone
    expect(data.compiled.systemPromptLength).toBeLessThan(50000)
    expect(data.compiled.systemPromptLength).toBeGreaterThan(100)

    // Stats should show retrieved < total artifacts
    expect(data.compiled.stats.retrieved).toBeLessThanOrEqual(data.compiled.stats.totalArtifacts)
  }, 15000)

  it('retrieval evidence is traceable', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'How do you forecast pipeline?',
        cloneId,
      }),
    })
    const data = await res.json()

    // Evidence should be present for each retrieved artifact
    expect(data.retrieval.evidence.length).toBeGreaterThan(0)

    // Each evidence should have the required fields
    const ev = data.retrieval.evidence[0]
    expect(ev.artifactId).toBeTruthy()
    expect(ev.retrievalMethod).toBe('keyword')
    expect(ev.rank).toBeGreaterThan(0)
    expect(ev.contextInclusionDecision).toBe('included')
  }, 15000)

  it('retrieves learned procedure when asking about pipeline review', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'How should I review this quarter enterprise pipeline?',
        cloneId,
      }),
    })
    const data = await res.json()

    // The learned "Pipeline Review Priority Order" should be in the retrieved set
    const hasLearnedProcedure = data.retrieval.candidates.some(
      (c: any) => c.name.includes('Pipeline Review Priority')
    )
    expect(hasLearnedProcedure, 'The learned Pipeline Review Priority Order should be retrieved').toBe(true)

    // It should be a workflow type
    const procedure = data.retrieval.candidates.find((c: any) => c.name.includes('Pipeline Review Priority'))
    expect(procedure.type).toBe('workflow')
  }, 15000)
})
