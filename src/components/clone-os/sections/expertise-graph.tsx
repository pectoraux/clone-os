'use client'

import * as React from 'react'
import { Network, Filter, ArrowRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CloneOSData, ExpertiseNode } from '../types'
import {
  Callout,
  EmptyState,
  PortabilityBadge,
  ProvenanceBadge,
  SensitivityBadge,
  SectionHeading,
  Tag,
  colorClasses,
} from '../shared'

const NODE_TYPE_COLORS: Record<string, string> = {
  domain: 'violet',
  concept: 'teal',
  skill: 'emerald',
  tool: 'amber',
  procedure: 'teal',
  decision: 'orange',
  failure: 'rose',
  artifact: 'muted',
}

export function ExpertiseGraphSection({ data }: { data: CloneOSData }) {
  const { expertise, catalogs } = data
  const [sourceFilter, setSourceFilter] = React.useState<string>('all')

  const filtered = React.useMemo(() => {
    if (sourceFilter === 'all') return expertise
    return expertise.filter((e) => e.sourceKind === sourceFilter)
  }, [expertise, sourceFilter])

  const grouped = React.useMemo(() => {
    const g: Record<string, ExpertiseNode[]> = {}
    for (const e of filtered) {
      ;(g[e.nodeType] ||= []).push(e)
    }
    return g
  }, [filtered])

  const restrictedCount = expertise.filter(
    (e) => e.sensitivity === 'restricted' || e.sensitivity === 'confidential' || e.portability !== 'portable',
  ).length

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Expertise Graph"
        description="Queryable, versioned graph of the professional's expertise (ADR-0010). Every node carries provenance (ADR-0003)."
        icon={Network}
      />

      <Callout tone="warning" title="Data ownership boundary">
        An employee's clone must <strong>not</strong> accidentally export a previous
        employer's confidential data. A company must <strong>not</strong> automatically
        own all of an employee's general professional expertise. The boundary below is
        represented even if legal policy is configured later.
      </Callout>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            Filter by Provenance
          </CardTitle>
          <CardDescription>
            Source-kind tracks <em>who owns</em> this artifact. {restrictedCount} of{' '}
            {expertise.length} nodes are sensitive or non-portable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={sourceFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setSourceFilter('all')}
            >
              All ({expertise.length})
            </Button>
            {catalogs.sourceKinds.map((s) => {
              const count = expertise.filter((e) => e.sourceKind === s.key).length
              return (
                <Button
                  key={s.key}
                  size="sm"
                  variant={sourceFilter === s.key ? 'default' : 'outline'}
                  onClick={() => setSourceFilter(s.key)}
                  disabled={count === 0}
                  className="text-xs"
                >
                  {s.label} ({count})
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grouped columns */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {catalogs.nodeTypes.map((nt) => {
          const nodes = grouped[nt.key] ?? []
          if (nodes.length === 0) return null
          const color = NODE_TYPE_COLORS[nt.key] ?? 'muted'
          const c = colorClasses(color)
          return (
            <Card key={nt.key} className="p-0">
              <div className={cn('rounded-t-xl border-b px-4 py-3', c.bg, c.border)}>
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-semibold', c.text)}>
                    {nt.label}
                  </span>
                  <span className={cn('text-xs font-medium', c.text)}>
                    {nodes.length}
                  </span>
                </div>
              </div>
              <CardContent className="flex flex-col gap-3 p-3">
                {nodes.map((node) => (
                  <NodeCard key={node.id} node={node} />
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState message="No nodes match this provenance filter." />
      )}
    </div>
  )
}

function NodeCard({ node }: { node: ExpertiseNode }) {
  const isRestricted =
    node.sensitivity === 'restricted' ||
    node.sensitivity === 'confidential' ||
    node.portability !== 'portable'
  const c = colorClasses(
    node.sensitivity === 'restricted'
      ? 'rose'
      : node.sensitivity === 'confidential'
        ? 'orange'
        : 'teal',
  )
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isRestricted ? 'border-rose-500/30 bg-rose-500/5' : 'border-border/60',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{node.name}</span>
            {node.description && (
              <span className="text-muted-foreground text-xs leading-snug">
                {node.description}
              </span>
            )}
          </div>
          {isRestricted && (
            <span className={cn('text-xs font-medium', c.text)}>restricted</span>
          )}
        </div>

        {node.proficiency != null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Proficiency</span>
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', c.bar)}
                style={{ width: `${node.proficiency}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{node.proficiency}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <ProvenanceBadge
            sourceKind={node.sourceKind}
            label={node.sourceLabel}
          />
          <SensitivityBadge sensitivity={node.sensitivity} />
          <PortabilityBadge portability={node.portability} />
        </div>

        {node.edges.length > 0 && (
          <div className="border-border/60 mt-1 border-t pt-2">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Edges
            </span>
            <ul className="mt-1 flex flex-col gap-0.5">
              {node.edges.slice(0, 5).map((e, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ArrowRight className="text-muted-foreground size-3" />
                  <span className="font-mono text-[10px]">{e.type}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground">{e.targetName}</span>
                </li>
              ))}
              {node.edges.length > 5 && (
                <li className="text-muted-foreground text-[10px]">
                  +{node.edges.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
