// Clone OS — Socket token validation (server-to-server)
//
// Called by the clone-chat mini-service to validate a socket token. Returns
// the principal info if the token is valid + not expired, then deletes the
// token (single-use). This endpoint is INTERNAL — it should only be reachable
// from the mini-service, not from the public internet. For the MVP it lives
// behind the same Caddy gateway as the rest of the platform; a real
// deployment would put it on an internal-only network.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, reason: "token required" }, { status: 400 });
  }
  const rec = await db.verificationToken.findFirst({
    where: { token },
  });
  if (!rec) {
    return NextResponse.json({ valid: false, reason: "not found" }, { status: 404 });
  }
  if (rec.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { token } });
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 410 });
  }
  // Look up the user
  const user = await db.user.findUnique({
    where: { id: rec.identifier },
    select: { id: true, email: true, name: true, role: true, accountStatus: true, tenantId: true },
  });
  if (!user) {
    await db.verificationToken.deleteMany({ where: { token } });
    return NextResponse.json({ valid: false, reason: "user not found" }, { status: 404 });
  }
  // Single-use: delete after validation
  await db.verificationToken.deleteMany({ where: { token } });
  return NextResponse.json({
    valid: true,
    principal: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountStatus: user.accountStatus,
      tenantId: user.tenantId,
    },
  });
}
