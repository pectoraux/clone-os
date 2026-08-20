// Clone OS — Current user info + waitlist (admin only)
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.user) {
    return NextResponse.json({ user: null })
  }
  const isAdmin = session.user.accountStatus === 'admin'
  let waitlist: any[] = []
  if (isAdmin) {
    waitlist = await db.waitlistEntry.findMany({
      where: { status: 'pending' },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    })
  }
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      accountStatus: session.user.accountStatus,
      tenantId: session.user.tenantId,
    },
    waitlist,
  })
}
