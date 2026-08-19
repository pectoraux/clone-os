// Clone OS — Package Manifest (ADR-0005)
// Packages are the universal distribution primitive.

export type PackageType =
  | "clone"
  | "agent"
  | "expertise"
  | "skill"
  | "knowledge"
  | "workflow"
  | "policy"
  | "tool"
  | "extension"
  | "evaluation"
  | "certification";

export interface PackageManifest {
  identity: {
    id: string;
    type: PackageType;
    name: string;
    version: string;
  };
  capabilities: string[];
  dependencies: { id: string; versionRange: string }[];
  interfaces: {
    kind: "api" | "event" | "tool" | "extension" | "evaluator";
    spec: Record<string, unknown>;
  }[];
  provenance: {
    owner: string;
    source: string;
    origin: string;
    license?: string;
    visibility?: string;
    sensitivity?: string;
    portability?: string;
  };
  licensing: {
    kind: "private" | "marketplace" | "licensed" | "commercial" | "open" | "restricted";
    terms?: string;
  };
  certification?: {
    level: "unverified" | "self_trained" | "platform_evaluated" | "certified" | "professionally_verified" | "enterprise_grade";
    evidenceUrl?: string;
  };
  metadata: Record<string, unknown>;
}

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  clone: "Clone Package",
  agent: "Agent Package",
  expertise: "Expertise Package",
  skill: "Skill Package",
  knowledge: "Knowledge Package",
  workflow: "Workflow Package",
  policy: "Policy Package",
  tool: "Tool Package",
  extension: "Extension Package",
  evaluation: "Evaluation Package",
  certification: "Certification Package",
};

// Certification levels (ADR-0043)
export const CERTIFICATION_LEVELS = [
  { key: "unverified", label: "Unverified", color: "rose" },
  { key: "self_trained", label: "Self-Trained", color: "orange" },
  { key: "platform_evaluated", label: "Platform Evaluated", color: "amber" },
  { key: "certified", label: "Certified", color: "teal" },
  { key: "professionally_verified", label: "Professionally Verified", color: "emerald" },
  { key: "enterprise_grade", label: "Enterprise Grade", color: "violet" },
] as const;
