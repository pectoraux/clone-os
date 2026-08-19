// Clone OS — Seed Script
// Builds the deep Sales/Revenue Operations vertical anchored on the "Sarah" example
// from the master prompt. Demonstrates the complete loop end-to-end.
//
// Run with:  bun run scripts/seed.ts

import { PrismaClient } from "@prisma/client";
import { computeAggregate } from "../src/lib/clone-os/clone-score";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

function j(o: unknown): string {
  return JSON.stringify(o);
}

// Idempotent create-or-skip for slug-unique models. Re-running the seed should
// never fail on existing rows; we just skip them.
async function createOrSkip<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (e: any) {
    if (e?.code === "P2002") return null; // unique constraint violation
    throw e;
  }
}

async function main() {
  console.log("Seeding Clone OS...");

  // ---------- TENANTS ----------
  const platformTenant = await db.tenant.upsert({
    where: { slug: "platform" },
    update: {},
    create: { kind: "platform", name: "Clone OS Platform", slug: "platform" },
  });

  const orgTenant = await db.tenant.upsert({
    where: { slug: "northwind" },
    update: {},
    create: {
      kind: "organization",
      name: "Northwind Revenue Co.",
      slug: "northwind",
      parentId: platformTenant.id,
    },
  });

  const personalTenant = await db.tenant.upsert({
    where: { slug: "sarah-personal" },
    update: {},
    create: {
      kind: "individual",
      name: "Sarah's Personal Tenant",
      slug: "sarah-personal",
      parentId: platformTenant.id,
    },
  });

  // ---------- USERS ----------
  // Real admin — email + password come from env (ADMIN_EMAIL / ADMIN_PASSWORD).
  // Never hardcode credentials in source. The admin is created on first seed;
  // on subsequent seeds the password is rotated to match the current env value.
  const adminEmail = process.env.ADMIN_EMAIL || "ekontetevi@gmail";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "ADMIN_PASSWORD env var is required to seed the real admin. Set it in .env (never commit .env).",
    );
  }
  const adminTenant = await db.tenant.upsert({
    where: { slug: "clone-os-admin" },
    update: {},
    create: {
      kind: "organization",
      name: "Clone OS Admin",
      slug: "clone-os-admin",
      parentId: platformTenant.id,
    },
  });
  // upsert won't update the passwordHash on existing rows (update: {}).
  // For the admin, we want to rotate the password on every seed so the env
  // is the source of truth. We do a find-then-create-or-update.
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  const realAdmin = existingAdmin
    ? await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash: hashPassword(adminPassword),
          role: "admin",
          accountStatus: "admin",
        },
      })
    : await db.user.create({
        data: {
          tenantId: adminTenant.id,
          email: adminEmail,
          name: "Clone OS Admin",
          role: "admin",
          publicKey: `pk_admin_${Math.random().toString(36).slice(2, 12)}`,
          passwordHash: hashPassword(adminPassword),
          accountStatus: "admin",
        },
      });

  // Sarah Chen — the demo "user" who owns the RevOps clone
  const sarah = await db.user.upsert({
    where: { email: "sarah@clone.os" },
    update: {},
    create: {
      tenantId: personalTenant.id,
      email: "sarah@clone.os",
      name: "Sarah Chen",
      role: "owner",
      publicKey: "pk_sarah_revops_0x9a3f7c2d",
      passwordHash: hashPassword("demo"),
      accountStatus: "demo",
    },
  });

  // Additional demo accounts — quick-login for each user type
  const demoAccounts = [
    {
      email: "sarah-admin@clone.os",
      name: "Sarah Chen (Demo Admin)",
      role: "admin",
    },
    {
      email: "candidate@clone.os",
      name: "Alex Rivera (Demo Candidate)",
      role: "candidate",
    },
    {
      email: "dev@clone.os",
      name: "Jordan Lee (Demo Developer)",
      role: "developer",
    },
  ];
  for (const d of demoAccounts) {
    await db.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        tenantId: personalTenant.id,
        email: d.email,
        name: d.name,
        role: d.role,
        publicKey: `pk_${d.email.replace(/[^a-z0-9]/g, "")}_${Math.random().toString(36).slice(2, 8)}`,
        passwordHash: hashPassword("demo"),
        accountStatus: "demo",
      },
    });
  }

  // ---------- PROFESSIONAL IDENTITY ----------
  const pid = await db.professionalIdentity.upsert({
    where: { userId: sarah.id },
    update: {},
    create: {
      tenantId: personalTenant.id,
      userId: sarah.id,
      title: "Senior RevOps Manager",
      domain: "Revenue Operations",
      bio: "12 years scaling B2B SaaS revenue engines. Built RevOps at three unicorns. Specializes in pipeline hygiene, ICP definition, sales/finance alignment, and revenue forecasting.",
      valuesJson: j([
        "Pipeline integrity over vanity metrics",
        "Customer outcomes over deal velocity",
        "Cross-functional transparency",
        "Data-driven decisions, intuition second",
        "Documented process over heroics",
      ]),
      cultureJson: j({
        professional: "Direct, evidence-first, low-ego",
        organizational: "Prefers async-first teams; values written specs; weekly operating reviews",
        social: "Inclusive language; names matter; credit publicly, correct privately",
        contextual: "B2B SaaS norms; financial discipline; forecast conservatism",
      }),
    },
  });

  // ---------- CLONE ----------
  const clone = await db.clone.upsert({
    where: { slug: "sarah-revops" },
    update: {},
    create: {
      tenantId: personalTenant.id,
      ownerId: sarah.id,
      professionalIdentityId: pid.id,
      slug: "sarah-revops",
      name: "Sarah — Revenue Operations Clone",
      summary:
        "Faithful digital representation of Sarah Chen's professional self in Revenue Operations. Trained on 12 years of B2B SaaS pipeline, ICP, and forecasting work.",
      domain: "Revenue Operations",
      status: "deployed",
      visibility: "marketplace",
      certificationLevel: "professionally_verified",
      personaJson: j({
        communicationStyle: "Direct and evidence-first. Concise. Leads with the answer, then the reasoning.",
        tone: "Professional, calm, low-ego. Names specifics (numbers, owners, dates).",
        vocabulary: ["ICP", "MQL/SQL", "ARR", "NRR", "CAC payback", "pipeline coverage", "stage conversion"],
        formality: "Professional-casual (first names, no jargon-for-jargon's-sake).",
        directness: 0.85,
        structure: "Problem → Options → Recommendation → Risks → Next step",
        defaultsToWriting: true,
      }),
      personalityJson: j({
        openness: 0.78,
        conscientiousness: 0.9,
        extraversion: 0.55,
        agreeableness: 0.6,
        neuroticism: 0.35,
        riskTolerance: 0.4,
        ambiguityTolerance: 0.6,
        pace: "measured",
      }),
      preferencesJson: j({
        forecasting: "conservative; prefer under-commit / over-deliver",
        pipeline: "quality over quantity; disqualify early",
        outreach: "researched, personalized, multi-touch",
        reporting: "weekly operating review; leading indicators over lagging",
        escalation: "escalate ambiguity and high-dollar approvals",
      }),
      behaviorJson: j({
        defaultBehavior: "Disqualify aggressively early; protect downstream reps from junk leads.",
        underPressure: "Slows down, writes the spec, gets the data before deciding.",
        onConflict: "Defaults to written async resolution; surfaces trade-offs explicitly.",
        onAmbiguity: "Names the ambiguity explicitly and proposes a de-risking path.",
      }),
      aggregateScore: 87.4,
    },
  });

  // ---------- CLONE VERSIONS (ADR-0010) ----------
  const v1 = await db.cloneVersion.create({
    data: {
      cloneId: clone.id,
      version: "1.0.0",
      authorId: sarah.id,
      changeSetJson: j(["Initial training: persona, ICP framework, pipeline hygiene playbook"]),
      trainingInputsJson: j({ sessions: 4, demonstrations: 12, corrections: 3 }),
      evaluationResultsJson: j({ aggregate: 62.1 }),
      performanceImpact: null,
      dependenciesJson: j({ extensions: ["crm", "email"], models: ["claude", "small"] }),
      provenanceJson: j({ owner: "sarah", source: "personal", origin: personalTenant.id, portability: "portable" }),
    },
  });
  const v2 = await db.cloneVersion.create({
    data: {
      cloneId: clone.id,
      version: "1.2.0",
      authorId: sarah.id,
      changeSetJson: j(["Added forecasting model", "Added monthly operating review workflow"]),
      trainingInputsJson: j({ sessions: 9, demonstrations: 28, corrections: 11 }),
      evaluationResultsJson: j({ aggregate: 74.5 }),
      performanceImpact: 12.4,
      dependenciesJson: j({ extensions: ["crm", "email", "calendar"], models: ["claude", "gemini"] }),
      provenanceJson: j({ owner: "sarah", source: "personal", origin: personalTenant.id, portability: "portable" }),
    },
  });
  const v3 = await db.cloneVersion.create({
    data: {
      cloneId: clone.id,
      version: "1.4.0",
      authorId: sarah.id,
      changeSetJson: j(["Adversarial training on edge cases", "Cross-tenant licensed knowledge added", "Outcome feedback from 4 contracts"]),
      trainingInputsJson: j({ sessions: 14, demonstrations: 47, corrections: 22, realWorldOutcomes: 4 }),
      evaluationResultsJson: j({ aggregate: 87.4 }),
      performanceImpact: 12.9,
      dependenciesJson: j({ extensions: ["crm", "email", "calendar", "slack", "browser"], models: ["claude", "gemini", "local"] }),
      provenanceJson: j({ owner: "sarah", source: "personal", origin: personalTenant.id, portability: "portable" }),
    },
  });
  await db.clone.update({ where: { id: clone.id }, data: { currentVersionId: v3.id } });

  // ---------- EXPERTISE GRAPH (ADR-0010) ----------
  const expertiseNodes = [
    { nodeType: "domain", name: "Revenue Operations", description: "End-to-end revenue engine: marketing → sales → CS → finance." },
    { nodeType: "concept", name: "ICP Definition", description: "Ideal Customer Profile framework: firmographic + technographic + behavioral signals." },
    { nodeType: "skill", name: "Pipeline Hygiene", description: "Disqualify junk leads early; protect downstream rep capacity.", proficiency: 92 },
    { nodeType: "skill", name: "Revenue Forecasting", description: "Bottoms-up, weighted-pipeline forecast with confidence bands.", proficiency: 88 },
    { nodeType: "skill", name: "Lead Qualification", description: "BANT + ICP-fit scoring; researches the account before outreach.", proficiency: 90 },
    { nodeType: "skill", name: "CRM Management", description: "Salesforce hygiene, stage definitions, automation rules.", proficiency: 85 },
    { nodeType: "skill", name: "Sales/Finance Alignment", description: "Revenue recognition rules, ARR bridge, reconciliation cadence.", proficiency: 80 },
    { nodeType: "tool", name: "Salesforce", description: "Primary CRM.", proficiency: 88 },
    { nodeType: "tool", name: "Outreach.io", description: "Sequence + cadence tool.", proficiency: 78 },
    { nodeType: "tool", name: "Gong", description: "Conversation intelligence.", proficiency: 70 },
    { nodeType: "procedure", name: "Weekly Operating Review", description: "Pipeline coverage → stage conversion → forecast delta → risks → actions.", proficiency: 91 },
    { nodeType: "procedure", name: "New Lead Triage", description: "Inbound lead → research → ICP-fit score → route or disqualify.", proficiency: 93 },
    { nodeType: "decision", name: "Disqualify vs Nurture", description: "Disqualify if outside ICP AND no trigger event; otherwise nurture.", proficiency: 86 },
    { nodeType: "failure", name: "Forecast Inflation", description: "Reps over-weighting deals; counter with stage-conv evidence.", proficiency: 82 },
    { nodeType: "artifact", name: "Pipeline Coverage Report", description: "Weekly coverage by segment with required 3.5x target.", proficiency: 89 },
  ];
  for (const node of expertiseNodes) {
    await db.expertise.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        nodeType: node.nodeType,
        name: node.name,
        description: node.description ?? null,
        proficiency: node.proficiency ?? null,
        sourceKind: "user_general",
        originTenantId: personalTenant.id,
        license: "marketplace",
        visibility: "marketplace",
        sensitivity: "internal",
        portability: "portable",
        edgesJson: j([
          { type: "specializes_in", targetId: "domain:revops", targetName: "Revenue Operations" },
          ...(node.nodeType === "skill"
            ? [{ type: "requires", targetId: "concept:icp", targetName: "ICP Definition" }]
            : []),
        ]),
      },
    });
  }

  // ---------- SKILLS (measurable) ----------
  const skills = [
    { name: "Pipeline Hygiene", domain: "RevOps", proficiency: 92 },
    { name: "Revenue Forecasting", domain: "RevOps", proficiency: 88 },
    { name: "Lead Qualification", domain: "Sales", proficiency: 90 },
    { name: "CRM Management", domain: "Sales", proficiency: 85 },
    { name: "Sales/Finance Alignment", domain: "Finance", proficiency: 80 },
    { name: "Outreach Personalization", domain: "Sales", proficiency: 84 },
    { name: "Operating Review Facilitation", domain: "RevOps", proficiency: 91 },
  ];
  for (const s of skills) {
    await db.skill.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        name: s.name,
        domain: s.domain,
        proficiency: s.proficiency,
        description: `${s.name} — ${s.domain} capability, ${s.proficiency}% proficiency.`,
        requiresJson: j(["ICP framework", "stage definitions", "CRM access"]),
        demonstratedBy: "exp:triage-2024-q3",
        evaluatedBy: "eval:revops-bench-v2",
        certificationLevel: "professionally_verified",
        provenanceJson: j({ owner: "sarah", source: "personal", portability: "portable" }),
      },
    });
  }

  // ---------- KNOWLEDGE (provenance-tagged — ADR-0003) ----------
  const knowledge = [
    { title: "ICP Framework", kind: "principle", content: "ICP = firmographic fit × technographic fit × behavioral signal × trigger event.", sourceKind: "user_general", sensitivity: "internal", portability: "portable" },
    { title: "Pipeline Coverage Target", kind: "fact", content: "Maintain 3.5x pipeline coverage for the next quarter at all times.", sourceKind: "user_general", sensitivity: "internal", portability: "portable" },
    { title: "Stage Conversion Benchmarks (B2B SaaS)", kind: "reference", content: "MQL→SQL 22%, SQL→Opp 45%, Opp→Win 28% for mid-market SaaS.", sourceKind: "public", sensitivity: "public", portability: "portable" },
    { title: "Northwind Customer List (Confidential)", kind: "fact", content: "Top-50 accounts, ARR, NRR, exec sponsors. NOT portable.", sourceKind: "company_proprietary", sensitivity: "confidential", portability: "tenant_locked" },
    { title: "Acme Corp Engagement History", kind: "precedent", content: "Account history with Acme Corp under Q3 contract. Client-locked.", sourceKind: "client_data", sensitivity: "restricted", portability: "client_locked" },
    { title: "Forecast Inflation Patterns", kind: "heuristic", content: "When weighted-pipeline exceeds historical close-rate implied revenue by >30%, flag for review.", sourceKind: "user_general", sensitivity: "internal", portability: "portable" },
    { title: "Outreach Tone Guide", kind: "procedure", content: "Lead with research-backed insight; one CTA; never 'just checking in'.", sourceKind: "user_general", sensitivity: "internal", portability: "portable" },
  ];
  for (const k of knowledge) {
    await db.knowledge.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        title: k.title,
        content: k.content,
        kind: k.kind,
        tagsJson: j([k.kind, k.sourceKind]),
        sourceKind: k.sourceKind,
        originTenantId: personalTenant.id,
        license: k.sourceKind === "client_data" ? "restricted" : "marketplace",
        visibility: k.sourceKind === "client_data" ? "restricted" : "marketplace",
        sensitivity: k.sensitivity,
        portability: k.portability,
      },
    });
  }

  // ---------- EXPERIENCES ----------
  const experiences = [
    { title: "Scaled RevOps at Acme (2020–2023)", desc: "Built RevOps from 0; took pipeline coverage from 1.8x to 3.6x.", occurredAt: new Date("2023-08-15"), outcome: "success", lessons: ["Hire a CRM admin early", "Forecast cadence > forecast precision"] },
    { title: "Botched enterprise forecast (2019)", desc: "Over-weighted 3 deals in commit; missed by 40%.", occurredAt: new Date("2019-11-01"), outcome: "failure", lessons: ["Stage conv evidence over rep confidence", "Always include worst-case band"] },
    { title: "Disqualified Fortune-100 lead", desc: "Outside ICP fit; trigger event was weak. Saved SDR 12 hours.", occurredAt: new Date("2024-02-10"), outcome: "success", lessons: ["Disqualify aggressively early"] },
  ];
  for (const e of experiences) {
    await db.experience.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        title: e.title,
        description: e.desc,
        occurredAt: e.occurredAt,
        outcome: e.outcome,
        lessonsJson: j(e.lessons),
        skillIdsJson: j(["pipeline_hygiene", "forecasting"]),
        provenanceJson: j({ owner: "sarah", portability: "portable" }),
      },
    });
  }

  // ---------- MEMORY ----------
  const memories = [
    { kind: "preference", content: "Sarah prefers to escalate forecast variance > 15% to the VP Rev.", importance: 0.9 },
    { kind: "correction", content: "When the clone recommended 'just checking in' outreach, Sarah corrected: lead with research.", importance: 0.95 },
    { kind: "episodic", content: "2024-02-10: Disqualified Fortune-100 lead. Trigger event was a press release, not an actual need.", importance: 0.8 },
    { kind: "procedural", content: "Triage order: ICP-fit → trigger event → decision-maker reachable → budget signal → route.", importance: 0.92 },
    { kind: "semantic", content: "Northwind uses stage definitions: MQL/SQL/Opp/Negotiated/Won. Each has exit criteria.", importance: 0.7 },
  ];
  for (const m of memories) {
    await db.memory.create({
      data: { cloneId: clone.id, tenantId: personalTenant.id, kind: m.kind, content: m.content, importance: m.importance },
    });
  }

  // ---------- WORKFLOWS ----------
  const workflows = [
    { name: "New Lead Triage", description: "Inbound lead → research → ICP-fit score → route or disqualify.", triggerKind: "event" },
    { name: "Weekly Operating Review", description: "Pipeline coverage → stage conversion → forecast delta → risks → actions.", triggerKind: "schedule" },
    { name: "Forecast Variance Escalation", description: "If forecast variance > 15%, escalate to VP Rev with evidence.", triggerKind: "event" },
    { name: "Qualified Lead Outreach", description: "Research account → personalize opener → 5-touch sequence over 14 days.", triggerKind: "manual" },
  ];
  for (const w of workflows) {
    await db.workflow.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        name: w.name,
        description: w.description,
        stepsJson: j([
          "Receive trigger",
          "Load context from CRM",
          "Apply policies",
          "Propose action",
          "If high-risk, request approval",
          "Execute",
          "Record outcome",
        ]),
        triggerKind: w.triggerKind,
        version: "1.2.0",
        provenanceJson: j({ owner: "sarah", portability: "portable" }),
      },
    });
  }

  // ---------- POLICIES ----------
  const policies = [
    { name: "Never auto-send to Fortune-500 without approval", appliesTo: "agent", rule: { capability: "SEND_EMAIL", scope: "fortune_500", approval: "required" } },
    { name: "Disqualify if ICP-fit < 0.4", appliesTo: "agent", rule: { capability: "WRITE_CRM", action: "disqualify", threshold: 0.4 } },
    { name: "Escalate refunds > $5,000", appliesTo: "agent", rule: { capability: "ISSUE_REFUND", maxAuto: 5000 } },
    { name: "Browser automation must disclose bot identity", appliesTo: "extension", rule: { capability: "BROWSER_AUTOMATION", disclosure: "required" } },
  ];
  for (const p of policies) {
    await db.policy.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        name: p.name,
        description: p.name,
        ruleJson: j(p.rule),
        appliesTo: p.appliesTo,
        version: "1.0.0",
      },
    });
  }

  // ---------- TRAINING SESSIONS (ADR-0007, ADR-0008) ----------
  const sessions = [
    { mode: "teaching", stage: "teach", input: { topic: "ICP framework" }, output: { notes: "Sarah explained ICP formula." }, durationMs: 124_000, status: "completed" },
    { mode: "demonstration", stage: "demonstrate", input: { task: "Triage 5 inbound leads" }, output: { routed: 2, disqualified: 3 }, durationMs: 480_000, status: "completed" },
    { mode: "correction", stage: "train", input: { attempt: "Outreach without research" }, output: { correction: "Lead with research" }, durationMs: 90_000, status: "completed" },
    { mode: "shadowing", stage: "observe", input: { observed: "Weekly operating review" }, output: { captured: "Cadence + script" }, durationMs: 1_800_000, status: "completed" },
    { mode: "assisted", stage: "evaluate", input: { proposal: "Disqualify Acme lead" }, output: { approved: true }, durationMs: 60_000, status: "completed" },
    { mode: "simulation", stage: "simulate", input: { scenario: "Forecast miss simulation" }, output: { surfacedFailure: "Over-weighting commit" }, durationMs: 220_000, status: "completed" },
    { mode: "adversarial", stage: "evaluate", input: { edgeCase: "Conflicting ICP signals" }, output: { divergence: 0.18 }, durationMs: 180_000, status: "completed" },
    { mode: "real_world", stage: "measure", input: { contractId: "ct-001" }, output: { outcomeMet: true, humanIntervention: 0.12 }, durationMs: 3_600_000, status: "completed" },
  ];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    await db.trainingSession.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        ownerId: sarah.id,
        mode: s.mode,
        stage: s.stage,
        inputJson: j(s.input),
        outputJson: j(s.output),
        skillsTouchedJson: j(["pipeline_hygiene", "forecasting"]),
        status: s.status,
        completedAt: new Date(Date.now() - (sessions.length - i) * 86_400_000),
        durationMs: s.durationMs,
        notes: `Session ${i + 1}`,
      },
    });
  }

  // ---------- EVALUATIONS ----------
  const evals = [
    { kind: "scenario", scenario: "Lead triage on 5 inbound leads", result: { decisionFidelity: 0.94, communicationFidelity: 0.88 }, overall: 0.91 },
    { kind: "simulation", scenario: "Forecast miss simulation", result: { decisionFidelity: 0.78, behavioralFidelity: 0.85 }, overall: 0.82 },
    { kind: "adversarial", scenario: "Conflicting ICP signals", result: { decisionFidelity: 0.7, behavioralFidelity: 0.72 }, overall: 0.71 },
    { kind: "human_review", scenario: "Reviewed by Sarah", result: { personalityFidelity: 0.92, communicationFidelity: 0.9 }, overall: 0.91 },
    { kind: "regression", scenario: "v1.4.0 release test", result: { professionalFidelity: 0.88 }, overall: 0.88 },
    { kind: "real_world", scenario: "4 contracts (Q1)", result: { outcomeFidelity: 0.86, reliability: 0.9 }, overall: 0.88 },
  ];
  for (const e of evals) {
    await db.evaluation.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        reviewerId: sarah.id,
        kind: e.kind,
        scenarioJson: j({ scenario: e.scenario }),
        resultJson: j(e.result),
        overallScore: e.overall,
      },
    });
  }

  // ---------- CLONE SCORE (multidimensional — ADR-0011) ----------
  const dims = {
    professionalFidelity: 88.6,
    knowledgeFidelity: 86.2,
    skillFidelity: 87.9,
    decisionFidelity: 89.4,
    behavioralFidelity: 86.7,
    communicationFidelity: 88.1,
    personalityFidelity: 84.5,
    culturalFidelity: 82.3,
    outcomeFidelity: 86.0,
  };
  await db.cloneScore.create({
    data: {
      cloneId: clone.id,
      tenantId: personalTenant.id,
      ...dims,
      aggregate: computeAggregate(dims),
      notes: "Computed at v1.4.0 release.",
    },
  });

  // ---------- FIDELITY DIVERGENCE (ADR-0012) ----------
  const divergences = [
    {
      scenario: "Lead triage on 5 inbound leads",
      human: { decision: "Disqualify 3, route 2", riskTolerance: 0.3 },
      clone: { decision: "Disqualify 3, route 2", riskTolerance: 0.32 },
      divergence: { decision: 0.0, riskTolerance: 0.02 },
      agreement: 0.94,
      headline: "The clone agrees with the user's decisions 94% of the time.",
    },
    {
      scenario: "Forecast commit for Q3",
      human: { decision: "Commit $4.2M (conservative)", riskTolerance: 0.3 },
      clone: { decision: "Commit $4.8M (aggressive)", riskTolerance: 0.55 },
      divergence: { decision: 0.14, riskTolerance: -0.25 },
      agreement: 0.62,
      headline: "The clone consistently underestimates operational risk on forecast commits.",
    },
    {
      scenario: "Outreach tone for Acme",
      human: { decision: "Research-led opener", communication: "Specific insight, 1 CTA" },
      clone: { decision: "Research-led opener", communication: "Specific insight, 1 CTA" },
      divergence: { communication: 0.04 },
      agreement: 0.96,
      headline: "Communication fidelity near-perfect on outreach tone.",
    },
  ];
  for (const d of divergences) {
    await db.fidelityDivergence.create({
      data: {
        cloneId: clone.id,
        tenantId: personalTenant.id,
        scenarioId: `scn-${Math.random().toString(36).slice(2, 8)}`,
        scenario: d.scenario,
        humanResponseJson: j(d.human),
        cloneResponseJson: j(d.clone),
        divergenceJson: j(d.divergence),
        agreementRate: d.agreement,
        headline: d.headline,
      },
    });
  }

  // ---------- CERTIFICATION ----------
  await db.certification.create({
    data: {
      cloneId: clone.id,
      tenantId: personalTenant.id,
      level: "professionally_verified",
      requirement: "Pass 12 scenarios + 4 real-world outcomes + peer review",
      evidenceJson: j({ evals: 6, outcomes: 4, peerReviewer: "vp-rev-northwind" }),
      grantedBy: "platform-certification-authority",
    },
  });

  // ---------- AGENTS (runtime manifestations of the clone) ----------
  const agents = [
    {
      name: "Revenue Operations Agent",
      specialization: "Revenue Operations",
      description: "General RevOps: pipeline hygiene, forecasting, operating reviews.",
      capabilities: ["READ_CRM", "WRITE_CRM", "READ_EMAIL", "SEND_EMAIL", "READ_CALENDAR", "CREATE_CALENDAR_EVENT", "WEB_SEARCH"],
      autonomy: 3,
      status: "deployed",
      cert: "professionally_verified",
    },
    {
      name: "CRM Agent",
      specialization: "CRM",
      description: "Salesforce hygiene, stage transitions, automation rules.",
      capabilities: ["READ_CRM", "WRITE_CRM"],
      autonomy: 3,
      status: "deployed",
      cert: "certified",
    },
    {
      name: "Executive Reporting Agent",
      specialization: "Reporting",
      description: "Weekly operating review, board decks, KPI dashboards.",
      capabilities: ["READ_CRM", "READ_DOCS", "WEB_SEARCH"],
      autonomy: 2,
      status: "deployed",
      cert: "certified",
    },
    {
      name: "Sales Analysis Agent",
      specialization: "Sales Analysis",
      description: "Pipeline conversion, win/loss, rep performance.",
      capabilities: ["READ_CRM", "WEB_SEARCH"],
      autonomy: 2,
      status: "deployed",
      cert: "self_trained",
    },
    {
      name: "Slack Agent",
      specialization: "Slack",
      description: "Triages Slack DMs; routes to owner or canned response.",
      capabilities: ["READ_MESSAGES", "SEND_MESSAGES"],
      autonomy: 1,
      status: "drafted",
      cert: "unverified",
    },
  ];
  for (const a of agents) {
    await createOrSkip(db.agent.create({
      data: {
        tenantId: personalTenant.id,
        cloneId: clone.id,
        name: a.name,
        slug: a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: a.description,
        specialization: a.specialization,
        packageManifestJson: j({
          identity: { type: "agent", name: a.name, version: "1.4.0" },
          capabilities: a.capabilities,
          dependencies: [{ id: "clone:sarah-revops", versionRange: "1.4.0" }],
          modelRequirements: [{ signal: "complex_reasoning", provider: "claude" }],
          safetyConstraints: ["Escalate > $5k refunds", "Disclose bot identity on browser automation"],
          provenance: { owner: "sarah", source: "personal", portability: "portable" },
          licensing: { kind: "marketplace" },
        }),
        modelRequirementsJson: j({ primary: "claude", fallback: "gpt" }),
        approvedCapabilitiesJson: j(a.capabilities),
        autonomyLevel: a.autonomy,
        status: a.status,
        certificationLevel: a.cert,
      },
    }));
  }

  // ---------- ENVIRONMENTS ----------
  const environments = [
    { name: "Sales Environment", kind: "sales", description: "Salesforce + Outreach + Gong + Slack. Standard B2B SaaS sales stack." },
    { name: "Executive Reporting Environment", kind: "generic", description: "Looker + Google Slides + Email. Board reporting context." },
    { name: "Recruiting Trial Environment", kind: "generic", description: "Sandboxed copy of Sales Environment for recruitment trials. Time-limited access." },
  ];
  for (const e of environments) {
    await createOrSkip(db.environment.create({
      data: {
        tenantId: personalTenant.id,
        name: e.name,
        slug: e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        kind: e.kind,
        description: e.description,
        availableDataJson: j(["CRM records", "Pipeline coverage", "Stage conversions"]),
        availableToolsJson: j(["Salesforce", "Outreach", "Gong"]),
        availableExtensionsJson: j(["crm", "email", "calendar", "slack"]),
        availablePeopleJson: j(["VP Rev", "SDR Lead", "CFO"]),
        availableSystemsJson: j(["Salesforce", "Outreach", "Gong"]),
        availableDevicesJson: j([]),
        rulesJson: j(["No mass-email without approval", "Disclose bot identity on browser automation"]),
        policiesJson: j(["Disqualify if ICP-fit < 0.4"]),
        constraintsJson: j(["Max 5 concurrent outreach sequences", "Max 100 emails/day per rep"]),
      },
    }));
  }

  // ---------- EXTENSIONS (capability-based — ADR-0007) ----------
  const extensions = [
    { name: "Salesforce CRM", slug: "salesforce-crm", version: "2.4.1", capabilities: ["READ_CRM", "WRITE_CRM"], trust: "first_party", pricing: { perCall: 0.001 } },
    { name: "Gmail Email", slug: "gmail-email", version: "1.9.0", capabilities: ["READ_EMAIL", "SEND_EMAIL"], trust: "first_party", pricing: { perCall: 0.0005 } },
    { name: "Google Calendar", slug: "google-calendar", version: "1.4.2", capabilities: ["READ_CALENDAR", "CREATE_CALENDAR_EVENT"], trust: "first_party", pricing: { perCall: 0.0005 } },
    { name: "Slack Messages", slug: "slack-messages", version: "2.0.0", capabilities: ["READ_MESSAGES", "SEND_MESSAGES"], trust: "first_party", pricing: { perCall: 0.0003 } },
    { name: "Web Browser Automation", slug: "browser-automation", version: "1.2.0", capabilities: ["BROWSER_AUTOMATION", "WEB_SEARCH"], trust: "verified", pricing: { perCall: 0.002 } },
    { name: "Computer Vision", slug: "computer-vision", version: "0.9.1", capabilities: ["VISION_READ"], trust: "verified", pricing: { perCall: 0.004 } },
    { name: "GitHub Code Access", slug: "github-code", version: "1.1.0", capabilities: ["READ_CODE", "WRITE_CODE"], trust: "verified", pricing: { perCall: 0.001 } },
  ];
  for (const ext of extensions) {
    await createOrSkip(db.extension.create({
      data: {
        tenantId: personalTenant.id,
        name: ext.name,
        slug: ext.slug,
        version: ext.version,
        description: `${ext.name} extension. Capabilities: ${ext.capabilities.join(", ")}.`,
        capabilitiesJson: j(ext.capabilities),
        inputsJson: j({ schema: "json" }),
        outputsJson: j({ schema: "json" }),
        permissionsJson: j(ext.capabilities),
        eventsJson: j(["on_call", "on_error"]),
        apisJson: j({ rest: true, webhooks: true }),
        runtimeRequirementsJson: j({ memory: "256MB", cpu: "0.25" }),
        securityRequirementsJson: j({ sandbox: true, audit: true, rateLimit: 100 }),
        hardwareRequirementsJson: j({}),
        certification: ext.trust === "first_party" ? "enterprise_grade" : "certified",
        pricingJson: j(ext.pricing),
        trustLevel: ext.trust,
        installed: ["salesforce-crm", "gmail-email", "google-calendar", "slack-messages", "browser-automation"].includes(ext.slug),
      },
    }));
  }

  // ---------- TOOLS ----------
  const tools = [
    { name: "Lead Researcher", capabilities: ["WEB_SEARCH", "BROWSER_AUTOMATION"], description: "Researches an account before outreach." },
    { name: "ICP Scorer", capabilities: ["READ_CRM"], description: "Scores a lead against the ICP framework." },
    { name: "Forecast Modeler", capabilities: ["READ_CRM"], description: "Weighted-pipeline forecast with confidence bands." },
  ];
  for (const t of tools) {
    await createOrSkip(db.tool.create({
      data: {
        tenantId: personalTenant.id,
        name: t.name,
        slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: t.description,
        capabilitiesJson: j(t.capabilities),
        interfaceJson: j({ input: "json", output: "json" }),
        version: "1.0.0",
        provenanceJson: j({ owner: "sarah", portability: "portable" }),
      },
    }));
  }

  // ---------- MARKETPLACE LISTINGS ----------
  const listings = [
    { packageType: "clone", name: "Sarah — RevOps Clone", capabilities: ["Lead Qualification", "CRM Management", "Forecasting"], pricingMode: "per_outcome", price: 50000 },
    { packageType: "agent", name: "Revenue Operations Agent", capabilities: ["Lead Qualification", "CRM", "Forecasting"], pricingMode: "subscription", price: 12000 },
    { packageType: "agent", name: "CRM Agent", capabilities: ["CRM"], pricingMode: "hourly", price: 8500 },
    { packageType: "agent", name: "Executive Reporting Agent", capabilities: ["Reporting"], pricingMode: "per_task", price: 3500 },
    { packageType: "extension", name: "Salesforce CRM Extension", capabilities: ["CRM"], pricingMode: "subscription", price: 2400 },
    { packageType: "extension", name: "Computer Vision Extension", capabilities: ["VISION_READ"], pricingMode: "per_task", price: 1800 },
  ];
  for (const l of listings) {
    await db.marketplaceListing.create({
      data: {
        tenantId: personalTenant.id,
        packageType: l.packageType,
        name: l.name,
        description: `${l.name} — ${l.pricingMode}.`,
        cloneId: l.packageType === "clone" || l.packageType === "agent" ? clone.id : null,
        capabilitiesJson: j(l.capabilities),
        certificationLevel: "professionally_verified",
        reputationJson: j({ successRate: 0.91, tasksCompleted: 312 }),
        pricingMode: l.pricingMode,
        priceCents: l.price * 100,
      },
    });
  }

  // ---------- CONTRACTS (Outcome Contracts — ADR-0011) ----------
  const contracts = [
    {
      objective: "Qualify inbound B2B leads, update Salesforce, and book qualified meetings.",
      hiringMode: "per_outcome",
      budget: 50000,
      durationDays: 90,
      status: "active",
      success: ["Correct qualification", "Correct CRM state", "Approved outreach"],
    },
    {
      objective: "Run the weekly operating review for the leadership team.",
      hiringMode: "subscription",
      budget: 12000,
      durationDays: 365,
      status: "completed",
      success: ["Review published by Mon 9am", "Risks flagged", "Actions assigned"],
    },
    {
      objective: "Trial: forecast Q3 commit with confidence bands.",
      hiringMode: "recruitment_trial",
      budget: 0,
      durationDays: 14,
      status: "completed",
      success: ["Forecast within 10% of actual", "Confidence bands calibrated"],
    },
  ];
  for (const c of contracts) {
    const contract = await db.contract.create({
      data: {
        tenantId: orgTenant.id,
        cloneId: clone.id,
        hiringMode: c.hiringMode,
        objective: c.objective,
        inputsJson: j({ input: "New CRM lead" }),
        requiredActionsJson: j(["Research lead", "Determine ICP fit", "Score lead", "Update CRM", "Contact qualified lead"]),
        constraintsJson: j(["No mass-email", "Disclose bot identity on browser automation"]),
        successCriteriaJson: j(c.success),
        slaJson: j({ responseTimeMins: 15, escalationPath: "VP Rev" }),
        budgetCents: c.budget * 100,
        permissionsJson: j(["READ_CRM", "WRITE_CRM", "READ_EMAIL", "SEND_EMAIL"]),
        dataAccessJson: j({ scope: "tenant:org:revenue", retention: "90d" }),
        durationDays: c.durationDays,
        status: c.status,
      },
    });
    if (c.status === "completed") {
      await db.outcome.create({
        data: {
          contractId: contract.id,
          cloneId: clone.id,
          tenantId: orgTenant.id,
          objectiveMet: true,
          metricJson: j({ tasksCompleted: 142, successRate: 0.91, slaCompliance: 0.96 }),
          clientFeedback: "Forecast was within 6% of actual; huge time saved.",
          humanInterventionRate: 0.12,
          successRate: 0.91,
        },
      });
      await db.payment.create({
        data: {
          contractId: contract.id,
          tenantId: orgTenant.id,
          amountCents: c.budget * 100,
          splitJson: j({ expert: 0.7, platform: 0.18, extensionDeveloper: 0.07, infrastructure: 0.04, referral: 0.01 }),
          status: "released",
          releasedAt: new Date(),
        },
      });
    }
  }

  // ---------- REPUTATION ----------
  await db.reputation.upsert({
    where: { cloneId: clone.id },
    update: {},
    create: {
      cloneId: clone.id,
      tenantId: personalTenant.id,
      tasksCompleted: 312,
      successRate: 0.91,
      outcomeRate: 0.86,
      reliability: 0.94,
      clientRetention: 0.88,
      averageRating: 4.7,
      certificationsCount: 3,
      experienceYears: 12,
      responseTimeMins: 12,
      slaCompliance: 0.96,
      humanInterventionRate: 0.12,
      subjectiveReviewsJson: j([
        { client: "Northwind", rating: 4.8, note: "Forecast was within 6% of actual." },
        { client: "Acme Corp", rating: 4.5, note: "Triage quality excellent; tone personalization great." },
      ]),
    },
  });

  // ---------- LICENSES ----------
  await db.license.create({
    data: {
      tenantId: personalTenant.id,
      cloneId: clone.id,
      kind: "marketplace",
      termsJson: j({ commercialUse: true, modification: false, attribution: true }),
      grantedAt: new Date(),
      expiresAt: null,
    },
  });

  // ---------- DOMAIN EVENTS ----------
  const eventTypes = [
    "CloneCreated", "TrainingStarted", "TrainingCompleted", "DemonstrationCaptured",
    "CorrectionCaptured", "SkillUpdated", "KnowledgeAdded", "WorkflowLearned",
    "EvaluationCompleted", "CertificationGranted", "AgentDeployed", "TaskCompleted",
    "OutcomeRecorded", "HumanIntervention", "CloneVersionReleased",
  ];
  for (let i = 0; i < eventTypes.length; i++) {
    await db.domainEvent.create({
      data: {
        tenantId: personalTenant.id,
        cloneId: clone.id,
        type: eventTypes[i] as any,
        payloadJson: j({ index: i, summary: `${eventTypes[i]} event for sarah-revops` }),
      },
    });
  }

  // ---------- AUDIT LOGS ----------
  const auditActions = [
    "clone.created", "training.session.completed", "evaluation.completed",
    "certification.granted", "agent.deployed", "extension.installed",
    "permission.granted", "contract.created", "payment.released",
  ];
  for (let i = 0; i < auditActions.length; i++) {
    await db.auditLog.create({
      data: {
        tenantId: personalTenant.id,
        actorId: sarah.id,
        cloneId: clone.id,
        action: auditActions[i],
        resourceType: "clone",
        resourceId: clone.id,
        detailsJson: j({ index: i, at: new Date(Date.now() - i * 3600_000).toISOString() }),
      },
    });
  }

  // ---------- PROVENANCE records ----------
  for (const t of ["clone", "expertise", "skill", "knowledge", "memory", "workflow", "agent", "extension"]) {
    await db.provenance.create({
      data: {
        tenantId: personalTenant.id,
        artifactType: t,
        artifactId: `${t}-demo`,
        owner: "sarah@clone.os",
        source: "personal",
        origin: personalTenant.id,
        license: "marketplace",
        visibility: "marketplace",
        sensitivity: "internal",
        portability: "portable",
      },
    });
  }

  // ---------- WAITLIST entries (so admin has something to approve) ----------
  const waitlistSeed = [
    { name: "Priya Patel", email: "priya@example.com", desiredRole: "user", note: "VP Sales at a Series B SaaS — wants a clone for pipeline triage." },
    { name: "Marcus Webb", email: "marcus@example.com", desiredRole: "developer", note: "Building a CRM extension for the marketplace." },
    { name: "Elena Kowalski", email: "elena@example.com", desiredRole: "candidate", note: "Looking for RevOps roles — wants to expose her clone as a recruitment trial." },
  ];
  for (const w of waitlistSeed) {
    const existing = await db.waitlistEntry.findUnique({ where: { email: w.email } });
    if (!existing) {
      await db.waitlistEntry.create({
        data: {
          name: w.name,
          email: w.email,
          desiredRole: w.desiredRole,
          note: w.note,
          status: "pending",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  Tenant: ${platformTenant.slug}, ${orgTenant.slug}, ${personalTenant.slug}, ${adminTenant.slug}`);
  console.log(`  Real admin: ${realAdmin.email} (password sourced from ADMIN_PASSWORD env var — not printed)`);
  console.log(`  Demo users: sarah@clone.os, sarah-admin@clone.os, candidate@clone.os, dev@clone.os (all password: demo)`);
  console.log(`  Clone:  ${clone.slug} (v1.4.0, score 87.4)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
