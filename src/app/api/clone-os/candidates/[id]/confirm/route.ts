// Clone OS — Confirm a candidate artifact (N1.1)
// POST /api/clone-os/candidates/[id]/confirm
// Body: { decision, editedContent? }
//
// The system never auto-mutates the durable professional self from LLM
// inference alone. Human confirmation is required: approve / edit / reject / merge / ignore.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated } from '@/lib/auth/server'
import { LearningPipeline } from '@/lib/learning/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  }

  const { id } = await params
  const body = await req.json()
  const { decision, editedContent } = body as {
    decision: 'approve' | 'edit' | 'reject' | 'merge' | 'ignore'
    editedContent?: string
  }

  if (!decision) {
    return NextResponse.json({ error: 'decision is required' }, { status: 400 })
  }

  // Verify the candidate belongs to a clone the principal can access
  const candidate = await db.candidateArtifact.findUnique({
    where: { id },
    include: { clone: true },
  })
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }
  if (candidate.tenantId !== ctx.tenantId && !ctx.isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const pipeline = new LearningPipeline()
  const result = await pipeline.confirm(id, ctx.principal!, decision, editedContent)

  return NextResponse.json({ ok: true, ...result })
}
