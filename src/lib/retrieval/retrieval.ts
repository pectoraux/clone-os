// Clone OS — Retrieval Architecture (N1.3A + N1.3A.2)
//
// N1.3A.2: Runtime Retrieval Integration & Context Integrity
//
// The clone's persistent state is the source of truth. The LLM receives
// only the relevant subset required for the current task.
//
// Architecture:
//   Task → TaskParser → RetrievalService → AuthorizationPolicy →
//   Ranking → ContextBudget → ContextCompiler → ExecutionContext →
//   CloneRuntime.execute() → ModelRouter → ModelProvider → Response
//
// The persistent source of truth ≠ the retrieval index. Source records
// remain authoritative. Indexes can be rebuilt.
//
// See HARDENING.md (N1.3A.2).

import { db } from '@/lib/db'
import { createHash } from 'crypto'
import type { CloneStateSnapshot } from '@/lib/fidelity/snapshot'

// ============================================================
// TaskContext — the typed task representation
// ============================================================
export interface TaskContext {
  intent: string
  domain: string
  environment?: string
  capabilities: string[]
  entities: string[]
  constraints: string[]
  urgency: 'low' | 'normal' | 'high' | 'critical'
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted'
  purpose: 'private_use' | 'company_internal' | 'marketplace' | 'recruitment_trial' | 'audit'
  userGoal: string
  retrievalHints: string[]
  // N1.3A.3: routing signal derived from the task
  routingSignal: 'general_chat' | 'complex_reasoning' | 'coding' | 'vision' | 'tool_use' | 'classification' | 'privacy_sensitive' | 'long_context'
}

// ============================================================
// Artifact types + stable identity
// ============================================================
export type ArtifactType = 'knowledge' | 'memory' | 'workflow' | 'policy' | 'skill' | 'experience' | 'preference' | 'behavior'

export interface RetrievalCandidate {
  artifactId: string        // stable database ID
  artifactType: ArtifactType
  name: string
  content: string
  sourceKind: string
  sensitivity: string
  portability: string
  relevanceScore: number    // 0..1
  importance: number         // 0..1
  recency: number           // 0..1
  confidence: number        // 0..1
  domain: string
  // N1.3A.2: stable identity for snapshot matching
  artifactVersion?: string
  artifactHash?: string
}

export interface RetrievalResult {
  candidates: RetrievalCandidate[]
  excluded: Array<RetrievalCandidate & { reason: string; exclusionType: 'authorization' | 'budget' }>
  evidence: RetrievalEvidence[]
  // N1.3A.3: redaction audit trail (original content NOT included)
  redactedArtifacts?: Array<{ artifactId: string; redactedContent: string; reason: string }>
}

export interface RetrievalEvidence {
  artifactId: string
  artifactType: ArtifactType
  retrievalMethod: string
  relevanceScore: number
  rank: number
  authorizationDecision: 'ALLOW' | 'DENY' | 'REDACT'
  selectionDecision: 'included' | 'excluded_by_budget' | 'excluded_by_authorization'
  estimatedTokens: number
  reason: string
}

// ============================================================
// Retriever interface — model-independent
// ============================================================
export interface Retriever {
  name: string
  retrieve(query: RetrievalQuery): Promise<RetrievalCandidate[]>
}

export interface RetrievalQuery {
  task: TaskContext
  cloneId: string
  artifactTypes: ArtifactType[]
  limit: number
  // N1.3A.2: snapshot for version-aware retrieval
  snapshot?: CloneStateSnapshot
}

// ============================================================
// KeywordRetriever — production implementation
// ============================================================
export class KeywordRetriever implements Retriever {
  name = 'keyword'

  async retrieve(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    const keywords = this.extractKeywords(query.task.intent + ' ' + query.task.retrievalHints.join(' '))
    if (keywords.length === 0) return []

    const candidates: RetrievalCandidate[] = []
    for (const type of query.artifactTypes) {
      // N1.3A.2: if a snapshot is provided, retrieve from the snapshot
      // (not the live DB) — this ensures version-aware retrieval
      if (query.snapshot) {
        const snapCandidates = this.retrieveFromSnapshot(query.snapshot, type)
        for (const item of snapCandidates) {
          const score = this.scoreRelevance(keywords, item.content + ' ' + item.name, query.task)
          if (score > 0) candidates.push({ ...item, relevanceScore: score })
        }
      } else {
        const items = await this.fetchArtifacts(query.cloneId, type)
        for (const item of items) {
          const score = this.scoreRelevance(keywords, item.content + ' ' + item.name, query.task)
          if (score > 0) candidates.push({ ...item, relevanceScore: score })
        }
      }
    }
    return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, query.limit)
  }

  // N1.3A.2: retrieve from an immutable snapshot using stable artifact IDs
  private retrieveFromSnapshot(snapshot: CloneStateSnapshot, type: ArtifactType): RetrievalCandidate[] {
    switch (type) {
      case 'knowledge':
        return snapshot.knowledge.map(k => ({
          artifactId: `snap:${snapshot.version}:k:${k.title}`, artifactType: 'knowledge' as const,
          name: k.title, content: k.content, sourceKind: k.sourceKind, sensitivity: k.sensitivity,
          portability: k.portability, relevanceScore: 0, importance: 0.5, recency: 0.5,
          confidence: 0.8, domain: k.kind, artifactVersion: snapshot.version,
        }))
      case 'workflow':
        return snapshot.workflows.map(w => ({
          artifactId: `snap:${snapshot.version}:w:${w.name}`, artifactType: 'workflow' as const,
          name: w.name, content: w.description + ' ' + w.stepsJson, sourceKind: 'user_general',
          sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: 0.7,
          recency: 0.5, confidence: 0.8, domain: 'procedure', artifactVersion: snapshot.version,
        }))
      case 'memory':
        return snapshot.memories.map(m => ({
          artifactId: `snap:${snapshot.version}:m:${m.content.slice(0, 32)}`, artifactType: 'memory' as const,
          name: m.kind, content: m.content, sourceKind: 'user_general', sensitivity: 'internal',
          portability: 'portable', relevanceScore: 0, importance: m.importance, recency: 0.5,
          confidence: 0.7, domain: m.kind, artifactVersion: snapshot.version,
        }))
      case 'policy':
        return snapshot.policies.map(p => ({
          artifactId: `snap:${snapshot.version}:p:${p.name}`, artifactType: 'policy' as const,
          name: p.name, content: p.description + ' ' + p.ruleJson, sourceKind: 'user_general',
          sensitivity: 'internal', portability: 'portable', relevanceScore: 0, importance: 0.9,
          recency: 0.3, confidence: 0.9, domain: p.appliesTo, artifactVersion: snapshot.version,
        }))
      case 'skill':
        return snapshot.skills.map(s => ({
          artifactId: `snap:${snapshot.version}:s:${s.name}`, artifactType: 'skill' as const,
          name: s.name, content: `${s.name} (${s.domain}, proficiency ${s.proficiency}%)`,
          sourceKind: 'user_general', sensitivity: 'internal', portability: 'portable',
          relevanceScore: 0, importance: s.proficiency / 100, recency: 0.5, confidence: 0.8,
          domain: s.domain, artifactVersion: snapshot.version,
        }))
      default: return []
    }
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

// ============================================================
// HybridRetriever — composition boundary for future vector/structured
// ============================================================
export class HybridRetriever implements Retriever {
  name = 'hybrid'
  private retrievers: Retriever[]
  private weights: number[]

  constructor(retrievers: Retriever[], weights?: number[]) {
    this.retrievers = retrievers
    this.weights = weights || retrievers.map(() => 1 / retrievers.length)
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    const allCandidates = new Map<string, RetrievalCandidate>()
    for (let i = 0; i < this.retrievers.length; i++) {
      const results = await this.retrievers[i].retrieve(query)
      for (const c of results) {
        const existing = allCandidates.get(c.artifactId)
        if (existing) {
          // Combine scores from multiple retrievers
          existing.relevanceScore = Math.max(existing.relevanceScore, c.relevanceScore * this.weights[i] + existing.relevanceScore * (1 - this.weights[i]))
        } else {
          allCandidates.set(c.artifactId, { ...c, relevanceScore: c.relevanceScore * this.weights[i] })
        }
      }
    }
    return Array.from(allCandidates.values()).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, query.limit)
  }
}

// ============================================================
// Token estimation — deterministic approximation (ceil(chars/4))
// ============================================================
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ============================================================
// ContextBudgetStrategy — real token budget enforcement
// ============================================================
export interface ContextBudget {
  maxTokens: number
  reservedSystemTokens: number   // persona/identity overhead
  reservedTaskTokens: number     // the user's message + scenario prompt
  remainingTokens: number        // available for retrieved artifacts
  perArtifactTypeBudget: Record<ArtifactType, number>  // max tokens per type
}

export interface ContextBudgetStrategy {
  createBudget(): ContextBudget
}

export class DefaultBudgetStrategy implements ContextBudgetStrategy {
  createBudget(): ContextBudget {
    const maxTokens = 12000 // ~48k chars — well within Claude's 200k window
    const reservedSystemTokens = 2000  // persona, identity, values, behavior
    const reservedTaskTokens = 1000    // user message / scenario prompt
    return {
      maxTokens,
      reservedSystemTokens,
      reservedTaskTokens,
      remainingTokens: maxTokens - reservedSystemTokens - reservedTaskTokens,
      perArtifactTypeBudget: {
        policy: Math.floor(9000 * 0.15),    // ~1350 tokens
        workflow: Math.floor(9000 * 0.20),  // ~1800 tokens
        knowledge: Math.floor(9000 * 0.30), // ~2700 tokens
        memory: Math.floor(9000 * 0.15),   // ~1350 tokens
        skill: Math.floor(9000 * 0.10),    // ~900 tokens
        experience: Math.floor(9000 * 0.05),
        preference: Math.floor(9000 * 0.05),
        behavior: 0,  // behavior is in the reserved system tokens
      },
    }
  }
}

// ============================================================
// RetrievalAuthorizationPolicy — explicit ALLOW/DENY/REDACT boundary
// ============================================================
export interface AuthorizationContext {
  principal?: { id: string; tenantId: string; accountStatus: string }
  tenantId: string
  cloneId: string
  task: TaskContext
  artifact: RetrievalCandidate
}

export type AuthorizationDecision = 'ALLOW' | 'DENY' | 'REDACT'

export interface RetrievalAuthorizationPolicy {
  authorize(ctx: AuthorizationContext): { decision: AuthorizationDecision; reason: string }
}

export class DefaultAuthorizationPolicy implements RetrievalAuthorizationPolicy {
  authorize(ctx: AuthorizationContext): { decision: AuthorizationDecision; reason: string } {
    const { task, artifact } = ctx
    // Always allow policies (hard constraints apply everywhere)
    if (artifact.artifactType === 'policy') return { decision: 'ALLOW', reason: 'Policies are always included as hard constraints' }

    const ranks: Record<string, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }
    const taskRank = ranks[task.sensitivity] ?? 1
    const artifactRank = ranks[artifact.sensitivity] ?? 1

    // DENY: artifact sensitivity exceeds task sensitivity
    if (taskRank < artifactRank) {
      return { decision: 'DENY', reason: `Sensitivity mismatch: task=${task.sensitivity}, artifact=${artifact.sensitivity}` }
    }

    // DENY: client-locked data without matching entity
    if (artifact.sourceKind === 'client_data' && !task.entities.some(e => artifact.content.toLowerCase().includes(e.toLowerCase()))) {
      return { decision: 'DENY', reason: 'Client-locked data without matching entity in task' }
    }

    // DENY: company-proprietary in a public marketplace task
    if (artifact.sourceKind === 'company_proprietary' && task.purpose === 'marketplace') {
      return { decision: 'DENY', reason: 'Company-proprietary data in marketplace context' }
    }

      // REDACT: restricted/confidential data in internal task — sanitized
    if ((artifact.sensitivity === 'restricted' || artifact.sensitivity === 'confidential') && task.sensitivity === 'internal') {
      return { decision: 'REDACT', reason: `${artifact.sensitivity} data redacted for internal task` }
    }

    return { decision: 'ALLOW', reason: 'Authorized for this task context' }
  }
}

// ============================================================
// ArtifactRedactor — sanitizes REDACT artifacts. The original content
// MUST NOT reach the model. Only safe metadata is preserved.
// ============================================================
export interface ArtifactRedactor {
  redact(candidate: RetrievalCandidate, reason: string): RetrievalCandidate
}

export class DefaultArtifactRedactor implements ArtifactRedactor {
  redact(candidate: RetrievalCandidate, reason: string): RetrievalCandidate {
    // Replace the content with a sanitized representation.
    // Preserve: name, artifactType, domain, importance (metadata).
    // Remove: the actual sensitive content.
    return {
      ...candidate,
      content: `[REDACTED ${candidate.sensitivity.toUpperCase()} ${candidate.sourceKind.toUpperCase()}] ${reason}`,
      // Mark as redacted so the serializer knows to use the redacted form
      name: `${candidate.name} (redacted)`,
    }
  }
}

// ============================================================
// ArtifactContextSerializer — type-specific serialization
// ============================================================
export interface ArtifactContextSerializer {
  serialize(candidate: RetrievalCandidate): string
}

export class DefaultArtifactSerializer implements ArtifactContextSerializer {
  serialize(candidate: RetrievalCandidate): string {
    switch (candidate.artifactType) {
      case 'policy':
        // Full constraint/rule representation — never truncated
        return `- [POLICY] ${candidate.name}: ${candidate.content}`

      case 'workflow':
        // Structured ordered steps — the full procedure, not first-200-chars
        // The content field contains description + stepsJson concatenated.
        // Parse out the steps if possible.
        const stepsMatch = candidate.content.match(/\[([^\]]+)\]/)
        const steps = candidate.content.includes('[') ?
          candidate.content.slice(candidate.content.indexOf('[')) : ''
        return `- [PROCEDURE] ${candidate.name}: ${candidate.content.slice(0, candidate.content.indexOf('[') > 0 ? candidate.content.indexOf('[') : 300)}${steps}`

      case 'knowledge':
        // Relevant content excerpt — up to 300 chars (not 200)
        return `- [${candidate.domain}] ${candidate.name}: ${candidate.content.slice(0, 300)}`

      case 'memory':
        // Concise memory representation — full content if short
        return `- [MEMORY, ${candidate.domain}, importance ${candidate.importance}] ${candidate.content.slice(0, 250)}`

      case 'skill':
        // Capability + proficiency + domain
        return `- [SKILL] ${candidate.name} (${candidate.domain}, proficiency ${Math.round(candidate.importance * 100)}%)`

      case 'experience':
        return `- [EXPERIENCE] ${candidate.name}: ${candidate.content.slice(0, 200)}`

      case 'preference':
        return `- [PREFERENCE] ${candidate.content.slice(0, 200)}`

      case 'behavior':
        return `- [BEHAVIOR] ${candidate.content.slice(0, 200)}`

      default:
        return `- ${candidate.name}: ${candidate.content.slice(0, 200)}`
    }
  }
}

// ============================================================
// RetrievalService — orchestrates retrieval + authorization + budget
// ============================================================
export class RetrievalService {
  private retriever: Retriever
  private budgetStrategy: ContextBudgetStrategy
  private authPolicy: RetrievalAuthorizationPolicy
  private serializer: ArtifactContextSerializer
  private redactor: ArtifactRedactor

  constructor(
    retriever?: Retriever,
    budgetStrategy?: ContextBudgetStrategy,
    authPolicy?: RetrievalAuthorizationPolicy,
    serializer?: ArtifactContextSerializer,
    redactor?: ArtifactRedactor,
  ) {
    this.retriever = retriever || new KeywordRetriever()
    this.budgetStrategy = budgetStrategy || new DefaultBudgetStrategy()
    this.authPolicy = authPolicy || new DefaultAuthorizationPolicy()
    this.serializer = serializer || new DefaultArtifactSerializer()
    this.redactor = redactor || new DefaultArtifactRedactor()
  }

  async retrieve(
    task: TaskContext,
    cloneId: string,
    tenantId: string,
    snapshot?: CloneStateSnapshot,
  ): Promise<RetrievalResult> {
    const query: RetrievalQuery = {
      task, cloneId, artifactTypes: ['policy', 'workflow', 'knowledge', 'memory', 'skill'],
      limit: 50, snapshot,
    }

    // Step 1: Retrieve candidates
    let candidates = await this.retriever.retrieve(query)

    // Step 2: Authorization / Policy filter (ALLOW/DENY/REDACT)
    // N1.3A.3: REDACT now actually redacts — the original content
    // is replaced with a sanitized representation. The original
    // content MUST NOT reach the model.
    const authorized: RetrievalCandidate[] = []
    const deniedByAuth: Array<RetrievalCandidate & { reason: string; exclusionType: 'authorization' }> = []
    const redactedArtifacts: Array<{ artifactId: string; originalContent: string; redactedContent: string; reason: string }> = []
    for (const c of candidates) {
      const authResult = this.authPolicy.authorize({ tenantId, cloneId, task, artifact: c })
      if (authResult.decision === 'DENY') {
        deniedByAuth.push({ ...c, reason: authResult.reason, exclusionType: 'authorization' })
      } else if (authResult.decision === 'REDACT') {
        // N1.3A.3: actually redact — replace content with sanitized form
        const redacted = this.redactor.redact(c, authResult.reason)
        redactedArtifacts.push({
          artifactId: c.artifactId,
          originalContent: c.content, // stored for audit only, NOT sent to model
          redactedContent: redacted.content,
          reason: authResult.reason,
        })
        authorized.push(redacted) // push the REDACTED version, not the original
      } else {
        authorized.push(c)
      }
    }

    // Step 3: Token budget enforcement (greedy selection by relevance)
    const budget = this.budgetStrategy.createBudget()
    const tokensByType: Record<string, number> = {}
    const selected: RetrievalCandidate[] = []
    const deniedByBudget: Array<RetrievalCandidate & { reason: string; exclusionType: 'budget' }> = []
    let totalArtifactTokens = 0

    for (const c of authorized) {
      const serialized = this.serializer.serialize(c)
      const tokens = estimateTokens(serialized)
      const typeBudget = budget.perArtifactTypeBudget[c.artifactType] || 0
      const typeUsed = tokensByType[c.artifactType] || 0

      if (totalArtifactTokens + tokens > budget.remainingTokens) {
        deniedByBudget.push({ ...c, reason: `Excluded by budget: ${tokens} tokens would exceed remaining ${budget.remainingTokens - totalArtifactTokens}`, exclusionType: 'budget' })
        continue
      }
      if (typeUsed + tokens > typeBudget) {
        deniedByBudget.push({ ...c, reason: `Excluded by ${c.artifactType} type budget: ${typeUsed + tokens} > ${typeBudget}`, exclusionType: 'budget' })
        continue
      }

      tokensByType[c.artifactType] = typeUsed + tokens
      totalArtifactTokens += tokens
      selected.push(c)
    }

    // Step 4: Build evidence
    const evidence: RetrievalEvidence[] = [
      ...selected.map((c, i) => ({
        artifactId: c.artifactId, artifactType: c.artifactType,
        retrievalMethod: this.retriever.name, relevanceScore: c.relevanceScore,
        rank: i + 1, authorizationDecision: 'ALLOW' as const,
        selectionDecision: 'included' as const,
        estimatedTokens: estimateTokens(this.serializer.serialize(c)),
        reason: `Relevance: ${(c.relevanceScore * 100).toFixed(0)}% | ${c.artifactType} | ${estimateTokens(this.serializer.serialize(c))} tokens`,
      })),
      ...deniedByAuth.map(c => ({
        artifactId: c.artifactId, artifactType: c.artifactType,
        retrievalMethod: this.retriever.name, relevanceScore: c.relevanceScore,
        rank: 0, authorizationDecision: 'DENY' as const,
        selectionDecision: 'excluded_by_authorization' as const,
        estimatedTokens: 0, reason: c.reason,
      })),
      ...deniedByBudget.map(c => ({
        artifactId: c.artifactId, artifactType: c.artifactType,
        retrievalMethod: this.retriever.name, relevanceScore: c.relevanceScore,
        rank: 0, authorizationDecision: 'ALLOW' as const,
        selectionDecision: 'excluded_by_budget' as const,
        estimatedTokens: estimateTokens(this.serializer.serialize(c)),
        reason: c.reason,
      })),
    ]

    return {
      candidates: selected,
      excluded: [...deniedByAuth, ...deniedByBudget],
      evidence,
      // N1.3A.3: redaction audit trail (original content NOT included — only the fact of redaction)
      redactedArtifacts: redactedArtifacts.map(r => ({
        artifactId: r.artifactId,
        redactedContent: r.redactedContent,
        reason: r.reason,
        // Original content is NOT included in the return value — it must not
        // be accidentally logged or sent to the client.
      })),
    }
  }

  getSerializer(): ArtifactContextSerializer {
    return this.serializer
  }

  getRedactor(): ArtifactRedactor {
    return this.redactor
  }

  getBudget(): ContextBudget {
    return this.budgetStrategy.createBudget()
  }
}

// ============================================================
// ContextCompiler — builds bounded ExecutionContext from retrieval
// ============================================================
export interface CompiledExecutionContext {
  systemPrompt: string
  retrievalEvidence: RetrievalEvidence[]
  selectedArtifacts: Array<{ artifactId: string; type: ArtifactType; name: string }>
  excludedArtifacts: Array<{ artifactId: string; type: ArtifactType; name: string; reason: string }>
  estimatedTokens: number
  budget: ContextBudget
  cloneVersionId?: string
  contextHash: string
}

// N1.3A.3: ProfessionalSelf — the complete identity dimensions that
// are ALWAYS included in the context (not retrieved, not budget-limited).
// These represent the professional's core self — retrieval must never erase them.
export interface ProfessionalSelf {
  name: string
  domain: string
  // Always-on identity dimensions
  persona: Record<string, any>           // communication style, tone, vocabulary, structure
  personality: Record<string, any>        // Big Five facets, risk tolerance, pace
  preferences: Record<string, any>       // forecasting, pipeline, outreach, reporting
  behavior: Record<string, any>          // default behavior, under pressure, on conflict
  values: string[]                        // professional values (do not violate)
  culture: Record<string, any>           // professional, organizational, social, contextual
  bio: string | null
  title: string | null
}

export class ContextCompiler {
  compile(
    self: ProfessionalSelf,
    retrieval: RetrievalResult,
    serializer: ArtifactContextSerializer,
    budget: ContextBudget,
    cloneVersionId?: string,
  ): CompiledExecutionContext {
    const parts: string[] = []

    // === ALWAYS-ON CORE IDENTITY (reserved system tokens) ===
    // N1.3A.3: The complete professional self is always included.
    // Retrieval must never erase personality, preferences, or culture.
    parts.push(`You are ${self.name}, the digital professional clone.`)
    parts.push(`Domain: ${self.domain}.`)
    if (self.bio) { parts.push('# Professional bio'); parts.push(self.bio); parts.push('') }
    if (self.values?.length) { parts.push('# Professional values (do not violate)'); parts.push(self.values.map(v => `- ${v}`).join('\n')); parts.push('') }
    // N1.3A.3: Culture — was missing before
    if (self.culture && Object.keys(self.culture).length) {
      parts.push('# Cultural context')
      parts.push(Object.entries(self.culture).map(([k, v]) => `- ${k}: ${v}`).join('\n'))
      parts.push('')
    }
    // Communication style (persona)
    if (self.persona && Object.keys(self.persona).length) {
      parts.push('# Communication style')
      parts.push(`- Style: ${self.persona.communicationStyle ?? 'direct'}`)
      parts.push(`- Tone: ${self.persona.tone ?? 'professional'}`)
      if (self.persona.structure) parts.push(`- Structure: ${self.persona.structure}`)
      parts.push('')
    }
    // N1.3A.3: Personality — was missing before
    if (self.personality && Object.keys(self.personality).length) {
      parts.push('# Personality')
      parts.push(Object.entries(self.personality).map(([k, v]) => `- ${k}: ${v}`).join('\n'))
      parts.push('')
    }
    // N1.3A.3: Preferences — was missing before (partially in retrieved, but core preferences are always-on)
    if (self.preferences && Object.keys(self.preferences).length) {
      parts.push('# Core preferences')
      parts.push(Object.entries(self.preferences).map(([k, v]) => `- ${k}: ${v}`).join('\n'))
      parts.push('')
    }
    // Behavioral patterns
    if (self.behavior && Object.keys(self.behavior).length) {
      parts.push('# Behavioral patterns')
      parts.push(Object.entries(self.behavior).map(([k, v]) => `- ${k}: ${v}`).join('\n'))
      parts.push('')
    }

    // === RETRIEVED PROFESSIONAL STATE (budget-limited) ===
    const byType = new Map<string, RetrievalCandidate[]>()
    for (const c of retrieval.candidates) { if (!byType.has(c.artifactType)) byType.set(c.artifactType, []); byType.get(c.artifactType)!.push(c) }

    if (byType.has('policy')) { parts.push('# Policies (hard constraints)'); parts.push(byType.get('policy')!.map(p => serializer.serialize(p)).join('\n')); parts.push('') }
    if (byType.has('workflow')) { parts.push('# Relevant procedures (retrieved)'); parts.push(byType.get('workflow')!.map(w => serializer.serialize(w)).join('\n')); parts.push('') }
    if (byType.has('knowledge')) { parts.push('# Relevant knowledge (retrieved)'); parts.push(byType.get('knowledge')!.map(k => serializer.serialize(k)).join('\n')); parts.push('') }
    if (byType.has('memory')) { parts.push('# Relevant memories (retrieved)'); parts.push(byType.get('memory')!.map(m => serializer.serialize(m)).join('\n')); parts.push('') }
    if (byType.has('skill')) { parts.push('# Relevant skills (retrieved)'); parts.push(byType.get('skill')!.map(s => serializer.serialize(s)).join('\n')); parts.push('') }

    parts.push('# Operating principles')
    parts.push('- You are an inference engine, NOT the source of truth.')
    parts.push('- Lead with the answer, then the reasoning.')
    parts.push('- Respect data sensitivity.')

    const systemPrompt = parts.join('\n')
    const estimatedTokens = estimateTokens(systemPrompt)

    // N1.3A.3: Budget integrity — verify total ≤ maxTokens
    const budgetExceeded = estimatedTokens > budget.maxTokens

    // Context hash — SHA-256 of the COMPLETE compiled context
    // (identity + personality + culture + retrieved artifacts + policies)
    const contextHash = createHash('sha256').update(systemPrompt).digest('hex')

    return {
      systemPrompt,
      retrievalEvidence: retrieval.evidence,
      selectedArtifacts: retrieval.candidates.map(c => ({ artifactId: c.artifactId, type: c.artifactType, name: c.name })),
      excludedArtifacts: retrieval.excluded.map(c => ({ artifactId: c.artifactId, type: c.artifactType, name: c.name, reason: c.reason })),
      estimatedTokens,
      budget,
      cloneVersionId,
      contextHash,
    }
  }
}

// ============================================================
// TaskParser — builds a TaskContext from a raw user message
// ============================================================
export function parseTask(message: string, domain: string = 'Revenue Operations', cloneVersionId?: string): TaskContext {
  const keywords = message.toLowerCase()
  const capabilities: string[] = []
  if (keywords.includes('pipeline')) capabilities.push('Pipeline Hygiene')
  if (keywords.includes('forecast')) capabilities.push('Revenue Forecasting')
  if (keywords.includes('lead') || keywords.includes('qualif')) capabilities.push('Lead Qualification')
  if (keywords.includes('crm') || keywords.includes('salesforce')) capabilities.push('CRM Management')
  if (keywords.includes('review') || keywords.includes('assess')) capabilities.push('Pipeline Hygiene')
  const entities: string[] = []
  const entityMatches = message.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []
  entities.push(...entityMatches.slice(0, 5))
  const urgency = keywords.includes('urgent') || keywords.includes('critical') || keywords.includes('asap') ? 'critical' : keywords.includes('important') ? 'high' : 'normal'
  const sensitivity = keywords.includes('confidential') ? 'confidential' : keywords.includes('client') ? 'restricted' : 'internal'
  const purpose = keywords.includes('marketplace') ? 'marketplace' : keywords.includes('recruit') ? 'recruitment_trial' : keywords.includes('audit') ? 'audit' : 'private_use'
  // N1.3A.3: routing signal derived from the task
  let routingSignal: TaskContext['routingSignal'] = 'general_chat'
  if (keywords.includes('analyz') || keywords.includes('complex') || keywords.includes('reason') || keywords.includes('strategy')) routingSignal = 'complex_reasoning'
  if (keywords.includes('code') || keywords.includes('debug') || keywords.includes('refactor')) routingSignal = 'coding'
  if (keywords.includes('image') || keywords.includes('screenshot') || keywords.includes('photo')) routingSignal = 'vision'
  if (keywords.includes('update') || keywords.includes('send') || keywords.includes('crm') || keywords.includes('email')) routingSignal = 'tool_use'
  if (keywords.includes('classify') || keywords.includes('categor') || keywords.includes('tag')) routingSignal = 'classification'
  if (keywords.includes('confidential') || keywords.includes('private') || keywords.includes('sensitive')) routingSignal = 'privacy_sensitive'
  if (message.length > 5000) routingSignal = 'long_context'
  return {
    intent: message, domain, capabilities, entities, constraints: [],
    urgency: urgency as any, sensitivity: sensitivity as any, purpose: purpose as any,
    userGoal: message, retrievalHints: keywords.split(/\s+/).filter(w => w.length > 3).slice(0, 10),
    routingSignal,
  }
}
