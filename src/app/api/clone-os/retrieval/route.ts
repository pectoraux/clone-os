// Clone OS — Retrieval API (N1.3A)
//
// POST /api/clone-os/retrieval
// Body: { message, cloneId, cloneVersionId? }
//
// Demonstrates: task parsing → retrieval → policy filtering → context
// compilation → bounded ExecutionContext with evidence.
//
// The response shows retrieved artifacts, excluded artifacts (with
// reasons), and the compiled system prompt (bounded, not everything).

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'
import { RetrievalService, ContextCompiler, parseTask } from '@/lib/retrieval/retrieval'
import { loadCloneStateSnapshot } from '@/lib/fidelity/snapshot'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })

  const body = await req.json()
  const { message, cloneId, cloneVersionId } = body as { message: string; cloneId: string; cloneVersionId?: string }

  if (!message?.trim() || !cloneId) {
    return NextResponse.json({ error: 'message and cloneId are required' }, { status: 400 })
  }

  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

  // Load the clone (for persona/identity)
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: { professionalIdentity: { include: { user: true } } },
  })
  if (!clone) return NextResponse.json({ error: 'Clone not found' }, { status: 404 })

  // Parse the task
  const task = parseTask(message, clone.domain)

  // If a specific version is requested, load the snapshot for that version
  let snapshot = null
  if (cloneVersionId) {
    snapshot = await loadCloneStateSnapshot(cloneVersionId)
  }

  // Retrieve relevant artifacts
  const retrievalService = new RetrievalService()
  const retrieval = await retrievalService.retrieve(task, cloneId, ctx.tenantId!, snapshot || undefined)

  // Compile the bounded context
  const compiler = new ContextCompiler()
  const budget = retrievalService.getBudget()
  const persona = {
    name: clone.name, domain: clone.domain,
    persona: JSON.parse(clone.personaJson || '{}'),
    behavior: JSON.parse(clone.behaviorJson || '{}'),
    values: JSON.parse(clone.professionalIdentity?.valuesJson || '[]'),
    bio: clone.professionalIdentity?.bio ?? null,
    title: clone.professionalIdentity?.title ?? null,
  }
  const compiled = compiler.compile(
    {
      name: clone.name, domain: clone.domain,
      persona: JSON.parse(clone.personaJson || '{}'),
      personality: JSON.parse(clone.personalityJson || '{}'),
      preferences: JSON.parse(clone.preferencesJson || '{}'),
      behavior: JSON.parse(clone.behaviorJson || '{}'),
      values: JSON.parse(clone.professionalIdentity?.valuesJson || '[]'),
      culture: JSON.parse(clone.professionalIdentity?.cultureJson || '{}'),
      bio: clone.professionalIdentity?.bio ?? null,
      title: clone.professionalIdentity?.title ?? null,
    },
    retrieval, retrievalService.getSerializer(), budget, cloneVersionId,
  )

  return NextResponse.json({
    task,
    retrieval: {
      candidates: retrieval.candidates.map(c => ({
        artifactId: c.artifactId,
        type: c.artifactType,
        name: c.name,
        relevanceScore: Math.round(c.relevanceScore * 100) / 100,
        sourceKind: c.sourceKind,
        sensitivity: c.sensitivity,
      })),
      excluded: retrieval.excluded.map(c => ({
        artifactId: c.artifactId,
        type: c.artifactType,
        name: c.name,
        reason: c.reason,
        exclusionType: c.exclusionType,
      })),
      evidence: compiled.retrievalEvidence,
    },
    compiled: {
      systemPromptLength: compiled.systemPrompt.length,
      systemPromptPreview: compiled.systemPrompt.slice(0, 2000) + (compiled.systemPrompt.length > 2000 ? '...' : ''),
      estimatedTokens: compiled.estimatedTokens,
      budget: compiled.budget.maxTokens,
      contextHash: compiled.contextHash.slice(0, 16),
      selectedArtifacts: compiled.selectedArtifacts,
      excludedArtifacts: compiled.excludedArtifacts,
    },
    usedSnapshot: !!snapshot,
    note: 'The clone received only the relevant subset. The persistent state is the source of truth; the retrieval index is derived.',
  })
}
