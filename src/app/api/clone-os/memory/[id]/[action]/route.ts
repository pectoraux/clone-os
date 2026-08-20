// Clone OS — Memory lifecycle actions (reinforce, weaken, supersede, archive, forget)
// POST /api/clone-os/memory/[id]/[action]

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated } from '@/lib/auth/server'
import { MemoryManager } from '@/lib/memory/manager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, action: string }> }) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  const { id, action } = await params
  const memory = await db.memory.findUnique({ where: { id } })
  if (!memory) return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  if (memory.tenantId !== ctx.tenantId && !ctx.isAdmin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const manager = new MemoryManager()
  const body = await req.json().catch(() => ({}))

  switch (action) {
    case 'reinforce': {
      const result = await manager.reinforce(id, { sourceType: body.sourceType || 'human_approval', sourceId: body.sourceId, evidenceWeight: body.evidenceWeight ?? 0.5, outcome: body.outcome || 'positive' }, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    case 'weaken': {
      const result = await manager.weaken(id, { sourceType: body.sourceType || 'correction', sourceId: body.sourceId, evidenceWeight: body.evidenceWeight ?? 0.5, outcome: body.outcome || 'negative' }, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    case 'supersede': {
      if (!body.newMemoryId) return NextResponse.json({ error: 'newMemoryId required' }, { status: 400 })
      const result = await manager.supersede(id, body.newMemoryId, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    case 'archive': {
      const result = await manager.archive(id, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    case 'forget': {
      const result = await manager.forget(id, ctx.principal!.id)
      return NextResponse.json({ ok: true, ...result })
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
