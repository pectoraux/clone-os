// Clone OS — Autonomy Levels & Capability Catalog (ADR-0008)
// Autonomy must never imply unlimited authority.

export const AUTONOMY_LEVELS = [
  { level: 0, name: "Observe", description: "Watch only. No actions taken." },
  { level: 1, name: "Suggest", description: "Propose actions for human review." },
  { level: 2, name: "Execute with Approval", description: "Perform actions after explicit human approval." },
  { level: 3, name: "Execute within Policy", description: "Perform actions under pre-approved policies." },
  { level: 4, name: "Autonomous", description: "Self-directed execution within capabilities." },
  { level: 5, name: "Fully Autonomous", description: "Independent execution across environments." },
] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

// Capability catalog — vendors are interchangeable; capabilities are not.
export const CAPABILITY_CATALOG = [
  // CRM
  { id: "READ_CRM", label: "Read CRM", risk: "low", category: "CRM" },
  { id: "WRITE_CRM", label: "Write CRM", risk: "medium", category: "CRM" },
  // Email
  { id: "READ_EMAIL", label: "Read Email", risk: "low", category: "Communication" },
  { id: "SEND_EMAIL", label: "Send Email", risk: "medium", category: "Communication" },
  // Calendar
  { id: "READ_CALENDAR", label: "Read Calendar", risk: "low", category: "Calendar" },
  { id: "CREATE_CALENDAR_EVENT", label: "Create Calendar Event", risk: "medium", category: "Calendar" },
  // Finance
  { id: "ISSUE_REFUND", label: "Issue Refund", risk: "high", category: "Finance", requiresApproval: true },
  { id: "EXECUTE_PAYMENT", label: "Execute Payment", risk: "critical", category: "Finance", requiresApproval: true },
  // Documents
  { id: "READ_DOCS", label: "Read Documents", risk: "low", category: "Documents" },
  { id: "WRITE_DOCS", label: "Write Documents", risk: "medium", category: "Documents" },
  // Code
  { id: "READ_CODE", label: "Read Code Repositories", risk: "low", category: "Engineering" },
  { id: "WRITE_CODE", label: "Write Code Repositories", risk: "high", category: "Engineering", requiresApproval: true },
  // Slack / Messaging
  { id: "READ_MESSAGES", label: "Read Messages", risk: "low", category: "Communication" },
  { id: "SEND_MESSAGES", label: "Send Messages", risk: "medium", category: "Communication" },
  // Web
  { id: "WEB_SEARCH", label: "Web Search", risk: "low", category: "Web" },
  { id: "BROWSER_AUTOMATION", label: "Browser Automation", risk: "medium", category: "Web" },
  // Physical-world (extension-first — ADR-0012)
  { id: "VISION_READ", label: "Computer Vision Read", risk: "medium", category: "Physical" },
  { id: "TEMPERATURE_READ", label: "Temperature Sensor Read", risk: "low", category: "Physical" },
  { id: "MOTION_DETECTION", label: "Motion Detection", risk: "medium", category: "Physical" },
  { id: "CONTROL_DEVICE", label: "Control Device", risk: "critical", category: "Physical", requiresApproval: true },
  { id: "ROBOTIC_MANIPULATION", label: "Robotic Manipulation", risk: "critical", category: "Physical", requiresApproval: true },
] as const;

export type Capability = (typeof CAPABILITY_CATALOG)[number];

export function getCapability(id: string) {
  return CAPABILITY_CATALOG.find((c) => c.id === id);
}

export function riskLevel(level: number): string {
  if (level === 0) return "Observe";
  if (level <= 1) return "Suggest";
  if (level === 2) return "Approval";
  if (level === 3) return "Policy";
  if (level === 4) return "Autonomous";
  return "Full";
}
