// Clone OS — Model Provider SPI (N0.4)
//
// The LLM is an inference engine. The Clone is the source of truth.
//
// This is the real ModelProvider interface + adapters. The rest of the
// platform depends only on the interface — adapters implement it.
// ModelRouter selects a provider per request based on routing signals.
//
// For the MVP, only ZAIProvider is operational. ClaudeProvider/OpenAIProvider/
// GeminiProvider/LocalProvider are stubs that throw NOT_IMPLEMENTED — they
// exist to make the architecture real and to make it trivial to add real
// adapters later without changing the call sites.

export interface ModelProvider {
  id: string
  label: string
  vendor: string
  // The runtime contract — every adapter implements these.
  generate(req: ModelRequest): Promise<ModelResponse>
  stream?(req: ModelRequest): AsyncIterable<ModelChunk>
  embed?(text: string): Promise<number[]>
  supports(signal: RoutingSignal): boolean
  metadata(): ModelMetadata
}

export interface ModelRequest {
  // The assembled context (system prompt + history + user message).
  messages: { role: 'assistant' | 'user'; content: string }[]
  // Optional routing signal hint
  signal?: RoutingSignal
  // Optional temperature / max_tokens
  temperature?: number
  maxTokens?: number
  // Request context for audit (requestId, principalId, cloneId)
  requestId?: string
  principalId?: string
  cloneId?: string
}

export interface ModelResponse {
  content: string
  // Provider-specific metadata for observability (ADR-0041)
  provider: string
  model: string
  latencyMs: number
  // Token usage if available
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

export interface ModelChunk {
  content: string
  done: boolean
}

export interface ModelMetadata {
  quality: number
  latencyMs: number
  costPer1kTokens: number
  privacy: 'cloud' | 'sandbox' | 'local'
  capabilities: ('text' | 'vision' | 'code' | 'audio' | 'embedding' | 'tool_use')[]
  contextWindow: number
  availability: number
}

export type RoutingSignal =
  | 'complex_reasoning'
  | 'vision'
  | 'coding'
  | 'classification'
  | 'privacy_sensitive'
  | 'long_context'
  | 'tool_use'
  | 'general_chat'

// ---- ZAIProvider — the only operational adapter ----
// This wraps the z-ai-web-dev-sdk behind the ModelProvider interface so the
// rest of the platform never imports the SDK directly.
export class ZAIProvider implements ModelProvider {
  id = 'claude' as const  // ZAI currently routes to Claude under the hood
  label = 'Claude (via Z.ai)'
  vendor = 'Z.ai'
  private zai: any = null

  async generate(req: ModelRequest): Promise<ModelResponse> {
    const zai = await this.getZai()
    const start = Date.now()
    const completion = await zai.chat.completions.create({
      messages: req.messages,
      thinking: { type: 'disabled' },
    })
    const content = completion?.choices?.[0]?.message?.content ?? '(no response)'
    return {
      content,
      provider: this.id,
      model: 'claude-via-zai',
      latencyMs: Date.now() - start,
      usage: completion?.usage,
    }
  }

  supports(signal: RoutingSignal): boolean {
    // ZAI/Claude supports complex reasoning, tool use, general chat
    return ['complex_reasoning', 'tool_use', 'general_chat', 'coding'].includes(signal)
  }

  metadata(): ModelMetadata {
    return {
      quality: 0.94,
      latencyMs: 1400,
      costPer1kTokens: 0.009,
      privacy: 'cloud',
      capabilities: ['text', 'vision', 'code', 'tool_use'],
      contextWindow: 200_000,
      availability: 0.995,
    }
  }

  private async getZai() {
    if (!this.zai) {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      this.zai = await ZAI.create()
    }
    return this.zai
  }
}

// ---- Stub adapters — exist to make the architecture real ----
// These throw NOT_IMPLEMENTED when invoked. They declare their capabilities
// and metadata so the ModelRouter can reason about them, but they don't yet
// have SDK wiring. Adding a real adapter is a localized change: implement
// generate() and you're done — no call site changes.

export class OpenAIProvider implements ModelProvider {
  id = 'gpt' as const
  label = 'GPT (Turbo)'
  vendor = 'OpenAI'
  async generate(_req: ModelRequest): Promise<ModelResponse> {
    throw new Error('NOT_IMPLEMENTED: OpenAIProvider — add real SDK wiring (see HARDENING.md N0.4)')
  }
  supports(signal: RoutingSignal): boolean {
    return ['general_chat', 'tool_use', 'coding'].includes(signal)
  }
  metadata(): ModelMetadata {
    return { quality: 0.9, latencyMs: 900, costPer1kTokens: 0.0065, privacy: 'cloud', capabilities: ['text', 'vision', 'code', 'tool_use'], contextWindow: 128_000, availability: 0.992 }
  }
}

export class GeminiProvider implements ModelProvider {
  id = 'gemini' as const
  label = 'Gemini (Pro)'
  vendor = 'Google'
  async generate(_req: ModelRequest): Promise<ModelResponse> {
    throw new Error('NOT_IMPLEMENTED: GeminiProvider — add real SDK wiring (see HARDENING.md N0.4)')
  }
  supports(signal: RoutingSignal): boolean {
    return ['vision', 'long_context', 'general_chat'].includes(signal)
  }
  metadata(): ModelMetadata {
    return { quality: 0.88, latencyMs: 1100, costPer1kTokens: 0.005, privacy: 'cloud', capabilities: ['text', 'vision', 'audio', 'code'], contextWindow: 1_000_000, availability: 0.99 }
  }
}

export class LocalProvider implements ModelProvider {
  id = 'local' as const
  label = 'Local Model (On-Prem)'
  vendor = 'Self-Hosted'
  async generate(_req: ModelRequest): Promise<ModelResponse> {
    throw new Error('NOT_IMPLEMENTED: LocalProvider — add real SDK wiring (see HARDENING.md N0.4)')
  }
  supports(signal: RoutingSignal): boolean {
    return ['privacy_sensitive', 'general_chat', 'classification'].includes(signal)
  }
  metadata(): ModelMetadata {
    return { quality: 0.7, latencyMs: 400, costPer1kTokens: 0.0, privacy: 'local', capabilities: ['text'], contextWindow: 16_000, availability: 0.999 }
  }
}

// ---- Model Router ----
// Selects a provider per request based on the routing signal. Falls back to
// ZAIProvider (the only operational adapter) for now — but the routing logic
// is real and observable.

const ROUTING_RULES: Record<RoutingSignal, string> = {
  complex_reasoning: 'claude',
  vision: 'gemini',
  coding: 'gpt',
  classification: 'local',
  privacy_sensitive: 'local',
  long_context: 'gemini',
  tool_use: 'claude',
  general_chat: 'gpt',
}

export class ModelRouter {
  private providers: Map<string, ModelProvider> = new Map()
  private fallback: ModelProvider

  constructor(providers: ModelProvider[] = [new ZAIProvider(), new OpenAIProvider(), new GeminiProvider(), new LocalProvider()]) {
    for (const p of providers) this.providers.set(p.id, p)
    this.fallback = providers[0] // ZAIProvider is the operational fallback
  }

  // Select a provider for a routing signal. If the preferred provider is a
  // stub (throws NOT_IMPLEMENTED), fall back to the operational ZAIProvider
  // and record the fallback in the routing decision for observability.
  select(signal: RoutingSignal): { provider: ModelProvider; preferredId: string; fellBack: boolean } {
    const preferredId = ROUTING_RULES[signal] ?? this.fallback.id
    const preferred = this.providers.get(preferredId) ?? this.fallback
    // For the MVP, only ZAIProvider is operational. If the preferred adapter
    // is a stub, use the fallback but record what we WOULD have used.
    if (preferred.id !== this.fallback.id && this.isStub(preferred)) {
      return { provider: this.fallback, preferredId: preferred.id, fellBack: true }
    }
    return { provider: preferred, preferredId: preferred.id, fellBack: false }
  }

  getProvider(id: string): ModelProvider | undefined {
    return this.providers.get(id)
  }

  listProviders(): ModelProvider[] {
    return Array.from(this.providers.values())
  }

  private isStub(p: ModelProvider): boolean {
    // Stubs are adapters other than ZAIProvider (the only operational one).
    // A real registry would mark this explicitly per adapter.
    return p.id !== 'claude'
  }
}
