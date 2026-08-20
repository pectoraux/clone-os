# ADR-0001: Clone as the Primary Asset

**Status:** Accepted  
**Date:** 2025  
**Decider:** Principal Architect

## Context

The platform could be modeled around "Agents" as the central abstraction (most agent platforms do this). However, the product thesis is a *progressively trained digital representation of a human professional*, not a fleet of disposable agents. Agents are runtime deployments; the **trained, owned, versioned intellectual asset** is the clone.

## Decision

`Clone` is the first-class primitive. `Agent` is a *runtime manifestation* of a clone (or a specialized slice of one). A user owns one primary professional clone and may derive multiple specialized agents from it. Agents share appropriate portions of the same underlying clone state.

## Consequences

- The data model has `Clone` separate from `Agent` and from `ProfessionalIdentity`.
- Training sessions, evaluations, provenance attach to the Clone, not the Agent.
- Agent packages reference Clone versions; they do not own the expertise.
- The marketplace lists Clones and Agents derived from them; forking preserves attribution back to the source Clone.
- LLMs are infrastructure — never the source of truth for the user's accumulated intelligence.

## Non-Negotiable

Do not collapse `Clone` and `Agent` into one model. Do not bind an agent permanently to one model provider.

---

# ADR-0002: Model Abstraction Layer

**Status:** Accepted

## Context

LLM providers (Claude, GPT, Gemini, open-source, local) differ in quality, latency, cost, privacy, and capabilities across tasks. Coupling domain logic to any vendor SDK creates lock-in and violates "User ownership over model ownership."

## Decision

Introduce a `ModelProvider` interface and adapter pattern. The rest of the platform depends only on the interface. A `ModelRouter` selects a provider per request based on: Task, Quality, Latency, Cost, Privacy, Context Requirements, Capabilities, Availability.

## Consequences

- `src/lib/clone-os/model-abstraction.ts` defines `ModelProvider`, `ModelRouter`, `ModelSelection`, and the registered adapters.
- No domain code imports vendor SDKs directly.
- Routing decisions are observable (recorded on agent executions).
- Privacy-sensitive requests route to local/sandbox providers; complex reasoning routes to high-quality models.

---

# ADR-0003: Data Ownership & Provenance

**Status:** Accepted

## Context

Every learned artifact must carry explicit provenance. An employee's clone must not accidentally export a previous employer's confidential data. A company must not automatically own all of an employee's general professional expertise merely because the employee trained their clone while employed.

## Decision

Every knowledge/skill/experience/memory record carries `Provenance` fields: owner, source, origin tenant, license, visibility, purpose, retention, portability, sensitivity. The data model distinguishes: User's General Expertise, Company Proprietary Knowledge, Client Data, Public Knowledge, Licensed Knowledge, Third-Party Data, Generated Knowledge.

## Consequences

- Provenance is a first-class column on every artifact table.
- Export controls, deletion controls, and revocation consult provenance.
- The data boundary is representable even if legal policy is configured later.

---

# ADR-0004: Multi-Tenancy from the Foundation

**Status:** Accepted

## Context

Multi-tenancy added late becomes a UI filter, not an architectural boundary.

## Decision

`Tenant` is the root of the data graph. Every record carries `tenantId`. Tenant levels supported: Platform, Organization, Department, Team, Individual, Project, Client. Tenant isolation exists at database, API, storage, memory, knowledge retrieval, tool execution, extension execution, billing, audit logs.

## Consequences

- Every Prisma model that owns data has `tenantId`.
- API routes scope queries by tenant.
- A user can have a personal tenant and belong to multiple organizations.

---

# ADR-0005: Package-Oriented Architecture

**Status:** Accepted

## Context

The platform must support portable, versioned, certified, licensable units of professional capability. Without a universal distribution primitive, each subsystem invents its own incompatible format.

## Decision

Packages are the universal distribution primitive. Package types: Clone, Agent, Expertise, Skill, Knowledge, Workflow, Policy, Tool, Extension, Evaluation, Certification. Every package supports: Identity, Version, Capabilities, Dependencies, Interfaces, Provenance, Licensing, Certification, Metadata. Defined in `src/lib/clone-os/package-manifest.ts`.

## Consequences

- Publishing, installing, forking, versioning, and certifying all flow through one manifest format.
- Marketplace listings are packages.

---

# ADR-0006: Agent Portability & Interoperability Protocol

**Status:** Accepted

## Context

Agents must not be trapped inside this platform.

## Decision

Define an Agent Interoperability Protocol. An agent package must be able to: expose an API, receive tasks, return results, advertise capabilities, authenticate, authorize, interact with tools/extensions, maintain state, report outcomes, identify itself, declare versions, provide provenance. Long-term target: this platform, external runtimes, company infra, web, mobile, desktop, SaaS, other agent platforms, physical environments.

## Consequences

- `src/lib/clone-os/agent-protocol.ts` defines the protocol surface.
- The Agent Package manifest is portable across runtimes.

---

# ADR-0007: Extension Architecture (Capability-Based)

**Status:** Accepted

## Context

Extensions are potentially dangerous and must not be tightly coupled to vendor concrete systems.

## Decision

Extensions declare capability surfaces (`VISION_READ`, `CRM_READ`, `EMAIL_SEND`, `ROBOTIC_MANIPULATION`). Agents request **capabilities**, not specific vendors. Extension security: capability declarations, permissions, sandboxing, authentication, authorization, audit logs, rate limits, resource limits, certification, trust levels, versioning, revocation. A malicious extension must not silently escalate from `READ_CAMERA` to `CONTROL_ROBOT` or `TRANSFER_MONEY`. Physical-world integration arrives through extensions, never hardcoded special cases.

## Consequences

- `src/lib/clone-os/extension-protocol.ts` defines the manifest.
- Capability permissions are explicit and capability-bound.

---

# ADR-0008: Capability-Based Permissions & Autonomy Levels

**Status:** Accepted

## Context

Autonomy must never imply unlimited authority.

## Decision

Autonomy levels 0–5 (Observe, Suggest, Execute with Approval, Execute within Policy, Autonomous, Fully Autonomous). Permissions are capability-based. High-risk capabilities (`ISSUE_REFUND`, `EXECUTE_PAYMENT`, `CONTROL_DEVICE`) require explicit approval policies.

## Consequences

- `src/lib/clone-os/autonomy.ts` defines levels and capability catalog.
- Deployment records carry `autonomyLevel` and approved capability set.

---

# ADR-0009: Clone Evaluation & Fidelity

**Status:** Accepted

## Context

Certification without evidence is marketing. The clone must be measurable against the human.

## Decision

Evaluation subsystem (Benchmark, Scenario, Simulation, Human Review, Automated Evaluation, Adversarial Evaluation, Regression Test, Real-World Outcome) produces a multidimensional Clone Score (Professional, Knowledge, Skill, Decision, Behavioral, Communication, Personality, Cultural, Outcome Fidelity). A Fidelity Engine compares Human vs Clone responses on equivalent scenarios and emits a Divergence Report. Certification levels: Unverified, Self-Trained, Platform Evaluated, Certified, Professionally Verified, Enterprise Grade.

## Consequences

- `src/lib/clone-os/clone-score.ts` defines dimensions and aggregation.
- `src/lib/clone-os/fidelity-engine.ts` defines divergence reporting.
- No marketplace certification without evaluation evidence.

---

# ADR-0010: Versioning Everything Important

**Status:** Accepted

## Context

Silently mutating production intelligence is unacceptable.

## Decision

Versioned: Clone, Expertise, Skill, Knowledge Package, Workflow, Policy, Agent, Extension, Evaluation, Certification. A version has Version, Author, Timestamp, Change Set, Training Inputs, Evaluation Results, Performance Impact, Dependencies, Provenance. Rollback is supported.

## Consequences

- `CloneVersion` is a first-class table.
- Production clones are never mutated in place; new versions are released.

---

# ADR-0011: Marketplace Outcome Contracts

**Status:** Accepted

## Context

The marketplace is for professional capability and digital labor, not prompts. Companies should express outcomes, not pick agents.

## Decision

Intent-based hiring: a company expresses an outcome, the platform translates to required capabilities and matches clones/agents (considering capability match, performance, certification, experience, reputation, reliability, availability, cost, security, latency, industry). Outcome Contracts specify: Objective, Inputs, Required Actions, Constraints, Success Criteria, SLA, Budget, Permissions, Data Access, Duration. Hiring modes: Hourly, Per Task, Per Outcome, Subscription, Project, Revenue Share, Enterprise License, Temporary Trial, Recruitment Trial, Human+Clone. Reputation tracks verified metrics separately from subjective review.

## Consequences

- `Contract` is a first-class table linked to Clone/Agent and Tenant.
- `Reputation` aggregates verified metrics.

---

# ADR-0012: Environment Abstraction

**Status:** Accepted

## Context

A clone is not limited to one platform. It operates inside environments.

## Decision

`Environment` is a first-class primitive declaring: Available Data, Tools, Extensions, People, Systems, Devices, Rules, Policies, Constraints. The clone reasons in terms of **capabilities**, not vendor-specific implementations. Examples: Sales, Restaurant, Hospital, Factory, Software Development, Home, Warehouse.

## Consequences

- `Environment` table holds declarations.
- Agents are deployed into environments with capability bindings.

---

# ADR-0013: Real-Time Clone Conversation via Socket.io Mini-Service

**Status:** Accepted

## Context

Live "talk to your clone" interaction is core to the user experience (training, demonstration, correction). It must be real-time and must run server-side so the LLM SDK is never bundled into the client.

## Decision

A dedicated socket.io mini-service (`mini-services/clone-chat-service`, port 3003) handles live clone chat. The Next.js frontend connects via `io('/?XTransformPort=3003')`. The service builds a system prompt from the clone's persisted persona/expertise/skills and streams responses using the z-ai-web-dev-sdk LLM. Conversation state lives in the service; the clone's persistent state is the source of truth — chat history is *experience*, not the clone itself.

## Consequences

- LLM SDK usage is confined to the mini-service (backend only).
- The clone identity (persona, expertise, skills, policies) is fetched from the platform's data layer; the LLM is an inference engine.
- Real-time events: `clone:message`, `clone:typing`, `clone:thinking`.

---

# ADR-0014: Single Comprehensive Dashboard Route

**Status:** Accepted

## Context

The sandbox exposes only the `/` route to the user. The Clone OS surface is large (clone score, expertise graph, training studio, fidelity lab, versions, agents, model router, environments, extensions, marketplace, contracts, reputation, live chat, architecture).

## Decision

Build `/` as a single comprehensive dashboard with a left navigation rail and tabbed main content. Each section maps to a frozen architectural layer. The dashboard demonstrates the complete loop end-to-end on one deep vertical (Sales/Revenue Operations, anchored on the "Sarah" example from the spec).

## Consequences

- All sections are reachable from `/`.
- The dashboard is the user-facing proof of the architecture.
