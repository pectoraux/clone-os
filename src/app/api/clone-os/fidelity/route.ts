// Clone OS — Fidelity: create scenario + capture human response + run + evaluate + recompute
// GET  /api/clone-os/fidelity — list scenarios + evaluations + scores
// POST /api/clone-os/fidelity (body: { action: 'create_scenario' | 'capture_human' | 'run' | 'evaluate' | 'recompute', ...payload })
//
// Consolidated endpoint for the N1.2 Fidelity Engine. Each action requires
// authentication + clone ownership.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'
import { FidelityEngine } from '@/lib/fidelity/engine'
import { ensureSnapshotsExist } from '@/lib/fidelity/snapshot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })

  const cloneId = new URL(req.url).searchParams.get('cloneId')
  if (!cloneId) return NextResponse.json({ error: 'cloneId required' }, { status: 400 })

  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

  // Get scenarios with their executions + evaluations
  const scenarios = await db.evaluationScenario.findMany({
    where: { OR: [{ cloneId }, { cloneId: null }] },
    include: {
      executions: {
        include: { cloneResponse: true, evaluation: { include: { dimensionScores: true } } },
        orderBy: { startedAt: 'desc' },
      },
      humanResponses: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Get the current CloneScore
  const score = await db.cloneScore.findFirst({
    where: { cloneId },
    orderBy: { computedAt: 'desc' },
  })

  return NextResponse.json({
    scenarios: scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      domain: s.domain,
      difficulty: s.difficulty,
      prompt: JSON.parse(s.promptJson),
      dimensions: JSON.parse(s.evaluationDimensionsJson),
      source: s.source,
      humanResponseCount: s.humanResponses.length,
      executions: s.executions.map((ex) => ({
        id: ex.id,
        cloneVersionId: ex.cloneVersionId,
        status: ex.status,
        startedAt: ex.startedAt,
        completedAt: ex.completedAt,
        cloneResponse: ex.cloneResponse ? {
          id: ex.cloneResponse.id,
          content: ex.cloneResponse.content.slice(0, 300),
          modelProvider: ex.cloneResponse.modelProvider,
          modelLatencyMs: ex.cloneResponse.modelLatencyMs,
        } : null,
        evaluation: ex.evaluation ? {
          id: ex.evaluation.id,
          agreementRate: ex.evaluation.agreementRate,
          headlineSummary: ex.evaluation.headlineSummary,
          evaluatorModel: ex.evaluation.evaluatorModel,
          dimensionScores: ex.evaluation.dimensionScores.map((ds) => ({
            dimension: ds.dimension,
            score: ds.score,
            evidence: ds.evidence,
            humanExcerpt: ds.humanExcerpt.slice(0, 200),
            cloneExcerpt: ds.cloneExcerpt.slice(0, 200),
            alignment: ds.alignment,
          })),
        } : null,
      })),
    })),
    score: score ? {
      aggregate: score.aggregate,
      dimensions: {
        professionalFidelity: score.professionalFidelity,
        knowledgeFidelity: score.knowledgeFidelity,
        skillFidelity: score.skillFidelity,
        decisionFidelity: score.decisionFidelity,
        behavioralFidelity: score.behavioralFidelity,
        communicationFidelity: score.communicationFidelity,
        personalityFidelity: score.personalityFidelity,
        culturalFidelity: score.culturalFidelity,
        outcomeFidelity: score.outcomeFidelity,
      },
      notes: score.notes,
      computedAt: score.computedAt,
    } : null,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })

  const body = await req.json()
  const { action } = body

  const engine = new FidelityEngine()

  switch (action) {
    case 'create_scenario': {
      const { cloneId, title, description, domain, difficulty, context, question, requiredSkills, evaluationDimensions, expectedEvidence } = body
      if (!cloneId || !title || !context || !question) {
        return NextResponse.json({ error: 'cloneId, title, context, question required' }, { status: 400 })
      }
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await engine.createScenario({
        cloneId, tenantId: ctx.tenantId!,
        title, description: description || title, domain: domain || 'Revenue Operations',
        difficulty: difficulty || 'medium',
        prompt: { context, question, inputs: body.inputs },
        requiredSkills: requiredSkills || [],
        evaluationDimensions: evaluationDimensions || ['decision', 'reasoning', 'behavioral', 'communication'],
        expectedEvidence: expectedEvidence || { keyPoints: [], decisionCriteria: [], riskFactors: [] },
        source: body.source || 'user_created',
      })
      return NextResponse.json({ ok: true, scenarioId: result.scenarioId })
    }

    case 'capture_human': {
      const { scenarioId, cloneId, content, decision, reasoning, actions, priorities, riskTolerance, communication } = body
      if (!scenarioId || !cloneId || !content || !decision) {
        return NextResponse.json({ error: 'scenarioId, cloneId, content, decision required' }, { status: 400 })
      }
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await engine.captureHumanResponse({
        scenarioId, cloneId, tenantId: ctx.tenantId!,
        principalId: ctx.principal!.id,
        content, decision, reasoning: reasoning || '',
        actions: actions || [], priorities: priorities || [],
        riskTolerance: riskTolerance ?? 0.5, communication: communication || '',
      })
      return NextResponse.json({ ok: true, humanResponseId: result.humanResponseId })
    }

    case 'run': {
      const { scenarioId, cloneId, cloneVersionId, humanResponseId, excludeWorkflowIds } = body
      if (!scenarioId || !cloneId || !cloneVersionId || !humanResponseId) {
        return NextResponse.json({ error: 'scenarioId, cloneId, cloneVersionId, humanResponseId required' }, { status: 400 })
      }
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await engine.runScenario({
        scenarioId, cloneId, tenantId: ctx.tenantId!,
        principalId: ctx.principal!.id,
        cloneVersionId, humanResponseId,
        excludeWorkflowIds,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    case 'evaluate': {
      const { executionId, cloneId } = body
      if (!executionId || !cloneId) {
        return NextResponse.json({ error: 'executionId, cloneId required' }, { status: 400 })
      }
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await engine.evaluate(executionId, ctx.principal!)
      return NextResponse.json({ ok: true, ...result })
    }

    case 'recompute': {
      const { cloneId } = body
      if (!cloneId) return NextResponse.json({ error: 'cloneId required' }, { status: 400 })
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await engine.recomputeCloneScore(cloneId, ctx.tenantId!)
      return NextResponse.json({ ok: true, ...result })
    }

    case 'ensure_snapshots': {
      // N1.2A: create retroactive snapshots for existing versions
      const { cloneId } = body
      if (!cloneId) return NextResponse.json({ error: 'cloneId required' }, { status: 400 })
      const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
      if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })

      const result = await ensureSnapshotsExist(cloneId)
      return NextResponse.json({ ok: true, ...result })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
