# Clone OS — Foundation Hardening Status

**Milestone: N1.1 — Persistent Learning & Candidate Clone State (OPERATIONAL)**

N0 is structurally complete with intentionally incomplete runtimes. N1.1 makes the first real product loop operational: a human teaching interaction produces a provenance-aware candidate artifact, the user confirms it, a versioned candidate clone state is created, and—after release—the clone's behavior genuinely changes in subsequent executions. This is the moment the architecture becomes real.

The frozen architecture (see `docs/ARCHITECTURE.md` and `docs/adr/README.md`) describes the target. This document describes the current state of the implementation against that target.

---

## Status legend

- ✅ **Operational** — runs, enforces the architecture, used in production paths
- 🟡 **Partial** — exists and runs, but with significant gaps vs. the architecture
- 🔴 **Simulated / Not implemented** — represented in schema/UI but no real runtime
- 🚧 **Stub interface defined** — typed interface exists so the runtime can be filled in without changing call sites

---

## N0.0 — Security

| Item | Status | Notes |
| --- | --- | --- |
| Admin credential rotation | ✅ | The exposed `***REDACTED***` was rotated to a strong env-sourced password (`ADMIN_PASSWORD`). The old password no longer authenticates (verified). |
| Git history scrub | ✅ | `git filter-repo` scrubbed all occurrences of the old password from every commit + every commit message. Force-pushed. 0 occurrences remain on GitHub (verified via the search API). |
| Secret audit | ✅ | Audited git history for Neon URL, NEXTAUTH_SECRET, PAT, Vercel token. None were ever committed (the `.env` file was committed once with only the SQLite path, then untracked). |
| `.env` in `.gitignore` | ✅ | `.env` is gitignored; `git rm --cached .env` removed it from tracking. `.env.example` documents required vars without values. |

---

## N0.1 — Identity + Authorization

| Item | Status | Notes |
| --- | --- | --- |
| `RequestContext` type | ✅ | `src/lib/auth/request-context.ts` — `principal`, `tenantId`, `requestId`, `isAuthenticated`, `isAdmin`, `isDemo`. |
| `requireAuthenticated` / `requireAdmin` / `requireCloneOwner` | ✅ | Helpers return `{ok, context, reason, status}` — route handlers decide. |
| `getRequestContext()` server helper | ✅ | Wraps `getServerSession()` + `contextFromSession()`. One-line resolution in any route handler. |
| All API routes resolve tenant/clone from session | ✅ | `/api/clone-os` GET, `/api/clone-os/train` POST, `/api/clone-os/extensions` POST, `/api/auth/waitlist` GET (was public — fixed), `/api/auth/admin/approve` POST, `/api/auth/socket-token` POST all use RequestContext. No route trusts `tenantId`/`ownerId`/`cloneId` from request body. |
| Socket.io auth handshake | ✅ | The mini-service requires a `sessionToken` on `clone:join`. The frontend fetches a single-use short-lived token from `/api/auth/socket-token` (authenticated); the mini-service validates it server-to-server via `/api/auth/validate-socket-token`. Unauthenticated clients can only join marketplace-visible (public demo) clones. |
| CORS tightening | ✅ | The mini-service no longer uses `cors: { origin: "*" }`. It allows only `http://localhost:3000`, `http://localhost:81`, `https://claune.vercel.app` (configurable via `ALLOWED_ORIGINS`). |

---

## N0.2 — Real Multi-tenancy

| Item | Status | Notes |
| --- | --- | --- |
| Tenant resolved from session | ✅ | `ctx.tenantId` comes from the NextAuth JWT, not from request body. |
| All tenant-scoped queries filter by `tenantId` | ✅ | The consolidated `/api/clone-os` GET now scopes outcomes by `tenantId` (was global — fixed). Other tenant-scoped queries (skills, knowledge, experiences, memories, workflows, policies, training sessions, evaluations, clone scores, divergences, certifications, agents, environments, extensions, tools, contracts, licenses, events, audit logs, expertise) were already scoped by `cloneId` + `tenantId`. |
| Marketplace queries | ✅ | Intentionally global (that's the marketplace's purpose) but only `listed`/`hired` statuses are returned to non-owners. Private/draft listings are not exposed. |
| Tenant-isolation automated tests | ✅ | `tests/tenant-isolation.test.ts` — 8 tests, all pass. See "Tests" section below. |

---

## N0.3 — Clone Runtime

| Item | Status | Notes |
| --- | --- | --- |
| `CloneRuntime.buildContext()` | ✅ | `src/lib/runtime/clone-runtime.ts` — resolves Clone + ProfessionalIdentity + Skills + Knowledge + Memories + Policies + Persona/Personality/Preferences/Behavior + Agent + Environment + Capabilities into a typed `ExecutionContext`. |
| `CloneRuntime.toSystemPrompt()` | ✅ | The ONLY place prompt assembly happens. The mini-service calls this instead of hand-assembling strings. |
| Mini-service uses CloneRuntime | ✅ | `mini-services/clone-chat-service/index.ts` calls `runtime.buildContext()` + `runtime.toSystemPrompt()`. |

---

## N0.4 — Model Provider SPI

| Item | Status | Notes |
| --- | --- | --- |
| `ModelProvider` interface | ✅ | `src/lib/runtime/model-provider.ts` — `generate()`, `stream()`, `embed()`, `supports()`, `metadata()`. |
| `ZAIProvider` (operational) | ✅ | Wraps `z-ai-web-dev-sdk` behind the interface. The only adapter that actually runs. |
| `OpenAIProvider` / `GeminiProvider` / `LocalProvider` | 🚧 | Stub adapters — declare capabilities + metadata so the router can reason about them, but `generate()` throws `NOT_IMPLEMENTED`. Adding a real adapter is a localized change: implement `generate()` and you're done — no call site changes. |
| `ModelRouter` | ✅ | Selects a provider per routing signal. If the preferred provider is a stub, falls back to `ZAIProvider` and records the fallback decision for observability. |
| Mini-service uses ModelRouter | ✅ | The mini-service calls `router.select(signal).provider.generate(req)` — never imports the SDK directly. |
| Direct `ZAI.create()` in the mini-service | ✅ | Removed. The mini-service now goes through `ModelRouter → ModelProvider → ZAIProvider`. |

---

## N0.5 — Capability / Policy Engine

| Item | Status | Notes |
| --- | --- | --- |
| `CapabilityBroker` | ✅ | `src/lib/capabilities/broker.ts` — `authorizeExtensionInstall()` evaluates principal + tenant + capabilities + risk. |
| High-risk/critical flagging | ✅ | The broker identifies `high` and `critical` capabilities (e.g., `CONTROL_DEVICE`, `ROBOTIC_MANIPULATION`, `EXECUTE_PAYMENT`) and returns `require-human-approval`. For the MVP, the install proceeds because the principal owns the tenant (they ARE the approver), but the decision is logged for audit. A production broker would block and emit an approval request. |
| `authorizeExtensionInvocation()` | 🚧 | Returns `deny` because the extension runtime (N0.6) isn't implemented. When N0.6 lands, this will check `subject + capability + resource + scope + environment + policy + contract + approval + risk`. |
| Extension install goes through broker | ✅ | `/api/clone-os/extensions` POST calls `broker.authorizeExtensionInstall()` before mutating the `installed` flag. |
| PermissionGranted/Revoked events per capability | ✅ | Emitted on install/uninstall (ADR-0027). |

---

## N0.6 — Extension Runtime

| Item | Status | Notes |
| --- | --- | --- |
| Extension schema (database) | ✅ | `prisma/schema.prisma` — `Extension` model with capabilities, inputs, outputs, permissions, events, APIs, runtime/security/hardware requirements, certification, pricing, trust level, installed flag. |
| `ExtensionManifest` (typed) | ✅ | `src/lib/extensions/runtime.ts` — typed manifest matching the schema. |
| `ExtensionRuntime` interface | 🚧 | `install()`, `uninstall()`, `invoke()`, `start()`, `stop()`, `resolveVersion()`, `attest()`. Stub implementation throws `NOT_IMPLEMENTED`. |
| Extension process / sandbox | 🔴 | Not implemented. No sandbox, no process isolation, no invocation protocol. The `installed` flag is metadata; nothing actually executes. |
| Capability-brokered invocation | 🔴 | `authorizeExtensionInvocation()` returns deny. The agent cannot actually invoke an extension yet. |
| The cooking example | 🔴 | Not architecturally realized. `VISION_READ` + `TEMPERATURE_READ` + `ROBOTIC_MANIPULATION` are in the catalog but no extension supplies them at runtime. |

---

## N0.7 → N1.1 — Real Learning Pipeline (OPERATIONAL)

| Item | Status | Notes |
| --- | --- | --- |
| `LearningPipeline` | ✅ | `src/lib/learning/pipeline.ts` — **OPERATIONAL**. `capture()` records a LearningEvent with provenance classified at capture time. `extract()` uses the ModelProvider SPI (via ModelRouter → ZAIProvider) to extract candidate artifacts. `confirm()` handles approve/edit/reject/merge. `persist()` writes confirmed artifacts to Knowledge/Workflow/Policy/Memory tables + creates a CloneVersionCandidate. `release()` creates a new CloneVersion + updates Clone.currentVersionId. |
| `LearningEvent` model | ✅ | Prisma model: actorId, mode, rawInteraction, provenanceKind, confidence, confirmationState, candidateVersionId. |
| `CandidateArtifact` model | ✅ | Prisma model: artifactType, name, content, confidence, provenanceKind/Sensitivity/Portability, conflictsWithArtifactId, confirmationState, persistedArtifactType/Id, extractionModel/Latency. |
| Provenance classification at extraction time | ✅ | `src/lib/learning/provenance-classifier.ts` — classifies USER_GENERAL vs COMPANY_PROPRIETARY vs CLIENT_DATA vs PUBLIC etc. during extraction, NOT deferred to export. Keyword heuristics override the LLM's classification when specific patterns appear (e.g., mentions of a company's proprietary formula). |
| Conflict detection | ✅ | `src/lib/learning/conflict-detector.ts` — detects when a new candidate supersedes/conflicts with an existing artifact (keyword overlap). The UI shows "⚠ Conflicts: {name}" and offers Merge as an option. |
| Human confirmation workflow | ✅ | The system never auto-mutates the durable professional self from LLM inference alone. Approve / Edit / Reject / Merge / Ignore are all real actions. The confirm endpoint requires authentication + tenant scoping. |
| `CloneVersionCandidate` model | ✅ | Prisma model: baseVersionId, candidateVersion, status (draft→evaluating→pending_approval→approved/rejected→released), changeSet, learningEventIds, artifactIds, evaluationResults, scoreDelta, provenanceImpact, createdBy, approvedBy, releasedVersionId. |
| Versioned candidate → release flow | ✅ | `persist()` creates a CloneVersionCandidate from approved artifacts. `release()` creates a new CloneVersion + updates Clone.currentVersionId + emits CloneVersionReleased domain event. Production is never silently mutated — the ONLY way the active version changes is through release. |
| Old simulated training endpoint | 🟡 | `/api/clone-os/train` remains as a PROTOTYPE ADAPTER (clearly marked simulated:true in the response). It records sessions + emits events but does not change the clone. Use `/api/clone-os/learn` for real learning. |
| Acceptance test | ✅ | Verified: Sarah teaches "stage aging matters more than raw pipeline coverage" → LearningEvent captured → LLM extracts "Pipeline Review Priority Order" (decision_pattern, 95% confidence, user_general provenance) → Sarah approves → persisted as Workflow → CloneVersionCandidate v1.5.0 → released → new chat: clone references "stage aging first, then deal concentration, then rep-level slippage" — the exact procedure Sarah taught. **The clone's behavior genuinely changed.** |

---

## N0.8 — Evaluation / Fidelity Engine

| Item | Status | Notes |
| --- | --- | --- |
| `FidelityEngine` interface | 🚧 | `src/lib/fidelity/engine.ts` — `runCloneScenario()`, `captureHumanResponse()`, `compare()`, `storeEvidence()`, `recomputeCloneScore()`. Stub throws `NOT_IMPLEMENTED`. |
| `FidelityScenario` / `FidelityComparison` types | ✅ | Typed: scenario + human response + clone response + per-dimension divergence + agreement rate + headline + evidence. |
| FidelityDivergence records (data) | ✅ | Seeded for the MVP — 3 divergence reports with headlines like "agrees 94% of the time" and "consistently underestimates operational risk". These are FIXTURES, not computed by an engine. |
| CloneScore records (data) | ✅ | Seeded — 9-dimension score (87.4 aggregate). Also a FIXTURE. |
| Real scenario runner | 🔴 | Not implemented. No runtime runs the clone against a scenario and computes divergence. |
| Real CloneScore computation | 🔴 | Not implemented. The aggregate is a seeded value, not computed from divergence reports. |

---

## N0.9 — Versioned Clone State

| Item | Status | Notes |
| --- | --- | --- |
| `CloneVersion` model | ✅ | Schema has version, author, changeSet, trainingInputs, evaluationResults, performanceImpact, dependencies, provenance, releasedAt, rolledBackFrom. |
| Active version pointer | ✅ | `Clone.currentVersionId` points to the active production version. |
| Training does NOT mutate production | ✅ | The training endpoint creates a `TrainingSession` + events only. It does NOT bump `clone.aggregateScore` or create a new version. |
| `CloneVersionCandidate` flow | 🔴 | Not implemented. The proper flow is: training → candidate state → evaluation → fidelity comparison → approved → release → `currentVersionId` update. The current training endpoint stops at "session recorded + events emitted." |
| Rollback | 🟡 | The UI has a "Rollback" button that toasts "rollback queued" — but no actual rollback happens. The schema supports it (`rolledBackFrom` field); the runtime doesn't. |

---

## N0.10 — Portable Agent Package

| Item | Status | Notes |
| --- | --- | --- |
| `AgentPackage` serialization format | ✅ | `src/lib/runtime/agent-package.ts` — manifest version, identity, clone snapshot, expertise/skill/knowledge/workflow/policy/memory refs, capabilities, autonomy, tool/extension/model requirements, evaluation suite, safety constraints, provenance, licensing, certification, cryptographic identity, metadata. |
| `serializeAgentPackage` / `deserializeAgentPackage` | ✅ | JSON serialization helpers. |
| Export endpoint (`POST /api/agents/:id/export`) | 🔴 | Not implemented. `StubAgentPackageExporter` throws. |
| Import endpoint (`POST /api/agents/import`) | 🔴 | Not implemented. `StubAgentPackageImporter` throws. |
| Cryptographic signing | 🔴 | The format has an `identity.signature` field, but no actual signing happens. A real implementation would sign with the clone owner's private key and verify on import. |
| External runtime | 🔴 | Not implemented. An external runtime that ingests an AgentPackage does not exist. |

---

## Persistence

| Item | Status | Notes |
| --- | --- | --- |
| Prisma schema (PostgreSQL / Neon) | ✅ | 30+ models implementing the frozen core object model. |
| Database migrations | 🔴 | TODO — the project uses `prisma db push --accept-data-loss` for development. Production needs `prisma migrate` with a migration history, backward-compatible migration strategy, data migrations, and a rollback policy. |
| Provenance on every artifact | ✅ | Knowledge, Experience, Skill, Workflow, Extension, Tool, CloneVersion, etc. all carry provenance fields (owner, source, origin, license, visibility, sensitivity, portability). |

---

## Marketplace

| Item | Status | Notes |
| --- | --- | --- |
| MarketplaceListing schema | ✅ | packageType, capabilities, certification, reputation, pricingMode, priceCents, status. |
| Intent-based hiring endpoint | 🟡 | `/api/clone-os/marketplace` is a **BASELINE MATCHER / PROTOTYPE**. It's a keyword parser that decomposes the intent into required capabilities and ranks listings by capability match × reputation. The response explicitly says `simulated: true` and `matcherType: "baseline-keyword"`. The future engine needs: intent → capability extraction → skill requirements → outcome requirements → environment requirements → security requirements → certification requirements → availability → cost → reputation → historical outcome similarity → ranking. |

---

## Payments

| Item | Status | Notes |
| --- | --- | --- |
| Contract, Outcome, Payment, License, Reputation schema | ✅ | All modeled with configurable revenue splitting (expert/platform/extensionDeveloper/infrastructure/referral). |
| Escrow / payment processor / milestone release | 🔴 | Not implemented. The schema records that a payment was released; no real money moves. |
| Outcome verification / dispute / refund | 🔴 | Not implemented. |

---

## Tests

| Item | Status | Notes |
| --- | --- | --- |
| Test scaffold | ✅ | `tests/tenant-isolation.test.ts` — 8 tests, all pass. Run with `bun test tests/tenant-isolation.test.ts` (requires dev server on `http://127.0.0.1:3000` and seeded DB). The test script is `bun test`. |
| Tenant isolation tests | ✅ | 8 tests covering: admin/demo tenant separation, unauthenticated 401s on all protected endpoints, public demo clone access for unauthenticated, waitlist GET admin-only (the auth-gap fix), training rejects non-owned cloneId, training does NOT mutate aggregateScore (N0.9 verification), extension install auth + tenant scoping, socket-token single-use + short-lived. All pass (26 expect() calls). |
| Authorization tests | ✅ | Covered in the tenant-isolation test file — unauthenticated callers get 401 on all protected endpoints (train, extensions, socket-token, waitlist). |
| Versioning tests | ✅ | Covered — "training endpoint does not mutate clone.aggregateScore" verifies that training produces a session + events but does NOT bump the aggregate. |
| Capability enforcement tests | 🟡 | The broker is tested indirectly via the extension install endpoint. A direct unit test of `CapabilityBroker.authorizeExtensionInstall()` (mocking principal + tenant + capabilities + risk) is planned for N1.8. |
| Extension isolation tests | 🔴 | Not yet applicable — the extension runtime (N0.6) is not implemented, so there is no isolation to test. |
| Evaluation reproducibility tests | 🔴 | Not yet applicable — the fidelity engine (N0.8) is a stub, so there is no evaluation to reproduce. |
| Model-provider swapping tests | 🔴 | Not yet applicable — only ZAIProvider is operational; the other adapters are stubs. |

---

## What changed in this hardening pass

1. **Security (N0.0)**: rotated the exposed admin password; scrubbed git history; audited for other secrets.
2. **Identity + Authorization (N0.1)**: added `RequestContext` + `requireAuthenticated`/`requireAdmin`/`requireCloneOwner`; refactored every API route to resolve tenant/clone from session; added socket.io auth handshake (socket-token exchange); tightened CORS.
3. **Multi-tenancy (N0.2)**: fixed the unscoped `db.outcome.findMany()` and the global marketplace query (now scoped to listed/hired statuses only).
4. **Clone Runtime (N0.3)**: extracted prompt assembly into `CloneRuntime.buildContext()` + `toSystemPrompt()`; the mini-service uses the runtime instead of hand-assembling strings.
5. **Model Provider SPI (N0.4)**: added `ModelProvider` interface + `ZAIProvider` (operational) + stub adapters for OpenAI/Gemini/Local + `ModelRouter` with fallback logic; the mini-service uses `ModelRouter` instead of direct `ZAI.create()`.
6. **Capability/Policy Engine (N0.5)**: added `CapabilityBroker` with `authorizeExtensionInstall()`; extension install goes through the broker; high-risk/critical capabilities are flagged.
7. **Extension Runtime (N0.6)**: defined `ExtensionManifest` + `ExtensionRuntime` interface (stub).
8. **Real Learning Pipeline (N0.7)**: defined `LearningPipeline` interface (stub); marked the training endpoint as SIMULATED; removed the direct `clone.aggregateScore` mutation.
9. **Evaluation/Fidelity Engine (N0.8)**: defined `FidelityEngine` interface (stub); marked the seeded scores/divergences as FIXTURES.
10. **Versioned Clone State (N0.9)**: training no longer mutates production; the candidate-version flow is stubbed.
11. **Portable Agent Package (N0.10)**: defined the serialization format (stub export/import).

---

## What did NOT change

- The UI is frozen (per the reviewer's instruction). No new sections, no new demo behavior.
- The schema is preserved — no rewrite. The hardening added typed interfaces and runtime boundaries on top of the existing schema.
- The conceptual foundation (Clone as primary asset, capability-based permissions, provenance everywhere, versioning, portability) is preserved.

---

## Recommended next milestone (N1)

After N0 is complete (the stubs become real runtimes), the next milestone is to make the stubs operational one at a time:

1. **N1.1 — Real Learning Pipeline**: capture from chat → extract candidate artifacts → human confirmation → persist → evaluation.
2. **N1.2 — Real Fidelity Engine**: run scenarios against the clone → compare to human → compute divergence → recompute CloneScore.
3. **N1.3 — Versioned Clone State**: training produces `CloneVersionCandidate` → evaluation gates release → `currentVersionId` update.
4. **N1.4 — Extension Runtime**: sandbox + invocation protocol + lifecycle.
5. **N1.5 — Portable Agent Package**: export/import endpoints + cryptographic signing.
6. **N1.6 — Database migrations**: replace `db push` with `prisma migrate`.
7. **N1.7 — Automated tests**: tenant isolation, authorization, capability enforcement, versioning, evaluation reproducibility.

Each N1 item can be tackled independently. The stubs make the boundaries explicit — filling one in doesn't require touching the others.
