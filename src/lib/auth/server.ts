// Clone OS — Server-side request-context resolver
// Use this in App Router route handlers to get a RequestContext from the
// NextAuth session, then enforce authorization with requireAdmin / requireCloneOwner.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  contextFromSession,
  requireAuthenticated,
  requireAdmin,
  requireCloneOwner,
  type RequestContext,
  type AuthResult,
} from '@/lib/auth/request-context'
import { db } from '@/lib/db'

export { requireAuthenticated, requireAdmin, requireCloneOwner }
export type { RequestContext, AuthResult }

export async function getRequestContext(): Promise<RequestContext> {
  const session = await getServerSession(authOptions)
  return contextFromSession(session)
}

// Resolve a clone by slug within the principal's tenant. Returns null if the
// clone doesn't exist or isn't accessible to the principal. Used by endpoints
// that take a clone slug in the URL.
export async function resolveAccessibleClone(
  ctx: RequestContext,
  slug: string,
): Promise<{ id: string; ownerId: string; tenantId: string } | null> {
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    // Unauthenticated — only allow access to the public demo clone
    const demo = await db.clone.findFirst({
      where: { slug, visibility: 'marketplace' },
      select: { id: true, ownerId: true, tenantId: true },
    })
    return demo
  }
  // Authenticated — look up within the principal's tenant first, then fall
  // back to marketplace-visible clones for cross-tenant reads.
  const own = await db.clone.findFirst({
    where: { slug, tenantId: ctx.tenantId },
    select: { id: true, ownerId: true, tenantId: true },
  })
  if (own) return own
  const listed = await db.clone.findFirst({
    where: { slug, visibility: 'marketplace' },
    select: { id: true, ownerId: true, tenantId: true },
  })
  return listed
}
