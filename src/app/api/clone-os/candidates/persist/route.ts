// Clone OS — Persist confirmed candidates + create CloneVersionCandidate (N1.1)
// POST /api/clone-os/candidates/persist
// Body: { learningEventId }
//
// Persists all approved/edited candidates from the learning event to the
// clone's Knowledge/Workflow/Policy/Memory tables and creates a
// CloneVersionCandidate (the versioned candidate clone state).
//
// This is the bridge from "confirmed artifacts" to "versioned clone state."

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
  const { learningEventId } = body as { learningEventId: string }

  if (!learningEventId) {
    return NextResponse.json({ error: 'learningEventId is required' }, { status: 400 })
  }

  // Verify the learning event belongs to a clone the principal can access
  const event = await db.learningEvent.findUnique({
    where: { id: learningEventId },
    include: { clone: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Learning event not found' }, { status: 404 })
  }
  const ownerCheck = await requireCloneOwner(ctx, event.cloneId, db)
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  }

  const pipeline = new LearningPipeline()
  const result = await pipeline.persist(learningEventId, ctx.principal!)

  return NextResponse.json({
    ok: true,
    cloneVersionCandidateId: result.cloneVersionCandidateId,
    persistedArtifactIds: result.persistedArtifactIds,
    note: 'Candidate version created. Review the score delta, then release to make it production.',
  })
}
