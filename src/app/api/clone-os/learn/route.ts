// Clone OS — Learn endpoint (N1.1)
// POST /api/clone-os/learn
// Body: { cloneId, interactionText, mode? }
//
// Captures a LearningEvent from a teaching interaction, then uses the
// ModelProvider SPI to extract candidate artifacts. Returns the candidates
// for the user to review (approve/edit/reject/merge).
//
// Provenance is classified DURING extraction (not deferred).
// Conflicts against existing artifacts are detected.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'
import { LearningPipeline } from '@/lib/learning/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  }

  const body = await req.json()
  const { cloneId, interactionText, mode } = body as {
    cloneId: string
    interactionText: string
    mode?: string
  }

  if (!cloneId || !interactionText?.trim()) {
    return NextResponse.json({ error: 'cloneId and interactionText are required' }, { status: 400 })
  }

  // N0.1: authorize that this principal may operate on this clone
  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  }

  const pipeline = new LearningPipeline()

  // Step 1: Capture the interaction as a LearningEvent (provenance classified at capture time)
  const { learningEventId } = await pipeline.capture({
    cloneId,
    principal: ctx.principal!,
    mode: mode || 'teach',
    rawInteraction: interactionText.trim(),
    context: { source: 'training_studio' },
  })

  // Step 2: Extract candidate artifacts using the LLM (via ModelProvider SPI)
  const result = await pipeline.extract(learningEventId)

  return NextResponse.json({
    ok: true,
    learningEventId,
    candidates: result.candidates,
    note: result.candidates.length === 0
      ? 'No learnable artifacts detected in this interaction. Try teaching a specific procedure, rule, or preference.'
      : undefined,
  })
}
