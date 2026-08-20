'use client'

// Clone OS — Shared UI atoms used across all sections.
// All colors are restricted to the allowed accent palette
// (emerald, teal, amber, orange, rose, violet) plus Tailwind theme tokens.
// NO indigo/blue accents are used anywhere in this dashboard.

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { Catalogs } from './types'

// ---- Color helpers ----
// Maps a "color" name (returned by the seed/lib layer) to concrete Tailwind
// classes. We restrict to the allowed accent palette only.
const COLOR_CLASSES: Record<
  string,
  { bg: string; text: string; border: string; dot: string; bar: string }
> = {
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  teal: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/30',
    dot: 'bg-teal-500',
    bar: 'bg-teal-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/30',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500/30',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
  },
  muted: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    dot: 'bg-muted-foreground',
    bar: 'bg-muted-foreground',
  },
}

export function colorClasses(color: string) {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.muted
}

// ---- Section heading ----
export function SectionHeading({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="bg-primary/5 text-primary rounded-lg p-2">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}

// ---- Callout — used for "the clone is the source of truth" notes etc. ----
export function Callout({
  title,
  children,
  tone = 'info',
  icon,
}: {
  title?: string
  children: React.ReactNode
  tone?: 'info' | 'warning' | 'success' | 'neutral'
  icon?: React.ComponentType<{ className?: string }>
}) {
  const toneClasses = {
    info: 'border-teal-500/30 bg-teal-500/5 text-teal-900 dark:text-teal-100',
    warning:
      'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100',
    success:
      'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    neutral: 'border-border bg-muted/40 text-foreground',
  }[tone]

  const DefaultIcon =
    tone === 'warning'
      ? AlertTriangle
      : tone === 'success'
        ? CheckCircle2
        : tone === 'info'
          ? Info
          : Sparkles

  const Icon = icon ?? DefaultIcon

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        toneClasses,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          {title && <div className="font-medium">{title}</div>}
          <div className="text-muted-foreground text-sm leading-relaxed [&_strong]:text-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Score badge (Faithful / Strong / Developing / Early / Untrained) ----
export function ScoreBandBadge({ score }: { score: number }) {
  const band =
    score >= 90
      ? { label: 'Faithful', color: 'emerald' }
      : score >= 75
        ? { label: 'Strong', color: 'teal' }
        : score >= 60
          ? { label: 'Developing', color: 'amber' }
          : score >= 40
            ? { label: 'Early', color: 'orange' }
            : { label: 'Untrained', color: 'rose' }
  const c = colorClasses(band.color)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      <span className={cn('size-1.5 rounded-full', c.dot)} />
      {band.label}
    </span>
  )
}

// ---- Certification badge ----
export function CertBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; color: string }> = {
    unverified: { label: 'Unverified', color: 'rose' },
    self_trained: { label: 'Self-Trained', color: 'orange' },
    platform_evaluated: { label: 'Platform Evaluated', color: 'amber' },
    certified: { label: 'Certified', color: 'teal' },
    professionally_verified: {
      label: 'Professionally Verified',
      color: 'emerald',
    },
    enterprise_grade: { label: 'Enterprise Grade', color: 'violet' },
  }
  const entry = map[level] ?? { label: level, color: 'muted' }
  const c = colorClasses(entry.color)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      <ShieldCheck className="size-3" />
      {entry.label}
    </span>
  )
}

// ---- Capability badge with risk color (low/medium/high/critical) ----
export function CapabilityBadge({
  id,
  label,
  risk,
  requiresApproval,
}: {
  id: string
  label?: string
  risk?: string
  requiresApproval?: boolean
}) {
  const riskColor =
    risk === 'critical'
      ? 'rose'
      : risk === 'high'
        ? 'orange'
        : risk === 'medium'
          ? 'amber'
          : risk === 'low'
            ? 'teal'
            : 'muted'
  const c = colorClasses(riskColor)
  return (
    <span
      title={
        requiresApproval
          ? `${label ?? id} — ${risk} risk, requires approval`
          : `${label ?? id} — ${risk} risk`
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {label ?? id}
      {requiresApproval && <AlertTriangle className="size-3" />}
    </span>
  )
}

// ---- Risk pill ----
export function RiskPill({ risk }: { risk: string }) {
  const color =
    risk === 'critical'
      ? 'rose'
      : risk === 'high'
        ? 'orange'
        : risk === 'medium'
          ? 'amber'
          : 'teal'
  const c = colorClasses(color)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
      )}
    >
      {risk}
    </span>
  )
}

// ---- Sensitivity badge (public/internal/confidential/restricted) ----
export function SensitivityBadge({ sensitivity }: { sensitivity: string }) {
  const color =
    sensitivity === 'restricted'
      ? 'rose'
      : sensitivity === 'confidential'
        ? 'orange'
        : sensitivity === 'internal'
          ? 'amber'
          : 'teal'
  const c = colorClasses(color)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {sensitivity}
    </span>
  )
}

// ---- Portability badge (portable/tenant_locked/client_locked) ----
export function PortabilityBadge({ portability }: { portability: string }) {
  const map: Record<string, { label: string; color: string }> = {
    portable: { label: 'Portable', color: 'emerald' },
    tenant_locked: { label: 'Tenant-Locked', color: 'amber' },
    client_locked: { label: 'Client-Locked', color: 'rose' },
  }
  const entry = map[portability] ?? { label: portability, color: 'muted' }
  const c = colorClasses(entry.color)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {entry.label}
    </span>
  )
}

// ---- Provenance badge (sourceKind label) ----
export function ProvenanceBadge({ sourceKind, label }: { sourceKind: string; label: string }) {
  const color =
    sourceKind === 'user_general'
      ? 'teal'
      : sourceKind === 'public'
        ? 'emerald'
        : sourceKind === 'licensed'
          ? 'violet'
          : sourceKind === 'company_proprietary'
            ? 'amber'
            : sourceKind === 'client_data'
              ? 'rose'
              : sourceKind === 'third_party'
                ? 'orange'
                : 'muted'
  const c = colorClasses(color)
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {label}
    </span>
  )
}

// ---- Autonomy level badge (0..5) ----
export function AutonomyBadge({ level }: { level: number }) {
  const map: Record<number, { label: string; color: string }> = {
    0: { label: 'L0 · Observe', color: 'muted' },
    1: { label: 'L1 · Suggest', color: 'teal' },
    2: { label: 'L2 · Approval', color: 'amber' },
    3: { label: 'L3 · Policy', color: 'violet' },
    4: { label: 'L4 · Autonomous', color: 'emerald' },
    5: { label: 'L5 · Fully Autonomous', color: 'rose' },
  }
  const entry = map[level] ?? { label: `L${level}`, color: 'muted' }
  const c = colorClasses(entry.color)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {entry.label}
    </span>
  )
}

// ---- Dimension progress bar (for clone score per-dimension) ----
export function DimensionBar({
  label,
  value,
  description,
  color = 'emerald',
}: {
  label: string
  value: number
  description?: string
  color?: string
}) {
  const c = colorClasses(color)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value.toFixed(1)}
        </span>
      </div>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full transition-all', c.bar)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

// ---- Simple stat card ----
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color = 'teal',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}) {
  const c = colorClasses(color)
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-2', c.bg)}>
            <Icon className={cn('size-4', c.text)} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ---- Empty state ----
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
      {message}
    </div>
  )
}

// ---- Long list with custom scrollbar ----
export function ScrollList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-h-96 overflow-y-auto pr-1',
        '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ---- Pill / Tag (generic) ----
export function Tag({
  children,
  color = 'muted',
}: {
  children: React.ReactNode
  color?: string
}) {
  const c = colorClasses(color)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {children}
    </span>
  )
}

// ---- Field/value display ----
export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// ---- Map a capability id -> catalog entry ----
export function useCapabilityLookup(catalogs: Catalogs | undefined) {
  return React.useCallback(
    (id: string) =>
      catalogs?.capabilities.find((c) => c.id === id) ?? {
        id,
        label: id,
        risk: 'unknown',
        category: 'Unknown',
        requiresApproval: false,
      },
    [catalogs],
  )
}

// ---- Currency formatter (cents -> $x,xxx) ----
export function formatPrice(cents: number, mode?: string): string {
  if (mode === 'subscription') {
    return `$${(cents / 100).toFixed(0)}/mo`
  }
  if (mode === 'hourly') {
    return `$${(cents / 100).toFixed(0)}/hr`
  }
  if (mode === 'revenue_share') {
    return `${cents}% rev`
  }
  if (mode === 'enterprise_license') {
    return `$${(cents / 100).toLocaleString()} lic`
  }
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toLocaleString()}`
}

// ---- Re-export for convenience ----
export { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress }
