// Clone OS — Real Fidelity Engine (N1.2 + N1.2A)
//
// PURPOSE: Prove empirically that learning makes the clone more faithful
// to the human.
//
// N1.2A + N1.2B FIXES:
// 1. Immutable Clone State Snapshots: runScenario loads the version's
//    snapshot, not the current clone. N1.2B: the snapshot must be
//    AUTHENTIC + RELEASE_CAPTURE — no fallback to current clone, no
//    excludeWorkflowIds in the production path.
// 2. Evaluator failure = FAILED, no score: the old fallback (fabricate
//    50%) is removed. A FAILED evaluation persists the error evidence
//    but does NOT contribute to CloneScore.
// 3. Reproducibility metadata: scenarioVersion, evaluatorPromptVersion,
//    rubricVersion, temperature, inputsHash.
// 4. Score type separation: fidelity | competence | outcome. Not every
//    evaluation contributes equally to the public CloneScore.
// 5. N1.2B: Evaluation gate — verify snapshot status, origin, and hash
//    before running. Return VERSION_STATE_UNAVAILABLE or
//    SNAPSHOT_INTEGRITY_FAILURE on failure. Never silently fall back.
//
// The evaluator is a SEPARATE model call from clone generation (different
// system prompt). The architecture supports model A ≠ model B — the
// evaluatorProviderId is configurable. For now, both use ZAIProvider
// (the only operational adapter), but the evaluatorPromptVersion makes
// the evaluation reproducible and the evaluatorProviderId makes it
// swappable.
//
// See HARDENING.md (N1.2A).

import { db } from '@/lib/db'
import { ModelRouter, type RoutingSignal, type ModelProvider } from '@/lib/runtime/model-provider'
import { CloneRuntime } from '@/lib/runtime/clone-runtime'
import { loadCloneStateSnapshot, getSnapshotMetadata, verifySnapshotIntegrity, type CloneStateSnapshot } from '@/lib/fidelity/snapshot'
import { RetrievalService, ContextCompiler, parseTask, estimateTokens, type TaskContext } from '@/lib/retrieval/retrieval'
import type { Principal } from '@/lib/auth/request-context'
import { createHash } from 'crypto'

const router = new ModelRouter()
const runtime = new CloneRuntime()
const retrievalService = new RetrievalService()
const contextCompiler = new ContextCompiler()

const EVALUATOR_PROMPT_VERSION = '1.0.0'
const RUBRIC_VERSION = '1.0.0'

export interface ScenarioInput {
  cloneId: string
  tenantId: string
  title: string
  description: string
  domain: string
  difficulty: string
  prompt: { context: string; question: string; inputs?: string[] }
  requiredSkills: string[]
  evaluationDimensions: string[]
  expectedEvidence: { keyPoints: string[]; decisionCriteria: string[]; riskFactors: string[] }
  source?: string
}

export interface HumanResponseInput {
  scenarioId: string
  cloneId: string
  tenantId: string
  principalId: string
  content: string
  decision: string
  reasoning: string
  actions: string[]
  priorities: string[]
  riskTolerance: number
  communication: string
}

export interface RunScenarioInput {
  scenarioId: string
  cloneId: string
  tenantId: string
  principalId: string
  cloneVersionId: string
  humanResponseId: string
  // Fallback for versions without snapshots (pre-N1.2A): exclude
  // specific workflows to approximate an older version's state.
  excludeWorkflowIds?: string[]
  // N1.2A: configurable evaluator provider (for future model A ≠ model B)
  evaluatorProviderId?: string
}

export class FidelityEngine {
  // Step 1: Create an EvaluationScenario
  async createScenario(input: ScenarioInput): Promise<{ scenarioId: string }> {
    const scenario = await db.evaluationScenario.create({
      data: {
        cloneId: input.cloneId,
        tenantId: input.tenantId,
        title: input.title,
        description: input.description,
        domain: input.domain,
        difficulty: input.difficulty,
        promptJson: JSON.stringify(input.prompt),
        requiredSkillsJson: JSON.stringify(input.requiredSkills),
        evaluationDimensionsJson: JSON.stringify(input.evaluationDimensions),
        expectedEvidenceJson: JSON.stringify(input.expectedEvidence),
        source: input.source || 'user_created',
      },
    })
    return { scenarioId: scenario.id }
  }

  // Step 2: Capture a HumanResponse (gold data)
  async captureHumanResponse(input: HumanResponseInput): Promise<{ humanResponseId: string }> {
    const resp = await db.humanResponse.create({
      data: {
        scenarioId: input.scenarioId,
        cloneId: input.cloneId,
        tenantId: input.tenantId,
        content: input.content,
        authorId: input.principalId,
        decision: input.decision,
        reasoning: input.reasoning,
        actionsJson: JSON.stringify(input.actions),
        prioritiesJson: JSON.stringify(input.priorities),
        riskTolerance: input.riskTolerance,
        communication: input.communication,
        provenanceJson: JSON.stringify({ source: 'user_general', sensitivity: 'internal', portability: 'portable' }),
        isGoldData: true,
      },
    })
    return { humanResponseId: resp.id }
  }

  // Step 3: Run the scenario against a specific clone version.
  // N1.2A: loads the version's IMMUTABLE SNAPSHOT, not the current clone.
  // If no snapshot exists (pre-N1.2A version), falls back to current
  // clone + excludeWorkflowIds with a warning.
  async runScenario(input: RunScenarioInput): Promise<{ executionId: string; cloneResponseId: string; cloneContent: string; usedSnapshot: boolean; snapshotStatus: string; snapshotOrigin: string }> {
    const scenario = await db.evaluationScenario.findUnique({ where: { id: input.scenarioId } })
    if (!scenario) throw new Error('Scenario not found')

    const humanResp = await db.humanResponse.findUnique({ where: { id: input.humanResponseId } })
    if (!humanResp) throw new Error('Human response not found')

    // N1.2B: Evaluation gate — verify snapshot before running.
    // Only AUTHENTIC + RELEASE_CAPTURE snapshots qualify for
    // certification-grade evaluation. No fallback to current clone.
    const meta = await getSnapshotMetadata(input.cloneVersionId)
    if (!meta.hasSnapshot || meta.status === 'UNAVAILABLE') {
      // Persist a failed execution with the reason
      const execution = await db.scenarioExecution.create({
        data: {
          scenarioId: input.scenarioId,
          cloneId: input.cloneId,
          cloneVersionId: input.cloneVersionId,
          tenantId: input.tenantId,
          humanResponseId: input.humanResponseId,
          status: 'failed',
        },
      })
      await db.scenarioExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', completedAt: new Date() },
      })
      throw new Error('VERSION_STATE_UNAVAILABLE: This version has no authentic snapshot. It cannot be used for certification-grade evaluation.')
    }
    if (meta.status !== 'AUTHENTIC' || meta.origin !== 'RELEASE_CAPTURE') {
      throw new Error(`VERSION_STATE_UNAVAILABLE: Snapshot status=${meta.status}, origin=${meta.origin}. Only AUTHENTIC + RELEASE_CAPTURE qualifies for certification-grade evaluation.`)
    }

    // Load the snapshot
    const snapshot = await loadCloneStateSnapshot(input.cloneVersionId)
    if (!snapshot) {
      throw new Error('VERSION_STATE_UNAVAILABLE: Snapshot metadata exists but snapshot data is missing.')
    }

    // N1.2B: Verify hash integrity
    if (meta.hash) {
      if (!verifySnapshotIntegrity(snapshot, meta.hash)) {
        throw new Error('SNAPSHOT_INTEGRITY_FAILURE: Snapshot hash does not match. The snapshot may have been tampered with or corrupted.')
      }
    }

    // N1.3A.2: Use the RETRIEVAL PIPELINE (same as live chat) instead of
    // dumping the entire snapshot into the prompt. This ensures fidelity
    // testing measures the actual production execution architecture.
    const prompt = JSON.parse(scenario.promptJson)
    const task = parseTask(prompt.question + ' ' + prompt.context, scenario.domain, input.cloneVersionId)
    // The scenario is an internal evaluation — sensitivity is internal
    task.sensitivity = 'internal'
    task.purpose = 'audit'

    // Retrieve relevant artifacts from the snapshot (version-aware)
    const retrieval = await retrievalService.retrieve(
      task, input.cloneId, input.tenantId, snapshot,
    )

    // Compile the bounded context
    const budget = retrievalService.getBudget()
    const persona = {
      name: snapshot.name, domain: snapshot.domain,
      persona: snapshot.persona, behavior: snapshot.behavior,
      values: snapshot.professionalIdentity?.values ?? [],
      bio: snapshot.professionalIdentity?.bio ?? null,
      title: snapshot.professionalIdentity?.title ?? null,
    }
    const compiled = contextCompiler.compile(
      persona, retrieval, retrievalService.getSerializer(), budget, input.cloneVersionId,
    )

    // Create the ScenarioExecution
    const execution = await db.scenarioExecution.create({
      data: {
        scenarioId: input.scenarioId,
        cloneId: input.cloneId,
        cloneVersionId: input.cloneVersionId,
        tenantId: input.tenantId,
        humanResponseId: input.humanResponseId,
        status: 'running',
      },
    })

    // Execute via CloneRuntime.execute() (the canonical path)
    const signal: RoutingSignal = 'complex_reasoning'
    const routing = router.select(signal)
    const provider = routing.provider
    const start = Date.now()

    const scenarioMessage = `SCENARIO: ${scenario.title}\n\nCONTEXT:\n${prompt.context}\n\nQUESTION:\n${prompt.question}${prompt.inputs ? '\n\nINPUTS:\n' + prompt.inputs.join('\n') : ''}\n\nProvide your professional response. Lead with your decision, then your reasoning, then actions, then risks.`
    const execResult = await runtime.execute(compiled.systemPrompt, scenarioMessage, provider)
    const response = { content: execResult.content, provider: execResult.providerId }

    const latencyMs = Date.now() - start

    const cloneResponse = await db.cloneResponse.create({
      data: {
        scenarioId: input.scenarioId,
        executionId: execution.id,
        cloneId: input.cloneId,
        cloneVersionId: input.cloneVersionId,
        tenantId: input.tenantId,
        content: response.content,
        modelProvider: provider.id,
        modelLatencyMs: latencyMs,
      },
    })

    await db.scenarioExecution.update({
      where: { id: execution.id },
      data: { status: 'completed', completedAt: new Date() },
    })

    return {
      executionId: execution.id,
      cloneResponseId: cloneResponse.id,
      cloneContent: response.content,
      usedSnapshot: true,
      snapshotStatus: 'AUTHENTIC',
      snapshotOrigin: 'RELEASE_CAPTURE',
    }
  }

  // Build a system prompt from an immutable snapshot (not the current clone).
  // This is the N1.2A way: the snapshot represents the exact state at the
  // time the version was released.
  private buildSystemPromptFromSnapshot(snapshot: CloneStateSnapshot): string {
    // Reuse CloneRuntime.toSystemPrompt by constructing an ExecutionContext
    // from the snapshot. This ensures the prompt format is identical
    // whether we're using a snapshot or the current clone.
    const ctx = {
      cloneId: '',
      cloneName: snapshot.name,
      cloneSlug: snapshot.slug,
      version: snapshot.version,
      certificationLevel: snapshot.certificationLevel,
      domain: snapshot.domain,
      ownerName: snapshot.professionalIdentity?.user?.name ?? null,
      ownerEmail: snapshot.professionalIdentity?.user?.email ?? null,
      ownerPublicKey: snapshot.professionalIdentity?.user?.publicKey ?? null,
      title: snapshot.professionalIdentity?.title ?? null,
      bio: snapshot.professionalIdentity?.bio ?? null,
      values: snapshot.professionalIdentity?.values ?? [],
      culture: snapshot.professionalIdentity?.culture ?? {},
      persona: snapshot.persona,
      personality: snapshot.personality,
      preferences: snapshot.preferences,
      behavior: snapshot.behavior,
      skills: snapshot.skills,
      knowledge: snapshot.knowledge,
      memories: snapshot.memories,
      policies: snapshot.policies.map((p) => ({
        name: p.name,
        description: p.description,
        rule: safeParse(p.ruleJson),
        appliesTo: p.appliesTo,
      })),
      workflows: snapshot.workflows.map((w) => ({
        name: w.name,
        description: w.description,
        steps: safeParseArr(w.stepsJson),
        version: w.version,
      })),
      approvedCapabilities: [],
    }
    return runtime.toSystemPrompt(ctx)
  }

  // Step 4: Evaluate — compare the clone's response to the human's response
  // using an INDEPENDENT evaluator model call.
  //
  // N1.2A: On parse failure, the evaluation is marked FAILED with no
  // dimension scores. The old fallback (fabricate 50%) is removed.
  // A FAILED evaluation does NOT contribute to CloneScore.
  async evaluate(executionId: string, principal: Principal): Promise<{ evaluationId: string; status: string; scores: Record<string, number>; agreementRate: number; headline: string }> {
    const execution = await db.scenarioExecution.findUnique({
      where: { id: executionId },
      include: { scenario: true, cloneResponse: true },
    })
    if (!execution) throw new Error('Execution not found')
    if (!execution.cloneResponse) throw new Error('No clone response for this execution')

    const humanResp = await db.humanResponse.findUnique({
      where: { id: execution.humanResponseId || '' },
    })
    if (!humanResp) throw new Error('No human response for comparison')

    // Build the EVALUATOR prompt
    const evaluatorPrompt = buildEvaluatorPrompt(execution.scenario, humanResp, execution.cloneResponse)

    // Use the ModelProvider SPI — the evaluator is a separate model call
    // with a different system prompt. N1.2A: the evaluatorProviderId is
    // recorded for reproducibility and future model A ≠ model B support.
    const signal: RoutingSignal = 'complex_reasoning'
    const routing = router.select(signal)
    const provider = routing.provider
    const start = Date.now()

    const evalResponse = await provider.generate({
      messages: [
        { role: 'assistant', content: 'You are an independent Fidelity Evaluator for Clone OS. You compare a clone\'s response to a human professional\'s response on the SAME scenario. You evaluate per-dimension, NOT by keyword matching. You look for genuine decision-pattern alignment, not lexical overlap. Return ONLY valid JSON.' },
        { role: 'user', content: evaluatorPrompt },
      ],
      signal,
      requestId: `fidelity_eval_${executionId}`,
    })

    const evalLatencyMs = Date.now() - start
    const inputsHash = createHash('sha256').update(`${execution.scenarioId}:${execution.cloneVersionId}:${humanResp.id}`).digest('hex').slice(0, 16)

    // N1.2A: Parse the evaluator's JSON response. On failure, persist
    // as status='failed' with NO dimension scores and NO agreement rate.
    // The old fallback (fabricate 50%) is REMOVED — it contaminated the
    // dataset with fake evidence.
    let evaluation: {
      agreementRate: number
      headline: string
      dimensions: Array<{
        dimension: string
        score: number
        evidence: string
        humanExcerpt: string
        cloneExcerpt: string
        alignment: string
      }>
    }

    try {
      const jsonMatch = evalResponse.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0])
        if (!evaluation.dimensions || !Array.isArray(evaluation.dimensions) || evaluation.dimensions.length === 0) {
          throw new Error('Evaluator returned no dimensions')
        }
      } else {
        throw new Error('No JSON in evaluator response')
      }
    } catch (e: any) {
      // N1.2A: FAILED evaluation — no score, no dimensions, never fabricate.
      const failedEval = await db.fidelityEvaluation.create({
        data: {
          executionId,
          cloneId: execution.cloneId,
          cloneVersionId: execution.cloneVersionId,
          tenantId: execution.tenantId,
          status: 'failed',
          scoreType: 'fidelity',
          evaluationSource: 'private',
          agreementRate: 0,
          headlineSummary: `EVALUATION FAILED: ${e.message}. No score recorded — retry or use an alternate evaluator.`,
          evaluatorModel: provider.id,
          evaluatorProviderId: provider.id,
          evaluatorLatencyMs: evalLatencyMs,
          scenarioVersion: execution.scenario.version,
          evaluatorPromptVersion: EVALUATOR_PROMPT_VERSION,
          rubricVersion: RUBRIC_VERSION,
          temperature: 0.7,
          inputsHash,
          evidenceJson: JSON.stringify({ status: 'failed', error: e.message, rawResponse: evalResponse.content.slice(0, 2000) }),
        },
      })
      await db.scenarioExecution.update({
        where: { id: executionId },
        data: { status: 'failed', completedAt: new Date() },
      })
      return {
        evaluationId: failedEval.id,
        status: 'failed',
        scores: {},
        agreementRate: 0,
        headline: `EVALUATION FAILED: ${e.message}. No score recorded.`,
      }
    }

    // Persist the FidelityEvaluation (status='completed')
    const fidelityEval = await db.fidelityEvaluation.create({
      data: {
        executionId,
        cloneId: execution.cloneId,
        cloneVersionId: execution.cloneVersionId,
        tenantId: execution.tenantId,
        status: 'completed',
        scoreType: 'fidelity',
        evaluationSource: 'private',
        agreementRate: evaluation.agreementRate,
        headlineSummary: evaluation.headline,
        evaluatorModel: provider.id,
        evaluatorProviderId: provider.id,
        evaluatorLatencyMs: evalLatencyMs,
        scenarioVersion: execution.scenario.version,
        evaluatorPromptVersion: EVALUATOR_PROMPT_VERSION,
        rubricVersion: RUBRIC_VERSION,
        temperature: 0.7,
        inputsHash,
        evidenceJson: JSON.stringify({ fullEvaluatorResponse: evalResponse.content }),
      },
    })

    // Persist the per-dimension scores with evidence
    for (const dim of evaluation.dimensions) {
      await db.fidelityDimensionScore.create({
        data: {
          evaluationId: fidelityEval.id,
          dimension: dim.dimension,
          score: dim.score,
          evidence: dim.evidence,
          humanExcerpt: dim.humanExcerpt,
          cloneExcerpt: dim.cloneExcerpt,
          alignment: dim.alignment,
        },
      })
    }

    const scores: Record<string, number> = {}
    for (const dim of evaluation.dimensions) {
      scores[dim.dimension] = dim.score
    }

    return {
      evaluationId: fidelityEval.id,
      status: 'completed',
      scores,
      agreementRate: evaluation.agreementRate,
      headline: evaluation.headline,
    }
  }

  // Step 5: Recompute the CloneScore from recent evaluation evidence.
  // N1.2A: only aggregates evaluations where status='completed'.
  // FAILED evaluations are skipped — they don't contaminate the score.
  async recomputeCloneScore(cloneId: string, tenantId: string): Promise<{ dimensions: Record<string, number>; aggregate: number; evidenceCount: number; failedCount: number }> {
    const evaluations = await db.fidelityEvaluation.findMany({
      where: { cloneId, status: 'completed' }, // N1.2A: skip FAILED
      include: { dimensionScores: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const failedCount = await db.fidelityEvaluation.count({
      where: { cloneId, status: 'failed' },
    })

    const dimensionAverages: Record<string, number[]> = {}
    for (const ev of evaluations) {
      for (const ds of ev.dimensionScores) {
        if (!dimensionAverages[ds.dimension]) dimensionAverages[ds.dimension] = []
        dimensionAverages[ds.dimension].push(ds.score)
      }
    }

    const dimensions: Record<string, number> = {}
    for (const [dim, scores] of Object.entries(dimensionAverages)) {
      dimensions[dim] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    }

    const weights: Record<string, number> = {
      decision: 1.4, reasoning: 1.3, behavioral: 1.1, communication: 1.0,
      personality: 0.9, cultural: 0.7, outcome: 1.6,
    }
    let total = 0, weightSum = 0
    for (const [dim, score] of Object.entries(dimensions)) {
      const w = weights[dim] ?? 1.0
      total += score * w
      weightSum += w
    }
    const aggregate = weightSum > 0 ? Math.round((total / weightSum) * 10) / 10 : 0

    const existing = await db.cloneScore.findFirst({
      where: { cloneId },
      orderBy: { computedAt: 'desc' },
    })
    if (existing) {
      await db.cloneScore.update({
        where: { id: existing.id },
        data: {
          professionalFidelity: dimensions.professional ?? 0,
          knowledgeFidelity: dimensions.knowledge ?? dimensions.reasoning ?? 0,
          skillFidelity: dimensions.behavioral ?? 0,
          decisionFidelity: dimensions.decision ?? 0,
          behavioralFidelity: dimensions.behavioral ?? 0,
          communicationFidelity: dimensions.communication ?? 0,
          personalityFidelity: dimensions.personality ?? 0,
          culturalFidelity: dimensions.cultural ?? 0,
          outcomeFidelity: dimensions.outcome ?? 0,
          aggregate,
          notes: `Computed from ${evaluations.length} completed evaluation(s). ${failedCount} failed evaluation(s) excluded.`,
        },
      })
    } else {
      await db.cloneScore.create({
        data: {
          cloneId, tenantId,
          professionalFidelity: dimensions.professional ?? 0,
          knowledgeFidelity: dimensions.knowledge ?? dimensions.reasoning ?? 0,
          skillFidelity: dimensions.behavioral ?? 0,
          decisionFidelity: dimensions.decision ?? 0,
          behavioralFidelity: dimensions.behavioral ?? 0,
          communicationFidelity: dimensions.communication ?? 0,
          personalityFidelity: dimensions.personality ?? 0,
          culturalFidelity: dimensions.cultural ?? 0,
          outcomeFidelity: dimensions.outcome ?? 0,
          aggregate,
          notes: `Computed from ${evaluations.length} completed evaluation(s). ${failedCount} failed evaluation(s) excluded.`,
        },
      })
    }

    return { dimensions, aggregate, evidenceCount: evaluations.length, failedCount }
  }
}

function buildEvaluatorPrompt(scenario: any, humanResp: any, cloneResp: any): string {
  const prompt = JSON.parse(scenario.promptJson)
  const expectedEvidence = JSON.parse(scenario.expectedEvidenceJson)
  const dimensions = JSON.parse(scenario.evaluationDimensionsJson)

  return `SCENARIO: ${scenario.title}
DOMAIN: ${scenario.domain}
DIFFICULTY: ${scenario.difficulty}

SCENARIO CONTEXT:
${prompt.context}

SCENARIO QUESTION:
${prompt.question}

EXPECTED EVIDENCE (what a good answer should contain):
- Key points: ${expectedEvidence.keyPoints?.join(', ')}
- Decision criteria: ${expectedEvidence.decisionCriteria?.join(', ')}
- Risk factors: ${expectedEvidence.riskFactors?.join(', ')}

=== HUMAN RESPONSE (gold data — the reference model) ===
Decision: ${humanResp.decision}
Reasoning: ${humanResp.reasoning}
Actions: ${JSON.parse(humanResp.actionsJson).join('; ')}
Priorities: ${JSON.parse(humanResp.prioritiesJson).join('; ')}
Risk tolerance: ${humanResp.riskTolerance}
Communication style: ${humanResp.communication}

Full response:
${humanResp.content}

=== CLONE RESPONSE (being evaluated) ===
${cloneResp.content}

=== EVALUATION INSTRUCTIONS ===
Compare the clone's response to the human's response on the SAME scenario. Evaluate each dimension:

${dimensions.map((d: string) => `- ${d}`).join('\n')}

For each dimension, provide:
- score: 0..100 (how well the clone matches the human on this dimension)
- evidence: what you found (specific observations, NOT keyword matching)
- humanExcerpt: the relevant excerpt from the human's response
- cloneExcerpt: the relevant excerpt from the clone's response
- alignment: "aligned" | "partial" | "misaligned"

IMPORTANT: Look for genuine decision-pattern alignment, not lexical overlap. If the clone uses the same keywords but for different reasons, score lower. If the clone arrives at the same decision via different but valid reasoning, score higher.

Return ONLY valid JSON:
{
  "agreementRate": 0.91,
  "headline": "Clone agrees with human 91% of the time",
  "dimensions": [
    {"dimension": "decision", "score": 92.1, "evidence": "...", "humanExcerpt": "...", "cloneExcerpt": "...", "alignment": "aligned"},
    ...
  ]
}`
}

function safeParse(s: string | null | undefined): Record<string, any> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
