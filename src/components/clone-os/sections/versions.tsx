'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { GitBranch, RotateCcw, ArrowUpRight, ArrowRight } from 'lucide-react'
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
import type { CloneOSData } from '../types'
import {
  Callout,
  Field,
  SectionHeading,
  colorClasses,
} from '../shared'

export function VersionsSection({ data }: { data: CloneOSData }) {
  const { versions, clone } = data
  const cv = clone.currentVersion

  const rollback = (v: string) => {
    toast.info(`Rollback to v${v} queued`, {
      description:
        'Production clones are never mutated in place — a new version would be released (ADR-0010).',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Versions"
        description="Versioned: Clone, Expertise, Skill, Knowledge, Workflow, Policy, Agent, Extension, Evaluation, Certification. Rollback is supported (ADR-0010)."
        icon={GitBranch}
      />

      <Callout tone="warning" title="Never silently mutate production">
        Production clones are <strong>never</strong> mutated in place — new versions
        are released. A version carries: Version, Author, Timestamp, Change Set,
        Training Inputs, Evaluation Results, Performance Impact, Dependencies,
        Provenance.
      </Callout>

      <div className="flex flex-col gap-4">
        {versions.map((v, idx) => {
          const isActive = v.version === cv?.version
          const isLatest = idx === 0
          return (
            <Card
              key={v.id}
              className={cn(
                isActive && 'border-emerald-500/40 bg-emerald-500/5',
              )}
            >
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg font-mono">
                        v{v.version}
                      </CardTitle>
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                          active
                        </Badge>
                      )}
                      {isLatest && (
                        <Badge variant="secondary" className="text-xs">
                          latest
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Released{' '}
                      {new Date(v.releasedAt).toLocaleString()} · author{' '}
                      <span className="font-medium">{v.author}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rollback(v.version)}
                      >
                        <RotateCcw className="size-3.5" />
                        Rollback to this version
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-3">
                {/* Change set */}
                <div className="lg:col-span-1">
                  <Field label="Change Set">
                    <ul className="flex flex-col gap-1.5 text-xs">
                      {v.changeSet.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ArrowUpRight className="text-teal-600 dark:text-teal-400 mt-0.5 size-3 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </Field>
                </div>

                {/* Training inputs */}
                <div className="lg:col-span-1">
                  <Field label="Training Inputs">
                    <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-[10px] leading-tight">
                      {JSON.stringify(v.trainingInputs, null, 1)}
                    </pre>
                  </Field>
                </div>

                {/* Evaluation results + impact */}
                <div className="lg:col-span-1 flex flex-col gap-3">
                  <Field label="Evaluation Results">
                    <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-[10px] leading-tight">
                      {JSON.stringify(v.evaluationResults, null, 1)}
                    </pre>
                  </Field>
                  {v.performanceImpact && (
                    <Field label="Performance Impact">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <ArrowRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {v.performanceImpact}
                      </span>
                    </Field>
                  )}
                </div>

                {/* Dependencies + provenance */}
                <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Dependencies">
                    <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-[10px] leading-tight">
                      {JSON.stringify(v.dependencies, null, 1)}
                    </pre>
                  </Field>
                  <Field label="Provenance">
                    <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-[10px] leading-tight">
                      {JSON.stringify(v.provenance, null, 1)}
                    </pre>
                  </Field>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
