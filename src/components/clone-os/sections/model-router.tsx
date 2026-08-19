'use client'

import * as React from 'react'
import { Cpu, Zap, ArrowRight, Gauge, DollarSign, Lock, Eye, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneOSData } from '../types'
import {
  Callout,
  SectionHeading,
  colorClasses,
} from '../shared'

const SIGNAL_LABELS: Record<string, string> = {
  complex_reasoning: 'Complex Reasoning',
  vision: 'Vision',
  coding: 'Coding',
  classification: 'Classification',
  privacy_sensitive: 'Privacy-Sensitive',
  long_context: 'Long Context',
  tool_use: 'Tool Use',
  general_chat: 'General Chat',
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'violet',
  gpt: 'teal',
  gemini: 'emerald',
  open: 'amber',
  local: 'rose',
  vision: 'orange',
  coding: 'teal',
  small: 'muted',
}

export function ModelRouterSection({ data }: { data: CloneOSData }) {
  const { catalogs } = data
  const providers = catalogs.modelProviders
  const routingRules = catalogs.routingRules

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Model Router"
        description="Model Abstraction Layer — the rest of the platform never depends on vendor SDKs directly (ADR-0002)."
        icon={Cpu}
      />

      <Callout tone="info" title="The LLM is an inference engine. The Clone is the source of truth.">
        Claude may currently be superior for a task — that is fine. But Claude is an{' '}
        <strong>interchangeable runtime dependency</strong>, not the owner's
        professional identity. The user's accumulated expertise stays in the
        platform's controlled data layer — never becomes proprietary training data
        belonging to whichever LLM provider happens to be used.
      </Callout>

      {/* Routing table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4" />
            Routing Table — signal → provider
          </CardTitle>
          <CardDescription>
            The router scores all providers per request on Task, Quality, Latency,
            Cost, Privacy, Context Requirements, Capabilities, Availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {Object.entries(routingRules).map(([signal, providerId]) => {
              const provider = providers.find((p) => p.id === providerId)
              const signalColor = 'teal'
              const providerColor = PROVIDER_COLORS[providerId] ?? 'muted'
              const sc = colorClasses(signalColor)
              const pc = colorClasses(providerColor)
              return (
                <div
                  key={signal}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs sm:text-sm"
                >
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 font-mono text-xs',
                      sc.bg,
                      sc.text,
                      sc.border,
                    )}
                  >
                    {SIGNAL_LABELS[signal] ?? signal}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3.5" />
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs font-medium',
                      pc.bg,
                      pc.text,
                      pc.border,
                    )}
                  >
                    {provider?.label ?? providerId}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {provider?.vendor}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((p) => {
          const color = PROVIDER_COLORS[p.id] ?? 'muted'
          const c = colorClasses(color)
          return (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-medium',
                      c.bg,
                      c.text,
                      c.border,
                    )}
                  >
                    {p.vendor}
                  </span>
                </div>
                {p.notes && (
                  <CardDescription className="text-xs">{p.notes}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-1">
                  {p.strengths.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Metric
                    icon={Gauge}
                    label="Quality"
                    value={`${Math.round(p.quality * 100)}`}
                    color="emerald"
                  />
                  <Metric
                    icon={Zap}
                    label="Latency"
                    value={`${p.latencyMs}ms`}
                    color="teal"
                  />
                  <Metric
                    icon={DollarSign}
                    label="Cost / 1k"
                    value={`$${p.costPer1kTokens.toFixed(4)}`}
                    color="amber"
                  />
                  <Metric
                    icon={Lock}
                    label="Privacy"
                    value={p.privacy}
                    color={
                      p.privacy === 'local'
                        ? 'rose'
                        : p.privacy === 'sandbox'
                          ? 'amber'
                          : 'muted'
                    }
                  />
                  <Metric
                    icon={Eye}
                    label="Context"
                    value={
                      p.contextWindow >= 1_000_000
                        ? '1M'
                        : p.contextWindow >= 1000
                          ? `${Math.round(p.contextWindow / 1000)}k`
                          : `${p.contextWindow}`
                    }
                    color="violet"
                  />
                  <Metric
                    icon={Server}
                    label="Avail."
                    value={`${Math.round(p.availability * 100)}%`}
                    color="teal"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {p.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline" className="text-[10px] font-mono">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
}) {
  const c = colorClasses(color)
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('rounded p-1', c.bg)}>
        <Icon className={cn('size-3', c.text)} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
    </div>
  )
}

// end of file
