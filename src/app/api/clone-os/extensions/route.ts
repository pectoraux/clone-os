// Clone OS — Extension install/uninstall (ADR-0007, ADR-0027)
// POST /api/clone-os/extensions  body: { extensionId, action: "install"|"uninstall" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function j(o: unknown): string {
  return JSON.stringify(o);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { extensionId, action } = body as { extensionId: string; action: "install" | "uninstall" };
  if (!extensionId || !action) {
    return NextResponse.json({ error: "extensionId and action are required" }, { status: 400 });
  }
  const ext = await db.extension.findUnique({ where: { id: extensionId } });
  if (!ext) {
    return NextResponse.json({ error: "extension not found" }, { status: 404 });
  }
  const installed = action === "install";
  await db.extension.update({ where: { id: extensionId }, data: { installed } });

  // Emit ExtensionInstalled event + audit log
  await db.domainEvent.create({
    data: {
      tenantId: ext.tenantId,
      type: "ExtensionInstalled" as any,
      payloadJson: j({ extensionId, slug: ext.slug, action }),
    },
  });
  await db.auditLog.create({
    data: {
      tenantId: ext.tenantId,
      action: `extension.${action}ed`,
      resourceType: "extension",
      resourceId: extensionId,
      detailsJson: j({ slug: ext.slug, capabilities: JSON.parse(ext.capabilitiesJson || "[]") }),
    },
  });

  // If installing, also emit PermissionGranted for each capability (ADR-0027)
  if (installed) {
    const caps: string[] = JSON.parse(ext.capabilitiesJson || "[]");
    for (const c of caps) {
      await db.domainEvent.create({
        data: { tenantId: ext.tenantId, type: "PermissionGranted" as any, payloadJson: j({ capability: c, extensionId }) },
      });
    }
  }

  return NextResponse.json({ ok: true, extensionId, installed });
}
