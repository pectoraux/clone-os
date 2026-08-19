'use client'

// Clone OS — Section components for the dashboard.
// Each section demonstrates a frozen architectural principle.

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar as RBar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import {
  Activity, AlertTriangle, BadgeCheck, Boxes, BrainCircuit, Calendar, CheckCircle2, Clock,
  Cpu, Database, FileText, GitBranch, Globe, Layers, Network, Package, Plug, Send,
  ShieldCheck, Sparkles, Target, TrendingUp, Users, Workflow as WorkflowIcon, Zap, RefreshCw, MessageSquare,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bar, Callout, CapabilityBadge, CertBadge, KV, PanelCard, ScrollList, SectionShell,
  SensitivityBadge, StatCard, StatusBadge, Tag, money, timeAgo,
} from '../shared/ui'
import { useCloneOs, useTrainSession, useMarketplaceMatch, useExtensionInstall } from '../data'
import type { CloneOsState } from '../data'
import { AdminWaitlistPanel, useCurrentUser } from '../auth/auth-ui'

// =========================================================================
// 1. OVERVIEW
// =========================================================================
export function OverviewSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={3} />
  if (error || !data) return <ErrorState message="Failed to load clone state" />
  const { clone, versions, events, catalogs } = data
  const pi = clone.professionalIdentity
  const cv = clone.currentVersion
  return (
    <SectionShell
      title="Overview"
      description="The Clone is the primary asset. A progressively more faithful digital representation of a human professional."
      right={<StatusBadge status={clone.status} />}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-emerald-600" />
              {clone.name}
            </CardTitle>
            <CardDescription>{clone.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <KV k="Owner" v={pi?.user?.name ?? '—'} />
              <KV k="Email" v={<span className="font-mono text-xs">{pi?.user?.email ?? '—'}</span>} />
              <KV k="Title" v={pi?.title ?? '—'} />
              <KV k="Domain" v={clone.domain} />
              <KV k="Public key" v={<span className="font-mono text-xs break-all">{pi?.user?.publicKey ?? '—'}</span>} />
              <KV k="Visibility" v={<Badge variant="outline" className="capitalize">{clone.visibility}</Badge>} />
              <KV k="Certification" v={<CertBadge level={clone.certificationLevel} />} />
              <KV k="Active version" v={<Badge variant="outline">v{cv?.version ?? '—'}</Badge>} />
            </div>
            <Separator />
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Professional bio</div>
              <p>{pi?.bio}</p>
            </div>
            {pi?.values?.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Professional values</div>
                <div className="flex flex-wrap gap-1.5">
                  {pi.values.map((v: string, i: number) => <Tag key={i}>{v}</Tag>)}
                </div>
              </div>
            )}
            {pi?.culture && Object.keys(pi.culture).length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Cultural context</div>
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {Object.entries(pi.culture).map(([k, v]: [string, any]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground capitalize">{k}:</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-600" />Clone Score</CardTitle>
            <CardDescription>Aggregate is a UI hint — dimensions are preserved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <div className="text-5xl font-bold tabular-nums">{clone.aggregateScore?.toFixed(1)}<span className="text-2xl text-muted-foreground">%</span></div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Professionally Verified</Badge>
            <Separator />
            <div className="text-xs text-muted-foreground">v{cv?.version} · {cv && timeAgo(cv.releasedAt)}</div>
            <div className="text-xs text-muted-foreground">Author: {cv?.author}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Versions" value={versions.length} sub={`Active: v${cv?.version}`} />
        <StatCard label="Training sessions" value={data.trainingSessions.length} sub="9 modes exercised" />
        <StatCard label="Agents" value={data.agents.length} sub="derived from this clone" />
        <StatCard label="Marketplace listings" value={data.marketplace.length} sub="intent-based hiring" />
      </div>

      <PanelCard title="12-Stage Clone Training Loop" description="OBSERVE → CAPTURE → TEACH → DEMONSTRATE → TRAIN → EVALUATE → SIMULATE → CERTIFY → DEPLOY → WORK → MEASURE → LEARN — then back to CLONE.">
        <div className="flex flex-wrap gap-2">
          {catalogs.trainingLoop.map((s: any, i: number) => (
            <React.Fragment key={s.stage}>
              <Badge variant="outline" className="px-2 py-1 font-mono text-[10px]">{i}. {s.stage}</Badge>
              {i < catalogs.trainingLoop.length - 1 && <span className="text-muted-foreground self-center">→</span>}
            </React.Fragment>
          ))}
        </div>
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard title="Version timeline" description="Everything important is versioned. Never silently mutate production intelligence.">
          <div className="space-y-3">
            {versions.map((v: any) => (
              <div key={v.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${v.version === cv?.version ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  {v !== versions[versions.length - 1] && <div className="w-px h-full bg-border flex-1" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{v.version}</span>
                    {v.version === cv?.version && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">active</Badge>}
                    <span className="text-xs text-muted-foreground">{timeAgo(v.releasedAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{v.author}</div>
                  {v.performanceImpact != null && (
                    <div className="text-xs text-emerald-700 mt-1">+{v.performanceImpact.toFixed(1)} pts vs prev</div>
                  )}
                  <ul className="text-xs mt-1 space-y-0.5">
                    {v.changeSet?.slice(0, 2).map((c: string, i: number) => <li key={i} className="text-muted-foreground">• {c}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Recent domain events" description="Event-driven learning & analytics pipelines.">
          <ScrollList>
            <div className="space-y-2">
              {events.slice(0, 10).map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 text-xs">
                  <Zap className="h-3 w-3 mt-0.5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-mono">{e.type}</div>
                    <div className="text-muted-foreground">{timeAgo(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollList>
        </PanelCard>
      </div>

      <Callout tone="emerald" title="North Star">
        “This is my professional self. It knows how I work, thinks through problems the way I do, communicates like me, understands my professional culture, and can perform my work wherever I authorize it to operate.”
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 2. CLONE SCORE (radar)
// =========================================================================
export function CloneScoreSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load clone score" />
  const { score } = data
  if (!score) return <ErrorState message="No score computed" />
  const radar = score.dimensions.map((d: any) => ({ dimension: d.label.replace(' Fidelity', ''), value: d.value }))
  return (
    <SectionShell
      title="Multidimensional Clone Score"
      description="The public UI may show an aggregate, but the system preserves the dimensions. NEVER reduce internally to one opaque score."
      right={<Badge variant="outline" className="text-base px-3 py-1 bg-emerald-100 text-emerald-800">{score.aggregate.toFixed(1)}%</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard title="Fidelity radar" description="9 dimensions, weighted toward Outcome & Decision fidelity (outcome > benchmark).">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name="Fidelity" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
        <PanelCard title="Per-dimension breakdown" description="Each dimension is measured separately against the human professional.">
          <div className="space-y-3">
            {score.dimensions.map((d: any) => (
              <div key={d.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.label}</span>
                  <span className="tabular-nums text-muted-foreground">{d.value.toFixed(1)}</span>
                </div>
                <Bar value={d.value} />
                <div className="text-[10px] text-muted-foreground">{d.description}</div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
      <Callout tone="amber" title="Why this matters">
        A single opaque score hides regressions. The clone can be 90% on knowledge fidelity but 62% on decision fidelity — and that distinction is what drives the next training cycle.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 3. EXPERTISE GRAPH
// =========================================================================
export function ExpertiseGraphSection() {
  const { data, isLoading, error } = useCloneOs()
  const [filter, setFilter] = React.useState<string>('all')
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load expertise graph" />
  const { expertise, catalogs } = data
  const grouped = (catalogs.nodeTypes as any[]).map((t) => ({
    type: t.key,
    label: t.label,
    items: expertise.filter((e: any) => e.nodeType === t.key && (filter === 'all' || e.sourceKind === filter)),
  }))
  return (
    <SectionShell
      title="Expertise Graph"
      description="Queryable, versioned graph of the professional's expertise. Nodes carry explicit provenance — the data boundary is representable even if legal policy is configured later."
      right={
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-background"
        >
          <option value="all">All sources</option>
          {catalogs.sourceKinds.map((s: any) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {grouped.map((g) => g.items.length > 0 && (
          <PanelCard key={g.type} title={g.label} description={`${g.items.length} node${g.items.length === 1 ? '' : 's'}`}>
            <div className="space-y-2">
              {g.items.map((n: any) => (
                <div key={n.id} className="rounded border p-2 text-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{n.name}</span>
                    {n.proficiency != null && <span className="text-xs tabular-nums">{n.proficiency}%</span>}
                  </div>
                  {n.description && <div className="text-xs text-muted-foreground">{n.description}</div>}
                  <div className="flex flex-wrap gap-1">
                    <SensitivityBadge sensitivity={n.sensitivity} />
                    <Badge variant="outline" className="text-[10px]">{n.portability}</Badge>
                    <Badge variant="outline" className="text-[10px]">{n.sourceLabel}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>
        ))}
      </div>
      <Callout tone="rose" title="Data ownership boundary (ADR-0003)">
        An employee's clone must NOT accidentally export a previous employer's confidential data. A company must NOT automatically own all of an employee's general professional expertise merely because the employee trained their clone while employed there. Filter by source kind to see this in action.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 4. TRAINING STUDIO
// =========================================================================
export function TrainingStudioSection() {
  const { data, isLoading, error } = useCloneOs()
  const train = useTrainSession()
  const [mode, setMode] = React.useState<string>('teaching')
  const [input, setInput] = React.useState('')
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load training data" />
  const { clone, catalogs, trainingSessions } = data

  async function run() {
    const t = toast.loading(`Running ${mode} training session…`)
    try {
      const res = await train.mutateAsync({
        cloneId: clone.id,
        mode,
        input: input ? { note: input } : { source: 'dashboard' },
      })
      toast.success(`Training complete · ${mode} → ${res.session.stage}`, {
        id: t,
        description: `Events emitted: ${res.events.join(', ')} · New aggregate: ${res.newAggregate.toFixed(1)}%`,
      })
      setInput('')
    } catch (e: any) {
      toast.error('Training failed', { id: t, description: e?.message })
    }
  }

  return (
    <SectionShell
      title="Training Studio"
      description="Training ≠ fine-tuning. Multiple model-independent mechanisms: teaching, demonstration, correction, shadowing, assisted, delegated, simulation, adversarial, real-world feedback."
      right={StatusBadge({ status: 'training' }) as any}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Training modes" description="Pick a mode and run a session. The system ingests inputs into the clone's persisted state — not the LLM's weights." className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {catalogs.trainingModes.map((m: any) => (
              <button
                key={m.mode}
                onClick={() => setMode(m.mode)}
                className={`text-left rounded border p-3 transition ${mode === m.mode ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'hover:border-foreground/30'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{m.label}</span>
                  {mode === m.mode && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Optional input for ${mode} session…`}
              className="min-h-20 text-sm"
            />
            <Button onClick={run} disabled={train.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {train.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Run {mode} session
            </Button>
          </div>
        </PanelCard>

        <PanelCard title="12-stage loop" description="Where the clone currently sits in the lifecycle.">
          <div className="space-y-1.5">
            {catalogs.trainingLoop.map((s: any, i: number) => {
              const active = i === 8 // DEPLOY (clone is deployed)
              return (
                <div key={s.stage} className={`flex items-center gap-2 text-xs ${active ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                  <span className="font-mono w-6">{i}.</span>
                  <span>{s.stage}</span>
                  {active && <Badge className="ml-auto bg-emerald-100 text-emerald-800 text-[10px]">here</Badge>}
                </div>
              )
            })}
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Training session history" description="Every stage is represented architecturally. Real-world outcomes feed the learning/evaluation system.">
        <ScrollList>
          <div className="grid gap-2">
            {trainingSessions.map((s: any) => (
              <div key={s.id} className="rounded border p-2.5 grid gap-1 text-xs sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <span className="font-mono capitalize">{s.mode}</span>
                  <span className="text-muted-foreground"> · stage: {s.stage}</span>
                </div>
                <div className="text-muted-foreground">{s.durationMs ? `${Math.round(s.durationMs / 1000)}s` : '—'}</div>
                <div className="text-muted-foreground sm:text-right">{s.completedAt ? timeAgo(s.completedAt) : '—'}</div>
              </div>
            ))}
          </div>
        </ScrollList>
      </PanelCard>
    </SectionShell>
  )
}

// =========================================================================
// 5. FIDELITY LAB
// =========================================================================
export function FidelityLabSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load fidelity data" />
  const { divergences, catalogs } = data
  const dims = catalogs.fidelityDimensions
  return (
    <SectionShell
      title="Clone Fidelity Lab"
      description="Compares Human vs Human's Clone against equivalent scenarios and produces a Divergence Report — per-dimension deltas, agreement rate, and headline findings."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {divergences.map((d: any) => {
          const div = d.divergence || {}
          const maxAbs = Math.max(0.01, ...dims.map((dim: any) => Math.abs(div[dim.key] ?? 0)))
          return (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{d.scenario}</CardTitle>
                <CardDescription className="text-xs">{d.headline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Agreement</span>
                  <span className={`text-2xl font-bold tabular-nums ${d.agreementRate >= 0.9 ? 'text-emerald-600' : d.agreementRate >= 0.75 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {Math.round(d.agreementRate * 100)}%
                  </span>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  {dims.map((dim: any) => {
                    const v = div[dim.key] ?? 0
                    return (
                      <div key={dim.key} className="flex items-center gap-2 text-xs">
                        <span className="w-32 text-muted-foreground">{dim.label}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden relative">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/30" />
                          <div
                            className="absolute top-0 bottom-0"
                            style={{
                              left: v >= 0 ? '50%' : `${50 + (v / maxAbs) * 50}%`,
                              right: v >= 0 ? `${50 - (v / maxAbs) * 50}%` : '50%',
                              background: v >= 0 ? '#f97316' : '#10b981',
                            }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-muted-foreground">{v.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Human</div>
                    <div className="text-xs">{d.humanResponse?.decision}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Clone</div>
                    <div className="text-xs">{d.cloneResponse?.decision}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Callout tone="amber" title="What the platform can say">
        “The clone agrees with the user's decisions 94% of the time.” and “The clone consistently underestimates operational risk on forecast commits.” — these statements are evidence-based, not marketing.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 6. VERSIONS
// =========================================================================
export function VersionsSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load versions" />
  const { versions, clone } = data
  const cv = clone.currentVersion
  return (
    <SectionShell
      title="Versioning"
      description="Everything important is versioned. A clone version has change set, training inputs, evaluation results, performance impact, dependencies, and provenance. Rollback is supported — never silently mutate production intelligence."
    >
      <div className="space-y-3">
        {versions.map((v: any) => (
          <Card key={v.id} className={v.version === cv?.version ? 'border-emerald-400' : ''}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">v{v.version}</Badge>
                {v.version === cv?.version && <Badge className="bg-emerald-100 text-emerald-800">active</Badge>}
                <span className="text-xs text-muted-foreground">{timeAgo(v.releasedAt)}</span>
                <span className="text-xs text-muted-foreground">· author: {v.author}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-xs h-7"
                  onClick={() => toast.info(`Rollback to v${v.version} queued`, { description: 'A new version will be released from this snapshot. Production is never mutated in place.' })}
                >
                  <GitBranch className="h-3 w-3 mr-1" /> Rollback
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change set</div>
                  <ul className="text-xs space-y-0.5">
                    {v.changeSet?.map((c: string, i: number) => <li key={i}>• {c}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Training inputs</div>
                  <div className="text-xs space-y-0.5">
                    {Object.entries(v.trainingInputs || {}).map(([k, val]: [string, any]) => <div key={k}>{k}: {String(val)}</div>)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Evaluation</div>
                  <div className="text-xs space-y-0.5">
                    {Object.entries(v.evaluationResults || {}).map(([k, val]: [string, any]) => <div key={k}>{k}: {String(val)}</div>)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Performance impact</div>
                  <div className="text-xs">
                    {v.performanceImpact == null ? <span className="text-muted-foreground">baseline</span> : <span className="text-emerald-700">+{v.performanceImpact.toFixed(1)} pts</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 mb-1">Provenance</div>
                  <div className="text-xs space-y-0.5">
                    {Object.entries(v.provenance || {}).map(([k, val]: [string, any]) => <div key={k}>{k}: {String(val)}</div>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  )
}

// =========================================================================
// 7. AGENTS
// =========================================================================
export function AgentsSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load agents" />
  const { agents, catalogs } = data
  return (
    <SectionShell
      title="Agents"
      description="Agents are runtime deployments of the clone, or specialized operational manifestations. They share appropriate portions of the same underlying clone state. Agents are NOT permanently bound to one model provider."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a: any) => {
          const level = catalogs.autonomyLevels.find((l: any) => l.level === a.autonomyLevel)
          return (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-emerald-600" />{a.name}</CardTitle>
                    <CardDescription className="text-xs">{a.specialization}</CardDescription>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{a.description}</p>
                <KV k="Autonomy" v={<Badge variant="outline">L{a.autonomyLevel} · {level?.name}</Badge>} />
                <KV k="Cert" v={<CertBadge level={a.certificationLevel} />} />
                <KV k="Model req" v={<span className="text-xs font-mono">{a.modelRequirements?.primary ?? '—'} → {a.modelRequirements?.fallback ?? '—'}</span>} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Approved capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {a.capabilities.map((c: string) => {
                      const cap = (catalogs.capabilities as any[]).find((x) => x.id === c)
                      return cap ? <CapabilityBadge key={c} {...cap} /> : <Tag key={c}>{c}</Tag>
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Callout tone="emerald" title="Clone over Agent (principle #1)">
        The clone is the primary asset. Agents are derived from it; they reference clone versions, they do not own the expertise.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 8. MODEL ROUTER
// =========================================================================
export function ModelRouterSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load model router" />
  const { catalogs } = data
  return (
    <SectionShell
      title="Model Abstraction Layer"
      description="LLMs are inference engines. The Clone is the source of truth. The rest of the platform never depends on vendor SDKs directly — adapters only. The Model Router selects a provider per request."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {catalogs.modelProviders.map((p: any) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.label}</CardTitle>
              <CardDescription className="text-xs">{p.vendor}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <KV k="Quality" v={<Bar value={p.quality * 100} />} />
              <KV k="Latency" v={`${p.latencyMs}ms`} />
              <KV k="Cost/1k" v={`$${p.costPer1kTokens.toFixed(4)}`} />
              <KV k="Privacy" v={<Badge variant="outline">{p.privacy}</Badge>} />
              <KV k="Context" v={`${(p.contextWindow / 1000).toFixed(0)}k`} />
              <KV k="Avail" v={<Bar value={p.availability * 100} />} />
              <div className="flex flex-wrap gap-1 pt-1">
                {p.capabilities.map((c: string) => <Tag key={c}>{c}</Tag>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PanelCard title="Routing rules" description="Signal → selected provider. The router considers task, quality, latency, cost, privacy, context, capabilities, availability.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(catalogs.routingRules).map(([signal, providerId]: [string, any]) => {
            const provider = (catalogs.modelProviders as any[]).find((p) => p.id === providerId)
            return (
              <div key={signal} className="rounded border p-2 text-xs">
                <div className="font-mono text-[10px] text-muted-foreground">{signal}</div>
                <div className="font-medium mt-1">→ {provider?.label ?? providerId}</div>
              </div>
            )
          })}
        </div>
      </PanelCard>

      <Callout tone="emerald" title="User ownership over model ownership (principle #2)">
        Claude may currently be superior for a particular task. That is fine. But Claude is an interchangeable runtime dependency, not the owner's professional identity.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 9. ENVIRONMENTS
// =========================================================================
export function EnvironmentsSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load environments" />
  const { environments } = data
  return (
    <SectionShell
      title="Environments"
      description="A clone is not limited to one platform. It operates inside environments. The clone reasons in terms of capabilities, not vendor-specific implementations."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {environments.map((e: any) => (
          <Card key={e.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-600" />{e.name}</CardTitle>
              <CardDescription className="text-xs">{e.kind}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">{e.description}</p>
              <EnvList label="Data" items={e.availableData} />
              <EnvList label="Tools" items={e.availableTools} />
              <EnvList label="Extensions" items={e.availableExtensions} />
              <EnvList label="People" items={e.availablePeople} />
              <EnvList label="Systems" items={e.availableSystems} />
              <EnvList label="Rules" items={e.rules} />
              <EnvList label="Constraints" items={e.constraints} />
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  )
}

function EnvList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1 mt-0.5">{items.map((t, i) => <Tag key={i}>{t}</Tag>)}</div>
    </div>
  )
}

// =========================================================================
// 10. EXTENSIONS
// =========================================================================
export function ExtensionsSection() {
  const { data, isLoading, error } = useCloneOs()
  const install = useExtensionInstall()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load extensions" />
  const { extensions, catalogs } = data
  return (
    <SectionShell
      title="Extensions"
      description="Capability-based. Agents request abstract capabilities (VISION_READ, CRM_READ, EMAIL_SEND), never specific vendors. A malicious extension must NOT silently escalate from READ_CAMERA to CONTROL_ROBOT or TRANSFER_MONEY."
    >
      <PanelCard title="Capability catalog" description="21 capabilities across CRM, Communication, Calendar, Finance, Documents, Engineering, Web, and Physical.">
        <div className="flex flex-wrap gap-1.5">
          {catalogs.capabilities.map((c: any) => <CapabilityBadge key={c.id} {...c} />)}
        </div>
      </PanelCard>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {extensions.map((e: any) => (
          <Card key={e.id} className={e.installed ? 'border-emerald-400' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2"><Plug className="h-4 w-4 text-emerald-600" />{e.name}</CardTitle>
                  <CardDescription className="text-xs">v{e.version} · {e.trustLevel}</CardDescription>
                </div>
                {e.installed && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">installed</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">{e.description}</p>
              <div className="flex flex-wrap gap-1">
                {e.capabilities.map((c: string) => {
                  const cap = (catalogs.capabilities as any[]).find((x) => x.id === c)
                  return cap ? <CapabilityBadge key={c} {...cap} /> : <Tag key={c}>{c}</Tag>
                })}
              </div>
              <KV k="Cert" v={<Badge variant="outline" className="text-[10px]">{e.certification}</Badge>} />
              <KV k="Pricing" v={<span className="font-mono">{Object.entries(e.pricing || {}).map(([k, v]: [string, any]) => `${k}: ${v}`).join(', ')}</span>} />
              <Button
                variant={e.installed ? 'outline' : 'default'}
                size="sm"
                className="w-full mt-1"
                disabled={install.isPending}
                onClick={async () => {
                  try {
                    await install.mutateAsync({ extensionId: e.id, action: e.installed ? 'uninstall' : 'install' })
                    toast.success(`${e.installed ? 'Uninstalled' : 'Installed'} ${e.name}`, {
                      description: e.installed ? 'PermissionRevoked events emitted for each capability.' : 'PermissionGranted events emitted for each capability.',
                    })
                  } catch (err: any) {
                    toast.error('Action failed', { description: err?.message })
                  }
                }}
              >
                {e.installed ? 'Uninstall' : 'Install'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Callout tone="rose" title="Extension security (ADR-0007, ADR-0027)">
        Capability declarations, permissions, sandboxing, authentication, authorization, audit logs, rate limits, resource limits, certification, trust levels, versioning, revocation. Physical-world capabilities arrive through extensions — never hardcoded special cases.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 11. MARKETPLACE (intent-based hiring)
// =========================================================================
export function MarketplaceSection() {
  const { data, isLoading, error } = useCloneOs()
  const match = useMarketplaceMatch()
  const [intent, setIntent] = React.useState('Qualify inbound B2B leads, update Salesforce, and book qualified meetings.')
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load marketplace" />
  const { marketplace, catalogs } = data
  const result = match.data

  return (
    <SectionShell
      title="Marketplace — Intent-based Hiring"
      description="Companies express outcomes, not agents. The platform translates the outcome into required capabilities and matches clones/agents. NOT an AI-agent store where every agent is a prompt."
    >
      <PanelCard title="Express an outcome" description="The platform decomposes your intent into required capabilities and ranks matches by capability match × reputation.">
        <Textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="min-h-20 text-sm"
          placeholder="e.g., I need someone to manage inbound B2B leads, qualify them, update Salesforce, and book qualified meetings."
        />
        <Button
          className="mt-2 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => match.mutate({ intent })}
          disabled={match.isPending || !intent.trim()}
        >
          {match.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Target className="h-4 w-4 mr-2" />}
          Find matching clones
        </Button>
      </PanelCard>

      {result && (
        <div className="grid gap-4 lg:grid-cols-3">
          <PanelCard title="Required capabilities" description="Decomposed from your intent.">
            <div className="space-y-1.5">
              {result.requiredCapabilities.map((c: any) => <CapabilityBadge key={c.id} {...c} />)}
            </div>
            <div className="mt-3 space-y-1">
              {result.rationale.map((r: string, i: number) => <div key={i} className="text-xs text-muted-foreground">• {r}</div>)}
            </div>
          </PanelCard>
          <PanelCard title="Ranked matches" description="Capability match × reputation score." className="lg:col-span-2">
            <div className="space-y-2">
              {result.matches.map((m: any) => (
                <div key={m.id} className="rounded border p-2.5 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.name}</span>
                      <Badge variant="outline" className="text-[10px]">{m.packageType}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-emerald-700">{Math.round(m.capabilityMatch * 100)}%</div>
                    <div className="text-[10px] text-muted-foreground">match</div>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>
        </div>
      )}

      <PanelCard title="All listings" description="Clones, agents, and extensions. Hiring modes: hourly, per-task, per-outcome, subscription, project, revenue share, enterprise license, temporary trial, recruitment trial, human+clone.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {marketplace.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{l.packageTypeLabel}</Badge>
                  <CertBadge level={l.certificationLevel} />
                </div>
                <div className="font-medium text-sm">{l.name}</div>
                <div className="text-xs text-muted-foreground">{l.description}</div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {l.capabilities.map((c: string, i: number) => <Tag key={i}>{c}</Tag>)}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className="text-[10px]">{l.pricingModeLabel}</Badge>
                  <span className="text-sm font-medium tabular-nums">{money(l.priceCents)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PanelCard>
    </SectionShell>
  )
}

// =========================================================================
// 12. OUTCOME CONTRACTS
// =========================================================================
export function OutcomeContractsSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load contracts" />
  const { contracts, outcomes, catalogs } = data
  return (
    <SectionShell
      title="Outcome Contracts"
      description="A company specifies objective, inputs, required actions, constraints, success criteria, SLA, budget, permissions, data access, and duration. The platform measures actual performance against the contract."
    >
      <div className="space-y-3">
        {contracts.map((c: any) => {
          const outs = outcomes.filter((o: any) => o.contractId === c.id)
          return (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  <Badge variant="outline" className="text-[10px]">{c.hiringModeLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{c.durationDays}d</span>
                  <span className="ml-auto font-medium tabular-nums">{money(c.budgetCents)}</span>
                </div>
                <div className="text-sm font-medium">{c.objective}</div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Required actions</div>
                    <ul className="space-y-0.5">{c.requiredActions.map((a: string, i: number) => <li key={i}>• {a}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Success criteria</div>
                    <ul className="space-y-0.5">{c.successCriteria.map((s: string, i: number) => <li key={i}><CheckCircle2 className="inline h-3 w-3 text-emerald-600 mr-1" />{s}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Constraints</div>
                    <ul className="space-y-0.5">{c.constraints.map((s: string, i: number) => <li key={i}><AlertTriangle className="inline h-3 w-3 text-amber-600 mr-1" />{s}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Data access</div>
                    <div className="space-y-0.5">{Object.entries(c.dataAccess || {}).map(([k, v]: [string, any]) => <div key={k}>{k}: {String(v)}</div>)}</div>
                  </div>
                </div>
                {outs.length > 0 && (
                  <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">Outcome recorded</div>
                    <div className="grid gap-2 md:grid-cols-4 text-xs">
                      <KV k="Objective met" v={outs[0].objectiveMet ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : '—'} />
                      <KV k="Success rate" v={`${Math.round((outs[0].successRate ?? 0) * 100)}%`} />
                      <KV k="Human interv." v={`${Math.round((outs[0].humanInterventionRate ?? 0) * 100)}%`} />
                      <KV k="Feedback" v={<span className="italic">{outs[0].clientFeedback}</span>} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </SectionShell>
  )
}

// =========================================================================
// 13. REPUTATION
// =========================================================================
export function ReputationSection() {
  const { data, isLoading, error } = useCloneOs()
  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load reputation" />
  const { reputation, catalogs } = data
  if (!reputation) return <ErrorState message="No reputation" />
  return (
    <SectionShell
      title="Reputation"
      description="Verified outcome metrics are separated from subjective review. Do not rely exclusively on star ratings."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Verified metrics" description="Outcome-based. Source of truth for marketplace matching." className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(catalogs.reputationMetrics as any[])
              .filter((m) => m.verified)
              .map((m) => {
                const val = (reputation as any)[m.key]
                const display = typeof val === 'number'
                  ? (m.key.includes('Rate') || m.key.includes('Compliance') || m.key.includes('Retention'))
                    ? `${Math.round(val * 100)}%`
                    : m.key === 'responseTimeMins' ? `${val}m` : m.key === 'experienceYears' ? `${val}y` : String(val)
                  : '—'
                return <StatCard key={m.key} label={m.label} value={display} sub="verified" />
              })}
          </div>
        </PanelCard>
        <PanelCard title="Subjective reviews" description="Separated from verified outcome.">
          <div className="space-y-2">
            {reputation.subjectiveReviews.map((r: any, i: number) => (
              <div key={i} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.client}</span>
                  <Badge variant="outline" className="text-[10px]">★ {r.rating}</Badge>
                </div>
                <div className="text-muted-foreground mt-1 italic">"{r.note}"</div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
      <Callout tone="emerald" title="Evidence over claims (principle #5)">
        Certification is based on measurable evidence. Reputation aggregates verified outcome metrics (tasks completed, success rate, outcome rate, reliability, SLA compliance, human intervention rate) — separated from subjective review.
      </Callout>
    </SectionShell>
  )
}

// =========================================================================
// 14. LIVE CHAT (socket.io)
// =========================================================================
type ChatMsg = { id: string; role: 'user' | 'clone' | 'system'; content: string; ts: number }

export function LiveChatSection() {
  const { data, isLoading, error } = useCloneOs()
  const [socket, setSocket] = React.useState<Socket | null>(null)
  const [ready, setReady] = React.useState(false)
  const [thinking, setThinking] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMsg[]>([])
  const [input, setInput] = React.useState('')
  const [persona, setPersona] = React.useState<any>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Connect once we have clone.id
  React.useEffect(() => {
    if (!data?.clone?.id) return
    if (socket) return
    // On Vercel (or anywhere NEXT_PUBLIC_SOCKET_URL is set), connect directly to
    // the deployed socket.io service. On Space-z.ai (where Caddy is the gateway
    // and the mini-service is on port 3003), use the XTransformPort query form.
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    const socketOpts = { transports: ['websocket', 'polling'] as const, reconnection: true }
    const s = socketUrl
      ? io(socketUrl, socketOpts)
      : io('/?XTransformPort=3003', socketOpts)
    setSocket(s)
    s.on('connect', () => {
      s.emit('clone:join', { cloneId: data.clone.id })
    })
    s.on('connect_error', (e: any) => console.error('[LiveChat] connect_error', e?.message, e))
    s.on('disconnect', (r: string) => console.warn('[LiveChat] disconnected', r))
    s.on('clone:ready', (p: any) => {
      setReady(true)
      setPersona(p)
      setMessages([{
        id: 'sys-1', role: 'system', ts: Date.now(),
        content: `Connected to ${p.cloneName} · v${p.version} · ${p.certification.replace(/_/g, ' ')}.`,
      }])
    })
    s.on('clone:message', (m: ChatMsg) => {
      setMessages((prev) => [...prev, m])
      setThinking(false)
    })
    s.on('clone:thinking', () => setThinking(true))
    s.on('clone:typing', () => setThinking(false))
    s.on('clone:error', (e: any) => toast.error('Clone error', { description: e?.message }))
    s.on('clone:reset-ack', () => setMessages([{ id: 'sys-2', role: 'system', ts: Date.now(), content: 'Conversation reset.' }]))
    return () => { s.disconnect() }
  }, [data?.clone?.id])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  if (isLoading) return <Skeleton count={2} />
  if (error || !data) return <ErrorState message="Failed to load chat" />
  const { clone } = data

  function send() {
    if (!socket || !input.trim() || !ready) return
    socket.emit('clone:message', { content: input.trim() })
    setInput('')
    setThinking(true)
  }

  return (
    <SectionShell
      title="Live Clone Chat"
      description="Real-time conversation with your clone. The clone's persona, expertise, skills, and policies are loaded from the platform data layer each session — the LLM is an inference engine, never the source of truth."
      right={ready ? <StatusBadge status="active" /> : <Badge variant="outline">connecting…</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-emerald-600" />{clone.name}</CardTitle>
            <CardDescription className="text-xs">{persona?.persona?.communicationStyle ?? clone.persona?.communicationStyle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="h-80 w-full rounded border p-3 bg-muted/30">
              <div className="space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : m.role === 'system'
                          ? 'bg-muted text-muted-foreground text-xs italic'
                          : 'bg-background border'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-background border rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Clone is thinking…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask the clone about pipeline, ICP, forecasting, or how it would triage a lead…"
                disabled={!ready}
              />
              <Button onClick={send} disabled={!ready || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                <Send className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => socket?.emit('clone:reset')} disabled={!ready}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <PanelCard title="Clone persona" description="Persisted in the data layer; the LLM receives it as a system prompt each session.">
            <div className="space-y-2 text-xs">
              <KV k="Style" v={clone.persona?.communicationStyle} />
              <KV k="Tone" v={clone.persona?.tone} />
              <KV k="Structure" v={clone.persona?.structure} />
              <div>
                <div className="text-muted-foreground mb-1">Vocabulary</div>
                <div className="flex flex-wrap gap-1">{(clone.persona?.vocabulary ?? []).map((v: string, i: number) => <Tag key={i}>{v}</Tag>)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Values (do not violate)</div>
                <ul className="space-y-0.5">{(clone.professionalIdentity?.values ?? []).map((v: string, i: number) => <li key={i}>• {v}</li>)}</ul>
              </div>
            </div>
          </PanelCard>
          <Callout tone="emerald" title="Why this design">
            Chat history is <em>experience</em>, not the clone itself. The clone's persistent state (persona, expertise, skills, policies) lives in the platform data layer — it is reloaded each session and never becomes the LLM provider's training data.
          </Callout>
        </div>
      </div>
    </SectionShell>
  )
}

// =========================================================================
// 15. ARCHITECTURE
// =========================================================================
export function ArchitectureSection() {
  return (
    <SectionShell
      title="Architecture"
      description="The frozen architectural constitution of Clone OS. Implementation is incremental; the architecture is not."
    >
      <Tabs defaultValue="model">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="model">Final Model</TabsTrigger>
          <TabsTrigger value="layers">15 Layers</TabsTrigger>
          <TabsTrigger value="principles">12 Principles</TabsTrigger>
          <TabsTrigger value="adr">14 ADRs</TabsTrigger>
        </TabsList>
        <TabsContent value="model" className="mt-4">
          <PanelCard title="Final architectural model" description="The complete system from HUMAN to FEEDBACK.">
            <pre className="text-[10px] sm:text-xs overflow-x-auto bg-muted/40 rounded p-3 font-mono leading-tight">{`
                         HUMAN
                           |
                 PROFESSIONAL IDENTITY
                           |
                         CLONE
       +-------------------+-------------------+
       v                   v                   v
   EXPERTISE           BEHAVIOR           PERSONALITY
       +-------------------+-------------------+
                           |
                     LEARNING SYSTEM
                           |
                    EVALUATION SYSTEM
                           |
                     CLONE SCORE
                           |
                     AGENT PACKAGES
              +------------+------------+
              v            v            v
          Environment   Environment   Environment
              |            |            |
          Extensions   Extensions   Extensions
              +------------+------------+
                           |
                    REAL-WORLD WORK
                           |
                       OUTCOMES
                           |
                       FEEDBACK -----> CLONE

Above:    MARKETPLACE -> Hiring / Licensing / Freelance -> ECONOMY
Below:    Identity, Security, Permissions, Provenance, Persistence,
          Events, Observability, Model Abstraction, Interoperability
`}</pre>
          </PanelCard>
        </TabsContent>
        <TabsContent value="layers" className="mt-4">
          <PanelCard title="15 architectural layers" description="Boundaries are explicit.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {[
                'Identity', 'Tenant / Organization', 'Professional Identity', 'Clone', 'Expertise / Knowledge',
                'Learning', 'Evaluation / Certification', 'Agent Runtime', 'Environment', 'Extension / Tool',
                'Interoperability', 'Marketplace / Economy', 'Model Abstraction', 'Persistence / Data', 'Security / Governance',
              ].map((l, i) => (
                <div key={l} className="rounded border p-2">
                  <span className="text-muted-foreground font-mono mr-2">{i + 1}.</span>{l}
                </div>
              ))}
            </div>
          </PanelCard>
        </TabsContent>
        <TabsContent value="principles" className="mt-4">
          <PanelCard title="12 non-negotiable design principles">
            <div className="grid gap-2 text-xs">
              {[
                ['Clone over Agent', 'The clone is the primary asset.'],
                ['User ownership over model ownership', 'LLMs are infrastructure.'],
                ['Capability over vendor', 'Agents request capabilities, not specific vendors.'],
                ['Environment over platform', 'Agents must operate outside this platform.'],
                ['Evidence over claims', 'Certification is based on measurable evidence.'],
                ['Outcome over benchmark', 'Real-world performance ultimately matters.'],
                ['Provenance everywhere', 'Know where knowledge and behavior came from.'],
                ['Explicit permissions', 'Autonomy never implies unlimited authority.'],
                ['Version everything', 'Never silently mutate production intelligence.'],
                ['Portable by design', 'Do not intentionally create lock-in.'],
                ['Multi-tenant from the foundation', 'Tenant boundaries are architectural, not UI features.'],
                ['Extension-first physical integration', 'Physical capabilities arrive through extensions.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded border p-2">
                  <div className="font-medium">{t}</div>
                  <div className="text-muted-foreground">{d}</div>
                </div>
              ))}
            </div>
          </PanelCard>
        </TabsContent>
        <TabsContent value="adr" className="mt-4">
          <PanelCard title="14 Architecture Decision Records" description="See docs/adr/README.md for full text.">
            <div className="grid gap-2 text-xs">
              {[
                ['ADR-0001', 'Clone as the Primary Asset'],
                ['ADR-0002', 'Model Abstraction Layer'],
                ['ADR-0003', 'Data Ownership & Provenance'],
                ['ADR-0004', 'Multi-Tenancy from the Foundation'],
                ['ADR-0005', 'Package-Oriented Architecture'],
                ['ADR-0006', 'Agent Portability & Interoperability Protocol'],
                ['ADR-0007', 'Extension Architecture (Capability-Based)'],
                ['ADR-0008', 'Capability-Based Permissions & Autonomy Levels'],
                ['ADR-0009', 'Clone Evaluation & Fidelity'],
                ['ADR-0010', 'Versioning Everything Important'],
                ['ADR-0011', 'Marketplace Outcome Contracts'],
                ['ADR-0012', 'Environment Abstraction'],
                ['ADR-0013', 'Real-Time Clone Conversation via Socket.io Mini-Service'],
                ['ADR-0014', 'Single Comprehensive Dashboard Route'],
              ].map(([id, title]) => (
                <div key={id} className="rounded border p-2 flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{id}</Badge>
                  <span>{title}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        </TabsContent>
      </Tabs>

      <PanelCard title="What NOT to build" description="If a proposed implementation contradicts the architecture, stop and identify the conflict before coding.">
        <ul className="text-xs space-y-1">
          {[
            'a generic ChatGPT wrapper',
            'a prompt marketplace',
            'a simple RAG chatbot',
            'an LLM fine-tuning dashboard',
            'an AI agent marketplace where every agent is a prompt',
            'a monolithic "Agent" database object containing everything',
            'vendor-specific agent/memory/identity/training-history implementations',
            'an ecosystem locked to your platform',
            'uncontrolled autonomous tool execution',
          ].map((s, i) => <li key={i} className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 text-rose-600 mt-0.5 shrink-0" /><span>{s}</span></li>)}
        </ul>
      </PanelCard>
    </SectionShell>
  )
}

// =========================================================================
// Helpers
// =========================================================================
function Skeleton({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}><CardContent className="p-6"><div className="h-32 rounded bg-muted animate-pulse" /></CardContent></Card>
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-rose-700">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        {message}
      </CardContent>
    </Card>
  )
}

// =========================================================================
// 16. ADMIN — Waitlist management (admin-only)
// =========================================================================
export function AdminSection() {
  const { me, waitlist, refresh, loadingMe } = useCurrentUser()

  if (loadingMe) return <Skeleton count={1} />
  if (!me || me.accountStatus !== 'admin') {
    return (
      <SectionShell title="Admin" description="Waitlist management is only available to admins.">
        <Callout tone="rose" title="Forbidden">
          You must be signed in as an admin to view this section.
        </Callout>
      </SectionShell>
    )
  }
  return (
    <SectionShell
      title="Admin — Waitlist"
      description="New signups land on the waitlist. Approve an entry to create a real User with a temporary password — share it with the user; they can change it after signing in."
      right={<Badge variant="outline" className="bg-emerald-100 text-emerald-800">{waitlist.length} pending</Badge>}
    >
      <Callout tone="emerald" title="You are signed in as the real admin">
        {me.email} · role: {me.role} · accountStatus: {me.accountStatus}
      </Callout>
      <AdminWaitlistPanel entries={waitlist} onApproved={refresh} />
    </SectionShell>
  )
}
