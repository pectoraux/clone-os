// Clone OS — Expertise Graph (ADR-0010)
// Queryable, versioned graph of the professional's expertise.

export type ExpertiseNodeType =
  | "concept"
  | "skill"
  | "tool"
  | "procedure"
  | "decision"
  | "failure"
  | "artifact"
  | "domain";

export interface ExpertiseEdge {
  type:
    | "knows"
    | "performs"
    | "uses"
    | "follows"
    | "makes"
    | "avoids"
    | "produces"
    | "specializes_in"
    | "requires"
    | "demonstrated_by"
    | "evaluated_by"
    | "depends_on";
  targetId: string;
  targetName: string;
}

export interface ExpertiseNode {
  id: string;
  nodeType: ExpertiseNodeType;
  name: string;
  description?: string;
  proficiency?: number; // 0..100 for skills
  edges: ExpertiseEdge[];
  // Provenance (ADR-0003)
  sourceKind:
    | "user_general"
    | "company_proprietary"
    | "client_data"
    | "public"
    | "licensed"
    | "third_party"
    | "generated";
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  portability: "portable" | "tenant_locked" | "client_locked";
}

// Source-kind labels for UI
export const SOURCE_KIND_LABELS: Record<ExpertiseNode["sourceKind"], string> = {
  user_general: "User's General Expertise",
  company_proprietary: "Company Proprietary",
  client_data: "Client Data",
  public: "Public Knowledge",
  licensed: "Licensed Knowledge",
  third_party: "Third-Party Data",
  generated: "Generated Knowledge",
};

export const NODE_TYPE_LABELS: Record<ExpertiseNodeType, string> = {
  concept: "Concept",
  skill: "Skill",
  tool: "Tool",
  procedure: "Procedure",
  decision: "Decision",
  failure: "Failure Mode",
  artifact: "Artifact",
  domain: "Domain",
};

export const EDGE_TYPE_LABELS: Record<ExpertiseEdge["type"], string> = {
  knows: "knows",
  performs: "performs",
  uses: "uses",
  follows: "follows",
  makes: "makes",
  avoids: "avoids",
  produces: "produces",
  specializes_in: "specializes in",
  requires: "requires",
  demonstrated_by: "demonstrated by",
  evaluated_by: "evaluated by",
  depends_on: "depends on",
};
