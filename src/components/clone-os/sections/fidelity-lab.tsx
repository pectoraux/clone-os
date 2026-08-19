'use client'

import * as React from 'react'
import { Activity, ArrowRight, Fingerprint, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CloneOSData, Divergence } from '../types'
import {
  Callout,
  SectionHeading,
  colorClasses,
} from '../shared'

export function FidelityLabSection({ data }: { data: CloneOSData }) {
  const { divergences, catalogs } = data

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Fidelity Lab"
        description="Clone Fidelity Testing — Human vs Clone on equivalent scenarios. Produces a Divergence Report (ADR-0012)."
        icon={Activity}
      />

      <Callout tone="info" title="The platform can compare Human vs Clone on equivalent scenarios">
        The Fidelity Engine surfaces both{' '}
        <strong>quantitative agreement</strong> (the clone agrees with the user's
        decisions 94% of the time) and <strong>qualitative patterns</strong>{' '}
        (consistently underestimates operational risk).
      </Callout>

      {/* 8 fidelity dimensions reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">8 Fidelity Dimensions</CardTitle>
          <CardDescription>
            Per-dimension deltas are recorded on each divergence report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {catalogs.fidelityDimensions.map((d, i) => (
              <Badge
                key={d.key}
                variant="outline"
                className="font-mono text-xs"
              >
                <span className="text-muted-foreground mr-1">{i + 1}.</span>
                {d.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Divergence reports */}
      <div className="flex flex-col gap-6">
        {divergences.map((d) => (
          <DivergenceCard key={d.id} divergence={d} />
        ))}
        {divergences.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No divergence reports yet. Run an evaluation to generate one.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function DivergenceCard({ divergence: d }: { divergence: Divergence }) {
  const agreementPct = Math.round(d.agreementRate * 100)
  const agreementColor =
    agreementPct >= 90
      ? 'emerald'
      : agreementPct >= 75
        ? 'teal'
        : agreementPct >= 60
          ? 'amber'
          : 'rose'
  const ac = colorClasses(agreementColor)

  const dimEntries = Object.entries(d.divergence) as [string, number][]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base leading-snug">
              {d.scenario}
            </CardTitle>
            <CardDescription>
              {new Date(d.createdAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={cn('text-3xl font-bold tabular-nums', ac.text)}>
              {agreementPct}%
            </div>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
              agreement
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Headline */}
        <div className={cn('rounded-lg border px-3 py-2 text-sm font-medium', ac.bg, ac.border, ac.text)}>
          “{d.headline}”
        </div>

        {/* Human vs Clone */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border border-border/60 rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <Fingerprint className="size-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Human Response
              </span>
            </div>
            <ComparisonContent data={d.humanResponse} />
          </div>
          <div className="border border-border/60 rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <Users className="size-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Clone Response
              </span>
            </div>
            <ComparisonContent data={d.cloneResponse} />
          </div>
        </div>

        {/* Per-dimension divergence bars */}
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Per-Dimension Divergence (positive = clone overshoots, negative = undershoots)
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {dimEntries.map(([k, v]) => {
              const pct = Math.max(-100, Math.min(100, v * 100))
              const isNeg = pct < 0
              const color = isNeg ? 'rose' : 'amber'
              const c = colorClasses(color)
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{k}</span>
                    <span className="tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/20" />
                    {isNeg ? (
                      <div
                        className={cn('absolute top-0 h-full rounded-l-full', c.bar)}
                        style={{
                          right: '50%',
                          width: `${Math.abs(pct) / 2}%`,
                        }}
                      />
                    ) : (
                      <div
                        className={cn('absolute top-0 h-full rounded-r-full', c.bar)}
                        style={{
                          left: '50%',
                          width: `${pct / 2}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ComparisonContent({ data }: { data: Record<string, unknown> }) {
  const fields = ['decision', 'reasoning', 'actions', 'communication', 'priorities', 'riskTolerance', 'expectedOutcome']
  return (
    <div className="flex flex-col gap-2 text-xs">
      {fields.map((f) => {
        const val = (data as any)[f]
        if (val == null) return null
        const label = f.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
        return (
          <div key={f} className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {label}
            </span>
            {Array.isArray(val) ? (
              <ul className="flex flex-col gap-0.5">
                {val.map((v, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <ArrowRight className="text-muted-foreground mt-0.5 size-2.5 shrink-0" />
                    <span>{String(v)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span>{String(val)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
