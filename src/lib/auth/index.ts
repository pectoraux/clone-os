// Clone OS — NextAuth.js v4 configuration (Credentials provider)
// The LLM is an inference engine; the Clone is the source of truth — auth lives
// in the platform's data layer, not in any vendor's identity system.

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    // We use a modal on the single / route — NextAuth's default pages are not
    // rendered. We set signIn to '/' so any flow that bounces to a page stays
    // on the dashboard.
    signIn: '/',
    signOut: '/',
    error: '/',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Clone OS',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password ?? ''
        if (!email || !password) return null
        const user = await db.user.findUnique({
          where: { email },
        })
        if (!user) return null
        if (!user.passwordHash) return null // waitlisted or no password set
        if (user.accountStatus === 'suspended') return null
        const ok = verifyPassword(password, user.passwordHash)
        if (!ok) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          accountStatus: user.accountStatus,
          tenantId: user.tenantId,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.accountStatus = (user as any).accountStatus
        token.tenantId = (user as any).tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).accountStatus = token.accountStatus
        ;(session.user as any).tenantId = token.tenantId
      }
      return session
    },
  },
  debug: false,
}

// Helper: typed session user
export interface CloneOsUser {
  id: string
  email: string
  name: string
  role: string
  accountStatus: string
  tenantId: string
}

export const DEMO_ACCOUNTS = [
  {
    email: 'sarah-admin@clone.os',
    password: 'demo',
    name: 'Sarah Chen (Demo Admin)',
    role: 'admin',
    accountStatus: 'demo',
    description: 'Demo Admin — can approve waitlist, see all sections',
  },
  {
    email: 'sarah@clone.os',
    password: 'demo',
    name: 'Sarah Chen (Demo User)',
    role: 'owner',
    accountStatus: 'demo',
    description: 'Demo User — the Sarah RevOps clone owner',
  },
  {
    email: 'candidate@clone.os',
    password: 'demo',
    name: 'Alex Rivera (Demo Candidate)',
    role: 'candidate',
    accountStatus: 'demo',
    description: 'Demo Candidate — recruitment trial flow',
  },
  {
    email: 'dev@clone.os',
    password: 'demo',
    name: 'Jordan Lee (Demo Developer)',
    role: 'developer',
    accountStatus: 'demo',
    description: 'Demo Developer — extension/tool developer view',
  },
] as const
