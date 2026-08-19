'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

// ---- Risk → color mapping (NO indigo/blue) ----
export const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  critical: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export const CERT_COLORS: Record<string, string> = {
  unverified: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  self_trained: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  platform_evaluated: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  certified: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  professionally_verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  enterprise_grade: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
}

export const STATUS_COLORS: Record<string, string> = {
  deployed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  training: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  evaluating: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  drafted: 'bg-muted text-muted-foreground',
  paused: 'bg-muted text-muted-foreground',
  stopped: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  breached: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export const SENSITIVITY_COLORS: Record<string, string> = {
  public: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  internal: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  confidential: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  restricted: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export function RiskBadge({ risk }: { risk: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', RISK_COLORS[risk] ?? '')}>
      {risk}
    </Badge>
  )
}

export function CertBadge({ level }: { level: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', CERT_COLORS[level] ?? '')}>
      {level.replace(/_/g, ' ')}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', STATUS_COLORS[status] ?? '')}>
      {status}
    </Badge>
  )
}

export function SensitivityBadge({ sensitivity }: { sensitivity: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', SENSITIVITY_COLORS[sensitivity] ?? '')}>
      {sensitivity}
    </Badge>
  )
}

export function CapabilityBadge({ id, label, risk, requiresApproval }: { id: string; label: string; risk: string; requiresApproval?: boolean }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] gap-1', RISK_COLORS[risk] ?? '')} title={`${id}${requiresApproval ? ' — requires approval' : ''}`}>
      {label}
      {requiresApproval && <span className="text-rose-600">⚠</span>}
    </Badge>
  )
}

export function SectionShell({
  id,
  title,
  description,
  children,
  right,
}: {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground max-w-3xl">{description}</p>}
        </div>
        {right}
      </div>
      <Separator />
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function Callout({
  children,
  tone = 'muted',
  title,
}: {
  children: React.ReactNode
  tone?: 'muted' | 'emerald' | 'amber' | 'rose'
  title?: string
}) {
  const tones: Record<string, string> = {
    muted: 'bg-muted/60 border-border',
    emerald: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
    amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
    rose: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900',
  }
  return (
    <div className={cn('rounded-lg border p-4 text-sm', tones[tone])}>
      {title && <div className="font-medium mb-1">{title}</div>}
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <div className="text-muted-foreground w-28 shrink-0">{k}</div>
      <div className="flex-1 break-words">{v}</div>
    </div>
  )
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-2 flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <Badge variant="secondary" className="text-[10px]">{children}</Badge>
}

// Custom scrollbar styling for long lists
export function ScrollList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-h-96 overflow-y-auto pr-1',
        '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PanelCard({
  title,
  description,
  children,
  className,
  right,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  right?: React.ReactNode
}) {
  return (
    <Card className={className}>
      {(title || right) && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              {title && <CardTitle className="text-base">{title}</CardTitle>}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {right}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(title ? 'pt-0' : 'p-4')}>{children}</CardContent>
    </Card>
  )
}

export function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
