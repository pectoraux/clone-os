// Clone OS — Release a CloneVersionCandidate (N1.1)
// POST /api/clone-os/candidates/[id]/release
//
// Creates a new CloneVersion from the candidate, updates Clone.currentVersionId,
// and emits a CloneVersionReleased domain event. This is the ONLY way
// production clone state changes — training produces a candidate; approval
// releases it. Production is never silently mutated.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'
import { LearningPipeline } from '@/lib/learning/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  }

  const { id } = await params

  // Verify the candidate belongs to a clone the principal can access
  const candidate = await db.cloneVersionCandidate.findUnique({
    where: { id },
    include: { clone: true },
  })
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }
  const ownerCheck = await requireCloneOwner(ctx, candidate.cloneId, db)
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  }

  const pipeline = new LearningPipeline()
  const result = await pipeline.release(id, ctx.principal!)

  return NextResponse.json({
    ok: true,
    releasedVersionId: result.releasedVersionId,
    version: result.version,
    note: `Clone released as v${result.version}. The new procedures/knowledge/policies are now live — open a new chat to verify the clone's behavior changed.`,
  })
}
