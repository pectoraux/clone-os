// Clone OS — Retrieval Architecture (N1.3A)
//
// The clone's persistent state is the source of truth. The LLM receives
// only the relevant subset required for the current task.
//
// Architecture:
//   Task → TaskUnderstanding → RetrievalService → PolicyFilter →
//   ContextCompiler → ExecutionContext → CloneRuntime → ModelProvider
//
// The persistent source of truth ≠ the retrieval index. Source records
// remain authoritative. Indexes can be rebuilt.
//
// See HARDENING.md (N1.3A).

import { db } from '@/lib/db'
import type { CloneStateSnapshot } from '@/lib/fidelity/snapshot'

// ---- TaskContext — the typed task representation ----
export interface TaskContext {
  intent: string
  domain: string
  environment?: string
  capabilities: string[]
  entities: string[]
  constraints: string[]
  urgency: 'low' | 'normal' | 'high' | 'critical'
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted'
  userGoal: string
  retrievalHints: string[]
}

// ---- Retrieval artifact types ----
export type ArtifactType = 'knowledge' | 'memory' | 'workflow' | 'policy' | 'skill' | 'experience' | 'preference' | 'behavior'

// ---- RetrievalCandidate ----
export interface RetrievalCandidate {
  artifactId: string
  artifactType: ArtifactType
  name: string
  content: string
  sourceKind: string
  sensitivity: string
  portability: string
  relevanceScore: number
  importance: number
  recency: number
  confidence: number
  domain: string
}

// ---- RetrievalResult ----
export interface RetrievalResult {
  candidates: RetrievalCandidate[]
  excluded: Array<RetrievalCandidate & { reason: string }>
  evidence: RetrievalEvidence[]
}

// ---- RetrievalEvidence — traceability ----
export interface RetrievalEvidence {
  artifactId: string
  artifactType: ArtifactType
  retrievalMethod: string
  relevanceScore: number
  rank: number
  retrievalPolicy: string
  contextInclusionDecision: 'included' | 'excluded'
  reason: string
}

// ---- Retriever interface — model-independent ----
export interface Retriever {
  name: string
  retrieve(query: RetrievalQuery): Promise<RetrievalCandidate[]>
}

export interface RetrievalQuery {
  task: TaskContext
  cloneId: string
  artifactTypes: ArtifactType[]
  limit: number
}

// ---- KeywordRetriever ----
export class KeywordRetriever implements Retriever {
  name = 'keyword'

  async retrieve(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    const keywords = this.extractKeywords(query.task.intent + ' ' + query.task.retrievalHints.join(' '))
    if (keywords.length === 0) return []
    const candidates: RetrievalCandidate[] = []
    for (const type of query.artifactTypes) {
      const items = await this.fetchArtifacts(query.cloneId, type)
      for (const item of items) {
        const score = this.scoreRelevance(keywords, item.content + ' ' + item.name, query.task)
        if (score > 0) candidates.push({ ...item, relevanceScore: score })
      }
    }
    return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, query.limit)
  }

  private async fetchArtifacts(cloneId: string, type: ArtifactType): Promise<RetrievalCandidate[]> {
    switch (type) {
      case 'knowledge': {
        const items = await db.knowledge.findMany({ where: { cloneId } })
        return items.map(k => ({ artifactId: k.id, artifactType: 'knowledge' as const, name: k.title, content: k.content, sourceKind: k.sourceKind, sensitivity: k.sensitivity, portability: k.portability, relevanceScore: 0, importance: 0.5, recency: 0.5, confidence: 0.8, domain: k.kind }))
      }
      case 'workflow': {
        const items = await db.workflow.findMany({ where: { cloneId } })
        return items.map(w => ({ artifactId: w.id, artifactType: 'workflow' as const, name: w.name, content: w.description + ' ' + w.stepsJson, sourceKind: 'user_general', sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: 0.7, recency: 0.5, confidence: 0.8, domain: 'procedure' }))
      }
      case 'memory': {
        const items = await db.memory.findMany({ where: { cloneId } })
        return items.map(m => ({ artifactId: m.id, artifactType: 'memory' as const, name: m.kind, content: m.content, sourceKind: 'user_general', sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: m.importance, recency: 0.5, confidence: 0.7, domain: m.kind }))
      }
      case 'policy': {
        const items = await db.policy.findMany({ where: { OR: [{ cloneId }, { cloneId: null }] } })
        return items.map(p => ({ artifactId: p.id, artifactType: 'policy' as const, name: p.name, content: p.description + ' ' + p.ruleJson, sourceKind: 'user_general', sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: 0.9, recency: 0.3, confidence: 0.9, domain: p.appliesTo }))
      }
      case 'skill': {
        const items = await db.skill.findMany({ where: { cloneId } })
        return items.map(s => ({ artifactId: s.id, artifactType: 'skill' as const, name: s.name, content: s.description || s.name, sourceKind: 'user_general', sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: s.proficiency / 100, recency: 0.5, confidence: 0.8, domain: s.domain }))
      }
      default: return []
    }
  }

  private extractKeywords(text: string): string[] {
    const stopwords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','may','might','must','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','this','that','these','those','i','you','he','she','it','we','they','my','your','his','her','its','our','their','me','him','us','them','and','or','but','not','no','if','then','else','when','where','why','how','all','any','both','each','few','more','most','other','some','such','only','same','so','than','too','very','just','about','up','down','out','off','over','under'])
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w))
  }

  private scoreRelevance(keywords: string[], content: string, task: TaskContext): number {
    const contentLower = content.toLowerCase()
    const contentWords = new Set(contentLower.split(/\s+/))
    const keywordHits = keywords.filter(k => contentWords.has(k) || contentLower.includes(k)).length
    const keywordScore = keywords.length > 0 ? keywordHits / keywords.length : 0
    const domainMatch = task.domain && contentLower.includes(task.domain.toLowerCase()) ? 0.1 : 0
    const capMatch = task.capabilities.filter(c => contentLower.includes(c.toLowerCase())).length
    const capScore = task.capabilities.length > 0 ? capMatch * 0.05 : 0
    return Math.min(1, keywordScore * 0.7 + domainMatch + capScore)
  }
}

// ---- ContextBudgetStrategy ----
export interface ContextBudgetStrategy {
  getBudget(type: ArtifactType, totalBudget: number): number
  getTokenBudget(): number
}

export class DefaultBudgetStrategy implements ContextBudgetStrategy {
  private budgets: Record<ArtifactType, number> = { policy: 15, workflow: 20, knowledge: 30, memory: 15, skill: 10, experience: 5, preference: 5, behavior: 5 }
  getBudget(type: ArtifactType, _total: number): number { return this.budgets[type] || 5 }
  getTokenBudget(): number { return 50000 }
}

// ---- RetrievalService ----
export class RetrievalService {
  private retriever: Retriever
  private budget: ContextBudgetStrategy

  constructor(retriever?: Retriever, budget?: ContextBudgetStrategy) {
    this.retriever = retriever || new KeywordRetriever()
    this.budget = budget || new DefaultBudgetStrategy()
  }

  async retrieve(task: TaskContext, cloneId: string, tenantId: string, snapshot?: CloneStateSnapshot): Promise<RetrievalResult> {
    const query: RetrievalQuery = { task, cloneId, artifactTypes: ['policy', 'workflow', 'knowledge', 'memory', 'skill'], limit: 50 }
    let candidates = await this.retriever.retrieve(query)

    // If using a snapshot, filter to snapshot artifacts
    if (snapshot) {
      const snapK = new Set(snapshot.knowledge.map(k => k.title))
      const snapW = new Set(snapshot.workflows.map(w => w.name))
      const snapM = new Set(snapshot.memories.map(m => m.content))
      candidates = candidates.filter(c => {
        if (c.artifactType === 'knowledge') return snapK.has(c.name)
        if (c.artifactType === 'workflow') return snapW.has(c.name)
        if (c.artifactType === 'memory') return snapM.has(c.content)
        return true
      })
    }

    const { included, excluded } = this.applyPolicyFilter(candidates, task)
    const budgeted = this.applyBudget(included)
    const evidence: RetrievalEvidence[] = [
      ...budgeted.map((c, i) => ({ artifactId: c.artifactId, artifactType: c.artifactType, retrievalMethod: this.retriever.name, relevanceScore: c.relevanceScore, rank: i + 1, retrievalPolicy: 'allowed', contextInclusionDecision: 'included' as const, reason: `Relevance: ${(c.relevanceScore * 100).toFixed(0)}% | ${c.artifactType}` })),
      ...excluded.map(c => ({ artifactId: c.artifactId, artifactType: c.artifactType, retrievalMethod: this.retriever.name, relevanceScore: c.relevanceScore, rank: 0, retrievalPolicy: 'denied', contextInclusionDecision: 'excluded' as const, reason: c.reason })),
    ]
    return { candidates: budgeted, excluded, evidence }
  }

  private applyPolicyFilter(candidates: RetrievalCandidate[], task: TaskContext): { included: RetrievalCandidate[]; excluded: Array<RetrievalCandidate & { reason: string }> } {
    const included: RetrievalCandidate[] = []
    const excluded: Array<RetrievalCandidate & { reason: string }> = []
    const ranks: Record<string, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }
    for (const c of candidates) {
      if (c.artifactType === 'policy') { included.push(c); continue }
      if ((ranks[task.sensitivity] ?? 1) < (ranks[c.sensitivity] ?? 1)) { excluded.push({ ...c, reason: `Sensitivity mismatch: task=${task.sensitivity}, artifact=${c.sensitivity}` }); continue }
      if (c.sourceKind === 'client_data' && !task.entities.some(e => c.content.toLowerCase().includes(e.toLowerCase()))) { excluded.push({ ...c, reason: 'Client-locked data without matching entity' }); continue }
      if (c.sourceKind === 'company_proprietary' && task.sensitivity === 'public') { excluded.push({ ...c, reason: 'Company-proprietary in public task' }); continue }
      included.push(c)
    }
    return { included, excluded }
  }

  private applyBudget(candidates: RetrievalCandidate[]): RetrievalCandidate[] {
    const byType = new Map<ArtifactType, RetrievalCandidate[]>()
    for (const c of candidates) { if (!byType.has(c.artifactType)) byType.set(c.artifactType, []); byType.get(c.artifactType)!.push(c) }
    const result: RetrievalCandidate[] = []
    for (const [type, items] of byType) result.push(...items.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, this.budget.getBudget(type, items.length)))
    return result.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }
}

// ---- ContextCompiler ----
export interface CompiledExecutionContext {
  systemPrompt: string
  evidence: RetrievalEvidence[]
  stats: { totalArtifacts: number; retrieved: number; excluded: number; byType: Record<string, number> }
}

export class ContextCompiler {
  compile(persona: { name: string; domain: string; persona: Record<string, any>; personality: Record<string, any>; preferences: Record<string, any>; behavior: Record<string, any>; values: string[]; culture: Record<string, any>; bio: string | null; title: string | null }, retrieval: RetrievalResult): CompiledExecutionContext {
    const parts: string[] = []
    parts.push(`You are ${persona.name}, the digital professional clone.`)
    parts.push(`Domain: ${persona.domain}.`)
    if (persona.bio) { parts.push('# Professional bio'); parts.push(persona.bio); parts.push('') }
    if (persona.values?.length) { parts.push('# Values (do not violate)'); parts.push(persona.values.map(v => `- ${v}`).join('\n')); parts.push('') }
    if (persona.persona && Object.keys(persona.persona).length) { parts.push('# Communication style'); parts.push(`- Style: ${persona.persona.communicationStyle ?? 'direct'}`); parts.push(`- Tone: ${persona.persona.tone ?? 'professional'}`); parts.push('') }
    if (persona.behavior && Object.keys(persona.behavior).length) { parts.push('# Behavioral patterns'); parts.push(Object.entries(persona.behavior).map(([k, v]) => `- ${k}: ${v}`).join('\n')); parts.push('') }
    const byType = new Map<string, RetrievalCandidate[]>()
    for (const c of retrieval.candidates) { if (!byType.has(c.artifactType)) byType.set(c.artifactType, []); byType.get(c.artifactType)!.push(c) }
    if (byType.has('policy')) { parts.push('# Policies (hard constraints)'); parts.push(byType.get('policy')!.map(p => `- ${p.name}`).join('\n')); parts.push('') }
    if (byType.has('workflow')) { parts.push('# Relevant procedures (retrieved)'); parts.push(byType.get('workflow')!.map(w => `- ${w.name}: ${w.content.slice(0, 200)}`).join('\n')); parts.push('') }
    if (byType.has('knowledge')) { parts.push('# Relevant knowledge (retrieved)'); parts.push(byType.get('knowledge')!.map(k => `- ${k.name}: ${k.content.slice(0, 200)}`).join('\n')); parts.push('') }
    if (byType.has('memory')) { parts.push('# Relevant memories (retrieved)'); parts.push(byType.get('memory')!.map(m => `- [${m.domain}, importance ${m.importance}] ${m.content}`).join('\n')); parts.push('') }
    parts.push('# Operating principles')
    parts.push('- You are an inference engine, NOT the source of truth.')
    parts.push('- Lead with the answer, then the reasoning.')
    const byTypeStats: Record<string, number> = {}
    for (const c of retrieval.candidates) byTypeStats[c.artifactType] = (byTypeStats[c.artifactType] || 0) + 1
    return { systemPrompt: parts.join('\n'), evidence: retrieval.evidence, stats: { totalArtifacts: retrieval.candidates.length + retrieval.excluded.length, retrieved: retrieval.candidates.length, excluded: retrieval.excluded.length, byType: byTypeStats } }
  }
}

// ---- TaskParser — builds a TaskContext from a raw user message ----
export function parseTask(message: string, domain: string = 'Revenue Operations'): TaskContext {
  const keywords = message.toLowerCase()
  const capabilities: string[] = []
  if (keywords.includes('pipeline')) capabilities.push('Pipeline Hygiene')
  if (keywords.includes('forecast')) capabilities.push('Revenue Forecasting')
  if (keywords.includes('lead') || keywords.includes('qualif')) capabilities.push('Lead Qualification')
  if (keywords.includes('crm') || keywords.includes('salesforce')) capabilities.push('CRM Management')
  const entities: string[] = []
  // Extract capitalized words as potential entity names
  const entityMatches = message.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []
  entities.push(...entityMatches.slice(0, 5))
  const urgency = keywords.includes('urgent') || keywords.includes('critical') || keywords.includes('asap') ? 'critical' : keywords.includes('important') ? 'high' : 'normal'
  const sensitivity = keywords.includes('confidential') ? 'confidential' : keywords.includes('client') ? 'restricted' : 'internal'
  return {
    intent: message, domain, capabilities, entities, constraints: [],
    urgency: urgency as any, sensitivity: sensitivity as any,
    userGoal: message, retrievalHints: keywords.split(/\s+/).filter(w => w.length > 3).slice(0, 10),
  }
}
