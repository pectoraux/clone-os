// Clone OS — Clone State Snapshot (N1.2A + N1.2B)
//
// N1.2B: Historical Version Truth. Only AUTHENTIC + RELEASE_CAPTURE
// snapshots qualify as authoritative historical state for
// certification-grade evaluation. RETROACTIVE snapshots are for
// debugging only. UNAVAILABLE means the version cannot be reproduced.
//
// The hash is calculated from a CANONICAL representation (sorted keys
// at every level) to ensure deterministic hashing regardless of JSON
// key order.

import { db } from '@/lib/db'
import { createHash } from 'crypto'

// N1.3A.4: SnapshotArtifactRef — stable identity for every artifact in the
// snapshot. Uses the REAL database ID (not synthetic name-based IDs).
export interface SnapshotArtifactRef {
  id: string              // the real database artifact ID
  artifactVersion: string // the clone version this snapshot is for
  artifactHash: string    // SHA-256 of the artifact's content (for integrity)
}

export interface CloneStateSnapshot {
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
  professionalIdentity: {
    title: string
    domain: string
    bio: string
    values: string[]
    culture: Record<string, any>
    user: { name: string; email: string; publicKey: string | null } | null
  } | null
  // N1.3A.4: each artifact carries its real DB id + version + hash
  skills: Array<{ id: string; name: string; domain: string; proficiency: number; certificationLevel: string; artifactVersion: string; artifactHash: string }>
  knowledge: Array<{ id: string; title: string; content: string; kind: string; sourceKind: string; sensitivity: string; portability: string; artifactVersion: string; artifactHash: string }>
  memories: Array<{ id: string; kind: string; content: string; importance: number; artifactVersion: string; artifactHash: string }>
  workflows: Array<{ id: string; name: string; description: string; stepsJson: string; version: string; artifactVersion: string; artifactHash: string }>
  policies: Array<{ id: string; name: string; description: string; ruleJson: string; appliesTo: string; artifactVersion: string; artifactHash: string }>
  version: string
  snapshotCreatedAt: string
}

// Canonical JSON serialization: recursively sort object keys at every
// level, then stringify with no extra whitespace. This ensures the hash
// is deterministic regardless of insertion order.
export function canonicalSerialize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalSerialize).join(',') + ']'
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort()
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalSerialize((obj as Record<string, unknown>)[k])).join(',') + '}'
}

// Compute the SHA-256 hash of a snapshot's canonical serialization.
export function computeSnapshotHash(snapshot: CloneStateSnapshot): string {
  const canonical = canonicalSerialize(snapshot)
  return createHash('sha256').update(canonical).digest('hex')
}

// Verify that a stored snapshot's hash matches a recomputed hash.
// If the hashes don't match, the snapshot has been tampered with or
// corrupted — evaluation must be rejected with SNAPSHOT_INTEGRITY_FAILURE.
export function verifySnapshotIntegrity(snapshot: CloneStateSnapshot, storedHash: string): boolean {
  const recomputed = computeSnapshotHash(snapshot)
  return recomputed === storedHash
}

// Create a snapshot of the clone's current state. Called when a version
// is released (LearningPipeline.release) — this is the AUTHENTIC path.
export async function captureAuthenticSnapshot(cloneId: string, version: string): Promise<{ json: string; hash: string }> {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      // N1.3A.4: select the real `id` field for every artifact
      skills: { select: { id: true, name: true, domain: true, proficiency: true, certificationLevel: true } },
      knowledgeItems: { select: { id: true, title: true, content: true, kind: true, sourceKind: true, sensitivity: true, portability: true } },
      memories: { select: { id: true, kind: true, content: true, importance: true } },
      workflows: { select: { id: true, name: true, description: true, stepsJson: true, version: true } },
      policies: { select: { id: true, name: true, description: true, ruleJson: true, appliesTo: true } },
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
    skills: clone.skills.map(s => ({ ...s, artifactVersion: version, artifactHash: createHash('sha256').update(canonicalSerialize(s)).digest('hex') })),
    knowledge: clone.knowledgeItems.map(k => ({ ...k, artifactVersion: version, artifactHash: createHash('sha256').update(canonicalSerialize(k)).digest('hex') })),
    memories: clone.memories.map(m => ({ ...m, artifactVersion: version, artifactHash: createHash('sha256').update(canonicalSerialize(m)).digest('hex') })),
    workflows: clone.workflows.map(w => ({ ...w, artifactVersion: version, artifactHash: createHash('sha256').update(canonicalSerialize(w)).digest('hex') })),
    policies: clone.policies.map(p => ({ ...p, artifactVersion: version, artifactHash: createHash('sha256').update(canonicalSerialize(p)).digest('hex') })),
    version,
    snapshotCreatedAt: new Date().toISOString(),
  }

  const json = JSON.stringify(snapshot)
  const hash = computeSnapshotHash(snapshot)
  return { json, hash }
}

// Load a snapshot for a specific clone version. Returns null if the
// version doesn't have a snapshot.
export async function loadCloneStateSnapshot(cloneVersionId: string): Promise<CloneStateSnapshot | null> {
  const version = await db.cloneVersion.findUnique({
    where: { id: cloneVersionId },
    select: { stateSnapshotJson: true, version: true, snapshotHash: true, snapshotStatus: true, snapshotOrigin: true },
  })
  if (!version?.stateSnapshotJson) return null
  try {
    return JSON.parse(version.stateSnapshotJson) as CloneStateSnapshot
  } catch {
    return null
  }
}

// N1.2B: Get snapshot metadata for a version (status, origin, hash).
export async function getSnapshotMetadata(cloneVersionId: string): Promise<{
  status: string | null
  origin: string | null
  hash: string | null
  hasSnapshot: boolean
}> {
  const version = await db.cloneVersion.findUnique({
    where: { id: cloneVersionId },
    select: { stateSnapshotJson: true, snapshotStatus: true, snapshotOrigin: true, snapshotHash: true },
  })
  if (!version) return { status: null, origin: null, hash: null, hasSnapshot: false }
  return {
    status: version.snapshotStatus,
    origin: version.snapshotOrigin,
    hash: version.snapshotHash,
    hasSnapshot: !!version.stateSnapshotJson,
  }
}

// N1.2B: Mark existing versions as RETROACTIVE or UNAVAILABLE.
// This REPLACES the old ensureSnapshotsExist that fabricated snapshots
// from the current clone state. Now:
// - Versions that already have a snapshot (from the old ensureSnapshotsExist):
//   mark as RETROACTIVE + MIGRATION_RECONSTRUCTION (NOT authoritative)
// - Versions without a snapshot: mark as UNAVAILABLE
// Never fabricate an old version from the current state.
export async function classifyExistingSnapshots(cloneId: string): Promise<{ retroactive: number; unavailable: number; authentic: number }> {
  const versions = await db.cloneVersion.findMany({
    where: { cloneId },
    select: { id: true, stateSnapshotJson: true, snapshotStatus: true, snapshotOrigin: true },
  })
  let retroactive = 0, unavailable = 0, authentic = 0
  for (const v of versions) {
    if (v.snapshotStatus === 'AUTHENTIC' && v.snapshotOrigin === 'RELEASE_CAPTURE') {
      authentic++
      continue // already authentic — don't touch
    }
    if (v.stateSnapshotJson) {
      // Has a snapshot but it was created retroactively (not at release time)
      await db.cloneVersion.update({
        where: { id: v.id },
        data: {
          snapshotStatus: 'RETROACTIVE',
          snapshotOrigin: 'MIGRATION_RECONSTRUCTION',
        },
      })
      retroactive++
    } else {
      // No snapshot at all — cannot reproduce this version
      await db.cloneVersion.update({
        where: { id: v.id },
        data: {
          snapshotStatus: 'UNAVAILABLE',
          snapshotOrigin: null,
        },
      })
      unavailable++
    }
  }
  return { retroactive, unavailable, authentic }
}

function safeParse(s: string | null | undefined): Record<string, any> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
