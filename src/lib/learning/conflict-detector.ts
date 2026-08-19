// Clone OS — Conflict Detector (N1.1)
//
// When the clone learns a new artifact, it may supersede or conflict with
// an existing one. The system should not just create two unrelated records
// — it should detect "Potential conflict" and ask:
//   "This appears to supersede an existing procedure. Replace, coexist, or reject?"
//
// This is a major part of professional evolution: a real human professional
// doesn't just accumulate facts; their practices change.

import { db } from '@/lib/db'

export interface ConflictResult {
  hasConflict: boolean
  conflictingArtifactId?: string
  conflictingArtifactName?: string
  conflictingArtifactType?: string
  conflictingArtifactContent?: string
  suggestion: string
}

// Check a new candidate against existing artifacts on the clone. Uses
// keyword overlap + name similarity. A real system would use embeddings +
// semantic similarity; for N1.1, keyword overlap is the baseline.
export async function detectConflicts(
  cloneId: string,
  candidateType: string,
  candidateContent: string,
  candidateName?: string,
): Promise<ConflictResult> {
  // Look for existing artifacts of the same type (procedures vs procedures,
  // policies vs policies, etc.) that have significant keyword overlap
  const keywords = extractKeywords(candidateContent)
  if (keywords.length < 2) return { hasConflict: false, suggestion: 'No conflict' }

  // Check against Workflows (procedures)
  if (candidateType === 'procedure' || candidateType === 'decision_pattern') {
    const workflows = await db.workflow.findMany({
      where: { cloneId },
      select: { id: true, name: true, description: true, stepsJson: true },
    })
    for (const w of workflows) {
      const existingText = `${w.name} ${w.description} ${w.stepsJson}`
      const overlap = keywordOverlap(keywords, extractKeywords(existingText))
      if (overlap >= 0.4) {
        return {
          hasConflict: true,
          conflictingArtifactId: w.id,
          conflictingArtifactName: w.name,
          conflictingArtifactType: 'workflow',
          conflictingArtifactContent: w.description,
          suggestion: `This candidate appears to supersede or conflict with the existing procedure "${w.name}". Replace it, coexist, or reject?`,
        }
      }
    }
  }

  // Check against Policies (rules)
  if (candidateType === 'rule' || candidateType === 'policy') {
    const policies = await db.policy.findMany({
      where: { cloneId },
      select: { id: true, name: true, description: true, ruleJson: true },
    })
    for (const p of policies) {
      const existingText = `${p.name} ${p.description} ${p.ruleJson}`
      const overlap = keywordOverlap(keywords, extractKeywords(existingText))
      if (overlap >= 0.4) {
        return {
          hasConflict: true,
          conflictingArtifactId: p.id,
          conflictingArtifactName: p.name,
          conflictingArtifactType: 'policy',
          conflictingArtifactContent: p.description,
          suggestion: `This candidate appears to supersede or conflict with the existing policy "${p.name}". Replace it, coexist, or reject?`,
        }
      }
    }
  }

  // Check against Knowledge (semantic knowledge, heuristics)
  if (candidateType === 'semantic_knowledge' || candidateType === 'behavioral_pattern') {
    const knowledge = await db.knowledge.findMany({
      where: { cloneId },
      select: { id: true, title: true, content: true },
    })
    for (const k of knowledge) {
      const overlap = keywordOverlap(keywords, extractKeywords(`${k.title} ${k.content}`))
      if (overlap >= 0.4) {
        return {
          hasConflict: true,
          conflictingArtifactId: k.id,
          conflictingArtifactName: k.title,
          conflictingArtifactType: 'knowledge',
          conflictingArtifactContent: k.content,
          suggestion: `This candidate appears to supersede or conflict with the existing knowledge "${k.title}". Replace it, coexist, or reject?`,
        }
      }
    }
  }

  return { hasConflict: false, suggestion: 'No conflict detected' }
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'shall', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'us',
    'them', 'and', 'or', 'but', 'not', 'no', 'if', 'then', 'else', 'when',
    'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'same', 'so', 'than', 'too',
    'very', 'just', 'about', 'above', 'up', 'down', 'out', 'off', 'over',
    'under', 'again', 'further', 'once', 'here', 'there', 'what', 'which',
    'who', 'whom', 'whose', 'always', 'never', 'sometimes', 'often',
    'stage', 'aging', 'pipeline', 'coverage', 'more', 'than', 'raw', 'matter',
    'first', 'then', 'check', 'inspect',
  ])
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))
}

function keywordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const shared = a.filter((w) => setB.has(w))
  return shared.length / Math.max(a.length, b.length)
}
