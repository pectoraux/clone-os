'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Store, Search, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { CloneOSData, MarketplaceIntentResponse } from '../types'
import {
  Callout,
  CapabilityBadge,
  CertBadge,
  SectionHeading,
  formatPrice,
} from '../shared'

export function MarketplaceSection({ data }: { data: CloneOSData }) {
  const { marketplace } = data
  const [intent, setIntent] = React.useState(
    'Qualify inbound leads from our SaaS demo form, then route them into Salesforce with enriched ICP signals.',
  )
  const [result, setResult] = React.useState<MarketplaceIntentResponse | null>(null)

  const matchMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch('/api/clone-os/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: text }),
      })
      if (!r.ok) throw new Error('Match failed')
      return r.json() as Promise<MarketplaceIntentResponse>
    },
    onSuccess: (res) => {
      setResult(res)
      toast.success('Intent decomposed', {
        description: `${res.requiredCapabilities.length} required capabilities · ${res.matches.length} matches`,
      })
    },
    onError: (err) => {
      toast.error('Marketplace match failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Marketplace"
        description="Intent-based hiring — companies express outcomes; the platform translates to required capabilities and matches clones (ADR-0029)."
        icon={Store}
      />

      <Callout tone="info" title="For professional capability, not prompts">
        The marketplace is for <strong>professional capability</strong>, digital
        labor, expertise, clones, agents, extensions, workflows, tools, licenses —{' '}
        <strong>NOT</strong> an AI-agent store where every agent is a prompt.
      </Callout>

      {/* Intent input */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Express an outcome
          </CardTitle>
          <CardDescription>
            Describe what you want done. The platform decomposes this into required
            capabilities and matches clones/agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={3}
            placeholder="e.g. Triage my Slack DMs, escalate sales threads, and book discovery calls on my calendar."
            className="bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => matchMutation.mutate(intent)}
              disabled={matchMutation.isPending || !intent.trim()}
              size="sm"
            >
              <Search className="size-3.5" />
              {matchMutation.isPending ? 'Matching…' : 'Find clones'}
            </Button>
            <span className="text-muted-foreground text-xs">
              Intent decomposition → capability matching (ADR-0011)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Match result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decomposed Outcome</CardTitle>
            <CardDescription>
              “{result.intent}”
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Required Capabilities
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.requiredCapabilities.map((c) => (
                  <CapabilityBadge
                    key={c.id}
                    id={c.id}
                    label={c.label}
                    risk={c.risk}
                    requiresApproval={c.requiresApproval}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Rationale
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {result.rationale.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ArrowRight className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Ranked Matches
              </div>
              <div className="flex flex-col gap-2">
                {result.matches.length === 0 && (
                  <span className="text-muted-foreground text-sm">
                    No matches with capability overlap. Try refining the intent.
                  </span>
                )}
                {result.matches.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-xs font-semibold">
                        #{i + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{m.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {m.packageType} · {formatPrice(m.priceCents, m.pricingMode)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CertBadge level={m.certificationLevel} />
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">capability match</span>
                          <span className="font-semibold tabular-nums">
                            {Math.round(m.capabilityMatch * 100)}%
                          </span>
                        </div>
                        <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${m.capabilityMatch * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketplace Listings</CardTitle>
          <CardDescription>
            {marketplace.length} packages — clone, agent, expertise, skill,
            knowledge, workflow, policy, tool, extension, evaluation, certification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {marketplace.map((l) => {
              const rep = l.reputation as { successRate?: number; tasksCompleted?: number }
              return (
                <div
                  key={l.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{l.name}</span>
                      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                        {l.packageTypeLabel}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {l.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {l.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {l.capabilities.slice(0, 4).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px] font-mono">
                        {c}
                      </Badge>
                    ))}
                    {l.capabilities.length > 4 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{l.capabilities.length - 4} more
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-2">
                    <CertBadge level={l.certificationLevel} />
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold">
                        {formatPrice(l.priceCents, l.pricingMode)}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {l.pricingModeLabel}
                      </span>
                    </div>
                  </div>
                  {(rep.successRate != null || rep.tasksCompleted != null) && (
                    <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                      <CheckCircle2 className="size-3" />
                      {rep.successRate != null && (
                        <span>success {Math.round(rep.successRate * 100)}%</span>
                      )}
                      {rep.tasksCompleted != null && (
                        <span>· {rep.tasksCompleted} tasks</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
