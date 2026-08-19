'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Brain, Play, RotateCcw, Sparkles, Zap } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CloneOSData, TrainResponse } from '../types'
import {
  Callout,
  ScrollList,
  SectionHeading,
  colorClasses,
} from '../shared'

const MODE_COLORS: Record<string, string> = {
  teaching: 'teal',
  demonstration: 'emerald',
  correction: 'amber',
  shadowing: 'teal',
  assisted: 'amber',
  delegated: 'violet',
  simulation: 'orange',
  adversarial: 'rose',
  real_world: 'emerald',
}

export function TrainingStudioSection({ data }: { data: CloneOSData }) {
  const { clone, catalogs, trainingSessions } = data
  const queryClient = useQueryClient()
  const [selectedMode, setSelectedMode] = React.useState<string>('teaching')
  const [lastResult, setLastResult] = React.useState<TrainResponse | null>(null)

  const trainMutation = useMutation({
    mutationFn: async (mode: string) => {
      const r = await fetch('/api/clone-os/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloneId: clone.id,
          mode,
          stage: mode === 'real_world' ? 'measure' : 'train',
        }),
      })
      if (!r.ok) throw new Error('Training failed')
      return r.json() as Promise<TrainResponse>
    },
    onSuccess: (res) => {
      setLastResult(res)
      toast.success(`${selectedMode} training completed`, {
        description: `New aggregate: ${res.newAggregate.toFixed(1)} · ${res.events.length} events emitted`,
      })
      queryClient.invalidateQueries({ queryKey: ['clone-os'] })
    },
    onError: (err) => {
      toast.error('Training session failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  // Where is the current clone in the loop?
  const currentStageIdx = trainingSessions[0]
    ? Math.max(
        ...catalogs.trainingLoop.map((s, i) =>
          trainingSessions[0].stage.toUpperCase() === s.stage ? i : -1,
        ),
      )
    : 4

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Training Studio"
        description="9 training modes — each carries a mode and structured inputs. Training is model-independent (ADR-0008)."
        icon={Brain}
      />

      <Callout tone="info" title="Training ≠ fine-tuning">
        Training is <strong>model-independent</strong>. Mechanisms include structured
        knowledge, RAG, examples, demonstrations, preference learning, workflow
        learning, policy learning, memory, tool-usage learning, evaluation feedback.
        The platform decides which representation is appropriate per dimension.
      </Callout>

      {/* 12-stage loop visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">12-Stage Training Loop</CardTitle>
          <CardDescription>
            OBSERVE → CAPTURE → TEACH → DEMONSTRATE → TRAIN → EVALUATE → SIMULATE →
            CERTIFY → DEPLOY → WORK → MEASURE → LEARN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {catalogs.trainingLoop.map((s, i) => {
              const isCurrent = i === currentStageIdx
              const isPast = i < currentStageIdx
              const color = isCurrent ? 'emerald' : isPast ? 'teal' : 'muted'
              const c = colorClasses(color)
              return (
                <React.Fragment key={s.stage}>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                      isCurrent
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border/60',
                    )}
                    title={s.description}
                  >
                    <span className={cn('font-mono font-semibold', c.text)}>
                      {s.stage}
                    </span>
                  </div>
                  {i < catalogs.trainingLoop.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mode picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pick a Training Mode</CardTitle>
          <CardDescription>
            Selecting a mode and running a session creates a real TrainingSession
            record, emits domain events, and bumps the aggregate score slightly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogs.trainingModes.map((m) => {
              const isActive = selectedMode === m.mode
              const color = MODE_COLORS[m.mode] ?? 'muted'
              const c = colorClasses(color)
              return (
                <button
                  key={m.mode}
                  onClick={() => setSelectedMode(m.mode)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all',
                    isActive
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        c.bg,
                        c.text,
                      )}
                    >
                      {m.mode}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs leading-snug">
                    {m.description}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => trainMutation.mutate(selectedMode)}
              disabled={trainMutation.isPending}
              size="sm"
            >
              <Play className="size-3.5" />
              {trainMutation.isPending
                ? 'Running…'
                : `Run ${selectedMode} training session`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLastResult(null)}
            >
              <RotateCcw className="size-3.5" />
              Clear result
            </Button>
            <span className="text-muted-foreground text-xs">
              Stage:{' '}
              <code className="text-foreground">
                {selectedMode === 'real_world' ? 'measure' : 'train'}
              </code>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Last training result */}
      {lastResult && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              <Sparkles className="size-4" />
              Last Training Session Result
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  Mode
                </div>
                <div className="text-sm font-mono">{lastResult.session.mode}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  Stage
                </div>
                <div className="text-sm font-mono">{lastResult.session.stage}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  New Aggregate
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {lastResult.newAggregate.toFixed(1)}
                </div>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">
                Output
              </div>
              <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">
                {JSON.stringify(lastResult.session.output, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">
                Events emitted
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {lastResult.events.map((e) => (
                  <Badge key={e} variant="secondary" className="text-xs font-mono">
                    <Zap className="size-3" />
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training session history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training Session History</CardTitle>
          <CardDescription>
            Most recent {Math.min(8, trainingSessions.length)} of {trainingSessions.length}{' '}
            sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollList className="max-h-[28rem]">
            <div className="flex flex-col gap-2">
              {trainingSessions.slice(0, 8).map((s) => {
                const color = MODE_COLORS[s.mode] ?? 'muted'
                const c = colorClasses(color)
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            c.bg,
                            c.text,
                          )}
                        >
                          {s.mode}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {s.stage}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {s.status}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {(s.durationMs / 1000).toFixed(1)}s ·{' '}
                        {new Date(s.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-muted-foreground mt-1 text-xs">{s.notes}</p>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          Input
                        </span>
                        <pre className="bg-muted mt-0.5 overflow-x-auto rounded p-1.5 text-[10px]">
                          {JSON.stringify(s.input)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          Output
                        </span>
                        <pre className="bg-muted mt-0.5 overflow-x-auto rounded p-1.5 text-[10px]">
                          {JSON.stringify(s.output)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )
              })}
              {trainingSessions.length === 0 && (
                <span className="text-muted-foreground text-sm">No sessions yet.</span>
              )}
            </div>
          </ScrollList>
        </CardContent>
      </Card>
    </div>
  )
}
