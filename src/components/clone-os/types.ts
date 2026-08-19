// Clone OS — Shared TypeScript contracts for the dashboard.
// These mirror the JSON shape returned by GET /api/clone-os and the action
// endpoints. Keeping them in one file keeps the section components honest about
// the API surface (ADR-0063: domain-concept APIs).

export interface Tenant {
  id: string;
  kind: string;
  name: string;
  slug: string;
}

export interface ProfessionalIdentity {
  title: string;
  domain: string;
  bio: string;
  values: string[];
  culture: Record<string, string>;
  user: { name: string; email: string; publicKey: string | null } | null;
}

export interface CloneVersion {
  id: string;
  version: string;
  changeSet: string[];
  trainingInputs: Record<string, unknown>;
  evaluationResults: Record<string, unknown>;
  performanceImpact: string;
  dependencies: Record<string, unknown>;
  provenance: Record<string, unknown>;
  releasedAt: string;
  author: string;
}

export interface Clone {
  id: string;
  slug: string;
  name: string;
  summary: string;
  domain: string;
  status: string;
  visibility: string;
  certificationLevel: string;
  aggregateScore: number;
  createdAt: string;
  updatedAt: string;
  persona: Record<string, unknown>;
  personality: Record<string, unknown>;
  preferences: Record<string, unknown>;
  behavior: Record<string, unknown>;
  professionalIdentity: ProfessionalIdentity | null;
  currentVersion: CloneVersion | null;
}

export interface ExpertiseNode {
  id: string;
  nodeType: string;
  name: string;
  description: string;
  proficiency: number | null;
  sourceKind: string;
  sourceLabel: string;
  sensitivity: string;
  portability: string;
  visibility: string;
  edges: { type: string; targetId: string; targetName: string }[];
}

export interface Skill {
  id: string;
  name: string;
  domain: string;
  proficiency: number;
  description: string;
  certificationLevel: string;
  requires: string[];
  provenance: Record<string, unknown>;
}

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  kind: string;
  tags: string[];
  sourceKind: string;
  sourceLabel: string;
  sensitivity: string;
  portability: string;
  visibility: string;
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  outcome: string;
  lessons: string[];
  provenance: Record<string, unknown>;
}

export interface Memory {
  id: string;
  kind: string;
  content: string;
  importance: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerKind: string;
  version: string;
  steps: unknown[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  appliesTo: string;
  version: string;
  rule: Record<string, unknown>;
}

export interface TrainingSession {
  id: string;
  mode: string;
  stage: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  notes: string | null;
}

export interface Evaluation {
  id: string;
  kind: string;
  scenario: string;
  result: Record<string, unknown>;
  overallScore: number;
  createdAt: string;
}

export interface ScoreDimension {
  key: string;
  label: string;
  description: string;
  value: number;
}

export interface CloneScore {
  dimensions: ScoreDimension[];
  aggregate: number;
  notes: string | null;
  computedAt: string;
}

export interface Divergence {
  id: string;
  scenario: string;
  humanResponse: Record<string, unknown>;
  cloneResponse: Record<string, unknown>;
  divergence: Record<string, number>;
  agreementRate: number;
  headline: string;
  createdAt: string;
}

export interface Certification {
  id: string;
  level: string;
  requirement: string;
  evidence: Record<string, unknown>;
  grantedBy: string;
  grantedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  specialization: string;
  description: string;
  capabilities: string[];
  autonomyLevel: number;
  status: string;
  certificationLevel: string;
  packageManifest: Record<string, unknown>;
  modelRequirements: Record<string, unknown>;
}

export interface Environment {
  id: string;
  name: string;
  kind: string;
  description: string;
  availableData: string[];
  availableTools: string[];
  availableExtensions: string[];
  availablePeople: string[];
  availableSystems: string[];
  availableDevices: string[];
  rules: string[];
  policies: string[];
  constraints: string[];
}

export interface Extension {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  capabilities: string[];
  permissions: string[];
  events: string[];
  runtimeRequirements: Record<string, unknown>;
  securityRequirements: Record<string, unknown>;
  hardwareRequirements: Record<string, unknown>;
  certification: string;
  trustLevel: string;
  pricing: Record<string, unknown>;
  installed: boolean;
}

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  capabilities: string[];
  version: string;
  provenance: Record<string, unknown>;
}

export interface Contract {
  id: string;
  objective: string;
  hiringMode: string;
  hiringModeLabel: string;
  requiredActions: string[];
  constraints: string[];
  successCriteria: string[];
  sla: Record<string, unknown>;
  budgetCents: number;
  permissions: string[];
  dataAccess: Record<string, unknown>;
  durationDays: number;
  status: string;
  createdAt: string;
}

export interface Outcome {
  id: string;
  contractId: string;
  objectiveMet: boolean;
  metric: Record<string, unknown>;
  clientFeedback: string | null;
  humanInterventionRate: number;
  successRate: number;
  recordedAt: string;
}

export interface Reputation {
  tasksCompleted: number;
  successRate: number;
  outcomeRate: number;
  reliability: number;
  clientRetention: number;
  averageRating: number;
  certificationsCount: number;
  experienceYears: number;
  responseTimeMins: number;
  slaCompliance: number;
  humanInterventionRate: number;
  subjectiveReviews: { author?: string; rating?: number; text?: string; date?: string }[];
}

export interface License {
  id: string;
  kind: string;
  terms: Record<string, unknown>;
  grantedAt: string;
  expiresAt: string | null;
}

export interface MarketplaceListing {
  id: string;
  packageType: string;
  packageTypeLabel: string;
  name: string;
  description: string;
  capabilities: string[];
  certificationLevel: string;
  reputation: Record<string, unknown>;
  pricingMode: string;
  pricingModeLabel: string;
  priceCents: number;
  status: string;
  publishedAt: string;
}

export interface DomainEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface Catalogs {
  scoreDimensions: { key: string; label: string; description: string }[];
  fidelityDimensions: { key: string; label: string }[];
  autonomyLevels: { level: number; name: string; description: string }[];
  capabilities: { id: string; label: string; risk: string; category: string; requiresApproval?: boolean }[];
  modelProviders: {
    id: string;
    label: string;
    vendor: string;
    strengths: string[];
    quality: number;
    latencyMs: number;
    costPer1kTokens: number;
    privacy: string;
    capabilities: string[];
    contextWindow: number;
    availability: number;
    notes?: string;
  }[];
  routingRules: Record<string, string>;
  trainingLoop: { stage: string; description: string }[];
  trainingModes: { mode: string; label: string; description: string }[];
  domainEvents: string[];
  certificationLevels: { key: string; label: string; color: string }[];
  packageTypes: { type: string; label: string }[];
  sourceKinds: { key: string; label: string }[];
  nodeTypes: { key: string; label: string }[];
  edgeTypes: { key: string; label: string }[];
  hiringModes: { key: string; label: string }[];
  reputationMetrics: { key: string; label: string; verified: boolean }[];
}

export interface CloneOSData {
  tenant: Tenant;
  clone: Clone;
  versions: CloneVersion[];
  expertise: ExpertiseNode[];
  skills: Skill[];
  knowledge: Knowledge[];
  experiences: Experience[];
  memories: Memory[];
  workflows: Workflow[];
  policies: Policy[];
  trainingSessions: TrainingSession[];
  evaluations: Evaluation[];
  score: CloneScore | null;
  divergences: Divergence[];
  certifications: Certification[];
  agents: Agent[];
  environments: Environment[];
  extensions: Extension[];
  tools: Tool[];
  contracts: Contract[];
  outcomes: Outcome[];
  reputation: Reputation | null;
  license: License[];
  marketplace: MarketplaceListing[];
  events: DomainEvent[];
  auditLogs: AuditLog[];
  catalogs: Catalogs;
}

// ---- Action endpoints ----

export interface TrainResponse {
  ok: boolean;
  session: TrainingSession;
  events: string[];
  newAggregate: number;
}

export interface MarketplaceMatch {
  id: string;
  packageType: string;
  name: string;
  description: string;
  capabilities: string[];
  capabilityMatch: number;
  certificationLevel: string;
  reputation: Record<string, unknown>;
  pricingMode: string;
  priceCents: number;
  score: number;
}

export interface MarketplaceIntentResponse {
  intent: string;
  requiredCapabilities: {
    id: string;
    label: string;
    risk: string;
    requiresApproval: boolean;
  }[];
  rationale: string[];
  matches: MarketplaceMatch[];
}

export interface ExtensionToggleResponse {
  ok: boolean;
  extensionId: string;
  installed: boolean;
}
