// Clone OS — Clone State Snapshot (N1.2A)
//
// When a CloneVersion is released, the complete clone state is serialized
// into an immutable snapshot. Evaluation runs against the SNAPSHOT, not the
// current clone — this is how v1.4 and v1.5 are genuinely different
// evaluations, not "current clone minus one workflow."
//
// The snapshot includes: persona, personality, preferences, behavior,
// professional identity, skills, knowledge, memories, workflows, policies.

import { db } from '@/lib/db'

export interface CloneStateSnapshot {
  // Clone scalar fields
  name: string
  slug: string
  domain: string
  status: string
  visibility: string
  certificationLevel: string
  persona: Record<string, any>
  personality: Record<string, any>
  preferences: Record<string, any>
  behavior: Record<string, any>
  // Professional identity
  professionalIdentity: {
    title: string
    domain: string
    bio: string
    values: string[]
    culture: Record<string, any>
    user: { name: string; email: string; publicKey: string | null } | null
  } | null
  // Expertise (arrays of the relevant fields)
  skills: Array<{ name: string; domain: string; proficiency: number; certificationLevel: string }>
  knowledge: Array<{ title: string; content: string; kind: string; sourceKind: string; sensitivity: string; portability: string }>
  memories: Array<{ kind: string; content: string; importance: number }>
  workflows: Array<{ name: string; description: string; stepsJson: string; version: string }>
  policies: Array<{ name: string; description: string; ruleJson: string; appliesTo: string }>
  // Version metadata
  version: string
  snapshotCreatedAt: string
}

// Create a snapshot of the clone's current state. Called when a version
// is released (LearningPipeline.release) and retroactively for existing
// versions that don't have snapshots yet.
export async function createCloneStateSnapshot(cloneId: string, version: string): Promise<string> {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      skills: { select: { name: true, domain: true, proficiency: true, certificationLevel: true } },
      knowledgeItems: { select: { title: true, content: true, kind: true, sourceKind: true, sensitivity: true, portability: true } },
      memories: { select: { kind: true, content: true, importance: true } },
      workflows: { select: { name: true, description: true, stepsJson: true, version: true } },
      policies: { select: { name: true, description: true, ruleJson: true, appliesTo: true } },
    },
  })
  if (!clone) throw new Error('Clone not found for snapshot')

  const snapshot: CloneStateSnapshot = {
    name: clone.name,
    slug: clone.slug,
    domain: clone.domain,
    status: clone.status,
    visibility: clone.visibility,
    certificationLevel: clone.certificationLevel,
    persona: safeParse(clone.personaJson),
    personality: safeParse(clone.personalityJson),
    preferences: safeParse(clone.preferencesJson),
    behavior: safeParse(clone.behaviorJson),
    professionalIdentity: clone.professionalIdentity
      ? {
          title: clone.professionalIdentity.title,
          domain: clone.professionalIdentity.domain,
          bio: clone.professionalIdentity.bio,
          values: safeParseArr(clone.professionalIdentity.valuesJson),
          culture: safeParse(clone.professionalIdentity.cultureJson),
          user: clone.professionalIdentity.user
            ? { name: clone.professionalIdentity.user.name, email: clone.professionalIdentity.user.email, publicKey: clone.professionalIdentity.user.publicKey }
            : null,
        }
      : null,
    skills: clone.skills,
    knowledge: clone.knowledgeItems,
    memories: clone.memories,
    workflows: clone.workflows,
    policies: clone.policies,
    version,
    snapshotCreatedAt: new Date().toISOString(),
  }

  return JSON.stringify(snapshot)
}

// Load a snapshot for a specific clone version. Returns null if the
// version doesn't have a snapshot (which means it was created before N1.2A).
export async function loadCloneStateSnapshot(cloneVersionId: string): Promise<CloneStateSnapshot | null> {
  const version = await db.cloneVersion.findUnique({
    where: { id: cloneVersionId },
    select: { stateSnapshotJson: true, version: true },
  })
  if (!version?.stateSnapshotJson) return null
  try {
    return JSON.parse(version.stateSnapshotJson) as CloneStateSnapshot
  } catch {
    return null
  }
}

// Retroactively create snapshots for versions that don't have them.
// This is a one-time migration for existing versions (v1.0, v1.2, v1.4).
// For v1.4, the snapshot should reflect the clone state WITHOUT the
// learned artifacts that were added in v1.5 — but since we can't
// reconstruct the exact pre-learning state, we snapshot the current
// state and note that it's a retroactive approximation. For v1.5,
// the snapshot is accurate (taken at release time).
export async function ensureSnapshotsExist(cloneId: string): Promise<{ created: number; existing: number }> {
  const versions = await db.cloneVersion.findMany({
    where: { cloneId, stateSnapshotJson: null },
    select: { id: true, version: true },
  })
  let created = 0
  for (const v of versions) {
    // For retroactive snapshots, we snapshot the CURRENT clone state.
    // This is an approximation for older versions — the only fully
    // accurate snapshot is for the current version (taken at release time).
    // For v1.4, the FidelityEngine.runScenario can use excludeWorkflowIds
    // as a fallback if no snapshot exists.
    const snapshotJson = await createCloneStateSnapshot(cloneId, v.version)
    await db.cloneVersion.update({
      where: { id: v.id },
      data: { stateSnapshotJson: snapshotJson },
    })
    created++
  }
  const existing = await db.cloneVersion.count({
    where: { cloneId, stateSnapshotJson: { not: null } },
  })
  return { created, existing }
}

function safeParse(s: string | null | undefined): Record<string, any> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
