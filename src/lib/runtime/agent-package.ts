// Clone OS — Portable Agent Package (N0.10)
//
// Agents must not be trapped inside this platform. An Agent Package is a
// portable serialization that an external runtime can ingest to run the
// agent. The package declares identity, capabilities, expertise/skill/
// knowledge/workflow references, policies, memory schema, tool/extension
// requirements, evaluation suite, safety constraints, model requirements,
// provenance, licensing, version, and metadata.
//
// STATUS: FORMAT DEFINED; EXPORT/IMPORT ENDPOINTS NOT IMPLEMENTED. This file
// defines the serialization format so the export/import endpoints can be
// filled in without changing the manifest shape.
//
// See HARDENING.md (N0.10).

export interface AgentPackage {
  // Manifest header
  manifestVersion: '1.0'
  identity: {
    id: string
    type: 'agent'
    name: string
    slug: string
    version: string
    description: string
    specialization: string
  }
  // The clone this agent is derived from (with version pin)
  clone: {
    id: string
    name: string
    slug: string
    version: string
    // Snapshot of the clone's persona/personality/preferences/behavior at
    // the time of packaging (the external runtime may not have access to
    // the platform's data layer)
    snapshot: {
      persona: Record<string, any>
      personality: Record<string, any>
      preferences: Record<string, any>
      behavior: Record<string, any>
      professionalIdentity: {
        title: string
        domain: string
        bio: string
        values: string[]
        culture: Record<string, any>
      } | null
    }
    // References to expertise/skills/knowledge/workflows (by ID + version).
    // An external runtime with platform access can fetch these; a fully
    // offline runtime would need them embedded (future: 'bundled: true')
    expertiseRefs: { id: string; nodeType: string; name: string }[]
    skillRefs: { id: string; name: string; domain: string; proficiency: number }[]
    knowledgeRefs: { id: string; title: string; kind: string; sourceKind: string; sensitivity: string; portability: string }[]
    workflowRefs: { id: string; name: string; version: string }[]
    policyRefs: { id: string; name: string; rule: any }[]
    memoryRefs: { id: string; kind: string; content: string; importance: number }[]
  }
  // Agent-level configuration
  capabilities: string[]  // approved capability IDs
  autonomyLevel: number  // 0..5
  // Tool + extension requirements (resolved at runtime via the broker)
  toolRequirements: { capability: string; versionRange?: string }[]
  extensionRequirements: { capability: string; versionRange?: string }[]
  // Model requirements (signal → preferred provider; runtime may override)
  modelRequirements: { signal: string; preferredProvider: string; fallbackProvider?: string }[]
  // Evaluation suite (the tests this agent must pass to be certified)
  evaluationSuite: { scenarioId: string; scenario: string; expectedDimensions: string[] }[]
  // Safety constraints (hard rules the runtime must enforce)
  safetyConstraints: string[]
  // Provenance (ADR-0003)
  provenance: {
    owner: string
    source: string
    origin: string
    portability: 'portable' | 'tenant_locked' | 'client_locked'
    sensitivity: 'public' | 'internal' | 'confidential' | 'restricted'
  }
  // Licensing (ADR-0035)
  licensing: {
    kind: 'private' | 'marketplace' | 'licensed' | 'commercial' | 'open' | 'restricted'
    terms?: string
  }
  // Certification (ADR-0043)
  certification: {
    level: 'unverified' | 'self_trained' | 'platform_evaluated' | 'certified' | 'professionally_verified' | 'enterprise_grade'
    evidenceUrl?: string
    evaluationResults?: Record<string, number>
  }
  // Cryptographic identity (ADR-0017) — for cross-environment authentication
  identity: {
    publicKey: string
    signature: string  // signs the package contents
    algorithm: 'ed25519' | 'rsa-pss-sha256'
  }
  // Free-form metadata
  metadata: Record<string, unknown>
}

// ---- Serialization helpers ----
// A real implementation would sign the package with the clone owner's
// private key and verify on import. For the MVP, we just provide the JSON
// shape — signing is a localized addition.

export function serializeAgentPackage(pkg: AgentPackage): string {
  return JSON.stringify(pkg, null, 2)
}

export function deserializeAgentPackage(json: string): AgentPackage {
  const pkg = JSON.parse(json) as AgentPackage
  if (pkg.manifestVersion !== '1.0') {
    throw new Error(`Unsupported manifest version: ${pkg.manifestVersion}`)
  }
  return pkg
}

// ---- Stub export/import endpoints ----
// The real endpoints would:
//   POST /api/agents/:id/export → returns a signed AgentPackage
//   POST /api/agents/import      → ingests a signed AgentPackage, validates
//                                  the signature, creates an Agent + links
//                                  to the clone snapshot
// These are NOT implemented yet. See HARDENING.md (N0.10).

export class StubAgentPackageExporter {
  async export(_agentId: string, _principalId: string): Promise<AgentPackage> {
    throw new Error('NOT_IMPLEMENTED: AgentPackageExporter.export — see HARDENING.md (N0.10)')
  }
}

export class StubAgentPackageImporter {
  async import(_pkg: AgentPackage, _principalId: string, _tenantId: string): Promise<{ agentId: string }> {
    throw new Error('NOT_IMPLEMENTED: AgentPackageImporter.import — see HARDENING.md (N0.10)')
  }
}
