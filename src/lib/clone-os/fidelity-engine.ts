// Clone OS — Fidelity Engine (ADR-0009, ADR-0012)
// Compares Human vs Human's Clone on equivalent scenarios. Emits Divergence Report.

export interface FidelityScenario {
  id: string;
  title: string;
  description: string;
  domain: string;
  difficulty: "low" | "medium" | "high" | "adversarial";
}

export interface FidelityComparison {
  scenarioId: string;
  scenario: string;
  humanResponse: {
    decision: string;
    reasoning: string;
    actions: string[];
    communication: string;
    priorities: string[];
    riskTolerance: number; // 0..1
    expectedOutcome: string;
  };
  cloneResponse: {
    decision: string;
    reasoning: string;
    actions: string[];
    communication: string;
    priorities: string[];
    riskTolerance: number;
    expectedOutcome: string;
  };
  // Per-dimension deltas (positive = clone overshoots, negative = clone undershoots)
  divergence: {
    decision: number;      // -1..1
    reasoning: number;
    actions: number;
    communication: number;
    priorities: number;
    riskTolerance: number; // negative = clone underestimates operational risk
    ambiguityHandling: number;
    expectedOutcome: number;
  };
  agreementRate: number; // 0..1
  headline: string;
}

export const FIDELITY_DIMENSIONS = [
  { key: "decision",            label: "Decision" },
  { key: "reasoning",           label: "Reasoning" },
  { key: "actions",             label: "Actions" },
  { key: "communication",       label: "Communication" },
  { key: "priorities",          label: "Priorities" },
  { key: "riskTolerance",       label: "Risk Tolerance" },
  { key: "ambiguityHandling",   label: "Ambiguity Handling" },
  { key: "expectedOutcome",    label: "Expected Outcome" },
] as const;

// Hiring modes (ADR-0031)
export const HIRING_MODES = [
  "hourly",
  "per_task",
  "per_outcome",
  "subscription",
  "project",
  "revenue_share",
  "enterprise_license",
  "temporary_trial",
  "recruitment_trial",
  "human_plus_clone",
] as const;

export const HIRING_MODE_LABELS: Record<string, string> = {
  hourly: "Hourly",
  per_task: "Per Task",
  per_outcome: "Per Outcome",
  subscription: "Subscription",
  project: "Project",
  revenue_share: "Revenue Share",
  enterprise_license: "Enterprise License",
  temporary_trial: "Temporary Trial",
  recruitment_trial: "Recruitment Trial",
  human_plus_clone: "Human + Clone",
};

// Reputation metrics (ADR-0034) — verified outcome separated from subjective review
export const REPUTATION_METRICS = [
  { key: "tasksCompleted",         label: "Tasks Completed",       verified: true },
  { key: "successRate",            label: "Success Rate",          verified: true },
  { key: "outcomeRate",            label: "Outcome Rate",          verified: true },
  { key: "reliability",            label: "Reliability",           verified: true },
  { key: "clientRetention",        label: "Client Retention",      verified: true },
  { key: "certificationsCount",    label: "Certifications",       verified: true },
  { key: "experienceYears",       label: "Experience (yrs)",      verified: true },
  { key: "responseTimeMins",       label: "Response Time (min)",   verified: true },
  { key: "slaCompliance",          label: "SLA Compliance",       verified: true },
  { key: "humanInterventionRate", label: "Human Intervention",    verified: true },
  { key: "averageRating",          label: "Avg Rating",            verified: false },
] as const;
