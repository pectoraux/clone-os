// Clone OS — Domain Events (ADR-0048)
// Event-driven learning & analytics pipelines.

export const DOMAIN_EVENTS = [
  "CloneCreated",
  "TrainingStarted",
  "TrainingCompleted",
  "DemonstrationCaptured",
  "CorrectionCaptured",
  "SkillUpdated",
  "KnowledgeAdded",
  "WorkflowLearned",
  "EvaluationCompleted",
  "CertificationGranted",
  "AgentDeployed",
  "TaskStarted",
  "TaskCompleted",
  "OutcomeRecorded",
  "HumanIntervention",
  "CloneUpdated",
  "CloneVersionReleased",
  "ExtensionInstalled",
  "PermissionGranted",
  "PermissionRevoked",
  "ContractCreated",
  "PaymentReleased",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[number];

export interface DomainEventPayload {
  type: DomainEventType;
  tenantId: string;
  cloneId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}

// Training loop stages (ADR-0007)
export const TRAINING_LOOP = [
  { stage: "OBSERVE",     description: "Watch the human perform work." },
  { stage: "CAPTURE",     description: "Record the demonstration." },
  { stage: "TEACH",       description: "Human explains how they do something." },
  { stage: "DEMONSTRATE", description: "Human performs the task for the clone." },
  { stage: "TRAIN",       description: "System ingests the input into the clone." },
  { stage: "EVALUATE",    description: "Measure against benchmark or scenario." },
  { stage: "SIMULATE",    description: "Run scenarios to surface failure modes." },
  { stage: "CERTIFY",     description: "Issue certification based on evidence." },
  { stage: "DEPLOY",      description: "Release the agent into an environment." },
  { stage: "WORK",        description: "Agent performs real work." },
  { stage: "MEASURE",     description: "Capture real-world outcomes." },
  { stage: "LEARN",       description: "Feed outcomes back into the clone." },
] as const;

// Training modes (ADR-0008)
export const TRAINING_MODES = [
  { mode: "teaching",      label: "Teaching",              description: "The human explains how they do something." },
  { mode: "demonstration", label: "Demonstration",         description: "The human performs a task; the clone observes." },
  { mode: "correction",    label: "Correction",            description: "The clone attempts; the human corrects." },
  { mode: "shadowing",     label: "Shadowing",              description: "The clone observes the human performing work." },
  { mode: "assisted",      label: "Assisted Execution",     description: "The clone proposes; the human approves." },
  { mode: "delegated",     label: "Delegated Execution",    description: "The clone performs under predefined policies." },
  { mode: "simulation",    label: "Simulation",             description: "The system generates realistic scenarios." },
  { mode: "adversarial",   label: "Adversarial Training",  description: "Edge cases, ambiguity, failure modes, conflicts." },
  { mode: "real_world",    label: "Real-World Feedback",   description: "The system observes actual outcomes." },
] as const;
