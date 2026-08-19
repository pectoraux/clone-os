// Clone OS — Model Abstraction Layer (ADR-0002)
// LLMs are inference engines. The Clone is the source of truth.
// The rest of the platform never depends on vendor SDKs directly.

export type ModelProviderId =
  | "claude"
  | "gpt"
  | "gemini"
  | "open"
  | "local"
  | "vision"
  | "coding"
  | "small";

export interface ModelProvider {
  id: ModelProviderId;
  label: string;
  vendor: string;
  strengths: string[];
  // Routing signals (ADR-0018) the router considers
  quality: number;        // 0..1
  latencyMs: number;     // typical first-token latency
  costPer1kTokens: number; // USD
  privacy: "cloud" | "sandbox" | "local";
  capabilities: ("text" | "vision" | "code" | "audio" | "embedding" | "tool_use")[];
  contextWindow: number;
  availability: number;   // 0..1
  notes?: string;
}

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: "claude",
    label: "Claude (Sonnet)",
    vendor: "Anthropic",
    strengths: ["Complex reasoning", "Long-context analysis", "Tool use", "Safety"],
    quality: 0.94,
    latencyMs: 1400,
    costPer1kTokens: 0.009,
    privacy: "cloud",
    capabilities: ["text", "vision", "code", "tool_use"],
    contextWindow: 200_000,
    availability: 0.995,
    notes: "Default for complex reasoning & multi-step planning.",
  },
  {
    id: "gpt",
    label: "GPT (Turbo)",
    vendor: "OpenAI",
    strengths: ["General chat", "Function calling", "Wide ecosystem"],
    quality: 0.9,
    latencyMs: 900,
    costPer1kTokens: 0.0065,
    privacy: "cloud",
    capabilities: ["text", "vision", "code", "tool_use"],
    contextWindow: 128_000,
    availability: 0.992,
  },
  {
    id: "gemini",
    label: "Gemini (Pro)",
    vendor: "Google",
    strengths: ["Multimodal", "Long context", "Search-grounded"],
    quality: 0.88,
    latencyMs: 1100,
    costPer1kTokens: 0.005,
    privacy: "cloud",
    capabilities: ["text", "vision", "audio", "code"],
    contextWindow: 1_000_000,
    availability: 0.99,
  },
  {
    id: "open",
    label: "Open Model (Llama-class)",
    vendor: "Open Source",
    strengths: ["Self-hostable", "Auditable", "No vendor lock-in"],
    quality: 0.78,
    latencyMs: 600,
    costPer1kTokens: 0.001,
    privacy: "sandbox",
    capabilities: ["text", "code"],
    contextWindow: 32_000,
    availability: 0.98,
  },
  {
    id: "local",
    label: "Local Model (On-Prem)",
    vendor: "Self-Hosted",
    strengths: ["Privacy-sensitive", "Air-gapped", "Full data control"],
    quality: 0.7,
    latencyMs: 400,
    costPer1kTokens: 0.0,
    privacy: "local",
    capabilities: ["text"],
    contextWindow: 16_000,
    availability: 0.999,
    notes: "Used for privacy-sensitive workloads. No data leaves tenant.",
  },
  {
    id: "vision",
    label: "Vision Model",
    vendor: "Specialized",
    strengths: ["Image understanding", "OCR", "Scene analysis"],
    quality: 0.85,
    latencyMs: 800,
    costPer1kTokens: 0.008,
    privacy: "cloud",
    capabilities: ["vision"],
    contextWindow: 32_000,
    availability: 0.99,
  },
  {
    id: "coding",
    label: "Coding Model",
    vendor: "Specialized",
    strengths: ["Code synthesis", "Refactor", "Test generation"],
    quality: 0.9,
    latencyMs: 1200,
    costPer1kTokens: 0.012,
    privacy: "cloud",
    capabilities: ["code", "tool_use"],
    contextWindow: 128_000,
    availability: 0.99,
  },
  {
    id: "small",
    label: "Small Model (Classifier)",
    vendor: "Specialized",
    strengths: ["Fast classification", "Cheap routing", "Intent detection"],
    quality: 0.65,
    latencyMs: 120,
    costPer1kTokens: 0.0001,
    privacy: "cloud",
    capabilities: ["text"],
    contextWindow: 8_000,
    availability: 0.999,
  },
];

export type RoutingSignal =
  | "complex_reasoning"
  | "vision"
  | "coding"
  | "classification"
  | "privacy_sensitive"
  | "long_context"
  | "tool_use"
  | "general_chat";

// Default routing rules — a real router would score all providers per request.
export const ROUTING_RULES: Record<RoutingSignal, ModelProviderId> = {
  complex_reasoning: "claude",
  vision: "vision",
  coding: "coding",
  classification: "small",
  privacy_sensitive: "local",
  long_context: "gemini",
  tool_use: "claude",
  general_chat: "gpt",
};

export function routeModel(signal: RoutingSignal): ModelProvider {
  const id = ROUTING_RULES[signal];
  return MODEL_PROVIDERS.find((p) => p.id === id)!;
}

export function getProvider(id: ModelProviderId): ModelProvider {
  return MODEL_PROVIDERS.find((p) => p.id === id) ?? MODEL_PROVIDERS[0];
}
