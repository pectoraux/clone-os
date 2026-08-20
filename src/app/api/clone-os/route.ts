// Clone OS — Consolidated Dashboard API
// ADR-0014: single comprehensive dashboard route. This endpoint returns the
// full platform state for the Sarah RevOps vertical so the dashboard can render
// in one round-trip. Domain-concept-shaped per ADR-0063.
//
// All queries are tenant-scoped (ADR-0004). For the MVP we default to Sarah's
// personal tenant — multi-tenant filtering is architectural, not a UI concern.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, resolveAccessibleClone } from "@/lib/auth/server";
import { computeAggregate, type CloneScoreDimensions } from "@/lib/clone-os/clone-score";
import { MODEL_PROVIDERS, ROUTING_RULES, type RoutingSignal } from "@/lib/clone-os/model-abstraction";
import { AUTONOMY_LEVELS, CAPABILITY_CATALOG } from "@/lib/clone-os/autonomy";
import { TRAINING_LOOP, TRAINING_MODES, DOMAIN_EVENTS } from "@/lib/clone-os/events";
import { SCORE_DIMENSIONS } from "@/lib/clone-os/clone-score";
import { CERTIFICATION_LEVELS, PACKAGE_TYPE_LABELS } from "@/lib/clone-os/package-manifest";
import { REPUTATION_METRICS, HIRING_MODE_LABELS, FIDELITY_DIMENSIONS } from "@/lib/clone-os/fidelity-engine";
import { SOURCE_KIND_LABELS, NODE_TYPE_LABELS, EDGE_TYPE_LABELS } from "@/lib/clone-os/expertise-graph";

export const dynamic = "force-dynamic";

function jparse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// GET /api/clone-os — full platform state for the dashboard
//
// N0.1 + N0.2: tenant and clone are resolved from the authenticated session,
// NOT from the request body. Unauthenticated callers get the public demo
// clone (visibility: marketplace) only. All tenant-scoped queries filter by
// the principal's tenantId. Marketplace listings are intentionally global
// (that's the marketplace's purpose) but outcomes are tenant-scoped.
export async function GET(_req: NextRequest) {
  const ctx = await getRequestContext();

  // Resolve the accessible clone.
  // - Authenticated principal: their tenant's sarah-revops clone (if present),
  //   else fall back to the marketplace-visible demo clone.
  // - Unauthenticated: only the marketplace-visible demo clone.
  const slug = "sarah-revops";
  const accessible = await resolveAccessibleClone(ctx, slug);
  if (!accessible) {
    return NextResponse.json(
      { error: "Clone not found or not accessible." },
      { status: 404 },
    );
  }

  // The effective tenant for scoping reads. For unauthenticated callers viewing
  // the demo clone, we use the clone's owning tenant (read-only).
  const effectiveTenantId = ctx.tenantId ?? accessible.tenantId;
  const tenant = await db.tenant.findUnique({ where: { id: effectiveTenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const clone = await db.clone.findFirst({
    where: { id: accessible.id },
    include: {
      professionalIdentity: { include: { user: true } },
      currentVersion: true,
      versions: { orderBy: { releasedAt: "desc" } },
      owner: true,
    },
  });
  if (!clone) {
    return NextResponse.json({ error: "Clone not seeded." }, { status: 500 });
  }

  const [skills, knowledge, experiences, memories, workflows, policies, trainingSessions, evaluations, score, divergences, certifications, agents, environments, extensions, tools, contracts, outcomes, reputation, license, listings, events, auditLogs, expertise] =
    await Promise.all([
      db.skill.findMany({ where: { cloneId: clone.id }, orderBy: { proficiency: "desc" } }),
      db.knowledge.findMany({ where: { cloneId: clone.id }, orderBy: { createdAt: "desc" } }),
      db.experience.findMany({ where: { cloneId: clone.id }, orderBy: { occurredAt: "desc" } }),
      db.memory.findMany({ where: { cloneId: clone.id }, orderBy: { importance: "desc" } }),
      db.workflow.findMany({ where: { cloneId: clone.id } }),
      db.policy.findMany({ where: { OR: [{ cloneId: clone.id }, { cloneId: null, tenantId: tenant.id }] } }),
      db.trainingSession.findMany({ where: { cloneId: clone.id }, orderBy: { startedAt: "desc" } }),
      db.evaluation.findMany({ where: { cloneId: clone.id }, orderBy: { createdAt: "desc" } }),
      db.cloneScore.findFirst({ where: { cloneId: clone.id }, orderBy: { computedAt: "desc" } }),
      db.fidelityDivergence.findMany({ where: { cloneId: clone.id }, orderBy: { createdAt: "desc" } }),
      db.certification.findMany({ where: { cloneId: clone.id } }),
      db.agent.findMany({ where: { cloneId: clone.id } }),
      db.environment.findMany({ where: { tenantId: tenant.id } }),
      db.extension.findMany({ where: { tenantId: tenant.id } }),
      db.tool.findMany({ where: { tenantId: tenant.id } }),
      db.contract.findMany({ where: { cloneId: clone.id }, orderBy: { createdAt: "desc" } }),
      // N0.2 fix: outcomes are tenant-scoped, not global.
      db.outcome.findMany({ where: { tenantId: tenant.id }, orderBy: { recordedAt: "desc" } }),
      db.reputation.findUnique({ where: { cloneId: clone.id } }),
      db.license.findMany({ where: { cloneId: clone.id } }),
      // Marketplace is intentionally global (cross-tenant listings), but only
      // published listings are returned to non-owners.
      db.marketplaceListing.findMany({
        where: { status: { in: ["listed", "hired"] } },
        orderBy: { publishedAt: "desc" },
      }),
      db.domainEvent.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.auditLog.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.expertise.findMany({ where: { cloneId: clone.id } }),
    ]);

  const persona = jparse(clone.personaJson, {});
  const personality = jparse(clone.personalityJson, {});
  const preferences = jparse(clone.preferencesJson, {});
  const behavior = jparse(clone.behaviorJson, {});
  const piValues = jparse<string[]>(clone.professionalIdentity?.valuesJson, []);
  const piCulture = jparse(clone.professionalIdentity?.cultureJson, {});

  return NextResponse.json({
    tenant,
    clone: {
      id: clone.id,
      slug: clone.slug,
      name: clone.name,
      summary: clone.summary,
      domain: clone.domain,
      status: clone.status,
      visibility: clone.visibility,
      certificationLevel: clone.certificationLevel,
      aggregateScore: clone.aggregateScore,
      createdAt: clone.createdAt,
      updatedAt: clone.updatedAt,
      persona,
      personality,
      preferences,
      behavior,
      professionalIdentity: clone.professionalIdentity
        ? {
            title: clone.professionalIdentity.title,
            domain: clone.professionalIdentity.domain,
            bio: clone.professionalIdentity.bio,
            values: piValues,
            culture: piCulture,
            user: clone.professionalIdentity.user
              ? { name: clone.professionalIdentity.user.name, email: clone.professionalIdentity.user.email, publicKey: clone.professionalIdentity.user.publicKey }
              : null,
          }
        : null,
      currentVersion: clone.currentVersion
        ? {
            version: clone.currentVersion.version,
            changeSet: jparse<string[]>(clone.currentVersion.changeSetJson, []),
            trainingInputs: jparse(clone.currentVersion.trainingInputsJson, {}),
            evaluationResults: jparse(clone.currentVersion.evaluationResultsJson, {}),
            performanceImpact: clone.currentVersion.performanceImpact,
            dependencies: jparse(clone.currentVersion.dependenciesJson, {}),
            provenance: jparse(clone.currentVersion.provenanceJson, {}),
            releasedAt: clone.currentVersion.releasedAt,
            author: clone.owner?.name ?? "unknown",
          }
        : null,
    },
    versions: clone.versions.map((v) => ({
      id: v.id,
      version: v.version,
      changeSet: jparse<string[]>(v.changeSetJson, []),
      trainingInputs: jparse(v.trainingInputsJson, {}),
      evaluationResults: jparse(v.evaluationResultsJson, {}),
      performanceImpact: v.performanceImpact,
      provenance: jparse(v.provenanceJson, {}),
      releasedAt: v.releasedAt,
      author: clone.owner?.name ?? "unknown",
    })),
    expertise: expertise.map((e) => ({
      id: e.id,
      nodeType: e.nodeType,
      name: e.name,
      description: e.description,
      proficiency: e.proficiency,
      sourceKind: e.sourceKind,
      sourceLabel: SOURCE_KIND_LABELS[e.sourceKind as keyof typeof SOURCE_KIND_LABELS] ?? e.sourceKind,
      sensitivity: e.sensitivity,
      portability: e.portability,
      visibility: e.visibility,
      edges: jparse(e.edgesJson, []),
    })),
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      proficiency: s.proficiency,
      description: s.description,
      certificationLevel: s.certificationLevel,
      requires: jparse(s.requiresJson, []),
      provenance: jparse(s.provenanceJson, {}),
    })),
    knowledge: knowledge.map((k) => ({
      id: k.id,
      title: k.title,
      content: k.content,
      kind: k.kind,
      tags: jparse(k.tagsJson, []),
      sourceKind: k.sourceKind,
      sourceLabel: SOURCE_KIND_LABELS[k.sourceKind as keyof typeof SOURCE_KIND_LABELS] ?? k.sourceKind,
      sensitivity: k.sensitivity,
      portability: k.portability,
      visibility: k.visibility,
    })),
    experiences: experiences.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      occurredAt: e.occurredAt,
      outcome: e.outcome,
      lessons: jparse(e.lessonsJson, []),
      provenance: jparse(e.provenanceJson, {}),
    })),
    memories: memories.map((m) => ({
      id: m.id,
      kind: m.kind,
      content: m.content,
      importance: m.importance,
    })),
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      triggerKind: w.triggerKind,
      version: w.version,
      steps: jparse(w.stepsJson, []),
    })),
    policies: policies.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      appliesTo: p.appliesTo,
      version: p.version,
      rule: jparse(p.ruleJson, {}),
    })),
    trainingSessions: trainingSessions.map((s) => ({
      id: s.id,
      mode: s.mode,
      stage: s.stage,
      input: jparse(s.inputJson, {}),
      output: jparse(s.outputJson, {}),
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      durationMs: s.durationMs,
      notes: s.notes,
    })),
    evaluations: evaluations.map((e) => ({
      id: e.id,
      kind: e.kind,
      scenario: jparse(e.scenarioJson, {}).scenario ?? "",
      result: jparse(e.resultJson, {}),
      overallScore: e.overallScore,
      createdAt: e.createdAt,
    })),
    score: score
      ? {
          dimensions: SCORE_DIMENSIONS.map((d) => ({
            key: d.key,
            label: d.label,
            description: d.description,
            value: (score as any)[d.key] as number,
          })),
          aggregate: score.aggregate,
          notes: score.notes,
          computedAt: score.computedAt,
        }
      : null,
    divergences: divergences.map((d) => ({
      id: d.id,
      scenario: d.scenario,
      humanResponse: jparse(d.humanResponseJson, {}),
      cloneResponse: jparse(d.cloneResponseJson, {}),
      divergence: jparse(d.divergenceJson, {}),
      agreementRate: d.agreementRate,
      headline: d.headline,
      createdAt: d.createdAt,
    })),
    certifications: certifications.map((c) => ({
      id: c.id,
      level: c.level,
      requirement: c.requirement,
      evidence: jparse(c.evidenceJson, {}),
      grantedBy: c.grantedBy,
      grantedAt: c.grantedAt,
    })),
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      specialization: a.specialization,
      description: a.description,
      capabilities: jparse(a.approvedCapabilitiesJson, []),
      autonomyLevel: a.autonomyLevel,
      status: a.status,
      certificationLevel: a.certificationLevel,
      packageManifest: jparse(a.packageManifestJson, {}),
      modelRequirements: jparse(a.modelRequirementsJson, {}),
    })),
    environments: environments.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      description: e.description,
      availableData: jparse(e.availableDataJson, []),
      availableTools: jparse(e.availableToolsJson, []),
      availableExtensions: jparse(e.availableExtensionsJson, []),
      availablePeople: jparse(e.availablePeopleJson, []),
      availableSystems: jparse(e.availableSystemsJson, []),
      availableDevices: jparse(e.availableDevicesJson, []),
      rules: jparse(e.rulesJson, []),
      policies: jparse(e.policiesJson, []),
      constraints: jparse(e.constraintsJson, []),
    })),
    extensions: extensions.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      version: e.version,
      description: e.description,
      capabilities: jparse(e.capabilitiesJson, []),
      permissions: jparse(e.permissionsJson, []),
      events: jparse(e.eventsJson, []),
      runtimeRequirements: jparse(e.runtimeRequirementsJson, {}),
      securityRequirements: jparse(e.securityRequirementsJson, {}),
      hardwareRequirements: jparse(e.hardwareRequirementsJson, {}),
      certification: e.certification,
      trustLevel: e.trustLevel,
      pricing: jparse(e.pricingJson, {}),
      installed: e.installed,
    })),
    tools: tools.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      capabilities: jparse(t.capabilitiesJson, []),
      version: t.version,
      provenance: jparse(t.provenanceJson, {}),
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      objective: c.objective,
      hiringMode: c.hiringMode,
      hiringModeLabel: HIRING_MODE_LABELS[c.hiringMode] ?? c.hiringMode,
      requiredActions: jparse(c.requiredActionsJson, []),
      constraints: jparse(c.constraintsJson, []),
      successCriteria: jparse(c.successCriteriaJson, []),
      sla: jparse(c.slaJson, {}),
      budgetCents: c.budgetCents,
      permissions: jparse(c.permissionsJson, []),
      dataAccess: jparse(c.dataAccessJson, {}),
      durationDays: c.durationDays,
      status: c.status,
      createdAt: c.createdAt,
    })),
    outcomes: outcomes.map((o) => ({
      id: o.id,
      contractId: o.contractId,
      objectiveMet: o.objectiveMet,
      metric: jparse(o.metricJson, {}),
      clientFeedback: o.clientFeedback,
      humanInterventionRate: o.humanInterventionRate,
      successRate: o.successRate,
      recordedAt: o.recordedAt,
    })),
    reputation: reputation
      ? {
          tasksCompleted: reputation.tasksCompleted,
          successRate: reputation.successRate,
          outcomeRate: reputation.outcomeRate,
          reliability: reputation.reliability,
          clientRetention: reputation.clientRetention,
          averageRating: reputation.averageRating,
          certificationsCount: reputation.certificationsCount,
          experienceYears: reputation.experienceYears,
          responseTimeMins: reputation.responseTimeMins,
          slaCompliance: reputation.slaCompliance,
          humanInterventionRate: reputation.humanInterventionRate,
          subjectiveReviews: jparse(reputation.subjectiveReviewsJson, []),
        }
      : null,
    license: license.map((l) => ({
      id: l.id,
      kind: l.kind,
      terms: jparse(l.termsJson, {}),
      grantedAt: l.grantedAt,
      expiresAt: l.expiresAt,
    })),
    marketplace: listings.map((l) => ({
      id: l.id,
      packageType: l.packageType,
      packageTypeLabel: PACKAGE_TYPE_LABELS[l.packageType as keyof typeof PACKAGE_TYPE_LABELS] ?? l.packageType,
      name: l.name,
      description: l.description,
      capabilities: jparse(l.capabilitiesJson, []),
      certificationLevel: l.certificationLevel,
      reputation: jparse(l.reputationJson, {}),
      pricingMode: l.pricingMode,
      pricingModeLabel: HIRING_MODE_LABELS[l.pricingMode] ?? l.pricingMode,
      priceCents: l.priceCents,
      status: l.status,
      publishedAt: l.publishedAt,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      payload: jparse(e.payloadJson, {}),
      createdAt: e.createdAt,
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      details: jparse(a.detailsJson, {}),
      createdAt: a.createdAt,
    })),
    // Reference catalogs (frozen design surface)
    catalogs: {
      scoreDimensions: SCORE_DIMENSIONS,
      fidelityDimensions: FIDELITY_DIMENSIONS,
      autonomyLevels: AUTONOMY_LEVELS,
      capabilities: CAPABILITY_CATALOG,
      modelProviders: MODEL_PROVIDERS,
      routingRules: ROUTING_RULES,
      trainingLoop: TRAINING_LOOP,
      trainingModes: TRAINING_MODES,
      domainEvents: DOMAIN_EVENTS,
      certificationLevels: CERTIFICATION_LEVELS,
      packageTypes: Object.entries(PACKAGE_TYPE_LABELS).map(([k, v]) => ({ type: k, label: v })),
      sourceKinds: Object.entries(SOURCE_KIND_LABELS).map(([k, v]) => ({ key: k, label: v })),
      nodeTypes: Object.entries(NODE_TYPE_LABELS).map(([k, v]) => ({ key: k, label: v })),
      edgeTypes: Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => ({ key: k, label: v })),
      hiringModes: Object.entries(HIRING_MODE_LABELS).map(([k, v]) => ({ key: k, label: v })),
      reputationMetrics: REPUTATION_METRICS,
    },
  });
}
