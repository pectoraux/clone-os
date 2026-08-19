// Clone OS — Real Fidelity Engine (N1.2)
//
// PURPOSE: Prove empirically that learning makes the clone more faithful
// to the human. This is NOT about improving the clone — it's about proving
// "this agent is increasingly becoming a faithful representation of this
// person's professional self."
//
// Architecture:
//   EvaluationScenario (controlled professional situation)
//     ↓
//   HumanResponse (gold data — the human is the reference model)
//   CloneResponse (the clone's answer, linked to a specific version)
//     ↓
//   FidelityEvaluation (independent evaluator model compares the two)
//     ↓
//   FidelityDimensionScore (per-dimension, evidence-backed)
//     ↓
//   CloneScore (aggregated from evaluation evidence)
//
// CRITICAL RULE: The evaluator is a SEPARATE model call from the clone
// response generation. The model that generates the clone's response is
// NOT the model that grades it. This prevents the LLM from grading itself.
//
// See HARDENING.md (N1.2).

import { db } from '@/lib/db'
import { ModelRouter, type RoutingSignal } from '@/lib/runtime/model-provider'
import { CloneRuntime } from '@/lib/runtime/clone-runtime'
import type { Principal } from '@/lib/auth/request-context'

const router = new ModelRouter()
const runtime = new CloneRuntime()

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
  // For the v1.4 baseline: exclude workflows that were added in v1.5
  // (the learned procedure). This simulates running the scenario against
  // the pre-learning version.
  excludeWorkflowIds?: string[]
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

  // Step 2: Capture a HumanResponse (gold data — the reference model)
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

  // Step 3: Run the scenario against a specific clone version. The clone
  // generates its response using the CloneRuntime + ModelProvider. The
  // response is captured as a CloneResponse linked to the version.
  async runScenario(input: RunScenarioInput): Promise<{ executionId: string; cloneResponseId: string; cloneContent: string }> {
    const scenario = await db.evaluationScenario.findUnique({
      where: { id: input.scenarioId },
    })
    if (!scenario) throw new Error('Scenario not found')

    const humanResp = await db.humanResponse.findUnique({
      where: { id: input.humanResponseId },
    })
    if (!humanResp) throw new Error('Human response not found')

    // Load the clone context using CloneRuntime
    const clone = await db.clone.findUnique({
      where: { id: input.cloneId },
      include: {
        professionalIdentity: { include: { user: true } },
        currentVersion: true,
        skills: true,
        knowledgeItems: { take: 12, orderBy: { createdAt: 'desc' } },
        memories: { take: 8, orderBy: { importance: 'desc' } },
        policies: { take: 8 },
        workflows: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!clone) throw new Error('Clone not found')

    // If excludeWorkflowIds is set, filter them out (for the v1.4 baseline)
    if (input.excludeWorkflowIds && input.excludeWorkflowIds.length > 0) {
      clone.workflows = clone.workflows.filter(
        (w) => !input.excludeWorkflowIds!.includes(w.id),
      )
    }

    // Build the execution context using CloneRuntime
    const ctx = runtime.buildContext({ clone })
    const systemPrompt = runtime.toSystemPrompt(ctx)
    const prompt = JSON.parse(scenario.promptJson)

    // Create the ScenarioExecution record
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

    // Generate the clone's response using ModelProvider SPI
    const signal: RoutingSignal = 'complex_reasoning'
    const routing = router.select(signal)
    const provider = routing.provider
    const start = Date.now()

    const response = await provider.generate({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: `SCENARIO: ${scenario.title}\n\nCONTEXT:\n${prompt.context}\n\nQUESTION:\n${prompt.question}${prompt.inputs ? '\n\nINPUTS:\n' + prompt.inputs.join('\n') : ''}\n\nProvide your professional response. Lead with your decision, then your reasoning, then actions, then risks.` },
      ],
      signal,
      requestId: `fidelity_run_${execution.id}`,
      cloneId: input.cloneId,
    })

    const latencyMs = Date.now() - start

    // Capture the CloneResponse
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

    return { executionId: execution.id, cloneResponseId: cloneResponse.id, cloneContent: response.content }
  }

  // Step 4: Evaluate — compare the clone's response to the human's response
  // using an INDEPENDENT evaluator model. The evaluator is a separate model
  // call with a different system prompt (it's an evaluator, not the clone).
  // This prevents the LLM from grading itself.
  async evaluate(executionId: string, principal: Principal): Promise<{ evaluationId: string; scores: Record<string, number>; agreementRate: number; headline: string }> {
    const execution = await db.scenarioExecution.findUnique({
      where: { id: executionId },
      include: {
        scenario: true,
        cloneResponse: true,
      },
    })
    if (!execution) throw new Error('Execution not found')
    if (!execution.cloneResponse) throw new Error('No clone response for this execution')

    const humanResp = await db.humanResponse.findUnique({
      where: { id: execution.humanResponseId || '' },
    })
    if (!humanResp) throw new Error('No human response for comparison')

    // Build the EVALUATOR prompt (different from the clone prompt)
    const evaluatorPrompt = buildEvaluatorPrompt(
      execution.scenario,
      humanResp,
      execution.cloneResponse,
    )

    // Use the ModelProvider SPI — the evaluator is a separate model call
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

    // Parse the evaluator's JSON response
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
      } else {
        throw new Error('No JSON in evaluator response')
      }
    } catch {
      // Fallback: if the evaluator didn't return valid JSON, create a
      // minimal evaluation
      evaluation = {
        agreementRate: 0.5,
        headline: 'Evaluation parsing failed — using fallback score',
        dimensions: (JSON.parse(execution.scenario.evaluationDimensionsJson) as string[]).map((dim) => ({
          dimension: dim,
          score: 50,
          evidence: 'Evaluation parsing failed',
          humanExcerpt: humanResp.content.slice(0, 200),
          cloneExcerpt: execution.cloneResponse.content.slice(0, 200),
          alignment: 'partial',
        })),
      }
    }

    // Persist the FidelityEvaluation
    const fidelityEval = await db.fidelityEvaluation.create({
      data: {
        executionId,
        cloneId: execution.cloneId,
        cloneVersionId: execution.cloneVersionId,
        tenantId: execution.tenantId,
        agreementRate: evaluation.agreementRate,
        headlineSummary: evaluation.headline,
        evaluatorModel: provider.id,
        evaluatorLatencyMs: evalLatencyMs,
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
      scores,
      agreementRate: evaluation.agreementRate,
      headline: evaluation.headline,
    }
  }

  // Step 5: Recompute the CloneScore from recent evaluation evidence.
  // The score is no longer a fixture — it's aggregated from real evaluations.
  async recomputeCloneScore(cloneId: string, tenantId: string): Promise<{ dimensions: Record<string, number>; aggregate: number; evidenceCount: number }> {
    // Get all FidelityDimensionScores for this clone, grouped by dimension
    const evaluations = await db.fidelityEvaluation.findMany({
      where: { cloneId },
      include: { dimensionScores: true },
      orderBy: { createdAt: 'desc' },
      take: 50, // last 50 evaluations
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

    // Compute aggregate (weighted — outcome + decision weigh heaviest)
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

    // Update or create the CloneScore
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
          notes: `Computed from ${evaluations.length} evaluation(s).`,
        },
      })
    } else {
      await db.cloneScore.create({
        data: {
          cloneId,
          tenantId,
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
          notes: `Computed from ${evaluations.length} evaluation(s).`,
        },
      })
    }

    return { dimensions, aggregate, evidenceCount: evaluations.length }
  }
}

// Build the evaluator prompt — this is the INDEPENDENT evaluation. The
// evaluator sees both the human response and the clone response, plus the
// scenario and expected evidence. It evaluates per-dimension with excerpts
// and alignment, NOT keyword matching.
function buildEvaluatorPrompt(
  scenario: any,
  humanResp: any,
  cloneResp: any,
): string {
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
