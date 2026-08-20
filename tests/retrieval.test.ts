// Clone OS — Retrieval Tests (N1.3A + N1.3A.2)
//
// Tests for:
// - retrieval relevance (relevant artifacts retrieved, irrelevant excluded)
// - retrieval authorization (sensitive/unauthorized artifacts excluded)
// - context budgeting (bounded context, not everything)
// - learned procedure retrieval (the Pipeline Review Priority Order
//   is retrieved for pipeline-review tasks)
// - context hashing (deterministic hash of compiled context)
// - token estimation (ceil(chars/4))
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

describe('Retrieval (N1.3A + N1.3A.2)', () => {
  let cookie: string
  let cloneId: string

  beforeAll(async () => {
    cookie = await login('sarah@clone.os', 'demo')
    const data = await fetch(`${BASE}/api/clone-os`, { headers: { cookie } }).then(r => r.json())
    cloneId = data.clone.id
  }, 30000)

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

    // Bounded context (not everything)
    expect(data.compiled.selectedArtifacts.length).toBeGreaterThan(0)
    expect(data.compiled.estimatedTokens).toBeGreaterThan(0)
    expect(data.compiled.budget).toBeGreaterThan(0)
  }, 30000)

  it('excludes irrelevant artifacts (executive email preference)', async () => {
    // Ask about pipeline review — the executive email preference should NOT be retrieved
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
    expect(data.compiled.estimatedTokens).toBeLessThan(data.compiled.budget)
    expect(data.compiled.estimatedTokens).toBeGreaterThan(100)
  }, 30000)

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
    expect(ev.authorizationDecision).toBeTruthy()
    expect(ev.selectionDecision).toBeTruthy()
  }, 30000)

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
  }, 30000)

  it('context hash is deterministic', async () => {
    const res1 = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'How do you review pipeline?', cloneId }),
    })
    const res2 = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'How do you review pipeline?', cloneId }),
    })
    const data1 = await res1.json()
    const data2 = await res2.json()

    // Same input → same context hash
    expect(data1.compiled.contextHash).toBeTruthy()
    expect(data1.compiled.contextHash).toBe(data2.compiled.contextHash)
  }, 30000)
})

describe('Redaction (N1.3A.3)', () => {
  let cookie: string
  let cloneId: string

  beforeAll(async () => {
    cookie = await login('sarah@clone.os', 'demo')
    const data = await fetch(`${BASE}/api/clone-os`, { headers: { cookie } }).then(r => r.json())
    cloneId = data.clone.id
  }, 30000)

  it('REDACT actually redacts — original content cannot reach the model', async () => {
    // Create a restricted knowledge artifact with a unique secret string
    const secretString = 'CONFIDENTIAL_SECRET_78921'
    await fetch(`${BASE}/api/clone-os/learn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        cloneId,
        interactionText: `At Acme, our proprietary formula is: ${secretString}. This is company confidential.`,
        mode: 'teach',
      }),
    })

    // Request retrieval with internal sensitivity (should trigger REDACT for restricted artifacts)
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        message: 'What is the proprietary formula?',
        cloneId,
      }),
    })
    const data = await res.json()

    // The compiled system prompt must NOT contain the secret string
    const promptPreview = data.compiled.systemPromptPreview || ''
    expect(
      promptPreview.includes(secretString),
      `Secret string "${secretString}" must NOT appear in the compiled prompt. Got: ${promptPreview.slice(0, 200)}`,
    ).toBe(false)

    // If the artifact was redacted, it should appear as [REDACTED...]
    if (data.retrieval.evidence?.some((e: any) => e.authorizationDecision === 'REDACT')) {
      const redactedEvidence = data.retrieval.evidence.find((e: any) => e.authorizationDecision === 'REDACT')
      expect(redactedEvidence.reason).toContain('redacted')
    }
  }, 30000)
})

describe('Professional Self Preservation (N1.3A.3)', () => {
  let cookie: string
  let cloneId: string

  beforeAll(async () => {
    cookie = await login('sarah@clone.os', 'demo')
    const data = await fetch(`${BASE}/api/clone-os`, { headers: { cookie } }).then(r => r.json())
    cloneId = data.clone.id
  }, 30000)

  it('personality is preserved in the compiled context', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'How do you review pipeline?', cloneId }),
    })
    const data = await res.json()
    // The compiled prompt should include a Personality section
    expect(data.compiled.systemPromptPreview.toLowerCase().includes('personality')).toBe(true)
  }, 30000)

  it('culture is preserved in the compiled context', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'What is your cultural context?', cloneId }),
    })
    const data = await res.json()
    // The compiled prompt should include a Cultural context section
    expect(data.compiled.systemPromptPreview.toLowerCase().includes('cultural')).toBe(true)
  }, 30000)

  it('preferences are preserved in the compiled context', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'What are your preferences?', cloneId }),
    })
    const data = await res.json()
    // The compiled prompt should include a Core preferences section
    expect(data.compiled.systemPromptPreview.toLowerCase().includes('preference')).toBe(true)
  }, 30000)
})

describe('Routing Propagation (N1.3A.3)', () => {
  let cookie: string
  let cloneId: string

  beforeAll(async () => {
    cookie = await login('sarah@clone.os', 'demo')
    const data = await fetch(`${BASE}/api/clone-os`, { headers: { cookie } }).then(r => r.json())
    cloneId = data.clone.id
  }, 30000)

  it('routing signal is derived from the task', async () => {
    // A complex analysis question should get complex_reasoning
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'Analyze this complex revenue forecast strategy', cloneId }),
    })
    const data = await res.json()
    expect(data.task.routingSignal).toBe('complex_reasoning')
  }, 30000)

  it('general chat gets general_chat signal', async () => {
    const res = await fetch(`${BASE}/api/clone-os/retrieval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ message: 'How do you review pipeline?', cloneId }),
    })
    const data = await res.json()
    expect(data.task.routingSignal).toBe('general_chat')
  }, 30000)
})
