// Clone OS — Real Learning Pipeline (N1.1)
//
// The frozen architecture requires:
//   Human Interaction → LearningEvent → Learning Extraction →
//   Candidate Artifact → Provenance Classification → Human Confirmation →
//   Candidate Clone State → Evaluation → CloneVersionCandidate → Release/Reject
//
// STATUS: OPERATIONAL (N1.1). The capture, extract, confirm, persist, and
// candidate-version flow are real. Evaluation is a lightweight stub (N1.2
// will make it real with the FidelityEngine). No model fine-tuning.
//
// See HARDENING.md (N1.1).

import { db } from '@/lib/db'
import { ModelRouter, type RoutingSignal } from '@/lib/runtime/model-provider'
import { CloneRuntime } from '@/lib/runtime/clone-runtime'
import { classifyProvenance } from '@/lib/learning/provenance-classifier'
import { detectConflicts } from '@/lib/learning/conflict-detector'
import { createCloneStateSnapshot } from '@/lib/fidelity/snapshot'
import type { Principal } from '@/lib/auth/request-context'

export interface CaptureInput {
  cloneId: string
  principal: Principal
  mode: string // teach | demonstrate | correct
  rawInteraction: string
  context?: Record<string, unknown>
}

export interface ExtractedCandidate {
  artifactType: string // procedure | rule | preference | policy | behavioral_pattern | decision_pattern | semantic_knowledge | episodic_memory
  name: string
  content: string
  confidence: number
  provenanceKind: string // the LLM's classification (overridden by the keyword classifier if needed)
}

export interface LearningPipelineResult {
  learningEventId: string
  candidates: Array<{
    id: string
    artifactType: string
    name: string
    content: string
    confidence: number
    provenanceKind: string
    provenanceSensitivity: string
    provenancePortability: string
    hasConflict: boolean
    conflictingArtifactName?: string
    conflictSuggestion?: string
  }>
}

// The extraction prompt sent to the LLM. It includes the clone's existing
// expertise (so the LLM can detect conflicts) and asks for structured JSON.
function buildExtractionPrompt(
  rawInteraction: string,
  existingExpertise: { type: string; name: string; content: string }[],
): string {
  const existing = existingExpertise
    .map((e) => `- [${e.type}] ${e.name}: ${e.content.slice(0, 200)}`)
    .join('\n')

  return `You are a Learning Extraction Engine for Clone OS. Given a human professional's teaching interaction, extract candidate professional artifacts that could be persisted to the clone's professional self.

EXISTING ARTIFACTS ON THE CLONE (for conflict detection):
${existing || '(none yet)'}

TEACHING INTERACTION:
"""
${rawInteraction}
"""

Extract candidate artifacts. For each candidate, provide:
- artifactType: one of "procedure" | "rule" | "preference" | "policy" | "behavioral_pattern" | "decision_pattern" | "semantic_knowledge" | "episodic_memory"
- name: a short, descriptive name (e.g., "Pipeline Forecasting Procedure")
- content: the extracted artifact, concise and actionable (e.g., "When forecasting pipeline, inspect stage aging before raw pipeline coverage.")
- confidence: 0..1 (how certain you are this is a real, learnable professional artifact — not casual conversation)
- provenanceKind: one of "user_general" | "company_proprietary" | "client_data" | "public" | "licensed" | "third_party" | "generated"
  (user_general = the person's own professional expertise; company_proprietary = mentions a specific company's proprietary process/formula/IP; client_data = mentions a specific client's confidential data; public = well-known industry knowledge)

Only extract genuine professional artifacts — do NOT extract casual conversation, greetings, or questions. If the interaction contains no learnable artifacts, return an empty array.

Return ONLY valid JSON, no markdown, no explanation:
{"candidates": [{"artifactType": "...", "name": "...", "content": "...", "confidence": 0.91, "provenanceKind": "user_general"}]}`
}

export class LearningPipeline {
  private router = new ModelRouter()
  private runtime = new CloneRuntime()

  // Step 1: Capture the raw interaction as a LearningEvent.
  // Provenance is classified HERE, not deferred.
  async capture(input: CaptureInput): Promise<{ learningEventId: string }> {
    const provenance = classifyProvenance(input.rawInteraction)
    const event = await db.learningEvent.create({
      data: {
        cloneId: input.cloneId,
        tenantId: input.principal.tenantId,
        actorId: input.principal.id,
        mode: input.mode,
        rawInteraction: input.rawInteraction,
        interactionType: 'text',
        contextJson: JSON.stringify({ source: input.context?.source ?? 'training_studio', ...input.context }),
        provenanceKind: provenance.kind,
        confidence: 0, // set after extraction
        confirmationState: 'pending',
      },
    })
    return { learningEventId: event.id }
  }

  // Step 2: Extract candidate artifacts from the LearningEvent using the LLM.
  // Includes provenance classification (per-artifact, during extraction) and
  // conflict detection against existing artifacts.
  async extract(learningEventId: string): Promise<LearningPipelineResult> {
    const event = await db.learningEvent.findUnique({
      where: { id: learningEventId },
      include: {
        clone: {
          include: {
            workflows: { select: { id: true, name: true, description: true, stepsJson: true } },
            policies: { select: { id: true, name: true, description: true, ruleJson: true } },
            knowledgeItems: { select: { id: true, title: true, content: true, kind: true } },
          },
        },
      },
    })
    if (!event) throw new Error('LearningEvent not found')

    // Build the existing-expertise context for conflict detection
    const existingExpertise = [
      ...event.clone.workflows.map((w) => ({ type: 'procedure', name: w.name, content: `${w.description} ${w.stepsJson}` })),
      ...event.clone.policies.map((p) => ({ type: 'policy', name: p.name, content: `${p.description} ${p.ruleJson}` })),
      ...event.clone.knowledgeItems.map((k) => ({ type: k.kind, name: k.title, content: k.content })),
    ]

    // Build the extraction prompt (split into system instructions + user content)
    const prompt = buildExtractionPrompt(event.rawInteraction, existingExpertise)

    // Use the ModelProvider SPI (never the SDK directly)
    const signal: RoutingSignal = 'complex_reasoning'
    const routing = this.router.select(signal)
    const provider = routing.provider
    const start = Date.now()
    const response = await provider.generate({
      messages: [
        { role: 'assistant', content: 'You are a Learning Extraction Engine for Clone OS. You extract candidate professional artifacts from teaching interactions and return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      signal,
      requestId: `extract_${learningEventId}`,
      cloneId: event.cloneId,
    })

    // Parse the LLM's JSON response
    let candidates: ExtractedCandidate[] = []
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        candidates = (parsed.candidates || []).filter(
          (c: any) => c.artifactType && c.content && typeof c.confidence === 'number',
        )
      }
    } catch {
      // LLM didn't return valid JSON — no candidates extracted
    }

    // Persist candidates with provenance classification + conflict detection
    const persistedCandidates = []
    for (const c of candidates) {
      // Provenance classification (keyword override on top of LLM classification)
      const provenance = classifyProvenance(c.content, c.provenanceKind)
      // Conflict detection against existing artifacts
      const conflict = await detectConflicts(event.cloneId, c.artifactType, c.content, c.name)
      const artifact = await db.candidateArtifact.create({
        data: {
          learningEventId,
          cloneId: event.cloneId,
          tenantId: event.tenantId,
          artifactType: c.artifactType,
          name: c.name,
          content: c.content,
          confidence: c.confidence,
          provenanceKind: provenance.kind,
          provenanceSensitivity: provenance.sensitivity,
          provenancePortability: provenance.portability,
          conflictsWithArtifactId: conflict.conflictingArtifactId ?? null,
          conflictsWithArtifactName: conflict.conflictingArtifactName ?? null,
          confirmationState: 'pending',
          extractionModel: provider.id,
          extractionLatencyMs: Date.now() - start,
        },
      })
      persistedCandidates.push({
        id: artifact.id,
        artifactType: artifact.artifactType,
        name: artifact.name,
        content: artifact.content,
        confidence: artifact.confidence,
        provenanceKind: artifact.provenanceKind,
        provenanceSensitivity: artifact.provenanceSensitivity,
        provenancePortability: artifact.provenancePortability,
        hasConflict: conflict.hasConflict,
        conflictingArtifactName: conflict.conflictingArtifactName,
        conflictSuggestion: conflict.suggestion,
      })
    }

    // Update the event's confidence + confirmation state
    const avgConfidence = candidates.length > 0
      ? candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length
      : 0
    await db.learningEvent.update({
      where: { id: learningEventId },
      data: { confidence: avgConfidence, confirmationState: persistedCandidates.length === 0 ? 'rejected' : 'pending' },
    })

    return { learningEventId, candidates: persistedCandidates }
  }

  // Step 3: Confirm a candidate (approve/edit/reject/merge).
  // The system never auto-mutates the durable professional self from LLM
  // inference alone — human confirmation is required.
  async confirm(
    candidateId: string,
    principal: Principal,
    decision: 'approve' | 'edit' | 'reject' | 'merge' | 'ignore',
    editedContent?: string,
  ): Promise<{ ok: boolean; persistedArtifactId?: string }> {
    const candidate = await db.candidateArtifact.findUnique({
      where: { id: candidateId },
    })
    if (!candidate) throw new Error('Candidate not found')
    if (candidate.confirmationState !== 'pending') {
      throw new Error(`Candidate already ${candidate.confirmationState}`)
    }

    const stateMap: Record<string, string> = {
      approve: 'approved',
      edit: 'edited',
      reject: 'rejected',
      merge: 'merged',
      ignore: 'ignored',
    }
    const newState = stateMap[decision] || 'ignored'

    await db.candidateArtifact.update({
      where: { id: candidateId },
      data: {
        confirmationState: newState,
        confirmedById: principal.id,
        confirmedAt: new Date(),
        originalContent: decision === 'edit' && editedContent ? candidate.content : candidate.originalContent,
        content: decision === 'edit' && editedContent ? editedContent : candidate.content,
        conflictResolution: candidate.conflictsWithArtifactId ? (decision === 'approve' ? 'replace' : decision) : null,
      },
    })

    return { ok: true }
  }

  // Step 4: Persist confirmed candidates to the clone's Knowledge/Workflow/
  // Policy/Memory tables + create a CloneVersionCandidate.
  // This is the bridge from "confirmed artifacts" to "versioned clone state."
  async persist(
    learningEventId: string,
    principal: Principal,
  ): Promise<{ cloneVersionCandidateId: string; persistedArtifactIds: string[] }> {
    const event = await db.learningEvent.findUnique({
      where: { id: learningEventId },
      include: { candidates: true, clone: { include: { currentVersion: true } } },
    })
    if (!event) throw new Error('LearningEvent not found')

    const approved = event.candidates.filter((c) => c.confirmationState === 'approved' || c.confirmationState === 'edited')
    if (approved.length === 0) {
      throw new Error('No approved candidates to persist')
    }

    // Persist each approved candidate to the appropriate clone table
    const persistedIds: string[] = []
    for (const c of approved) {
      const persisted = await this.persistArtifact(c, event.cloneId, event.tenantId)
      persistedIds.push(persisted.id)
      // Link the candidate to its persisted artifact
      await db.candidateArtifact.update({
        where: { id: c.id },
        data: { persistedArtifactType: persisted.type, persistedArtifactId: persisted.id },
      })
    }

    // Create a CloneVersionCandidate
    const baseVersion = event.clone.currentVersion
    const baseVersionNum = baseVersion?.version ?? '1.0.0'
    const candidateVersion = bumpVersion(baseVersionNum)
    const candidate = await db.cloneVersionCandidate.create({
      data: {
        cloneId: event.cloneId,
        tenantId: event.tenantId,
        baseVersionId: baseVersion?.id ?? '',
        candidateVersion,
        status: 'pending_approval',
        changeSetJson: JSON.stringify({
          summary: `${approved.length} artifact(s) learned from a ${event.mode} interaction`,
          artifacts: approved.map((c) => ({ type: c.artifactType, name: c.name, content: c.content })),
        }),
        learningEventIdsJson: JSON.stringify([learningEventId]),
        artifactIdsJson: JSON.stringify(approved.map((c) => c.id)),
        provenanceImpactJson: JSON.stringify(this.provenanceImpactSummary(approved)),
        createdBy: principal.id,
      },
    })

    // Update the learning event's link to the candidate
    await db.learningEvent.update({
      where: { id: learningEventId },
      data: { candidateVersionId: candidate.id, confirmationState: 'fully_confirmed' },
    })

    // Emit domain events
    await db.domainEvent.create({
      data: {
        tenantId: event.tenantId,
        cloneId: event.cloneId,
        type: 'CloneUpdated',
        payloadJson: JSON.stringify({ learningEventId, candidateId: candidate.id, candidateVersion, artifactCount: approved.length }),
      } as any,
    })

    return { cloneVersionCandidateId: candidate.id, persistedArtifactIds: persistedIds }
  }

  // Step 5: Release a CloneVersionCandidate → creates a new CloneVersion +
  // updates Clone.currentVersionId. This is the ONLY way production changes.
  async release(
    candidateId: string,
    principal: Principal,
  ): Promise<{ releasedVersionId: string; version: string }> {
    const candidate = await db.cloneVersionCandidate.findUnique({
      where: { id: candidateId },
      include: { clone: true },
    })
    if (!candidate) throw new Error('Candidate not found')
    if (candidate.status !== 'pending_approval') {
      throw new Error(`Candidate is ${candidate.status}, not pending_approval`)
    }

    // Create the new CloneVersion
    const newVersion = await db.cloneVersion.create({
      data: {
        cloneId: candidate.cloneId,
        version: candidate.candidateVersion,
        authorId: principal.id,
        changeSetJson: candidate.changeSetJson,
        trainingInputsJson: JSON.stringify({ learningEventIds: JSON.parse(candidate.learningEventIdsJson), artifactIds: JSON.parse(candidate.artifactIdsJson) }),
        evaluationResultsJson: candidate.evaluationResultsJson ?? '{}',
        performanceImpact: candidate.scoreDelta,
        dependenciesJson: '{}',
        provenanceJson: JSON.stringify({ learningEventIds: JSON.parse(candidate.learningEventIdsJson) }),
        // N1.2A: create an immutable snapshot of the clone's state at
        // release time. Evaluation runs against this snapshot, not the
        // current clone — this is how version comparisons are genuine.
        stateSnapshotJson: await createCloneStateSnapshot(candidate.cloneId, candidate.candidateVersion),
      },
    })

    // Update the candidate to released + update the clone's active version
    await db.cloneVersionCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'released',
        approvedBy: principal.id,
        approvedAt: new Date(),
        releasedVersionId: newVersion.id,
      },
    })
    await db.clone.update({
      where: { id: candidate.cloneId },
      data: { currentVersionId: newVersion.id },
    })

    // Emit domain event
    await db.domainEvent.create({
      data: {
        tenantId: candidate.tenantId,
        cloneId: candidate.cloneId,
        type: 'CloneVersionReleased',
        payloadJson: JSON.stringify({ candidateId, version: candidate.candidateVersion, releasedById: principal.id }),
      } as any,
    })
    await db.auditLog.create({
      data: {
        tenantId: candidate.tenantId,
        actorId: principal.id,
        cloneId: candidate.cloneId,
        action: 'clone.version.released',
        resourceType: 'clone_version',
        resourceId: newVersion.id,
        detailsJson: JSON.stringify({ version: candidate.candidateVersion, candidateId }),
      },
    })

    return { releasedVersionId: newVersion.id, version: candidate.candidateVersion }
  }

  // Persist a single approved candidate artifact to the appropriate clone table.
  // The artifactType determines which table: procedure → Workflow, rule/policy →
  // Policy, semantic_knowledge → Knowledge, episodic_memory/preference → Memory.
  private async persistArtifact(
    candidate: { artifactType: string; name: string; content: string; provenanceKind: string; provenanceSensitivity: string; provenancePortability: string },
    cloneId: string,
    tenantId: string,
  ): Promise<{ type: string; id: string }> {
    switch (candidate.artifactType) {
      case 'procedure':
      case 'decision_pattern': {
        const w = await db.workflow.create({
          data: {
            cloneId, tenantId,
            name: candidate.name,
            description: candidate.content,
            stepsJson: JSON.stringify([candidate.content]),
            triggerKind: 'manual',
            version: '1.0.0',
            provenanceJson: JSON.stringify({ owner: 'sarah@clone.os', source: candidate.provenanceKind, portability: candidate.provenancePortability }),
          },
        })
        return { type: 'workflow', id: w.id }
      }
      case 'rule':
      case 'policy': {
        const p = await db.policy.create({
          data: {
            cloneId, tenantId,
            name: candidate.name,
            description: candidate.content,
            ruleJson: JSON.stringify({ content: candidate.content }),
            appliesTo: 'agent',
            version: '1.0.0',
          },
        })
        return { type: 'policy', id: p.id }
      }
      case 'semantic_knowledge':
      case 'behavioral_pattern':
      case 'heuristic': {
        const k = await db.knowledge.create({
          data: {
            cloneId, tenantId,
            title: candidate.name,
            content: candidate.content,
            kind: candidate.artifactType === 'behavioral_pattern' ? 'heuristic' : 'principle',
            tagsJson: JSON.stringify([candidate.artifactType, candidate.provenanceKind]),
            sourceKind: candidate.provenanceKind as any,
            originTenantId: tenantId,
            license: candidate.provenanceKind === 'user_general' ? 'marketplace' : 'restricted',
            visibility: candidate.provenanceSensitivity === 'public' ? 'marketplace' : 'private',
            sensitivity: candidate.provenanceSensitivity as any,
            portability: candidate.provenancePortability as any,
          },
        })
        return { type: 'knowledge', id: k.id }
      }
      case 'episodic_memory':
      case 'preference': {
        const m = await db.memory.create({
          data: {
            cloneId, tenantId,
            kind: candidate.artifactType === 'preference' ? 'preference' : 'episodic',
            content: candidate.content,
            importance: 0.8,
          },
        })
        return { type: 'memory', id: m.id }
      }
      default: {
        // Default: store as knowledge
        const k = await db.knowledge.create({
          data: {
            cloneId, tenantId,
            title: candidate.name,
            content: candidate.content,
            kind: 'fact',
            tagsJson: JSON.stringify([candidate.artifactType, candidate.provenanceKind]),
            sourceKind: candidate.provenanceKind as any,
            originTenantId: tenantId,
            license: 'marketplace',
            visibility: 'private',
            sensitivity: candidate.provenanceSensitivity as any,
            portability: candidate.provenancePortability as any,
          },
        })
        return { type: 'knowledge', id: k.id }
      }
    }
  }

  private provenanceImpactSummary(artifacts: { provenanceKind: string }[]): Record<string, number> {
    const summary: Record<string, number> = {}
    for (const a of artifacts) {
      summary[a.provenanceKind] = (summary[a.provenanceKind] || 0) + 1
    }
    return summary
  }
}

// Bump a semver-like version string (e.g., "1.4.0" → "1.5.0")
function bumpVersion(version: string): string {
  const parts = version.split('.').map((n) => parseInt(n, 10) || 0)
  parts[1] = (parts[1] || 0) + 1
  parts[2] = 0
  return parts.join('.')
}
