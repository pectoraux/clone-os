# Clone OS — Architecture

> **Open, multi-tenant operating system for creating, training, evaluating, deploying, transporting, and monetizing portable digital clones of people's professional selves.**

This document is the **frozen architectural constitution** of the project. Subsystems may evolve, but the core primitives, layering, and design principles below must not be silently violated. Conflicts require an ADR.

---

## 1. Product Thesis

A person progressively trains a digital representation of their professional self. The clone learns:

- knowledge, skills, procedures, workflows
- decision-making patterns, problem-solving approaches
- preferences, communication style, personality
- professional values, cultural context, domain experience
- tool usage, behavioral patterns, work habits
- corrections, demonstrated behavior, real-world outcomes

The objective is **not** "build an AI that performs a task." It is:

> **Build a progressively more faithful digital representation of a human professional.**

The clone can be used privately, by an employer, for freelance work, rented by companies, used as a recruitment trial, licensed, deployed into other environments, combined with other agents, connected to external software, and eventually physical-world extensions.

---

## 2. The Most Important Architectural Principle

### The Clone Belongs to the User

The underlying LLM is **NOT** the source of truth for the user's accumulated intelligence. LLMs (Claude, GPT, Gemini, open models, local models) are **inference engines** — replaceable infrastructure.

The platform maintains an **independent persistent representation** of the user's:

- identity, expertise, knowledge, skills
- experiences, memories, demonstrations, corrections
- decisions, preferences, personality, behavior
- training history, evaluation history
- provenance, reputation, licensing, permissions

The platform's accumulated data stays in the platform's controlled data layer. The user's accumulated expertise must **never** become proprietary training data belonging to whichever LLM provider happens to be used.

```text
User Clone
    |
    +-- Persistent Clone State
    +-- Expertise Graph
    +-- Knowledge
    +-- Skills
    +-- Memory
    +-- Behavioral Model
    +-- Personality Model
    +-- Training History
    +-- Evaluation History
    +-- Provenance
    |
    v
Model Abstraction Layer
    |
    +-- Claude  +-- GPT  +-- Gemini  +-- Open Models  +-- Local Models
```

Claude may currently be superior for a task — that is fine. But Claude is an **interchangeable runtime dependency**, not the owner's professional identity.

---

## 3. Core Terminology (Frozen)

| Term                  | Definition                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| User                  | The human being.                                                            |
| Professional Identity | The user's persistent professional identity (represents the human, not merely an agent). |
| Expertise             | What the person knows and can do.                                           |
| Skill                 | A measurable professional capability.                                       |
| Experience            | Observed or recorded evidence the user performed something.                 |
| Clone                 | The persistent digital representation of the user's professional self. **Primary intellectual asset.** |
| Agent                 | A runtime deployment of a clone, or a specialized operational manifestation of a clone. |
| Environment           | The digital or physical context an agent operates in (Salesforce, Slack, Gmail, browser, kitchen, factory, vehicle, robotic environment). |
| Extension             | A capability package allowing an agent to interact with an external system, sensor, device, API, or physical-world system. |
| Outcome               | The observable result of an agent performing work.                         |
| Evaluation            | A structured measurement of capability or fidelity.                         |
| Certification         | A formal assertion that an agent/clone meets defined competency requirements. |
| Contract              | The rules under which a company/person hires or uses a clone.               |
| Reputation            | Evidence of historical performance, reliability, and trustworthiness.     |

---

## 4. Frozen Core Object Model

First-class primitives — these are **NOT** collapsed into one generic `Agent` model. They have different semantics and lifecycle requirements.

```text
Tenant              Organization        User
ProfessionalIdentity Clone              Expertise
Skill               Knowledge           Experience
Memory              Behavior            Personality
Workflow            Policy              Agent
Environment         Extension           Tool
Evaluation          Certification       Outcome
Contract            Reputation          License
Payment             Provenance
```

---

## 5. Clone is the Primary Asset

```text
User
  |
  v
Professional Identity
  |
  v
Clone
  |
  +-- Expertise    +-- Skills       +-- Knowledge
  +-- Experiences  +-- Memory       +-- Personality
  +-- Behavior     +-- Preferences +-- Workflows
  +-- Policies     +-- Training History
  +-- Evaluation History
  +-- Provenance
  |
  v
Agents
```

A user has one primary professional clone and may have multiple specialized agents derived from it (e.g. Sarah's Clone → Revenue Ops Agent, CRM Agent, Reporting Agent, Slack Agent). Agents share appropriate portions of the same underlying clone state.

---

## 6. The Clone Models the Professional Self

The clone is **NOT** simply a knowledge base. It separately models: Knowledge, Skills, Procedures, Decision Patterns, Preferences, Personality, Culture, Values, Communication Style, Behavioral Patterns, Experience. The system preserves these dimensions separately rather than reducing everything to embeddings or prompt text.

---

## 7. Clone Training Loop

```text
OBSERVE -> CAPTURE -> TEACH -> DEMONSTRATE -> TRAIN -> EVALUATE
  -> SIMULATE -> CERTIFY -> DEPLOY -> WORK -> MEASURE -> LEARN
  +-----> CLONE <-----+
```

Every stage is represented architecturally (training session kinds, evaluation kinds, deployment records, outcome records, learning records).

---

## 8. Training Modes

Teaching, Demonstration, Correction, Shadowing, Assisted Execution, Delegated Execution, Simulation, Adversarial Training, Real-World Feedback. Each training session carries a `mode` and structured inputs.

---

## 9. Training ≠ Fine-Tuning

Training is model-independent. Mechanisms include: structured knowledge, RAG, examples, demonstrations, preference learning, workflow learning, policy learning, memory, tool-usage learning, model fine-tuning, evaluation feedback, reinforcement learning, model selection. The platform decides which representation is appropriate per dimension.

---

## 10. Expertise Graph

```text
Expert
 |-- knows --> Concept
 |-- performs --> Skill
 |-- uses --> Tool
 |-- follows --> Procedure
 |-- makes --> Decision
 |-- avoids --> Failure
 |-- produces --> Artifact
 |-- specializes_in --> Domain

Skill
 |-- requires --> Knowledge
 |-- requires --> Skill
 |-- requires --> Tool
 |-- demonstrated_by --> Experience
 |-- evaluated_by --> Evaluation
 |-- depends_on --> Skill
```

The graph is queryable and versioned.

---

## 11. Professional Clone Score (Multidimensional)

The public UI may show `Clone Score: 87.4%`, but the underlying system preserves the dimensions:

- Professional Fidelity
- Knowledge Fidelity
- Skill Fidelity
- Decision Fidelity
- Behavioral Fidelity
- Communication Fidelity
- Personality Fidelity
- Cultural Fidelity
- Outcome Fidelity

---

## 12. Clone Fidelity Testing

Compares Human vs Human's Clone against equivalent scenarios. Produces a **Divergence Report** (decisions, reasoning, actions, communication, priorities, risk tolerance, preferences, ambiguity handling, expected vs actual outcomes). Can state "the clone agrees with the user's decisions 94% of the time" and "consistently underestimates operational risk".

---

## 13. Real-World Performance

Real work is a training signal. Tracks Task / Input / Agent Actions / Human Interventions / Output / Outcome / Client Feedback / Objective Metrics / Evaluation. Version 1 → real-world work → performance data → evaluation → training → Version 2. **Never silently mutate production clones — use explicit versions.**

---

## 14. Versioning

Versioned: Clone, Expertise, Skill, Knowledge Package, Workflow, Policy, Agent, Extension, Evaluation, Certification. A clone version has Version, Author, Timestamp, Change Set, Training Inputs, Evaluation Results, Performance Impact, Dependencies, Provenance. Rollback is supported.

---

## 15. Agent Package

Agents are packageable and portable. A package contains: Identity, Capabilities, Expertise/Skill/Knowledge/Workflow References, Policies, Memory Schema, Tool Requirements, Extension Requirements, Evaluation Suite, Safety Constraints, Model Requirements, Provenance, Licensing, Version, Metadata. **Agents are NOT permanently bound to one model provider.**

---

## 16. Portability is First-Class

Agents must not be trapped inside this platform. An open interoperability protocol lets an agent: expose an API, receive tasks, return results, advertise capabilities, authenticate, authorize, interact with tools/extensions, maintain state, report outcomes, identify itself, declare versions, provide provenance. Long-term target: Clone runs in this platform, external runtimes, company infra, web, mobile, desktop, SaaS, other agent platforms, physical environments.

---

## 17. Agent Identity

Portable cryptographic identity, separate from the LLM. Supports: Public Key, Owner, Capabilities, Versions, Provenance, Trust Credentials, Permissions, Licenses. A clone authenticates across environments.

---

## 18. Model Abstraction Layer

Clean Model Provider abstraction. The rest of the platform never depends on vendor SDKs directly — adapters only. The **Model Router** considers Task, Quality, Latency, Cost, Privacy, Context Requirements, Capabilities, Availability:

```text
Complex reasoning   -> Claude
Vision              -> Vision Model
Coding              -> Coding Model
Classification      -> Small Model
Privacy-sensitive   -> Local Model
```

---

## 19. Data Ownership & Provenance

Every learned artifact has explicit provenance: Owner, Source, Origin, Tenant, License, Visibility, Purpose, Retention, Portability, Sensitivity. Distinguish: User's General Expertise, Company Proprietary Knowledge, Client Data, Public Knowledge, Licensed Knowledge, Third-Party Data, Generated Knowledge.

> An employee's clone must not accidentally export a previous employer's confidential data. A company must not automatically own all of an employee's general professional expertise merely because the employee trained their clone while employed there.

The data model represents these questions even if legal policy is configured later.

---

## 20. Multi-Tenancy

Foundational. Levels: Platform, Organization, Department, Team, Individual, Project, Client. A user can have a personal tenant. A company has an organization tenant. Users belong to multiple organizations. A clone can be deployed into multiple environments with different permissions.

Tenant isolation exists at: database, API, storage, memory, knowledge retrieval, tool execution, extension execution, billing, audit logs. **Tenant filtering is NOT merely a UI concern.**

---

## 21–22. Employee Automation & Autonomy Levels

Employees progressively automate their workload: Manual → Copilot → Recommendation → Approval → Policy-bound Autonomous → Highly Autonomous.

| Level | Behavior                  |
| ----- | ------------------------- |
| 0     | Observe                   |
| 1     | Suggest                   |
| 2     | Execute with Approval     |
| 3     | Execute within Policy     |
| 4     | Autonomous                |
| 5     | Fully Autonomous          |

Permissions are **capability-based** (e.g. `READ_EMAIL`, `SEND_EMAIL`, `READ_CRM`, `WRITE_CRM`, `CREATE_CALENDAR_EVENT`, `ISSUE_REFUND`, `EXECUTE_PAYMENT`, `CONTROL_DEVICE`). High-risk capabilities require explicit approval policies.

---

## 23. Environment as a First-Class Primitive

An Environment declares: Available Data, Tools, Extensions, People, Systems, Devices, Rules, Policies, Constraints. The clone reasons in terms of **capabilities**, not vendor-specific implementations.

---

## 24–27. Extension Ecosystem

Extensions interact with SaaS, APIs, browsers, desktop apps, cameras, microphones, sensors, databases, vehicles, industrial systems, robots, physical devices. A package declares Identity, Version, Capabilities, Inputs, Outputs, Permissions, Events, APIs, Runtime Requirements, Security Requirements, Hardware Requirements, Certification, Pricing.

**Capability-based extensions:** agents consume abstract capabilities (`VISION_READ`, `TEMPERATURE_READ`, `CRM_READ`, `EMAIL_SEND`, `ROBOTIC_MANIPULATION`) — never tightly coupled to vendor concrete systems (`Robot X`, `Camera Y`, `CRM Vendor Z`).

**Physical-world extension path:** Vision → Determine Cooking State → Plan → Robot Arm → Physical Action. The core architecture does **not** need to be redesigned for this.

**Extension security:** capability declarations, permissions, sandboxing, authentication, authorization, audit logs, rate limits, resource limits, certification, trust levels, versioning, revocation. A malicious extension must NOT silently escalate from `READ_CAMERA` to `CONTROL_ROBOT` or `TRANSFER_MONEY`.

---

## 28–37. Marketplace, Economy, Forking

The marketplace is for professional capability, digital labor, expertise, clones, agents, extensions, workflows, tools, licenses — **NOT** an AI-agent store where every agent is a prompt.

- **Intent-based hiring:** companies express outcomes; the platform translates to required capabilities and matches clones/agents.
- **Outcome Contracts:** Objective, Inputs, Required Actions, Constraints, Success Criteria, SLA, Budget, Permissions, Data Access, Duration.
- **Hiring modes:** Hourly, Per Task, Per Outcome, Subscription, Project, Revenue Share, Enterprise License, Temporary Trial, Recruitment Trial, Human+Clone.
- **Recruitment use case:** candidate grants controlled, time-limited trial access; the company does NOT receive ownership of the clone.
- **Human + Clone:** clone handles routine work; human handles strategic decisions, exceptions, escalations. Clone escalates when its confidence/policy requires it.
- **Reputation:** verified metrics (tasks completed, success rate, outcome rate, reliability, client retention, certification, experience, response time, SLA compliance, human intervention rate). Separates verified outcome from subjective review.
- **Expertise licensing:** Private, Marketplace, Licensed, Commercial, Open, Restricted — represented in package metadata.
- **Forking:** controlled forking of expertise and agents with attribution, provenance, licensing, version history preserved.
- **Economics:** revenue split across Expert / Platform / Extension Developer / Infrastructure / Referral — percentages configurable.

---

## 38. Agent-to-Agent Interoperability

Capability-based discovery and explicit authorization. **No arbitrary agent-to-agent access.**

---

## 39–40. Security & Privacy

Security: tenant isolation, identity, cryptographic signatures, authorization, capability-based permissions, secrets management, audit logging, extension sandboxing, data classification, provenance, consent, revocation, session controls, model-provider isolation, export controls, deletion controls. Autonomous agents are privileged actors.

Privacy: encryption at rest/in transit, tenant isolation, field-level access controls, sensitive-data classification, selective retrieval, data minimization, retention policies, export, deletion, revocation, auditability. **Never send unnecessary user data to an LLM provider.**

---

## 41. Observability

Every agent execution is traceable: Request, Agent Version, Clone Version, Model, Model Version, Context Sources, Tools, Extensions, Actions, Human Approvals, Output, Outcome, Latency, Cost, Errors, Evaluation. Sensitive data is appropriately protected.

---

## 42–43. Evaluation & Certification

Evaluation subsystem: Benchmark, Scenario, Simulation, Human Review, Automated Evaluation, Adversarial Evaluation, Regression Test, Real-World Outcome. Every agent version has evaluation history. **No marketplace certification without evidence.**

Certification levels: Unverified, Self-Trained, Platform Evaluated, Certified, Professionally Verified, Enterprise Grade — based on defined competency requirements.

---

## 44. Package-Oriented Architecture

Packages are the universal distribution primitive. Types: Clone, Agent, Expertise, Skill, Knowledge, Workflow, Policy, Tool, Extension, Evaluation, Certification. Each package supports: Identity, Version, Capabilities, Dependencies, Interfaces, Provenance, Licensing, Certification, Metadata.

---

## 45. Architectural Layers

1. Identity
2. Tenant / Organization
3. Professional Identity
4. Clone
5. Expertise / Knowledge
6. Learning
7. Evaluation / Certification
8. Agent Runtime
9. Environment
10. Extension / Tool
11. Interoperability
12. Marketplace / Economy
13. Model Abstraction
14. Persistence / Data
15. Security / Governance

Boundaries are explicit.

---

## 46–47. Services & Data Architecture

Logical services (modular monolith first, preserving boundaries): Identity, Tenant, Professional Identity, Clone, Expertise, Knowledge, Memory, Learning, Training, Evaluation, Certification, Agent Registry, Agent Runtime, Environment Registry, Extension Registry, Tool Registry, Policy Engine, Permission Service, Model Router, Marketplace, Contract, Outcome, Reputation, Payment, Provenance, Audit, Interoperability Gateway. Async workers/queues where appropriate.

Data architecture separates: Transactional, Knowledge, Vector/Retrieval, Graph, Blob/Object, Event, Telemetry, Audit, Financial. A canonical relational source of truth exists for identity, ownership, versioning, permissions, contracts.

---

## 48. Event-Driven Learning

Domain events drive analytics & learning pipelines: `CloneCreated`, `TrainingStarted`, `TrainingCompleted`, `DemonstrationCaptured`, `CorrectionCaptured`, `SkillUpdated`, `KnowledgeAdded`, `WorkflowLearned`, `EvaluationCompleted`, `CertificationGranted`, `AgentDeployed`, `TaskStarted`, `TaskCompleted`, `OutcomeRecorded`, `HumanIntervention`, `CloneUpdated`, `CloneVersionReleased`, `ExtensionInstalled`, `PermissionGranted`, `PermissionRevoked`, `ContractCreated`, `PaymentReleased`.

---

## 49. Implementation Phases (Incremental)

Phase 1 Foundation → Phase 2 Clone Core → Phase 3 Learning Studio → Phase 4 Agent Runtime → Phase 5 Evaluation → Phase 6 Extensions → Phase 7 Marketplace → Phase 8 Enterprise → Phase 9 Portability → Phase 10 Physical World.

> The architecture is frozen; the implementation is incremental. This MVP delivers **one deep vertical** (Sales/Revenue Operations) covering the complete loop end-to-end.

---

## 50. MVP Priority

Build **one deep vertical** (Sales/Revenue Operations) through the complete loop: User → Train Clone → Evaluate → Deploy → Perform Real Work → Measure Outcomes → Improve → Marketplace → Company Hiring. Do not build ten shallow verticals.

---

## 57. Non-Negotiable Design Principles

1. Clone over Agent
2. User ownership over model ownership
3. Capability over vendor
4. Environment over platform
5. Evidence over claims
6. Outcome over benchmark
7. Provenance everywhere
8. Explicit permissions
9. Version everything
10. Portable by design
11. Multi-tenant from the foundation
12. Extension-first physical integration

---

## 58. What NOT to Build

- a generic ChatGPT wrapper
- a prompt marketplace
- a simple RAG chatbot
- an LLM fine-tuning dashboard
- an AI agent marketplace where every agent is a prompt
- a monolithic `Agent` database object containing everything
- vendor-specific agent/memory/identity/training-history implementations
- an ecosystem locked to this platform
- uncontrolled autonomous tool execution

If a proposed implementation contradicts this architecture, **stop and identify the conflict before coding.**

---

## 63. API Design

Domain-concept APIs, e.g.:

```
POST /clones
GET  /clones/:id
POST /clones/:id/training-sessions
POST /clones/:id/demonstrations
POST /clones/:id/corrections
GET  /clones/:id/skills
GET  /clones/:id/evaluations
GET  /clones/:id/score
POST /agents
POST /agents/:id/deployments
GET  /extensions
POST /extensions/:id/install
POST /contracts
POST /contracts/:id/tasks
POST /contracts/:id/outcomes
POST /marketplace/listings
POST /marketplace/matches
```

Internal implementation details are not prematurely exposed.

---

## 64. Final Architectural Model

```text
                         HUMAN
                           |
                 PROFESSIONAL IDENTITY
                           |
                         CLONE
       +-------------------+-------------------+
       v                   v                   v
   EXPERTISE           BEHAVIOR           PERSONALITY
       +-------------------+-------------------+
                           |
                     LEARNING SYSTEM
                           |
                    EVALUATION SYSTEM
                           |
                     CLONE SCORE
                           |
                     AGENT PACKAGES
              +------------+------------+
              v            v            v
          Environment   Environment   Environment
              |            |            |
          Extensions   Extensions   Extensions
              +------------+------------+
                           |
                    REAL-WORLD WORK
                           |
                       OUTCOMES
                           |
                       FEEDBACK -----> CLONE

Above:    MARKETPLACE -> Hiring / Licensing / Freelance -> ECONOMY
Below:    Identity, Security, Permissions, Provenance, Persistence,
          Events, Observability, Model Abstraction, Interoperability
```

---

## 67. North Star

> **"This is my professional self. It knows how I work, thinks through problems the way I do, communicates like me, understands my professional culture, and can perform my work wherever I authorize it to operate."**

The longer someone uses the platform, the more valuable their clone becomes: more capable, more accurate, more autonomous, more personalized, more faithful, more valuable economically, more portable, more interoperable.

**Build the operating system for that statement. Do not optimize for a demo.**
