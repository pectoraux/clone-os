// Clone OS — Memory API (N1.3B)
// GET /api/clone-os/memory?cloneId=... — list memories
// POST /api/clone-os/memory — create candidate / consolidate / maintenance

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated, requireCloneOwner } from '@/lib/auth/server'
import { MemoryManager } from '@/lib/memory/manager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  const cloneId = new URL(req.url).searchParams.get('cloneId')
  if (!cloneId) return NextResponse.json({ error: 'cloneId required' }, { status: 400 })
  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  const manager = new MemoryManager()
  const memories = await manager.listMemories(cloneId, true)
  return NextResponse.json({ memories })
}

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  const body = await req.json()
  const { action, cloneId } = body
  if (!cloneId) return NextResponse.json({ error: 'cloneId required' }, { status: 400 })
  const ownerCheck = await requireCloneOwner(ctx, cloneId, db)
  if (!ownerCheck.ok) return NextResponse.json({ error: ownerCheck.reason }, { status: ownerCheck.status })
  const manager = new MemoryManager()

  switch (action) {
    case 'create_candidate': {
      const { type, content, importance, confidence, domain, scope, sourceKind, sensitivity, portability } = body
      if (!type || !content) return NextResponse.json({ error: 'type and content required' }, { status: 400 })
      const result = await manager.createCandidate({
        cloneId, tenantId: ctx.tenantId!, type, content,
        importance, confidence, domain, scope, sourceKind, sensitivity, portability,
        actorId: ctx.principal!.id,
      })
      return NextResponse.json({ ok: true, ...result })
    }
    case 'consolidate': {
      const result = await manager.consolidate(cloneId, ctx.tenantId!, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    case 'maintenance': {
      const result = await manager.runDecayMaintenance(cloneId)
      return NextResponse.json({ ok: true, ...result })
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
