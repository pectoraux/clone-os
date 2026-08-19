// Clone OS — Intent-based hiring (ADR-0011, ADR-0029)
// POST /api/clone-os/marketplace
// Body: { intent: string }  -> returns capability decomposition + matched listings.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CAPABILITY_CATALOG } from "@/lib/clone-os/autonomy";

export const dynamic = "force-dynamic";

// Naive intent -> capability decomposition. The master prompt requires the
// platform to translate an outcome into required capabilities; this is a
// reference implementation of that step.
function decomposeIntent(intent: string): { capabilities: string[]; rationale: string[] } {
  const text = intent.toLowerCase();
  const caps = new Set<string>();
  const rationale: string[] = [];

  if (/(qualify|lead|inbound|outbound)/.test(text)) {
    caps.add("READ_CRM");
    caps.add("WRITE_CRM");
    rationale.push("Lead qualification requires CRM read + write.");
  }
  if (/(salesforce|crm|pipeline)/.test(text)) {
    caps.add("READ_CRM");
    caps.add("WRITE_CRM");
    rationale.push("CRM management requires read + write to the CRM system.");
  }
  if (/(email|outreach|contact|book.*meeting)/.test(text)) {
    caps.add("READ_EMAIL");
    caps.add("SEND_EMAIL");
    rationale.push("Outreach requires email read + send.");
  }
  if (/(meeting|schedule|calendar)/.test(text)) {
    caps.add("READ_CALENDAR");
    caps.add("CREATE_CALENDAR_EVENT");
    rationale.push("Scheduling requires calendar read + create.");
  }
  if (/(research|investigate|analyz|enrich)/.test(text)) {
    caps.add("WEB_SEARCH");
    caps.add("BROWSER_AUTOMATION");
    rationale.push("Research requires web search + browser automation.");
  }
  if (/(report|deck|dashboard|kpi|operating review)/.test(text)) {
    caps.add("READ_CRM");
    caps.add("READ_DOCS");
    caps.add("WEB_SEARCH");
    rationale.push("Reporting requires data read across CRM + docs.");
  }
  if (/(slack|message|chat|triage.*dm)/.test(text)) {
    caps.add("READ_MESSAGES");
    caps.add("SEND_MESSAGES");
    rationale.push("Messaging triage requires read + send messages.");
  }
  if (/(vision|image|video|camera)/.test(text)) {
    caps.add("VISION_READ");
    rationale.push("Vision task requires computer vision capability.");
  }
  if (/(robot|physical|device|control)/.test(text)) {
    caps.add("CONTROL_DEVICE");
    rationale.push("Physical control requires CONTROL_DEVICE (high-risk, approval required).");
  }
  if (/(refund|payment|finance|invoice)/.test(text)) {
    caps.add("ISSUE_REFUND");
    rationale.push("Finance task requires refund capability (high-risk).");
  }
  if (caps.size === 0) {
    // Fallback: pick general-purpose capabilities
    caps.add("WEB_SEARCH");
    caps.add("READ_CRM");
    rationale.push("No specific capabilities detected — falling back to general-purpose web research + CRM read.");
  }

  return { capabilities: Array.from(caps), rationale };
}

function scoreListing(listingCaps: string[], requiredCaps: string[]): number {
  if (requiredCaps.length === 0) return 0.5;
  const hits = requiredCaps.filter((c) => listingCaps.includes(c)).length;
  return hits / requiredCaps.length;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const intent: string = body?.intent ?? "";
  if (!intent.trim()) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 });
  }

  const { capabilities, rationale } = decomposeIntent(intent);

  const listings = await db.marketplaceListing.findMany({
    where: { status: "listed" },
  });
  const scored = listings
    .map((l) => {
      const caps: string[] = JSON.parse(l.capabilitiesJson || "[]");
      const match = scoreListing(caps, capabilities);
      // Reputation weight (ADR-0034)
      const rep = JSON.parse(l.reputationJson || "{}");
      const repScore = (rep.successRate ?? 0.7) * 0.3 + (rep.tasksCompleted ?? 0) / 1000 * 0.1;
      const total = match * 0.7 + repScore;
      return {
        id: l.id,
        packageType: l.packageType,
        name: l.name,
        description: l.description,
        capabilities: caps,
        capabilityMatch: Math.round(match * 100) / 100,
        certificationLevel: l.certificationLevel,
        reputation: rep,
        pricingMode: l.pricingMode,
        priceCents: l.priceCents,
        score: Math.round(total * 100) / 100,
      };
    })
    .filter((l) => l.capabilityMatch > 0)
    .sort((a, b) => b.score - a.score);

  const capMeta = capabilities.map((c) => {
    const found = CAPABILITY_CATALOG.find((x) => x.id === c);
    return { id: c, label: found?.label ?? c, risk: found?.risk ?? "unknown", requiresApproval: found?.requiresApproval ?? false };
  });

  return NextResponse.json({
    intent,
    requiredCapabilities: capMeta,
    rationale,
    matches: scored,
  });
}
