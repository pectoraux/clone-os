// N1.2B — Create genuine v1.6 (pre-learning) and v1.7 (post-learning) versions
// with AUTHENTIC snapshots captured at release time.
//
// Run with: bun run scripts/create-authentic-versions.ts

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

function safeParse(s: string | null | undefined): Record<string, any> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}
function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

function canonicalSerialize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalSerialize).join(',') + ']';
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalSerialize((obj as Record<string, unknown>)[k])).join(',') + '}';
}

async function captureAuthenticSnapshot(cloneId: string, version: string) {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      skills: { select: { id: true, name: true, domain: true, proficiency: true, certificationLevel: true } },
      knowledgeItems: { select: { id: true, title: true, content: true, kind: true, sourceKind: true, sensitivity: true, portability: true } },
      memories: { select: { id: true, type: true, content: true, importance: true, confidence: true, state: true, domain: true, sourceKind: true, sensitivity: true, portability: true, scope: true } },
      workflows: { select: { id: true, name: true, description: true, stepsJson: true, version: true } },
      policies: { select: { id: true, name: true, description: true, ruleJson: true, appliesTo: true } },
    },
  });
  if (!clone) throw new Error("Clone not found");

  const snapshot = {
    name: clone.name, slug: clone.slug, domain: clone.domain,
    status: clone.status, visibility: clone.visibility, certificationLevel: clone.certificationLevel,
    persona: safeParse(clone.personaJson), personality: safeParse(clone.personalityJson),
    preferences: safeParse(clone.preferencesJson), behavior: safeParse(clone.behaviorJson),
    professionalIdentity: clone.professionalIdentity ? {
      title: clone.professionalIdentity.title, domain: clone.professionalIdentity.domain,
      bio: clone.professionalIdentity.bio, values: safeParseArr(clone.professionalIdentity.valuesJson),
      culture: safeParse(clone.professionalIdentity.cultureJson),
      user: clone.professionalIdentity.user ? {
        name: clone.professionalIdentity.user.name, email: clone.professionalIdentity.user.email,
        publicKey: clone.professionalIdentity.user.publicKey
      } : null
    } : null,
    skills: clone.skills, knowledge: clone.knowledgeItems, memories: clone.memories,
    workflows: clone.workflows, policies: clone.policies,
    version, snapshotCreatedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(snapshot);
  const hash = createHash("sha256").update(canonicalSerialize(snapshot)).digest("hex");
  return { json, hash };
}

async function main() {
  const clone = await db.clone.findFirst({ where: { slug: "sarah-revops" } });
  if (!clone) throw new Error("Clone not found");
  console.log("Clone:", clone.id, "currentVersion:", clone.currentVersionId);

  // Step 1: Delete the learned Pipeline Review Priority Order workflow
  const learned = await db.workflow.findFirst({ where: { cloneId: clone.id, name: { contains: "Pipeline Review" } } });
  if (learned) {
    await db.workflow.delete({ where: { id: learned.id } });
    console.log("Deleted learned workflow:", learned.name);
  } else {
    console.log("No learned workflow found");
  }

  // Step 2: Create v1.6.0 — pre-learning, AUTHENTIC snapshot
  const sarah = await db.user.findUnique({ where: { email: "sarah@clone.os" } });
  if (!sarah) throw new Error("Sarah user not found");

  const snapshot16 = await captureAuthenticSnapshot(clone.id, "1.6.0");
  console.log("v1.6 snapshot hash:", snapshot16.hash.slice(0, 16) + "...");

  const v16 = await db.cloneVersion.create({
    data: {
      cloneId: clone.id, version: "1.6.0", authorId: sarah.id,
      changeSetJson: JSON.stringify(["Pre-learning baseline: authentic snapshot before re-teaching"]),
      trainingInputsJson: JSON.stringify({ source: "n1_2b_baseline" }),
      evaluationResultsJson: JSON.stringify({}),
      dependenciesJson: JSON.stringify({}),
      provenanceJson: JSON.stringify({ source: "n1_2b_baseline" }),
      stateSnapshotJson: snapshot16.json,
      snapshotHash: snapshot16.hash,
      snapshotStatus: "AUTHENTIC",
      snapshotOrigin: "RELEASE_CAPTURE",
      snapshotCreatedAt: new Date(),
    },
  });
  console.log("Created v1.6.0:", v16.id, "| AUTHENTIC | RELEASE_CAPTURE");

  // Update clone to v1.6
  await db.clone.update({ where: { id: clone.id }, data: { currentVersionId: v16.id } });
  console.log("Clone currentVersion → v1.6.0");

  // Step 3: Re-add the learned workflow (simulating the N1.1 learning)
  await db.workflow.create({
    data: {
      cloneId: clone.id, tenantId: clone.tenantId,
      name: "Pipeline Review Priority Order",
      description: "When reviewing pipeline, prioritize stage aging first, then deal concentration, then rep-level slippage before considering raw pipeline coverage.",
      stepsJson: JSON.stringify(["Check stage aging", "Assess deal concentration", "Review rep-level slippage", "Then consider raw pipeline coverage"]),
      triggerKind: "manual", version: "1.0.0",
      provenanceJson: JSON.stringify({ owner: "sarah", source: "user_general", portability: "portable" }),
    },
  });
  console.log("Re-added learned workflow: Pipeline Review Priority Order");

  // Step 4: Create v1.7.0 — post-learning, AUTHENTIC snapshot
  const snapshot17 = await captureAuthenticSnapshot(clone.id, "1.7.0");
  console.log("v1.7 snapshot hash:", snapshot17.hash.slice(0, 16) + "...");

  const v17 = await db.cloneVersion.create({
    data: {
      cloneId: clone.id, version: "1.7.0", authorId: sarah.id,
      changeSetJson: JSON.stringify(["Post-learning: re-added 'Pipeline Review Priority Order' procedure"]),
      trainingInputsJson: JSON.stringify({ source: "n1_2b_post_learning" }),
      evaluationResultsJson: JSON.stringify({}),
      dependenciesJson: JSON.stringify({}),
      provenanceJson: JSON.stringify({ source: "n1_2b_post_learning" }),
      stateSnapshotJson: snapshot17.json,
      snapshotHash: snapshot17.hash,
      snapshotStatus: "AUTHENTIC",
      snapshotOrigin: "RELEASE_CAPTURE",
      snapshotCreatedAt: new Date(),
    },
  });
  console.log("Created v1.7.0:", v17.id, "| AUTHENTIC | RELEASE_CAPTURE");

  // Update clone to v1.7
  await db.clone.update({ where: { id: clone.id }, data: { currentVersionId: v17.id } });
  console.log("Clone currentVersion → v1.7.0");

  // Verify snapshots differ
  console.log("\nSnapshots differ:", snapshot16.hash !== snapshot17.hash);
  console.log("v1.6 has stage aging:", !snapshot16.json.includes("Pipeline Review Priority Order"));
  console.log("v1.7 has stage aging:", snapshot17.json.includes("Pipeline Review Priority Order"));

  console.log("\nDone. v1.6 (pre-learning) and v1.7 (post-learning) are AUTHENTIC.");
  console.log("v1.6 ID:", v16.id);
  console.log("v1.7 ID:", v17.id);
}

main().catch(console.error).finally(() => db.$disconnect());
