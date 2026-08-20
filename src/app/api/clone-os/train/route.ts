// Clone OS — Training Studio action endpoint
//
// N0.1: cloneId is resolved from the authenticated session, NOT the request
//   body. The caller can request a training operation; the server decides
//   whether that caller may perform it (requireCloneOwner).
// N0.9: training does NOT mutate clone.aggregateScore in place. It creates
//   a TrainingSession, emits events, and (in the real learning pipeline)
//   would produce a CloneVersionCandidate. The simulated aggregate bump is
//   gone — see HARDENING.md.
// N0.7: this is a PROTOTYPE ADAPTER / SIMULATED TRAINING BACKEND. It is
//   clearly marked as simulated in the response. Real learning pipeline is
//   tracked under N0.7 in docs/HARDENING.md.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, requireCloneOwner, requireAuthenticated } from "@/lib/auth/server";
import type { RequestContext } from "@/lib/auth/request-context";
import { DOMAIN_EVENTS } from "@/lib/clone-os/events";

export const dynamic = "force-dynamic";

function j(o: unknown): string {
  return JSON.stringify(o);
}

// PROTOTYPE ADAPTER — this is NOT a real learning system. It records the
// training session for audit purposes and emits domain events, but the
// "output" is a canned response keyed on mode. Real learning is N0.7.
function simulatedOutput(mode: string): Record<string, unknown> {
  switch (mode) {
    case "teaching":
      return { captured: "knowledge_added", skillsTouched: 1, simulated: true };
    case "demonstration":
      return { captured: "demonstration_recorded", stepsObserved: 5, simulated: true };
    case "correction":
      return { applied: "behavior_patched", divergenceBefore: 0.34, divergenceAfter: 0.12, simulated: true };
    case "shadowing":
      return { captured: "workflow_observed", workflowRef: "weekly-operating-review", simulated: true };
    case "assisted":
      return { proposal: "approve", approved: true, simulated: true };
    case "delegated":
      return { executed: true, withinPolicy: true, simulated: true };
    case "simulation":
      return { surfacedFailure: "over-weighting-commit-deal", severity: 0.18, simulated: true };
    case "adversarial":
      return { divergence: 0.21, edgeCaseSurfaced: "conflicting-ICP-signals", simulated: true };
    case "real_world":
      return { outcomeMet: true, humanIntervention: 0.11, simulated: true };
    default:
      return { captured: true, simulated: true };
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext();

  // N0.1: Auth — any authenticated user can request a training session, but
  // they must own (or be admin/demo on) the clone they're training.
  const authCheck = requireAuthenticated(ctx);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status });
  }

  const body = await req.json();
  const { cloneId, mode, stage, input } = body as {
    cloneId?: string;
    mode: string;
    stage?: string;
    input?: Record<string, unknown>;
  };

  if (!cloneId || !mode) {
    return NextResponse.json({ error: "cloneId and mode are required" }, { status: 400 });
  }

  // N0.1: authorize that this principal may operate on this clone.
  const ownerCheck = await requireCloneOwner(ctx, cloneId, db);
  if (!ownerCheck.ok) {
    return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status });
  }

  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: { owner: true, currentVersion: true },
  });
  if (!clone) {
    return NextResponse.json({ error: "clone not found" }, { status: 404 });
  }

  // Resolve ownerId/tenantId from the authenticated context, NEVER from body.
  const effectiveTenantId = ctx.tenantId ?? clone.tenantId;
  const effectiveOwnerId = ctx.principal!.id;

  const output = simulatedOutput(mode);
  const session = await db.trainingSession.create({
    data: {
      cloneId,
      tenantId: effectiveTenantId,
      ownerId: effectiveOwnerId,
      mode,
      stage: stage ?? (mode === "real_world" ? "measure" : "train"),
      inputJson: j(input ?? { source: "dashboard" }),
      outputJson: j(output),
      skillsTouchedJson: j(["pipeline_hygiene", "forecasting"]),
      status: "completed",
      completedAt: new Date(),
      durationMs: 60_000 + Math.floor(Math.random() * 240_000),
      notes: `Dashboard-initiated ${mode} training (SIMULATED — see HARDENING.md N0.7)`,
    },
  });

  // Domain events (ADR-0048)
  await db.domainEvent.createMany({
    data: [
      {
        tenantId: effectiveTenantId,
        cloneId,
        type: "TrainingStarted",
        payloadJson: j({ mode, stage: session.stage, sessionId: session.id, requestId: ctx.requestId }),
      },
      {
        tenantId: effectiveTenantId,
        cloneId,
        type: "TrainingCompleted",
        payloadJson: j({ mode, sessionId: session.id, output, simulated: true }),
      },
      ...(mode === "demonstration"
        ? [{ tenantId: effectiveTenantId, cloneId, type: "DemonstrationCaptured" as any, payloadJson: j({ sessionId: session.id }) }]
        : []),
      ...(mode === "correction"
        ? [{ tenantId: effectiveTenantId, cloneId, type: "CorrectionCaptured" as any, payloadJson: j({ sessionId: session.id, ...output }) }]
        : []),
    ],
  });

  await db.auditLog.create({
    data: {
      tenantId: effectiveTenantId,
      actorId: effectiveOwnerId,
      cloneId,
      action: "training.session.completed",
      resourceType: "training_session",
      resourceId: session.id,
      detailsJson: j({ mode, stage: session.stage, requestId: ctx.requestId, simulated: true }),
    },
  });

  // N0.9: NO direct mutation of clone.aggregateScore. Training produces a
  // session record + events; the aggregate is recomputed only when a new
  // CloneVersion is released (after evaluation gates the release). The old
  // `clone.aggregateScore + 0.1` bump is removed because it violated the
  // versioning principle (never silently mutate production intelligence).

  return NextResponse.json({
    ok: true,
    session,
    events: ["TrainingStarted", "TrainingCompleted", mode === "demonstration" ? "DemonstrationCaptured" : "", mode === "correction" ? "CorrectionCaptured" : ""].filter(Boolean),
    // Explicitly tell the caller this is a simulated training output.
    simulated: true,
    note: "Prototype training adapter — see HARDENING.md (N0.7). No production clone state was mutated.",
  });
}
