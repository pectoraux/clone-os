// Clone OS — Waitlist signup endpoint
// POST /api/auth/waitlist  { name, email, desiredRole, note }
// Adds an entry to the waitlist. The admin can approve it later, which creates a
// real User with a temporary password.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['user', 'candidate', 'developer']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, desiredRole, note } = body as {
      name?: string
      email?: string
      desiredRole?: string
      note?: string
    }
    const cleanEmail = email?.trim().toLowerCase()
    const cleanName = (name ?? '').trim()
    const cleanRole = VALID_ROLES.includes(desiredRole ?? '') ? desiredRole! : 'user'
    if (!cleanEmail || !cleanName) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }
    // Check if email already exists as a user (already approved / demo)
    const existingUser = await db.user.findUnique({ where: { email: cleanEmail } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }
    // Check if already on waitlist
    const existingEntry = await db.waitlistEntry.findUnique({ where: { email: cleanEmail } })
    if (existingEntry) {
      return NextResponse.json(
        { error: 'You are already on the waitlist. We will be in touch.' },
        { status: 409 },
      )
    }
    const entry = await db.waitlistEntry.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        desiredRole: cleanRole,
        note: note?.slice(0, 1000) ?? null,
        status: 'pending',
      },
    })
    return NextResponse.json({ ok: true, id: entry.id })
  } catch (e: any) {
    console.error('[waitlist] error', e)
    return NextResponse.json({ error: e?.message ?? 'Signup failed' }, { status: 500 })
  }
}

// GET lists the waitlist for the admin UI (server-side filtered by session — see /api/auth/admin/*)
export async function GET() {
  const entries = await db.waitlistEntry.findMany({
    where: { status: 'pending' },
    orderBy: { requestedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ entries })
}
