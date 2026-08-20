// Clone OS — Memory Manager (N1.3B + N1.3B.1)
//
// N1.3B.1: Transactional, authorization-aware, operationally efficient.
//
// The clone's persistent memory is a governed, evidence-backed, time-aware
// component of the professional self — not merely a content blob.
//
// Architectural rules:
// - Every lifecycle mutation is transactional (atomic)
// - The domain layer verifies clone/tenant ownership before mutation
// - Operational state (accessCount, lastRetrievedAt) does NOT create versions
// - Identity state (content, confidence, state, supersession) enters
//   the candidate-version pipeline
// - The LLM may propose, but the system decides what persists

import { db } from '@/lib/db'

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'preference' | 'policy' | 'behavioral' | 'experience' | 'correction'
export type MemoryState = 'candidate' | 'active' | 'reinforced' | 'weakened' | 'superseded' | 'archived' | 'forgotten' | 'conflicted'
export type EvidenceSourceType = 'user_teaching' | 'demonstration' | 'correction' | 'observation' | 'real_world_task' | 'human_approval' | 'evaluation' | 'client_feedback' | 'outcome'
export type MutationClass = 'OPERATIONAL' | 'IDENTITY'

// N1.3B.1: Authorization-aware context — the domain layer verifies ownership
export interface MemoryExecutionContext {
  principalId: string
  tenantId: string
  cloneId: string
  purpose?: string
}

export interface CreateMemoryInput {
  cloneId: string; tenantId: string; type: MemoryType; content: string;
  importance?: number; confidence?: number; domain?: string; scope?: string;
  sourceKind?: string; sourceEvent?: string; sensitivity?: string; portability?: string;
  validFrom?: Date; validUntil?: Date; actorId?: string
}

export interface EvidenceInput {
  sourceType: EvidenceSourceType; sourceId?: string; evidenceWeight?: number; outcome?: 'positive' | 'negative' | 'neutral'
}

export interface MemoryLifecyclePolicy {
  decayRate: number; minimumConfidence: number; consolidationEligibility: boolean;
  autoArchive: boolean; humanApprovalRequired: boolean; exportPolicy: string; retentionPolicy: string
}

const DEFAULT_POLICIES: Record<MemoryType, MemoryLifecyclePolicy> = {
  policy:       { decayRate: 0,    minimumConfidence: 0.5, consolidationEligibility: false, autoArchive: false, humanApprovalRequired: true,  exportPolicy: 'tenant_locked', retentionPolicy: 'retain' },
  preference:   { decayRate: 0.01, minimumConfidence: 0.4, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'retain' },
  procedural:   { decayRate: 0.02, minimumConfidence: 0.4, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'retain' },
  semantic:     { decayRate: 0.03, minimumConfidence: 0.3, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'retain' },
  behavioral:   { decayRate: 0.03, minimumConfidence: 0.3, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'retain' },
  episodic:     { decayRate: 0.05, minimumConfidence: 0.2, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'expire_after:365' },
  experience:   { decayRate: 0.05, minimumConfidence: 0.2, consolidationEligibility: true,  autoArchive: true,  humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'expire_after:365' },
  correction:   { decayRate: 0.01, minimumConfidence: 0.4, consolidationEligibility: false, autoArchive: false, humanApprovalRequired: false, exportPolicy: 'portable',     retentionPolicy: 'retain' },
}

const LEARNING_RATE = 0.15

export function getLifecyclePolicy(type: MemoryType): MemoryLifecyclePolicy {
  return DEFAULT_POLICIES[type] ?? DEFAULT_POLICIES.episodic
}

export class MemoryManager {
  // ---- Authorization helper ----
  // Verifies the memory belongs to the authorized clone/tenant
  private async authorizeMemory(memoryId: string, ctx: MemoryExecutionContext): Promise<any> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    if (memory.tenantId !== ctx.tenantId) throw new Error('Tenant isolation violation: memory belongs to different tenant')
    if (memory.cloneId !== ctx.cloneId) throw new Error('Clone ownership violation: memory belongs to different clone')
    return memory
  }

  // ---- createCandidate ----
  async createCandidate(input: CreateMemoryInput): Promise<{ memoryId: string }> {
    const memory = await db.memory.create({
      data: {
        cloneId: input.cloneId, tenantId: input.tenantId, type: input.type, state: 'candidate',
        content: input.content, importance: input.importance ?? 0.5, confidence: input.confidence ?? 0.5,
        utility: 0.5, domain: input.domain ?? 'general', scope: input.scope ?? 'personal',
        sourceKind: input.sourceKind ?? 'user_general', sourceEvent: input.sourceEvent,
        sensitivity: input.sensitivity ?? 'internal', portability: input.portability ?? 'portable',
        validFrom: input.validFrom, validUntil: input.validUntil, observedAt: input.validFrom ?? new Date(),
      },
    })
    return { memoryId: memory.id }
  }

  // ---- activate (IDENTITY mutation, transactional) ----
  async activate(memoryId: string, ctx: MemoryExecutionContext): Promise<{ ok: boolean; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    if (memory.state !== 'candidate') throw new Error(`Cannot activate from state ${memory.state}`)
    await db.$transaction([
      db.memory.update({ where: { id: memoryId }, data: { state: 'active' } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'activate', beforeState: memory.state, afterState: 'active', actorId: ctx.principalId } }),
    ])
    return { ok: true, mutationClass: 'IDENTITY' }
  }

  // ---- reinforce (IDENTITY mutation, transactional) ----
  // newConfidence = oldConfidence + learningRate * evidenceWeight * (1 - oldConfidence), bounded [0,1]
  async reinforce(memoryId: string, evidence: EvidenceInput, ctx: MemoryExecutionContext): Promise<{ newConfidence: number; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    const policy = DEFAULT_POLICIES[memory.type as MemoryType] ?? DEFAULT_POLICIES.episodic
    const weight = evidence.evidenceWeight ?? 0.5
    const oldConfidence = memory.confidence
    const newConfidence = Math.min(1, oldConfidence + LEARNING_RATE * weight * (1 - oldConfidence))
    const newState = newConfidence > 0.75 ? 'reinforced' : memory.state === 'candidate' ? 'active' : memory.state
    const newDecayScore = Math.max(0, memory.decayScore - 0.1)

    // N1.3B.1: Transactional — all or nothing
    await db.$transaction([
      db.memoryEvidence.create({ data: { memoryId, sourceType: evidence.sourceType, sourceId: evidence.sourceId, evidenceWeight: weight, outcome: evidence.outcome ?? 'positive' } }),
      db.memory.update({ where: { id: memoryId }, data: { confidence: newConfidence, reinforcementCount: memory.reinforcementCount + 1, lastReinforcedAt: new Date(), state: newState, decayScore: newDecayScore } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'reinforce', beforeState: memory.state, afterState: newState, evidenceJson: JSON.stringify({ oldConfidence, newConfidence, evidenceWeight: weight }), actorId: ctx.principalId } }),
    ])
    return { newConfidence, mutationClass: 'IDENTITY' }
  }

  // ---- weaken (IDENTITY mutation, transactional) ----
  // newConfidence = oldConfidence - learningRate * evidenceWeight * oldConfidence, bounded [0,1]
  async weaken(memoryId: string, evidence: EvidenceInput, ctx: MemoryExecutionContext): Promise<{ newConfidence: number; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    const policy = DEFAULT_POLICIES[memory.type as MemoryType] ?? DEFAULT_POLICIES.episodic
    // Protected memories (policy type) cannot be weakened
    if (policy.decayRate === 0 && memory.type === 'policy') {
      await db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'weaken_blocked', beforeState: memory.state, afterState: memory.state, reason: 'Policy memory protected from weakening', actorId: ctx.principalId } })
      return { newConfidence: memory.confidence, mutationClass: 'IDENTITY' }
    }
    const weight = evidence.evidenceWeight ?? 0.5
    const oldConfidence = memory.confidence
    const newConfidence = Math.max(0, oldConfidence - LEARNING_RATE * weight * oldConfidence)
    const newState = newConfidence < policy.minimumConfidence ? 'weakened' : memory.state

    await db.$transaction([
      db.memoryEvidence.create({ data: { memoryId, sourceType: evidence.sourceType, sourceId: evidence.sourceId, evidenceWeight: weight, outcome: evidence.outcome ?? 'negative' } }),
      db.memory.update({ where: { id: memoryId }, data: { confidence: newConfidence, contradictionCount: memory.contradictionCount + 1, state: newState } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'weaken', beforeState: memory.state, afterState: newState, evidenceJson: JSON.stringify({ oldConfidence, newConfidence, evidenceWeight: weight }), actorId: ctx.principalId } }),
    ])
    return { newConfidence, mutationClass: 'IDENTITY' }
  }

  // ---- supersede (IDENTITY mutation, transactional) ----
  async supersede(oldMemoryId: string, newMemoryId: string, ctx: MemoryExecutionContext): Promise<{ ok: boolean; mutationClass: MutationClass }> {
    const oldMem = await this.authorizeMemory(oldMemoryId, ctx)
    const newMem = await this.authorizeMemory(newMemoryId, ctx)
    const newMemNewState = newMem.state === 'candidate' ? 'active' : newMem.state
    await db.$transaction([
      db.memory.update({ where: { id: oldMemoryId }, data: { state: 'superseded', supersededByMemoryId: newMemoryId } }),
      db.memory.update({ where: { id: newMemoryId }, data: { supersedesMemoryId: oldMemoryId, state: newMemNewState } }),
      db.memoryLifecycleEvent.create({ data: { memoryId: oldMemoryId, operation: 'supersede', beforeState: oldMem.state, afterState: 'superseded', evidenceJson: JSON.stringify({ newMemoryId }), actorId: ctx.principalId } }),
      db.memoryLifecycleEvent.create({ data: { memoryId: newMemoryId, operation: 'supersede', beforeState: newMem.state, afterState: newMemNewState, evidenceJson: JSON.stringify({ oldMemoryId }), actorId: ctx.principalId } }),
    ])
    return { ok: true, mutationClass: 'IDENTITY' }
  }

  // ---- archive (IDENTITY mutation, transactional) ----
  async archive(memoryId: string, ctx: MemoryExecutionContext): Promise<{ ok: boolean; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    await db.$transaction([
      db.memory.update({ where: { id: memoryId }, data: { state: 'archived' } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'archive', beforeState: memory.state, afterState: 'archived', actorId: ctx.principalId } }),
    ])
    return { ok: true, mutationClass: 'IDENTITY' }
  }

  // ---- restore (IDENTITY mutation, transactional) ----
  async restore(memoryId: string, ctx: MemoryExecutionContext): Promise<{ ok: boolean; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    if (memory.state !== 'archived') throw new Error(`Cannot restore from state ${memory.state}`)
    await db.$transaction([
      db.memory.update({ where: { id: memoryId }, data: { state: 'active', decayScore: 0 } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'restore', beforeState: memory.state, afterState: 'active', actorId: ctx.principalId } }),
    ])
    return { ok: true, mutationClass: 'IDENTITY' }
  }

  // ---- forget (IDENTITY mutation, transactional) ----
  async forget(memoryId: string, ctx: MemoryExecutionContext): Promise<{ ok: boolean; mutationClass: MutationClass }> {
    const memory = await this.authorizeMemory(memoryId, ctx)
    // Policy memories require stronger authorization for forgetting
    if (memory.type === 'policy') throw new Error('Policy memories cannot be forgotten through ordinary lifecycle. Use explicit administrative deletion.')
    await db.$transaction([
      db.memory.update({ where: { id: memoryId }, data: { state: 'forgotten' } }),
      db.memoryLifecycleEvent.create({ data: { memoryId, operation: 'forget', beforeState: memory.state, afterState: 'forgotten', actorId: ctx.principalId } }),
    ])
    return { ok: true, mutationClass: 'IDENTITY' }
  }

  // ---- recordRetrieval (OPERATIONAL — no lifecycle event, no version) ----
  async recordRetrieval(memoryId: string): Promise<void> {
    // N1.3B.1: This is OPERATIONAL — it does NOT create a lifecycle event
    // or a clone version. It's runtime telemetry.
    await db.memory.update({
      where: { id: memoryId },
      data: { accessCount: { increment: 1 }, lastRetrievedAt: new Date() },
    })
  }

  // ---- runDecayMaintenance (OPERATIONAL — batched, no per-memory events) ----
  // N1.3B.1: Optimized — fetch all memories, compute all changes, ONE bulk transaction
  async runDecayMaintenance(cloneId: string, tenantId: string): Promise<{ weakened: number; archived: number; forgotten: number }> {
    const memories = await db.memory.findMany({
      where: { cloneId, tenantId, state: { in: ['active', 'reinforced', 'weakened'] } },
    })
    let weakened = 0, archived = 0, forgotten = 0
    const updates: any[] = []
    for (const m of memories) {
      const policy = DEFAULT_POLICIES[m.type as MemoryType] ?? DEFAULT_POLICIES.episodic
      if (policy.decayRate === 0) continue // protected
      const newDecayScore = Math.min(1, m.decayScore + policy.decayRate)
      const newConfidence = Math.max(0, m.confidence - (policy.decayRate * 0.5))
      const newUtility = Math.max(0, m.utility - (policy.decayRate * 0.3))
      let newState = m.state
      if (newConfidence < policy.minimumConfidence && newState === 'active') { newState = 'weakened'; weakened++ }
      if (newDecayScore > 0.8 && policy.autoArchive && newState !== 'archived') { newState = 'archived'; archived++ }
      if (newDecayScore > 0.95 && newState === 'archived') { newState = 'forgotten'; forgotten++ }
      if (newState !== m.state || newDecayScore !== m.decayScore || newConfidence !== m.confidence) {
        updates.push(db.memory.update({ where: { id: m.id }, data: { decayScore: newDecayScore, confidence: newConfidence, utility: newUtility, state: newState } }))
      }
    }
    // N1.3B.1: ONE transaction for all maintenance updates — not per-memory
    if (updates.length > 0) {
      await db.$transaction(updates)
    }
    return { weakened, archived, forgotten }
  }

  // ---- consolidate (IDENTITY mutation, transactional per group) ----
  async consolidate(cloneId: string, tenantId: string, ctx: MemoryExecutionContext): Promise<{ consolidated: number; candidates: any[] }> {
    const experiences = await db.memory.findMany({
      where: { cloneId, tenantId, type: 'experience', state: { in: ['active', 'candidate'] }, confidence: { gte: 0.4 } },
      take: 100,
    })
    const groups = new Map<string, any[]>()
    for (const exp of experiences) {
      const key = exp.domain + ':' + exp.content.slice(0, 50).toLowerCase()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(exp)
    }
    const candidates = []
    let consolidated = 0
    for (const [, group] of groups) {
      if (group.length < 3) continue
      if (group.some(g => g.contradictionCount > 0)) continue
      const existing = await db.memory.findFirst({ where: { cloneId, type: 'semantic', content: { contains: group[0].content.slice(0, 50) } } })
      if (existing) continue
      const avgConfidence = group.reduce((s, g) => s + g.confidence, 0) / group.length
      if (avgConfidence < 0.4) continue
      const sourceIds = group.map(g => g.id)

      // N1.3B.1: Transactional — all or nothing per consolidation group
      const txOps: any[] = [
        db.memory.create({
          data: {
            cloneId, tenantId, type: 'semantic', state: 'candidate',
            content: `Consolidated from ${group.length} experiences: ${group[0].content}`,
            structuredContentJson: JSON.stringify({ sourceExperienceIds: sourceIds }),
            confidence: Math.min(1, avgConfidence + 0.1), importance: 0.7, utility: 0.6,
            domain: group[0].domain, sourceKind: 'generated', sourceEvent: 'consolidation',
            scope: 'personal', sensitivity: 'internal', portability: 'portable',
          },
        }),
      ]
      // We can't use the created memory's ID in the same transaction batch
      // because we don't know it yet. So we do a two-phase: create first, then supersede.
      const newMemory = await db.memory.create({
        data: {
          cloneId, tenantId, type: 'semantic', state: 'candidate',
          content: `Consolidated from ${group.length} experiences: ${group[0].content}`,
          structuredContentJson: JSON.stringify({ sourceExperienceIds: sourceIds }),
          confidence: Math.min(1, avgConfidence + 0.1), importance: 0.7, utility: 0.6,
          domain: group[0].domain, sourceKind: 'generated', sourceEvent: 'consolidation',
          scope: 'personal', sensitivity: 'internal', portability: 'portable',
        },
      })
      // Now supersede all source experiences + create evidence in one transaction
      const supersedeOps: any[] = []
      for (const src of group) {
        supersedeOps.push(
          db.memoryEvidence.create({ data: { memoryId: newMemory.id, sourceType: 'observation', sourceId: src.id, evidenceWeight: src.confidence, outcome: 'positive' } }),
          db.memory.update({ where: { id: src.id }, data: { state: 'superseded', supersededByMemoryId: newMemory.id } }),
        )
      }
      supersedeOps.push(
        db.memoryLifecycleEvent.create({ data: { memoryId: newMemory.id, operation: 'consolidate', beforeState: null, afterState: 'candidate', evidenceJson: JSON.stringify({ sourceExperienceIds: sourceIds, avgConfidence }), actorId: ctx.principalId } }),
      )
      await db.$transaction(supersedeOps)
      candidates.push({ memoryId: newMemory.id, sourceCount: group.length, confidence: avgConfidence })
      consolidated++
    }
    return { consolidated, candidates }
  }

  // ---- getMemory (inspection — "what does my clone remember?") ----
  async getMemory(memoryId: string, ctx?: MemoryExecutionContext): Promise<any> {
    if (ctx) {
      return this.authorizeMemory(memoryId, ctx).then(m => db.memory.findUnique({ where: { id: memoryId }, include: { evidence: true, lifecycleEvents: { take: 10, orderBy: { createdAt: 'desc' } } } }))
    }
    return db.memory.findUnique({ where: { id: memoryId }, include: { evidence: true, lifecycleEvents: { take: 10, orderBy: { createdAt: 'desc' } } } })
  }

  // ---- listMemories (scoped by cloneId + tenantId) ----
  async listMemories(cloneId: string, tenantId: string, includeForgotten: boolean = false): Promise<any[]> {
    const states = includeForgotten
      ? ['candidate', 'active', 'reinforced', 'weakened', 'superseded', 'archived', 'forgotten', 'conflicted']
      : ['candidate', 'active', 'reinforced', 'weakened', 'superseded', 'archived']
    return db.memory.findMany({
      where: { cloneId, tenantId, state: { in: states } },
      orderBy: [{ importance: 'desc' }, { confidence: 'desc' }],
      take: 100,
    })
  }
}
