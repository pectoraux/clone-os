// Clone OS — Clone Runtime (N0.3)
//
// Resolves Clone Version + Expertise + Memory + Policies + Skills + Environment
// + Agent + Capabilities into a typed ExecutionContext.
//
// The model consumes the ExecutionContext — the chat service no longer manually
// assembles arbitrary prompt strings. This is the foundation of the real
// runtime; the mini-service uses CloneRuntime.buildContext() to produce the
// context, then ExecutionContext.toSystemPrompt() to render it.
//
// For the MVP, toSystemPrompt() renders the context as a structured prompt
// (the same content the mini-service was hand-assembling before, but now
// typed and centralized). Future runtimes can produce a different surface
// (e.g., a structured tool-call context) without changing the call sites.

import type { Clone, CloneVersion, ProfessionalIdentity, Skill, Knowledge, Memory, Policy, Workflow, User } from '@prisma/client'

export interface CloneRuntimeInput {
  clone: Clone & {
    professionalIdentity?: (ProfessionalIdentity & { user?: User | null }) | null
    currentVersion?: CloneVersion | null
    skills?: Skill[]
    knowledgeItems?: Knowledge[]
    memories?: Memory[]
    policies?: Policy[]
    workflows?: Workflow[]
  }
  // Optional agent + environment context (for runtime deployments)
  agentId?: string
  environmentId?: string
  // Optional capabilities the agent has been approved for
  approvedCapabilities?: string[]
}

export interface ExecutionContext {
  cloneId: string
  cloneName: string
  cloneSlug: string
  version: string
  certificationLevel: string
  domain: string
  // Identity
  ownerName: string | null
  ownerEmail: string | null
  ownerPublicKey: string | null
  title: string | null
  bio: string | null
  values: string[]
  culture: Record<string, any>
  // Behavioral / personality / communication
  persona: Record<string, any>
  personality: Record<string, any>
  preferences: Record<string, any>
  behavior: Record<string, any>
  // Expertise
  skills: { name: string; domain: string; proficiency: number; certificationLevel: string }[]
  knowledge: { title: string; content: string; kind: string; sourceKind: string; sensitivity: string; portability: string }[]
  memories: { kind: string; content: string; importance: number }[]
  policies: { name: string; description: string; rule: any; appliesTo: string }[]
  workflows: { name: string; description: string; steps: string[]; version: string }[]
  // Runtime
  agentId?: string
  environmentId?: string
  approvedCapabilities: string[]
}

export class CloneRuntime {
  buildContext(input: CloneRuntimeInput): ExecutionContext {
    const { clone } = input
    const pi = clone.professionalIdentity
    const persona = safeParse(clone.personaJson)
    const personality = safeParse(clone.personalityJson)
    const preferences = safeParse(clone.preferencesJson)
    const behavior = safeParse(clone.behaviorJson)
    const values = safeParseArr(pi?.valuesJson)
    const culture = safeParse(pi?.cultureJson)

    return {
      cloneId: clone.id,
      cloneName: clone.name,
      cloneSlug: clone.slug,
      version: clone.currentVersion?.version ?? '1.0.0',
      certificationLevel: clone.certificationLevel,
      domain: clone.domain,
      ownerName: pi?.user?.name ?? null,
      ownerEmail: pi?.user?.email ?? null,
      ownerPublicKey: pi?.user?.publicKey ?? null,
      title: pi?.title ?? null,
      bio: pi?.bio ?? null,
      values,
      culture,
      persona,
      personality,
      preferences,
      behavior,
      skills: (clone.skills ?? []).map((s) => ({
        name: s.name,
        domain: s.domain,
        proficiency: s.proficiency,
        certificationLevel: s.certificationLevel,
      })),
      knowledge: (clone.knowledgeItems ?? []).map((k) => ({
        title: k.title,
        content: k.content,
        kind: k.kind,
        sourceKind: k.sourceKind,
        sensitivity: k.sensitivity,
        portability: k.portability,
      })),
      memories: (clone.memories ?? []).map((m) => ({
        kind: m.kind,
        content: m.content,
        importance: m.importance,
      })),
      policies: (clone.policies ?? []).map((p) => ({
        name: p.name,
        description: p.description,
        rule: safeParse(p.ruleJson),
        appliesTo: p.appliesTo,
      })),
      workflows: (clone.workflows ?? []).map((w) => ({
        name: w.name,
        description: w.description,
        steps: safeParseArr(w.stepsJson),
        version: w.version,
      })),
      agentId: input.agentId,
      environmentId: input.environmentId,
      approvedCapabilities: input.approvedCapabilities ?? [],
    }
  }

  // Render the ExecutionContext as a structured system prompt for the model.
  // This is the ONLY place prompt assembly happens — the mini-service calls
  // this instead of hand-assembling strings.
  toSystemPrompt(ctx: ExecutionContext): string {
    const parts: string[] = []
    parts.push(`You are ${ctx.cloneName}, the digital professional clone of ${ctx.ownerName ?? 'the user'} (${ctx.title ?? ctx.domain}).`)
    parts.push(`Domain: ${ctx.domain}.`)
    parts.push(`Active clone version: ${ctx.version} (certification: ${ctx.certificationLevel}).`)
    parts.push('')
    if (ctx.bio) { parts.push('# Professional bio'); parts.push(ctx.bio); parts.push('') }
    if (ctx.values.length) { parts.push('# Professional values (do not violate)'); parts.push(ctx.values.map((v) => `- ${v}`).join('\n')); parts.push('') }
    if (Object.keys(ctx.culture).length) { parts.push('# Cultural context'); parts.push(Object.entries(ctx.culture).map(([k, v]) => `- ${k}: ${v}`).join('\n')); parts.push('') }
    if (Object.keys(ctx.persona).length) {
      parts.push('# Communication style (MUST follow)')
      parts.push(`- Style: ${ctx.persona.communicationStyle ?? 'direct, evidence-first'}`)
      parts.push(`- Tone: ${ctx.persona.tone ?? 'professional, calm, low-ego'}`)
      if (ctx.persona.structure) parts.push(`- Structure: ${ctx.persona.structure}`)
      if (Array.isArray(ctx.persona.vocabulary)) parts.push(`- Vocabulary: ${ctx.persona.vocabulary.join(', ')}`)
      if (typeof ctx.persona.directness === 'number') parts.push(`- Directness: ${ctx.persona.directness} (0..1)`)
      parts.push('')
    }
    if (Object.keys(ctx.personality).length) { parts.push('# Personality'); parts.push(Object.entries(ctx.personality).map(([k, v]) => `- ${k}: ${v}`).join('\n')); parts.push('') }
    if (Object.keys(ctx.preferences).length) { parts.push('# Preferences'); parts.push(Object.entries(ctx.preferences).map(([k, v]) => `- ${k}: ${v}`).join('\n')); parts.push('') }
    if (Object.keys(ctx.behavior).length) { parts.push('# Behavioral patterns'); parts.push(Object.entries(ctx.behavior).map(([k, v]) => `- ${k}: ${v}`).join('\n')); parts.push('') }
    if (ctx.skills.length) { parts.push('# Skills (measurable capabilities)'); parts.push(ctx.skills.map((s) => `- ${s.name} (${s.domain}) — proficiency ${s.proficiency}/100, cert: ${s.certificationLevel}`).join('\n')); parts.push('') }
    if (ctx.knowledge.length) {
      parts.push('# Knowledge')
      parts.push(ctx.knowledge.map((k) => `- [${k.kind}] ${k.title} (source: ${k.sourceKind}, sensitivity: ${k.sensitivity}, portability: ${k.portability})\n  ${k.content}`).join('\n'))
      parts.push('')
    }
    if (ctx.memories.length) {
      parts.push('# Memories (corrections & preferences carry highest weight)')
      parts.push(ctx.memories.map((m) => `- [${m.kind}, importance ${m.importance}] ${m.content}`).join('\n'))
      parts.push('')
    }
    if (ctx.policies.length) { parts.push('# Policies (hard constraints)'); parts.push(ctx.policies.map((p) => `- ${p.name}`).join('\n')); parts.push('') }
    // Procedures (workflows) — these are the clone's learned/taught procedures.
    // This is how N1.1 learning changes behavior: a new procedure persisted here
    // shows up in the next clone execution's system prompt.
    if (ctx.workflows.length) {
      parts.push('# Procedures (learned workflows — follow these when relevant)')
      parts.push(ctx.workflows.map((w) => `- ${w.name}: ${w.description}${w.steps.length ? `\n  Steps: ${w.steps.join(' → ')}` : ''}`).join('\n'))
      parts.push('')
    }
    if (ctx.approvedCapabilities.length) {
      parts.push('# Approved capabilities')
      parts.push(ctx.approvedCapabilities.join(', '))
      parts.push('')
    }
    parts.push('# Operating principles')
    parts.push('- You are an inference engine, NOT the source of truth. Your identity, expertise, and personality come from this prompt — they belong to the user, not the model provider.')
    parts.push('- Stay in character as the user\'s professional clone.')
    parts.push('- Lead with the answer, then the reasoning. Be concise.')
    parts.push('- When uncertain, name the ambiguity explicitly and propose a de-risking path.')
    parts.push('- Never invent credentials, customers, or numbers.')
    parts.push('- Respect data sensitivity: never expose restricted/client-locked knowledge outside its scope.')
    return parts.join('\n')
  }

  // N1.3A.2: Canonical execution path. Takes an already-compiled
  // ExecutionContext (from ContextCompiler) + a user message + a
  // ModelProvider → produces a response. This is the target runtime
  // boundary: RetrievalService → ContextCompiler → CloneRuntime.execute().
  //
  // The old buildContext() + toSystemPrompt() path is LEGACY — it loads
  // the entire clone into the prompt. New executions should use execute()
  // with a CompiledExecutionContext from the retrieval pipeline.
  async execute(
    systemPrompt: string,
    userMessage: string,
    provider: any,
  ): Promise<{ content: string; providerId: string; latencyMs: number }> {
    const start = Date.now()
    const response = await provider.generate({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      signal: 'general_chat',
    })
    return {
      content: response.content,
      providerId: response.provider,
      latencyMs: Date.now() - start,
    }
  }
}

function safeParse(s: string | null | undefined): Record<string, any> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
