// Clone OS — Extension Manifest + Runtime (N0.6)
//
// An extension is a package that declares capabilities, inputs, outputs,
// permissions, events, APIs, runtime requirements, security requirements,
// hardware requirements, certification, pricing, trust level, and version.
// The agent requests CAPABILITIES (never specific vendors) — the broker
// resolves the capability to an extension + adapter at runtime.
//
// STATUS: MANIFEST DEFINED, RUNTIME NOT IMPLEMENTED. The schema has Extension
// records (seeded for the MVP) and the install/uninstall endpoint manages the
// `installed` flag through the CapabilityBroker — but there is no actual
// extension process, sandbox, invocation protocol, lifecycle, version
// resolution, isolation, or attestation. This file defines the manifest +
// lifecycle interface so the runtime can be filled in.
//
// See HARDENING.md (N0.6).

export interface ExtensionManifest {
  identity: {
    id: string
    name: string
    version: string
    slug: string
  }
  vendor: string
  description: string
  capabilities: string[]  // capability IDs from the catalog
  inputs: Record<string, { type: string; description: string; required: boolean }>[]
  outputs: Record<string, { type: string; description: string }>[]
  permissions: string[]  // same shape as capabilities for the MVP
  events: { name: string; payloadShape: any }[]
  apis: { kind: 'rest' | 'webhook' | 'grpc' | 'ws'; spec: any }[]
  runtimeRequirements: {
    memory: string
    cpu: string
    disk?: string
    network?: boolean
  }
  securityRequirements: {
    sandbox: boolean
    audit: boolean
    rateLimit: number
    resourceLimits: Record<string, number>
  }
  hardwareRequirements: {
    sensors?: string[]
    actuators?: string[]
    devices?: string[]
  }
  certification: string  // unverified | certified | enterprise_grade
  pricing: Record<string, number>
  trustLevel: 'community' | 'verified' | 'first_party' | 'enterprise'
}

export interface ExtensionRuntime {
  // Install: validate the manifest, register the extension, mint capability
  // permissions (subject to broker approval for high-risk/critical caps)
  install(manifest: ExtensionManifest, tenantId: string, principalId: string): Promise<{ extensionId: string; brokerDecision: string }>
  // Uninstall: revoke capabilities, emit PermissionRevoked, de-register
  uninstall(extensionId: string, tenantId: string, principalId: string): Promise<void>
  // Invoke: the agent requests a capability+resource+scope; the broker
  // authorizes and the runtime invokes the extension's adapter. The
  // extension runs in a sandbox; its outputs are validated against the
  // manifest's output schema.
  invoke(req: ExtensionInvocationRequest): Promise<ExtensionInvocationResult>
  // Lifecycle: start/stop the extension process (for long-running extensions)
  start(extensionId: string): Promise<void>
  stop(extensionId: string): Promise<void>
  // Version resolution: given a capability + version range, resolve to a
  // concrete extension instance
  resolveVersion(capability: string, versionRange: string): Promise<{ extensionId: string; version: string } | null>
  // Attestation: verify the extension's signature / hash matches the manifest
  attest(extensionId: string): Promise<{ verified: boolean; reason: string }>
}

export interface ExtensionInvocationRequest {
  extensionId: string
  capability: string
  resource?: string
  scope?: string
  input: Record<string, unknown>
  // The agent requesting the invocation
  agentId: string
  environmentId: string
  contractId?: string
  principalId: string
  tenantId: string
}

export interface ExtensionInvocationResult {
  ok: boolean
  output?: Record<string, unknown>
  // Audit trail
  audit: {
    extensionId: string
    capability: string
    resource?: string
    agentId: string
    environmentId: string
    invokedAt: string
    latencyMs: number
    sandboxBoundary: 'process' | 'container' | 'vm' | 'wasm'
  }
  error?: string
}

// ---- Stub implementation ----
export class StubExtensionRuntime implements ExtensionRuntime {
  async install(): Promise<{ extensionId: string; brokerDecision: string }> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.install — see HARDENING.md (N0.6)')
  }
  async uninstall(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.uninstall — see HARDENING.md (N0.6)')
  }
  async invoke(_req: ExtensionInvocationRequest): Promise<ExtensionInvocationResult> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.invoke — see HARDENING.md (N0.6). The CapabilityBroker.authorizeExtensionInvocation() also returns deny for the same reason.')
  }
  async start(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.start — see HARDENING.md (N0.6)')
  }
  async stop(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.stop — see HARDENING.md (N0.6)')
  }
  async resolveVersion(): Promise<{ extensionId: string; version: string } | null> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.resolveVersion — see HARDENING.md (N0.6)')
  }
  async attest(): Promise<{ verified: boolean; reason: string }> {
    throw new Error('NOT_IMPLEMENTED: ExtensionRuntime.attest — see HARDENING.md (N0.6)')
  }
}
