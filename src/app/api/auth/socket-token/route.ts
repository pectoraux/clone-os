// Clone OS — Socket token exchange (N0.1)
//
// The NextAuth session cookie is HttpOnly — JS can't read it to pass to the
// socket.io mini-service. This endpoint mints a short-lived opaque token
// tied to the principal, returns it to the frontend, and the mini-service
// validates it via /api/auth/validate-socket-token (server-to-server).
//
// The token is single-use and expires in 60 seconds. This is the bridge
// between the authenticated Next.js session and the socket.io mini-service.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getRequestContext, requireAuthenticated } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const ctx = await getRequestContext();
  const authCheck = requireAuthenticated(ctx);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status });
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60_000); // 60 seconds

  // Store in VerificationToken (repurposed: identifier = userId, token = socket token)
  // Delete any existing tokens for this user first (one active token at a time)
  await db.verificationToken.deleteMany({ where: { identifier: ctx.principal!.id } });
  await db.verificationToken.create({
    data: {
      identifier: ctx.principal!.id,
      token,
      expires,
    },
  });

  return NextResponse.json({ token, expiresAt: expires.toISOString() });
}
