'use client'

import * as React from 'react'
import {
  Activity,
  ArrowUpRight,
  Award,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  GitBranch,
  Globe,
  Layers,
  Mail,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CloneOSData } from '../types'
import {
  Callout,
  CertBadge,
  Field,
  ScoreBandBadge,
  SectionHeading,
  StatCard,
  colorClasses,
} from '../shared'

const NORTH_STAR =
  '"This is my professional self. It knows how I work, thinks through problems the way I do, communicates like me, understands my professional culture, and can perform my work wherever I authorize it to operate."'

function trainingLoopStageOf(mode: string, stage: string): number {
  // Map training sessions back onto the 12-stage loop
  const idx = {
    OBSERVE: 0,
    CAPTURE: 1,
    TEACH: 2,
    DEMONSTRATE: 3,
    TRAIN: 4,
    EVALUATE: 5,
    SIMULATE: 6,
    CERTIFY: 7,
    DEPLOY: 8,
    WORK: 9,
    MEASURE: 10,
    LEARN: 11,
  }[stage.toUpperCase()]
  return idx ?? 4
}

export function OverviewSection({ data }: { data: CloneOSData }) {
  const { clone, versions, score, events, catalogs, trainingSessions, certifications } =
    data
  const pi = clone.professionalIdentity
  const cv = clone.currentVersion

  const loopProgress = React.useMemo(() => {
    // Where is the most recent training session?
    const last = trainingSessions[0]
    return last ? trainingLoopStageOf(last.mode, last.stage) : 7 // CERTIFY default
  }, [trainingSessions])

  const recentEvents = events.slice(0, 5)
  const values = pi?.values ?? []
  const cultureEntries = pi?.culture ? Object.entries(pi.culture) : []

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Overview"
        description="The complete loop end-to-end on one deep vertical — Sales / Revenue Operations, anchored on the Sarah example."
        icon={Sparkles}
      />

      {/* Hero card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {clone.slug}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {clone.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Globe className="size-3" />
                    {clone.visibility}
                  </Badge>
                </div>
                <CardTitle className="text-2xl sm:text-3xl">
                  {clone.name}
                </CardTitle>
                <CardDescription className="max-w-3xl text-base">
                  {clone.summary}
                </CardDescription>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/60 p-4 text-center">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Aggregate Score
                </div>
                <div className="text-4xl font-bold tabular-nums">
                  {clone.aggregateScore.toFixed(1)}
                </div>
                <ScoreBandBadge score={clone.aggregateScore} />
                <div className="text-muted-foreground mt-1 text-[10px]">
                  UI hint · {score?.dimensions.length ?? 9} dimensions preserved
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Domain">
                <span className="flex items-center gap-2">
                  <Target className="text-primary size-3.5" />
                  {clone.domain}
                </span>
              </Field>
              <Field label="Professional Title">
                {pi?.title ?? '—'}
              </Field>
              <Field label="Owner">
                <span className="flex items-center gap-2">
                  <User className="size-3.5" />
                  {pi?.user?.name ?? 'Unknown'}
                </span>
              </Field>
              <Field label="Public Key">
                <code className="text-xs">
                  {pi?.user?.publicKey
                    ? `${pi.user.publicKey.slice(0, 12)}…`
                    : '—'}
                </code>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CertBadge level={clone.certificationLevel} />
              <Badge variant="outline" className="font-mono text-xs">
                <GitBranch className="size-3" />
                v{cv?.version ?? '0.0.0'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Released {cv ? new Date(cv.releasedAt).toLocaleDateString() : '—'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Author: {cv?.author ?? 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Versions"
          value={versions.length}
          hint="Explicit versioning · ADR-0010"
          icon={GitBranch}
          color="teal"
        />
        <StatCard
          label="Training Sessions"
          value={data.trainingSessions.length}
          hint="9 modes available"
          icon={Activity}
          color="emerald"
        />
        <StatCard
          label="Agents"
          value={data.agents.length}
          hint="Runtime deployments of this clone"
          icon={Building2}
          color="amber"
        />
        <StatCard
          label="Certifications"
          value={certifications.length}
          hint="Evidence-based · ADR-0043"
          icon={Award}
          color="violet"
        />
      </div>

      {/* Professional identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Professional Identity
          </CardTitle>
          <CardDescription>
            The persistent professional self the clone represents (ADR-0001: clone is
            primary asset).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Field label="Bio">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {pi?.bio ?? '—'}
              </p>
            </Field>
            <Field label="Values (do not violate)">
              <div className="flex flex-wrap gap-1.5">
                {values.length ? (
                  values.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {v}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">No values recorded.</span>
                )}
              </div>
            </Field>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Cultural Context">
              {cultureEntries.length ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {cultureEntries.map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        {k}:
                      </span>
                      <span className="text-sm">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground text-xs">
                  No culture recorded.
                </span>
              )}
            </Field>
            <Field label="Email">
              <a
                href={`mailto:${pi?.user?.email ?? ''}`}
                className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                <Mail className="size-3.5" />
                {pi?.user?.email ?? '—'}
              </a>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 12-stage training loop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4" />
            Clone Training Loop
          </CardTitle>
          <CardDescription>
            12 architectural stages (ADR-0007). Each is represented as a session
            kind, evaluation, deployment, or outcome record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {catalogs.trainingLoop.map((stage, i) => {
              const isPast = i <= loopProgress
              const isCurrent = i === loopProgress
              const c = colorClasses(
                isCurrent ? 'emerald' : isPast ? 'teal' : 'muted',
              )
              return (
                <li
                  key={stage.stage}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                    isCurrent
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-border/60',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                      isCurrent ? c.bg : 'bg-muted',
                    )}
                  >
                    {isCurrent ? (
                      <Circle className={cn('size-3', c.text)} />
                    ) : isPast ? (
                      <CheckCircle2 className="text-teal-600 dark:text-teal-400 size-3.5" />
                    ) : (
                      <span className="text-muted-foreground text-[10px] font-semibold">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold tracking-wider">
                        {stage.stage}
                      </span>
                      {isCurrent && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]" variant="outline">
                          current
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {stage.description}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Version timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Version Timeline
          </CardTitle>
          <CardDescription>
            Explicit versions — production is never silently mutated (ADR-0010).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {versions.slice(0, 3).map((v, idx) => {
            const isActive = v.version === cv?.version
            return (
              <div
                key={v.id}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between',
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border/60',
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">v{v.version}</span>
                    {isActive && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs"
                      >
                        active
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(v.releasedAt).toLocaleDateString()} · author{' '}
                    {v.author}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:pl-6">
                  <Field label="Change Set">
                    <ul className="flex flex-col gap-1 text-xs">
                      {v.changeSet.slice(0, 4).map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ArrowUpRight className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </Field>
                  {v.performanceImpact && (
                    <Field label="Performance Impact">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {v.performanceImpact}
                      </span>
                    </Field>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Recent events + North star */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Recent Domain Events
            </CardTitle>
            <CardDescription>
              Event-driven learning (ADR-0048). 22 domain event types in the catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-72 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border flex flex-col gap-2">
              {recentEvents.length ? (
                recentEvents.map((e) => {
                  const c = colorClasses('teal')
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <span
                        className={cn(
                          'mt-1 size-2 shrink-0 rounded-full',
                          c.dot,
                        )}
                      />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-xs font-mono font-medium">
                          {e.type}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                        {e.payload && Object.keys(e.payload).length > 0 && (
                          <pre className="bg-muted mt-1 overflow-x-auto rounded px-2 py-1 text-[10px] leading-tight">
                            {JSON.stringify(e.payload)}
                          </pre>
                        )}
                      </div>
                    </li>
                  )
                })
              ) : (
                <span className="text-muted-foreground text-sm">No events.</span>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" />
              North Star
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed italic">{NORTH_STAR}</p>
            <p className="text-muted-foreground mt-3 text-xs">
              The longer someone uses the platform, the more valuable their clone
              becomes — more capable, more accurate, more autonomous, more faithful,
              more portable, more interoperable.
            </p>
          </CardContent>
        </Card>
      </div>

      <Callout tone="info" title="One deep vertical">
        This MVP delivers the <strong>complete loop</strong> end-to-end on{' '}
        <strong>Sales / Revenue Operations</strong> — not ten shallow verticals.
        Every section of the dashboard demonstrates a frozen architectural principle.
      </Callout>
    </div>
  )
}
