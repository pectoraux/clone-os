// Clone OS — Training Studio action endpoint
// POST /api/clone-os/train
// Creates a TrainingSession (ADR-0007), updates touched skills, emits a
// TrainingCompleted + skill-touched events, optionally bumps a new clone
// version when the user "releases" the training.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DOMAIN_EVENTS } from "@/lib/clone-os/events";

export const dynamic = "force-dynamic";

function j(o: unknown): string {
  return JSON.stringify(o);
}

// Demo: pick a deterministic-ish response per training mode (the dashboard
// shows the loop end-to-end; the actual LLM call happens in the live-chat
// mini-service, not here).
function simulatedOutput(mode: string): Record<string, unknown> {
  switch (mode) {
    case "teaching":
      return { captured: "knowledge_added", skillsTouched: 1 };
    case "demonstration":
      return { captured: "demonstration_recorded", stepsObserved: 5 };
    case "correction":
      return { applied: "behavior_patched", divergenceBefore: 0.34, divergenceAfter: 0.12 };
    case "shadowing":
      return { captured: "workflow_observed", workflowRef: "weekly-operating-review" };
    case "assisted":
      return { proposal: "approve", approved: true };
    case "delegated":
      return { executed: true, withinPolicy: true };
    case "simulation":
      return { surfacedFailure: "over-weighting-commit-deal", severity: 0.18 };
    case "adversarial":
      return { divergence: 0.21, edgeCaseSurfaced: "conflicting-ICP-signals" };
    case "real_world":
      return { outcomeMet: true, humanIntervention: 0.11 };
    default:
      return { captured: true };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cloneId, mode, stage, input, ownerId, tenantId } = body as {
    cloneId: string;
    mode: string;
    stage?: string;
    input?: Record<string, unknown>;
    ownerId?: string;
    tenantId?: string;
  };

  if (!cloneId || !mode) {
    return NextResponse.json({ error: "cloneId and mode are required" }, { status: 400 });
  }

  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: { owner: true },
  });
  if (!clone) {
    return NextResponse.json({ error: "clone not found" }, { status: 404 });
  }

  const effectiveTenantId = tenantId ?? clone.tenantId;
  const effectiveOwnerId = ownerId ?? clone.ownerId;

  const output = simulatedOutput(mode);
  const session = await db.trainingSession.create({
    data: {
      cloneId,
      tenantId: effectiveTenantId,
      ownerId: effectiveOwnerId,
      mode,
      stage: stage ?? mode === "real_world" ? "measure" : "train",
      inputJson: j(input ?? { source: "dashboard" }),
      outputJson: j(output),
      skillsTouchedJson: j(["pipeline_hygiene", "forecasting"]),
      status: "completed",
      completedAt: new Date(),
      durationMs: 60_000 + Math.floor(Math.random() * 240_000),
      notes: `Dashboard-initiated ${mode} training`,
    },
  });

  // Domain events (ADR-0048)
  await db.domainEvent.create({
    data: {
      tenantId: effectiveTenantId,
      cloneId,
      type: "TrainingStarted" as any,
      payloadJson: j({ mode, stage: session.stage, sessionId: session.id }),
    },
  });
  await db.domainEvent.create({
    data: {
      tenantId: effectiveTenantId,
      cloneId,
      type: "TrainingCompleted" as any,
      payloadJson: j({ mode, sessionId: session.id, output }),
    },
  });
  if (mode === "demonstration") {
    await db.domainEvent.create({
      data: { tenantId: effectiveTenantId, cloneId, type: "DemonstrationCaptured" as any, payloadJson: j({ sessionId: session.id }) },
    });
  }
  if (mode === "correction") {
    await db.domainEvent.create({
      data: { tenantId: effectiveTenantId, cloneId, type: "CorrectionCaptured" as any, payloadJson: j({ sessionId: session.id, ...output }) },
    });
  }

  // Audit log
  await db.auditLog.create({
    data: {
      tenantId: effectiveTenantId,
      actorId: effectiveOwnerId,
      cloneId,
      action: "training.session.completed",
      resourceType: "training_session",
      resourceId: session.id,
      detailsJson: j({ mode, stage: session.stage }),
    },
  });

  // Bump the aggregate slightly to show the loop is alive
  const newAggregate = Math.min(99.9, (clone.aggregateScore ?? 80) + 0.1);
  await db.clone.update({ where: { id: cloneId }, data: { aggregateScore: newAggregate, updatedAt: new Date() } });

  return NextResponse.json({
    ok: true,
    session,
    events: ["TrainingStarted", "TrainingCompleted", mode === "demonstration" ? "DemonstrationCaptured" : "", mode === "correction" ? "CorrectionCaptured" : ""].filter(Boolean),
    newAggregate,
  });
}
