// Clone OS — RequestContext (ADR-0021)
//
// The caller can request a resource. The server decides whether that caller
// may access it. Domain operations receive `context + command` — never trust
// tenantId / ownerId / cloneId from request body.
//
// This is the foundation of N0.1 (Identity + Authorization) and N0.2 (Real
// multi-tenancy). Every API route resolves a RequestContext from the session
// and passes it down to the domain service layer.

import type { Session } from 'next-auth'

export interface Principal {
  id: string
  email: string
  name: string
  role: string            // owner | admin | member | developer | candidate
  accountStatus: string   // admin | demo | approved | waitlist | suspended
  tenantId: string
}

export interface RequestContext {
  principal: Principal | null       // null for unauthenticated (e.g., public marketplace reads)
  requestId: string
  isAuthenticated: boolean
  isAdmin: boolean
  isDemo: boolean
  // The effective tenant for this request. Resolved from the session, NEVER
  // from request body. A user may belong to multiple tenants — for the MVP
  // we resolve from the session's tenantId; a real org-switcher would update
  // the active tenant via an explicit switch endpoint.
  tenantId: string | null
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

// Build a RequestContext from a NextAuth session.
export function contextFromSession(session: Session | null): RequestContext {
  const requestId = newRequestId()
  if (!session?.user) {
    return {
      principal: null,
      requestId,
      isAuthenticated: false,
      isAdmin: false,
      isDemo: false,
      tenantId: null,
    }
  }
  const u = session.user as any
  const principal: Principal = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    accountStatus: u.accountStatus,
    tenantId: u.tenantId,
  }
  return {
    principal,
    requestId,
    isAuthenticated: true,
    isAdmin: u.accountStatus === 'admin',
    isDemo: u.accountStatus === 'demo',
    tenantId: u.tenantId,
  }
}

// ---- Authorization helpers ----
// Each helper returns a typed result that the route handler can use to
// either proceed or reject. We never throw — the route handler decides.

export interface AuthOk {
  ok: true
  context: RequestContext
}
export interface AuthDenied {
  ok: false
  reason: string
  status: number
}
export type AuthResult = AuthOk | AuthDenied

export function requireAuthenticated(ctx: RequestContext): AuthResult {
  if (!ctx.isAuthenticated || !ctx.principal) {
    return { ok: false, reason: 'Authentication required', status: 401 }
  }
  return { ok: true, context: ctx }
}

export function requireAdmin(ctx: RequestContext): AuthResult {
  const authed = requireAuthenticated(ctx)
  if (!authed.ok) return authed
  if (!ctx.isAdmin) {
    return { ok: false, reason: 'Admin role required', status: 403 }
  }
  return authed
}

// Check that the principal owns the clone OR is an admin. Used by training,
// extension install, etc. — operations that mutate a specific clone.
export async function requireCloneOwner(
  ctx: RequestContext,
  cloneId: string,
  db: any,
): Promise<AuthResult> {
  const authed = requireAuthenticated(ctx)
  if (!authed.ok) return authed
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    select: { id: true, ownerId: true, tenantId: true },
  })
  if (!clone) {
    return { ok: false, reason: 'Clone not found', status: 404 }
  }
  // Admin can act on any clone within their tenant scope. Owner can act on
  // their own clones. Demo users can act on the demo Sarah clone (read-only
  // for the MVP — mutations are still logged for audit).
  if (ctx.isAdmin) {
    // Admin must be in the same tenant (admins are scoped to their admin tenant
    // but can read across — this is intentionally permissive for the MVP and
    // must be tightened per ADR-0004 for production).
    return { ok: true, context: ctx }
  }
  if (clone.ownerId === ctx.principal!.id) {
    return { ok: true, context: ctx }
  }
  // Demo users on the demo tenant can operate on the demo clone
  if (ctx.isDemo && clone.tenantId === ctx.tenantId) {
    return { ok: true, context: ctx }
  }
  return { ok: false, reason: 'Not authorized to operate on this clone', status: 403 }
}
