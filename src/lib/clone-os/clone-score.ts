// Clone OS — Multidimensional Clone Score (ADR-0009)
// The public UI may show an aggregate, but the system preserves the dimensions.
// NEVER reduce internally to one opaque score.

export const SCORE_DIMENSIONS = [
  { key: "professionalFidelity",    label: "Professional Fidelity",  description: "Overall representation of the professional self." },
  { key: "knowledgeFidelity",       label: "Knowledge Fidelity",      description: "Accuracy & coverage of what the person knows." },
  { key: "skillFidelity",            label: "Skill Fidelity",          description: "Measurable capability on the person's skills." },
  { key: "decisionFidelity",         label: "Decision Fidelity",       description: "Agreement with the person's decisions." },
  { key: "behavioralFidelity",       label: "Behavioral Fidelity",     description: "Match to the person's behavioral patterns." },
  { key: "communicationFidelity",   label: "Communication Fidelity",  description: "Tone, structure, vocabulary match." },
  { key: "personalityFidelity",      label: "Personality Fidelity",    description: "Personality facets match." },
  { key: "culturalFidelity",         label: "Cultural Fidelity",       description: "Understanding of professional/organizational culture." },
  { key: "outcomeFidelity",          label: "Outcome Fidelity",         description: "Real-world outcome match rate." },
] as const;

export type ScoreKey = (typeof SCORE_DIMENSIONS)[number]["key"];

export interface CloneScoreDimensions {
  professionalFidelity: number;
  knowledgeFidelity: number;
  skillFidelity: number;
  decisionFidelity: number;
  behavioralFidelity: number;
  communicationFidelity: number;
  personalityFidelity: number;
  culturalFidelity: number;
  outcomeFidelity: number;
  aggregate: number;
}

export function computeAggregate(d: Omit<CloneScoreDimensions, "aggregate">): number {
  // Weighted average — outcome & decision fidelity weigh heaviest (ADR-0006: outcome over benchmark)
  const weights: Record<ScoreKey, number> = {
    professionalFidelity: 1.0,
    knowledgeFidelity: 0.9,
    skillFidelity: 1.0,
    decisionFidelity: 1.4,
    behavioralFidelity: 1.1,
    communicationFidelity: 1.0,
    personalityFidelity: 0.9,
    culturalFidelity: 0.7,
    outcomeFidelity: 1.6,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const sum = (Object.keys(weights) as ScoreKey[]).reduce(
    (acc, k) => acc + (d[k] as number) * weights[k],
    0,
  );
  return Math.round((sum / total) * 10) / 10;
}

export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Faithful", color: "emerald" };
  if (score >= 75) return { label: "Strong", color: "teal" };
  if (score >= 60) return { label: "Developing", color: "amber" };
  if (score >= 40) return { label: "Early", color: "orange" };
  return { label: "Untrained", color: "rose" };
}
