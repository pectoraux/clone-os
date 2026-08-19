// Clone OS — Admin: approve a waitlist entry (creates a real User with a temp password)
// POST /api/auth/admin/approve  { entryId }
// Returns { ok, userId, tempPassword }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

function generateTempPassword(): string {
  // 12-char readable password
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session || session.user?.accountStatus !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 })
    }
    const { entryId } = await req.json()
    if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 })

    const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } })
    if (!entry || entry.status !== 'pending') {
      return NextResponse.json({ error: 'Entry not found or already decided.' }, { status: 404 })
    }

    // Default tenant for new users (Sarah's personal tenant — they'll share the demo clone)
    const tenant = await db.tenant.findUnique({ where: { slug: 'sarah-personal' } })
    if (!tenant) return NextResponse.json({ error: 'Default tenant not seeded.' }, { status: 500 })

    const tempPassword = generateTempPassword()

    const user = await db.user.create({
      data: {
        tenantId: tenant.id,
        email: entry.email,
        name: entry.name,
        role: entry.desiredRole || 'user',
        accountStatus: 'approved',
        passwordHash: hashPassword(tempPassword),
        approvedAt: new Date(),
        approvedBy: session.user.id,
        publicKey: `pk_${entry.email.replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).slice(2, 10)}`,
      },
    })

    await db.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'approved', decidedAt: new Date(), decidedBy: session.user.id, createdUserId: user.id },
    })

    await db.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: session.user.id,
        action: 'waitlist.approved',
        resourceType: 'waitlist_entry',
        resourceId: entry.id,
        detailsJson: JSON.stringify({ createdUserId: user.id, email: user.email }),
      },
    })

    return NextResponse.json({ ok: true, userId: user.id, email: user.email, tempPassword })
  } catch (e: any) {
    console.error('[admin/approve] error', e)
    return NextResponse.json({ error: e?.message ?? 'Approval failed' }, { status: 500 })
  }
}

// Reject a waitlist entry
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session || session.user?.accountStatus !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get('id')
    if (!entryId) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await db.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'rejected', decidedAt: new Date(), decidedBy: session.user.id },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Reject failed' }, { status: 500 })
  }
}
