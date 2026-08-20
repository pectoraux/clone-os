// Clone OS — Extension install/uninstall (ADR-0007, ADR-0027)
//
// N0.1: Auth required. The principal must be authenticated AND must own (or
//   be admin/demo on) the tenant that the extension belongs to. The
//   extensionId comes from the request body but is validated against the
//   principal's tenantId — you can't install an extension in another tenant.
// N0.5 (partial): the install action goes through a CapabilityBroker check
//   stub. For the MVP the broker logs the requested capabilities + risk and
//   approves (because the principal owns the tenant); a real broker would
//   require explicit approval for high-risk/critical capabilities.
// N0.6: extension *runtime* (sandbox, invocation protocol, lifecycle) is NOT
//   implemented — see HARDENING.md. This endpoint only manages the
//   `installed` flag and emits PermissionGranted/Revoked events.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, requireAuthenticated } from "@/lib/auth/server";
import { CapabilityBroker } from "@/lib/capabilities/broker";

export const dynamic = "force-dynamic";

function j(o: unknown): string {
  return JSON.stringify(o);
}

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext();
  const authCheck = requireAuthenticated(ctx);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status });
  }

  const body = await req.json();
  const { extensionId, action } = body as { extensionId: string; action: "install" | "uninstall" };
  if (!extensionId || !action) {
    return NextResponse.json({ error: "extensionId and action are required" }, { status: 400 });
  }

  // N0.1 + N0.2: resolve the extension within the principal's tenant. You
  // cannot install an extension that belongs to another tenant.
  const ext = await db.extension.findFirst({
    where: { id: extensionId, tenantId: ctx.tenantId },
  });
  if (!ext) {
    return NextResponse.json({ error: "Extension not found in your tenant." }, { status: 404 });
  }

  // N0.5: CapabilityBroker check. For install, the principal is requesting
  // all the extension's declared capabilities. The broker evaluates risk and
  // (for the MVP) approves because the principal owns the tenant — but it
  // logs every requested capability, flags high-risk/critical ones that would
  // require explicit approval in a real system, and emits an audit event.
  const caps: string[] = JSON.parse(ext.capabilitiesJson || "[]");
  const broker = new CapabilityBroker();
  const decision = broker.authorizeExtensionInstall({
    principal: ctx.principal!,
    tenantId: ctx.tenantId!,
    extensionId: ext.id,
    extensionSlug: ext.slug,
    capabilities: caps,
    action,
  });

  if (decision.decision === "deny") {
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId!,
        actorId: ctx.principal!.id,
        action: `extension.${action}.denied`,
        resourceType: "extension",
        resourceId: extensionId,
        detailsJson: j({ slug: ext.slug, capabilities: caps, reason: decision.reason, requestId: ctx.requestId }),
      },
    });
    return NextResponse.json({ error: "Capability broker denied", reason: decision.reason }, { status: 403 });
  }

  // For the MVP, "require-human-approval" is logged but the install proceeds
  // because the principal owns the tenant (they ARE the human approver).
  // A real broker would block here and emit an approval request.
  const installed = action === "install";
  await db.extension.update({ where: { id: extensionId }, data: { installed } });

  await db.domainEvent.create({
    data: {
      tenantId: ext.tenantId,
      type: "ExtensionInstalled",
      payloadJson: j({ extensionId, slug: ext.slug, action, requestId: ctx.requestId, brokerDecision: decision.decision, requiresApproval: decision.requiresApproval }),
    } as any,
  });
  await db.auditLog.create({
    data: {
      tenantId: ext.tenantId,
      actorId: ctx.principal!.id,
      action: `extension.${action}ed`,
      resourceType: "extension",
      resourceId: extensionId,
      detailsJson: j({ slug: ext.slug, capabilities: caps, brokerDecision: decision.decision, requestId: ctx.requestId }),
    },
  });

  // N0.5: emit PermissionGranted/Revoked per capability (ADR-0027)
  if (installed) {
    await db.domainEvent.createMany({
      data: caps.map((c) => ({
        tenantId: ext.tenantId,
        type: "PermissionGranted" as any,
        payloadJson: j({ capability: c, extensionId, principalId: ctx.principal!.id, requestId: ctx.requestId }),
      })),
    });
  } else {
    await db.domainEvent.createMany({
      data: caps.map((c) => ({
        tenantId: ext.tenantId,
        type: "PermissionRevoked" as any,
        payloadJson: j({ capability: c, extensionId, principalId: ctx.principal!.id, requestId: ctx.requestId }),
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    extensionId,
    installed,
    brokerDecision: decision.decision,
    requiresApproval: decision.requiresApproval,
    note: decision.requiresApproval
      ? "Some capabilities are high-risk/critical and would require explicit approval in a production broker. Proceeded because principal owns the tenant — see HARDENING.md (N0.5)."
      : undefined,
  });
}
