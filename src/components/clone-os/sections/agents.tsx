'use client'

import * as React from 'react'
import { Users, Package, Cpu, Boxes, BadgeCheck } from 'lucide-react'
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
  AutonomyBadge,
  Callout,
  CapabilityBadge,
  CertBadge,
  Field,
  SectionHeading,
  useCapabilityLookup,
} from '../shared'

export function AgentsSection({ data }: { data: CloneOSData }) {
  const { agents, catalogs } = data
  const lookup = useCapabilityLookup(catalogs)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Agents"
        description="Agents are runtime deployments of the clone — they share the underlying clone state (ADR-0001, ADR-0006)."
        icon={Users}
      />

      <Callout tone="warning" title="Agents are NOT permanently bound to one model provider">
        Agents are <strong>runtime deployments</strong> of the clone — they share the
        underlying clone state. The clone is the primary asset; agents are how it
        operates. Model selection is a per-request routing decision, not a permanent
        binding (ADR-0002).
      </Callout>

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((a) => {
          const modelReq = a.modelRequirements as {
            primary?: string
            fallback?: string
            signals?: string[]
          }
          const pkg = a.packageManifest as {
            identity?: { version?: string; type?: string }
            capabilities?: string[]
            dependencies?: { id: string; versionRange: string }[]
            licensing?: { kind?: string }
          }
          return (
            <Card key={a.id} className="flex flex-col">
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {a.slug}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {a.specialization}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <AutonomyBadge level={a.autonomyLevel} />
                  <CertBadge level={a.certificationLevel} />
                  <Badge
                    variant="outline"
                    className={
                      a.status === 'active'
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs'
                        : 'text-xs'
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {a.description}
                </p>

                <Field label="Approved Capabilities">
                  <div className="flex flex-wrap gap-1.5">
                    {a.capabilities.map((cap) => {
                      const meta = lookup(cap)
                      return (
                        <CapabilityBadge
                          key={cap}
                          id={cap}
                          label={meta.label}
                          risk={meta.risk}
                          requiresApproval={meta.requiresApproval}
                        />
                      )
                    })}
                  </div>
                </Field>

                <Field label="Model Requirements">
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Cpu className="text-muted-foreground size-3.5" />
                      <span>
                        primary:{' '}
                        <span className="font-mono font-medium">
                          {modelReq.primary ?? '—'}
                        </span>
                      </span>
                      {modelReq.fallback && (
                        <span className="text-muted-foreground">
                          fallback:{' '}
                          <span className="font-mono">
                            {modelReq.fallback}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </Field>

                <Field label="Package Manifest">
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Package className="text-muted-foreground size-3.5" />
                      <span>
                        type:{' '}
                        <span className="font-mono font-medium">
                          {pkg.identity?.type ?? 'agent'}
                        </span>{' '}
                        · version{' '}
                        <span className="font-mono font-medium">
                          {pkg.identity?.version ?? '1.0.0'}
                        </span>
                      </span>
                      {pkg.licensing?.kind && (
                        <span className="text-muted-foreground">
                          license:{' '}
                          <span className="font-mono">{pkg.licensing.kind}</span>
                        </span>
                      )}
                    </div>
                    {pkg.dependencies && pkg.dependencies.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Boxes className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {pkg.dependencies.slice(0, 4).map((d, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px] font-mono"
                            >
                              {d.id}@{d.versionRange}
                            </Badge>
                          ))}
                          {pkg.dependencies.length > 4 && (
                            <span className="text-muted-foreground text-[10px]">
                              +{pkg.dependencies.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BadgeCheck className="size-3.5" />
                  Shares clone state · portable across environments
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Autonomy levels reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autonomy Levels (0–5)</CardTitle>
          <CardDescription>
            Autonomy must never imply unlimited authority (ADR-0008).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalogs.autonomyLevels.map((l) => (
              <div
                key={l.level}
                className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <AutonomyBadge level={l.level} />
                <span className="text-muted-foreground text-xs">{l.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
