// Clone OS — List learning events + pending candidates (N1.1)
// GET /api/clone-os/candidates?cloneId=...
// Returns: pending candidate artifacts for the clone, grouped by learning event.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  }

  const cloneId = new URL(req.url).searchParams.get('cloneId')
  if (!cloneId) {
    return NextResponse.json({ error: 'cloneId is required' }, { status: 400 })
  }

  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  }

  // Get pending learning events with their pending candidates
  const events = await db.learningEvent.findMany({
    where: { cloneId, confirmationState: 'pending' },
    include: {
      candidates: {
        where: { confirmationState: 'pending' },
        orderBy: { confidence: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Also get pending CloneVersionCandidates (approved artifacts awaiting release)
  const versionCandidates = await db.cloneVersionCandidate.findMany({
    where: { cloneId, status: 'pending_approval' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({
    learningEvents: events.map((e) => ({
      id: e.id,
      mode: e.mode,
      rawInteraction: e.rawInteraction,
      provenanceKind: e.provenanceKind,
      confidence: e.confidence,
      createdAt: e.createdAt,
      candidates: e.candidates.map((c) => ({
        id: c.id,
        artifactType: c.artifactType,
        name: c.name,
        content: c.content,
        confidence: c.confidence,
        provenanceKind: c.provenanceKind,
        provenanceSensitivity: c.provenanceSensitivity,
        provenancePortability: c.provenancePortability,
        hasConflict: !!c.conflictsWithArtifactId,
        conflictingArtifactName: c.conflictsWithArtifactName,
        conflictSuggestion: c.conflictsWithArtifactId ? 'This appears to supersede an existing artifact. Replace, coexist, or reject?' : null,
        confirmationState: c.confirmationState,
      })),
    })),
    versionCandidates: versionCandidates.map((c) => ({
      id: c.id,
      candidateVersion: c.candidateVersion,
      status: c.status,
      changeSet: JSON.parse(c.changeSetJson),
      scoreDelta: c.scoreDelta,
      provenanceImpact: JSON.parse(c.provenanceImpactJson || '{}'),
      createdAt: c.createdAt,
    })),
  })
}
