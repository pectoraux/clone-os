'use client'

// Clone OS — Authentication UI
// Sign-up puts users on a waitlist. Admin can approve (creates a real user with
// a temp password). Demo accounts have quick-login buttons.

import * as React from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  X, LogIn, LogOut, UserPlus, ShieldCheck, Sparkles, User as UserIcon,
  CheckCircle2, AlertTriangle, Clock, KeyRound, Copy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// ---- Public demo accounts (mirrors the seed) ----
export const DEMO_ACCOUNTS = [
  { email: 'sarah-admin@clone.os', password: 'demo', name: 'Demo Admin', role: 'admin', description: 'Admin view — approve waitlist, all sections' },
  { email: 'sarah@clone.os', password: 'demo', name: 'Demo User (Sarah)', role: 'owner', description: 'The Sarah RevOps clone owner' },
  { email: 'candidate@clone.os', password: 'demo', name: 'Demo Candidate', role: 'candidate', description: 'Recruitment trial flow' },
  { email: 'dev@clone.os', password: 'demo', name: 'Demo Developer', role: 'developer', description: 'Extension/tool developer view' },
] as const

interface WaitlistEntry {
  id: string
  name: string
  email: string
  desiredRole: string
  note: string | null
  status: string
  requestedAt: string
}

interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  accountStatus: string
  tenantId: string
}

// ---- Public hooks ----
export function useCurrentUser() {
  const { data: session, status } = useSession()
  const [me, setMe] = React.useState<CurrentUser | null>(null)
  const [waitlist, setWaitlist] = React.useState<WaitlistEntry[]>([])
  const [loadingMe, setLoadingMe] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const data = await res.json()
      setMe(data.user ?? null)
      setWaitlist(data.waitlist ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingMe(false)
    }
  }, [])

  React.useEffect(() => {
    // Only fetch /me when the NextAuth session says we're authenticated
    if (status === 'authenticated') {
      refresh()
    } else if (status === 'unauthenticated') {
      setMe(null)
      setWaitlist([])
      setLoadingMe(false)
    }
  }, [status, refresh])

  return { session, status, me, waitlist, refresh, loadingMe }
}

// ---- The auth modal (login + signup-to-waitlist + demo quick-login) ----
export function AuthModal({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAuthenticated?: () => void
}) {
  const [tab, setTab] = React.useState<'login' | 'waitlist'>('login')
  // Login form
  const [loginEmail, setLoginEmail] = React.useState('')
  const [loginPassword, setLoginPassword] = React.useState('')
  const [loginLoading, setLoginLoading] = React.useState(false)
  // Waitlist form
  const [wlName, setWlName] = React.useState('')
  const [wlEmail, setWlEmail] = React.useState('')
  const [wlRole, setWlRole] = React.useState('user')
  const [wlNote, setWlNote] = React.useState('')
  const [wlLoading, setWlLoading] = React.useState(false)

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      toast.error('Email and password are required.')
      return
    }
    setLoginLoading(true)
    const t = toast.loading('Signing in…')
    const res = await signIn('credentials', {
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
      redirect: false,
    })
    setLoginLoading(false)
    if (res?.error) {
      toast.error('Sign-in failed', { id: t, description: 'Check your email and password.' })
      return
    }
    toast.success('Signed in', { id: t })
    setLoginEmail('')
    setLoginPassword('')
    onOpenChange(false)
    onAuthenticated?.()
  }

  async function handleQuickLogin(email: string, password: string) {
    setLoginLoading(true)
    const t = toast.loading(`Signing in as ${email}…`)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoginLoading(false)
    if (res?.error) {
      toast.error('Quick login failed', { id: t })
      return
    }
    toast.success(`Signed in as ${email}`, { id: t })
    onOpenChange(false)
    onAuthenticated?.()
  }

  async function handleWaitlist(e?: React.FormEvent) {
    e?.preventDefault()
    if (!wlName.trim() || !wlEmail.trim()) {
      toast.error('Name and email are required.')
      return
    }
    setWlLoading(true)
    const t = toast.loading('Adding you to the waitlist…')
    try {
      const res = await fetch('/api/auth/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: wlName.trim(),
          email: wlEmail.trim().toLowerCase(),
          desiredRole: wlRole,
          note: wlNote.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Could not join waitlist', { id: t, description: data?.error ?? 'Try again.' })
        return
      }
      toast.success("You're on the waitlist!", {
        id: t,
        description: 'An admin will review your request and create your account.',
      })
      setWlName('')
      setWlEmail('')
      setWlNote('')
      setTab('login')
    } catch (err: any) {
      toast.error('Could not join waitlist', { id: t, description: err?.message })
    } finally {
      setWlLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Clone OS Access
          </DialogTitle>
          <DialogDescription>
            Sign in to your account, join the waitlist, or try a demo account.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'waitlist')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login"><LogIn className="h-3.5 w-3.5 mr-1.5" />Sign in</TabsTrigger>
            <TabsTrigger value="waitlist"><UserPlus className="h-3.5 w-3.5 mr-1.5" />Waitlist</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-3 mt-3">
            <form onSubmit={handleLogin} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="login-email" className="text-xs">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="login-password" className="text-xs">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loginLoading}>
                <LogIn className="h-4 w-4 mr-2" />
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="relative my-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Quick demo logins
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => handleQuickLogin(a.email, a.password)}
                  disabled={loginLoading}
                  className="text-left rounded border p-2 hover:border-emerald-500 transition disabled:opacity-50"
                >
                  <div className="text-xs font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" />{a.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{a.description}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">{a.email}</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground text-center pt-1">
              All demo accounts use password <code className="font-mono">demo</code>
            </div>
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-3 mt-3">
            <form onSubmit={handleWaitlist} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="wl-name" className="text-xs">Full name</Label>
                <Input id="wl-name" value={wlName} onChange={(e) => setWlName(e.target.value)} placeholder="Jane Doe" autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wl-email" className="text-xs">Email</Label>
                <Input id="wl-email" type="email" value={wlEmail} onChange={(e) => setWlEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wl-role" className="text-xs">What brings you here?</Label>
                <select
                  id="wl-role"
                  value={wlRole}
                  onChange={(e) => setWlRole(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="user">I want to build a professional clone</option>
                  <option value="candidate">I want to expose my clone for recruitment</option>
                  <option value="developer">I want to build extensions/tools</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wl-note" className="text-xs">Anything else? (optional)</Label>
                <Textarea id="wl-note" value={wlNote} onChange={(e) => setWlNote(e.target.value)} placeholder="What kind of work would your clone do?" className="min-h-16 text-sm" />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={wlLoading}>
                <UserPlus className="h-4 w-4 mr-2" />
                {wlLoading ? 'Joining…' : 'Join the waitlist'}
              </Button>
            </form>
            <div className="text-[10px] text-muted-foreground text-center">
              An admin will review your request and create your account with a temporary password.
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---- Admin waitlist panel (renders inside the dashboard when admin is signed in) ----
export function AdminWaitlistPanel({ entries, onApproved }: { entries: WaitlistEntry[]; onApproved?: () => void }) {
  const [approving, setApproving] = React.useState<string | null>(null)
  const [lastResult, setLastResult] = React.useState<{ email: string; tempPassword: string } | null>(null)

  async function approve(entry: WaitlistEntry) {
    setApproving(entry.id)
    const t = toast.loading(`Approving ${entry.email}…`)
    try {
      const res = await fetch('/api/auth/admin/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Approval failed', { id: t, description: data?.error })
        return
      }
      toast.success(`Approved ${entry.email}`, { id: t, description: 'User created with temp password.' })
      setLastResult({ email: data.email, tempPassword: data.tempPassword })
      onApproved?.()
    } catch (err: any) {
      toast.error('Approval failed', { id: t, description: err?.message })
    } finally {
      setApproving(null)
    }
  }

  return (
    <div className="space-y-3">
      {lastResult && (
        <Card className="border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Account created
            </div>
            <div className="text-xs">Share these credentials with the new user (they can change the password after signing in):</div>
            <div className="grid grid-cols-[auto_1fr_auto] gap-1 text-xs font-mono">
              <span className="text-muted-foreground">Email:</span>
              <span>{lastResult.email}</span>
              <button
                onClick={() => navigator.clipboard.writeText(lastResult.email).then(() => toast.success('Email copied'))}
                className="text-muted-foreground hover:text-foreground"
              ><Copy className="h-3 w-3" /></button>
              <span className="text-muted-foreground">Temp pw:</span>
              <span className="font-semibold">{lastResult.tempPassword}</span>
              <button
                onClick={() => navigator.clipboard.writeText(lastResult.tempPassword).then(() => toast.success('Password copied'))}
                className="text-muted-foreground hover:text-foreground"
              ><Copy className="h-3 w-3" /></button>
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No pending waitlist requests.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{e.name}</span>
                  <Badge variant="outline" className="text-[10px]">{e.desiredRole}</Badge>
                  <span className="text-xs text-muted-foreground">{e.email}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />{new Date(e.requestedAt).toLocaleDateString()}
                  </span>
                </div>
                {e.note && <div className="text-xs text-muted-foreground italic">"{e.note}"</div>}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => approve(e)}
                    disabled={approving === e.id}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {approving === e.id ? 'Approving…' : 'Approve & create account'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Sign-out button (used in the header) ----
export function SignOutButton({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await signOut({ redirect: false })
        setLoading(false)
        toast.success('Signed out')
        onDone?.()
      }}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
