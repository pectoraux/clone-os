// Clone OS — Capability Broker (N0.5)
//
// The agent never directly calls an extension. It requests:
//   capability = SEND_EMAIL
//   resource   = mailbox X
//   scope      = contract Y
//
// The broker checks:
//   identity → tenant → agent → environment → policy → contract → approval → risk → extension
//
// Then either: allow | deny | require-human-approval
//
// This is the foundation of the capability/permission engine. For the MVP,
// the broker authorizes extension installs because the principal owns the
// tenant — but it flags high-risk/critical capabilities that would require
// explicit approval in a real system. See HARDENING.md (N0.5).

import { CAPABILITY_CATALOG } from '@/lib/clone-os/autonomy'
import type { Principal } from '@/lib/auth/request-context'

export type BrokerDecision = 'allow' | 'deny' | 'require-human-approval'

export interface BrokerRequest {
  principal: Principal
  tenantId: string
  // What is being requested
  capability?: string
  resource?: string
  scope?: string
  // Extension-install flavor
  extensionId?: string
  extensionSlug?: string
  capabilities?: string[]
  action?: 'install' | 'uninstall' | 'invoke'
  // Execution flavor (future)
  agentId?: string
  environmentId?: string
  contractId?: string
}

export interface BrokerResult {
  decision: BrokerDecision
  reason: string
  requiresApproval: boolean
  // Audit-ready summary of what was evaluated
  evaluation: {
    principalId: string
    tenantId: string
    capabilities: string[]
    highRisk: string[]
    critical: string[]
    principalIsOwner: boolean
  }
}

export class CapabilityBroker {
  authorizeExtensionInstall(req: BrokerRequest): BrokerResult {
    const caps = req.capabilities ?? []
    // Find the high-risk and critical capabilities
    const highRisk = caps.filter((c) => {
      const cap = CAPABILITY_CATALOG.find((x) => x.id === c)
      return cap?.risk === 'high'
    })
    const critical = caps.filter((c) => {
      const cap = CAPABILITY_CATALOG.find((x) => x.id === c)
      return cap?.risk === 'critical'
    })

    // For the MVP: the principal owns the tenant, so they can approve their
    // own extension installs. A real system would require a separate
    // approval workflow for critical capabilities (CONTROL_DEVICE,
    // ROBOTIC_MANIPULATION, EXECUTE_PAYMENT) — possibly a second factor or
    // a separate approver.
    const requiresApproval = critical.length > 0 || highRisk.length > 0

    // Hard rule: never auto-allow CONTROL_DEVICE or ROBOTIC_MANIPULATION
    // without an explicit policy + approval. For the MVP we still allow
    // because there's no real runtime enforcing this, but we flag it loudly.
    const decision: BrokerDecision = requiresApproval ? 'require-human-approval' : 'allow'

    return {
      decision,
      reason: requiresApproval
        ? `Extension declares high-risk/critical capabilities (${[...highRisk, ...critical].join(', ')}). Production broker would require explicit approval.`
        : 'All declared capabilities are low/medium risk; install is allowed.',
      requiresApproval,
      evaluation: {
        principalId: req.principal.id,
        tenantId: req.tenantId,
        capabilities: caps,
        highRisk,
        critical,
        principalIsOwner: true, // for the MVP, the principal owns the tenant
      },
    }
  }

  // Future: authorizeExtensionInvocation(req) — for when there's a real
  // extension runtime. The agent requests capability+resource+scope and the
  // broker checks against the agent's approved capabilities, the contract
  // scope, the environment policies, and the approval state.
  authorizeExtensionInvocation(_req: BrokerRequest): BrokerResult {
    return {
      decision: 'deny',
      reason: 'Extension runtime is not implemented yet — see HARDENING.md (N0.6).',
      requiresApproval: false,
      evaluation: {
        principalId: '',
        tenantId: '',
        capabilities: [],
        highRisk: [],
        critical: [],
        principalIsOwner: false,
      },
    }
  }
}
