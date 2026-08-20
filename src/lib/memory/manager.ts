// Clone OS — Memory Manager (N1.3B)
//
// The clone's persistent memory is a governed, evidence-backed, time-aware
// component of the professional self — not merely a content blob.
//
// Lifecycle: OBSERVE → CAPTURE → CLASSIFY → EXTRACT → SCORE → STORE →
// RETRIEVE → REINFORCE/WEAKEN → CONSOLIDATE → SUPERSEDE → ARCHIVE → FORGET
//
// The LLM may propose what the clone should remember, but persistent
// memory changes are governed by evidence, lifecycle policy, provenance,
// authorization, and versioning — not by the model's assertion alone.

import { db } from '@/lib/db'

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'preference' | 'policy' | 'behavioral' | 'experience' | 'correction'
export type MemoryState = 'candidate' | 'active' | 'reinforced' | 'weakened' | 'superseded' | 'archived' | 'forgotten' | 'conflicted'
export type EvidenceSourceType = 'user_teaching' | 'demonstration' | 'correction' | 'observation' | 'real_world_task' | 'human_approval' | 'evaluation' | 'client_feedback' | 'outcome'

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
    await this.emitEvent(memory.id, memory.tenantId, memory.cloneId, 'create_candidate', null, 'candidate', { input, actorId: input.actorId })
    return { memoryId: memory.id }
  }

  async activate(memoryId: string, actorId?: string): Promise<{ ok: boolean }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    if (memory.state !== 'candidate') throw new Error(`Cannot activate from state ${memory.state}`)
    await db.memory.update({ where: { id: memoryId }, data: { state: 'active' } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'activate', memory.state, 'active', { actorId })
    return { ok: true }
  }

  // newConfidence = oldConfidence + learningRate * evidenceWeight * (1 - oldConfidence), bounded [0,1]
  async reinforce(memoryId: string, evidence: EvidenceInput, actorId?: string): Promise<{ newConfidence: number }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    const weight = evidence.evidenceWeight ?? 0.5
    const oldConfidence = memory.confidence
    const newConfidence = Math.min(1, oldConfidence + LEARNING_RATE * weight * (1 - oldConfidence))
    await db.memoryEvidence.create({ data: { memoryId, sourceType: evidence.sourceType, sourceId: evidence.sourceId, evidenceWeight: weight, outcome: evidence.outcome ?? 'positive' } })
    const newState = newConfidence > 0.75 ? 'reinforced' : memory.state === 'candidate' ? 'active' : memory.state
    await db.memory.update({ where: { id: memoryId }, data: { confidence: newConfidence, reinforcementCount: memory.reinforcementCount + 1, lastReinforcedAt: new Date(), state: newState, decayScore: Math.max(0, memory.decayScore - 0.1) } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'reinforce', memory.state, newState, { evidence, oldConfidence, newConfidence, actorId })
    return { newConfidence }
  }

  // newConfidence = oldConfidence - learningRate * evidenceWeight * oldConfidence, bounded [0,1]
  async weaken(memoryId: string, evidence: EvidenceInput, actorId?: string): Promise<{ newConfidence: number }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    const policy = DEFAULT_POLICIES[memory.type as MemoryType] ?? DEFAULT_POLICIES.episodic
    if (policy.decayRate === 0 && memory.type === 'policy') {
      await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'weaken_blocked', memory.state, memory.state, { reason: 'Policy memory protected from weakening', actorId })
      return { newConfidence: memory.confidence }
    }
    const weight = evidence.evidenceWeight ?? 0.5
    const oldConfidence = memory.confidence
    const newConfidence = Math.max(0, oldConfidence - LEARNING_RATE * weight * oldConfidence)
    await db.memoryEvidence.create({ data: { memoryId, sourceType: evidence.sourceType, sourceId: evidence.sourceId, evidenceWeight: weight, outcome: evidence.outcome ?? 'negative' } })
    const newState = newConfidence < policy.minimumConfidence ? 'weakened' : memory.state
    await db.memory.update({ where: { id: memoryId }, data: { confidence: newConfidence, contradictionCount: memory.contradictionCount + 1, state: newState } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'weaken', memory.state, newState, { evidence, oldConfidence, newConfidence, actorId })
    return { newConfidence }
  }

  async supersede(oldMemoryId: string, newMemoryId: string, actorId?: string): Promise<{ ok: boolean }> {
    const oldMem = await db.memory.findUnique({ where: { id: oldMemoryId } })
    const newMem = await db.memory.findUnique({ where: { id: newMemoryId } })
    if (!oldMem || !newMem) throw new Error('Memory not found')
    await db.memory.update({ where: { id: oldMemoryId }, data: { state: 'superseded', supersededByMemoryId: newMemoryId } })
    await db.memory.update({ where: { id: newMemoryId }, data: { supersedesMemoryId: oldMemoryId, state: newMem.state === 'candidate' ? 'active' : newMem.state } })
    await this.emitEvent(oldMemoryId, oldMem.tenantId, oldMem.cloneId, 'supersede', oldMem.state, 'superseded', { newMemoryId, actorId })
    await this.emitEvent(newMemoryId, newMem.tenantId, newMem.cloneId, 'supersede', newMem.state, 'active', { oldMemoryId, actorId })
    return { ok: true }
  }

  async archive(memoryId: string, actorId?: string): Promise<{ ok: boolean }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    await db.memory.update({ where: { id: memoryId }, data: { state: 'archived' } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'archive', memory.state, 'archived', { actorId })
    return { ok: true }
  }

  async restore(memoryId: string, actorId?: string): Promise<{ ok: boolean }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    if (memory.state !== 'archived') throw new Error(`Cannot restore from state ${memory.state}`)
    await db.memory.update({ where: { id: memoryId }, data: { state: 'active', decayScore: 0 } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'restore', memory.state, 'active', { actorId })
    return { ok: true }
  }

  async forget(memoryId: string, actorId?: string): Promise<{ ok: boolean }> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) throw new Error('Memory not found')
    await db.memory.update({ where: { id: memoryId }, data: { state: 'forgotten' } })
    await this.emitEvent(memoryId, memory.tenantId, memory.cloneId, 'forget', memory.state, 'forgotten', { actorId })
    return { ok: true }
  }

  async recordRetrieval(memoryId: string): Promise<void> {
    const memory = await db.memory.findUnique({ where: { id: memoryId } })
    if (!memory) return
    await db.memory.update({ where: { id: memoryId }, data: { accessCount: memory.accessCount + 1, lastRetrievedAt: new Date() } })
  }

  async runDecayMaintenance(cloneId: string): Promise<{ weakened: number; archived: number; forgotten: number }> {
    const memories = await db.memory.findMany({ where: { cloneId, state: { in: ['active', 'reinforced', 'weakened'] } } })
    let weakened = 0, archived = 0, forgotten = 0
    for (const m of memories) {
      const policy = DEFAULT_POLICIES[m.type as MemoryType] ?? DEFAULT_POLICIES.episodic
      if (policy.decayRate === 0) continue
      const newDecayScore = Math.min(1, m.decayScore + policy.decayRate)
      const newConfidence = Math.max(0, m.confidence - (policy.decayRate * 0.5))
      const newUtility = Math.max(0, m.utility - (policy.decayRate * 0.3))
      let newState = m.state
      if (newConfidence < policy.minimumConfidence && newState === 'active') { newState = 'weakened'; weakened++ }
      if (newDecayScore > 0.8 && policy.autoArchive && newState !== 'archived') { newState = 'archived'; archived++ }
      if (newDecayScore > 0.95 && newState === 'archived') { newState = 'forgotten'; forgotten++ }
      if (newState !== m.state || newDecayScore !== m.decayScore || newConfidence !== m.confidence) {
        const beforeState = m.state
        await db.memory.update({ where: { id: m.id }, data: { decayScore: newDecayScore, confidence: newConfidence, utility: newUtility, state: newState } })
        await this.emitEvent(m.id, m.tenantId, m.cloneId, 'decay', beforeState, newState, { newDecayScore, newConfidence, newUtility })
      }
    }
    return { weakened, archived, forgotten }
  }

  // Consolidation: 3+ independent supporting experiences + minimum confidence + no unresolved contradiction
  async consolidate(cloneId: string, tenantId: string, actorId?: string): Promise<{ consolidated: number; candidates: any[] }> {
    const experiences = await db.memory.findMany({ where: { cloneId, type: 'experience', state: { in: ['active', 'candidate'] }, confidence: { gte: 0.4 } }, take: 100 })
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
      for (const src of group) {
        await db.memoryEvidence.create({ data: { memoryId: newMemory.id, sourceType: 'observation', sourceId: src.id, evidenceWeight: src.confidence, outcome: 'positive' } })
        await db.memory.update({ where: { id: src.id }, data: { state: 'superseded', supersededByMemoryId: newMemory.id } })
        await this.emitEvent(src.id, src.tenantId, src.cloneId, 'consolidate', src.state, 'superseded', { consolidatedInto: newMemory.id })
      }
      await this.emitEvent(newMemory.id, tenantId, cloneId, 'consolidate', null, 'candidate', { sourceExperienceIds: sourceIds, avgConfidence, actorId })
      candidates.push({ memoryId: newMemory.id, sourceCount: group.length, confidence: avgConfidence })
      consolidated++
    }
    return { consolidated, candidates }
  }

  async getMemory(memoryId: string): Promise<any> {
    return db.memory.findUnique({ where: { id: memoryId }, include: { evidence: true, lifecycleEvents: { take: 10, orderBy: { createdAt: 'desc' } } } })
  }

  async listMemories(cloneId: string, includeForgotten: boolean = false): Promise<any[]> {
    const states = includeForgotten ? ['candidate', 'active', 'reinforced', 'weakened', 'superseded', 'archived', 'forgotten', 'conflicted'] : ['candidate', 'active', 'reinforced', 'weakened', 'superseded', 'archived']
    return db.memory.findMany({ where: { cloneId, state: { in: states } }, orderBy: [{ importance: 'desc' }, { confidence: 'desc' }], take: 100 })
  }

  private async emitEvent(memoryId: string, tenantId: string, cloneId: string, operation: string, beforeState: string | null, afterState: string, details: Record<string, unknown>): Promise<void> {
    await db.memoryLifecycleEvent.create({ data: { memoryId, operation, beforeState, afterState, evidenceJson: JSON.stringify(details), reason: (details.reason as string) || null, actorId: (details.actorId as string) || null } })
    // Use createMany for the domain event to avoid extra queries
    const eventType = `Memory${operation.charAt(0).toUpperCase() + operation.slice(1)}`
    await db.domainEvent.create({ data: { tenantId, cloneId, type: eventType, payloadJson: JSON.stringify({ memoryId, operation, beforeState, afterState }) } as any }).catch(() => {})
  }
}
