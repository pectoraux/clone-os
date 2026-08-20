// Clone OS — Memory lifecycle actions (N1.3B.1)
// POST /api/clone-os/memory/[id]/[action]
// Actions: reinforce | weaken | supersede | archive | restore | forget | activate

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestContext, requireAuthenticated } from '@/lib/auth/server'
import { MemoryManager, type MemoryExecutionContext, type EvidenceInput } from '@/lib/memory/manager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, action: string }> }) {
  const ctx = await getRequestContext()
  const authCheck = requireAuthenticated(ctx)
  if (!authCheck.ok) return NextResponse.json({ error: authCheck.reason }, { status: authCheck.status })
  const { id, action } = await params

  // N1.3B.1: The memory's cloneId/tenantId is verified by the domain layer
  // (authorizeMemory), not trusted from the request body.
  const memory = await db.memory.findUnique({ where: { id } })
  if (!memory) return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  if (memory.tenantId !== ctx.tenantId && !ctx.isAdmin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const memCtx: MemoryExecutionContext = {
    principalId: ctx.principal!.id,
    tenantId: memory.tenantId,
    cloneId: memory.cloneId,
  }
  const manager = new MemoryManager()
  const body = await req.json().catch(() => ({}))

  try {
    switch (action) {
      case 'activate': {
        const result = await manager.activate(id, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'reinforce': {
        const evidence: EvidenceInput = { sourceType: body.sourceType || 'human_approval', sourceId: body.sourceId, evidenceWeight: body.evidenceWeight ?? 0.5, outcome: body.outcome || 'positive' }
        const result = await manager.reinforce(id, evidence, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'weaken': {
        const evidence: EvidenceInput = { sourceType: body.sourceType || 'correction', sourceId: body.sourceId, evidenceWeight: body.evidenceWeight ?? 0.5, outcome: body.outcome || 'negative' }
        const result = await manager.weaken(id, evidence, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'supersede': {
        if (!body.newMemoryId) return NextResponse.json({ error: 'newMemoryId required' }, { status: 400 })
        const result = await manager.supersede(id, body.newMemoryId, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'archive': {
        const result = await manager.archive(id, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'restore': {
        const result = await manager.restore(id, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      case 'forget': {
        const result = await manager.forget(id, memCtx)
        return NextResponse.json({ ok: true, ...result })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    // N1.3B.1: Return structured errors for policy protection violations
    return NextResponse.json({ error: e.message || 'Memory operation failed' }, { status: e.message?.includes('Policy') ? 422 : 500 })
  }
}
