'use client'

import * as React from 'react'
import { FileText, CheckCircle2, XCircle, DollarSign, Clock, Lock, Target } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneOSData, Contract, Outcome } from '../types'
import {
  Callout,
  Field,
  SectionHeading,
} from '../shared'

export function ContractsSection({ data }: { data: CloneOSData }) {
  const { contracts, outcomes, catalogs } = data
  const outcomesByContract = React.useMemo(() => {
    const m: Record<string, Outcome[]> = {}
    for (const o of outcomes) {
      ;(m[o.contractId] ||= []).push(o)
    }
    return m
  }, [outcomes])

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Outcome Contracts"
        description="Objective, inputs, required actions, constraints, success criteria, SLA, budget, permissions, data access, duration (ADR-0030)."
        icon={FileText}
      />

      <Callout tone="info" title="Outcome contracts specify the rules of engagement">
        A company expresses an outcome; the platform matches a clone and forms a
        contract. Outcomes (objective met, metric, client feedback, human
        intervention rate, success rate) are recorded and feed back into training.
      </Callout>

      {/* 10 hiring modes reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">10 Hiring Modes</CardTitle>
          <CardDescription>
            How clones are paid and engaged. Recruitment Trial = candidate grants
            controlled, time-limited access; the company does NOT receive ownership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {catalogs.hiringModes.map((h) => (
              <Badge key={h.key} variant="outline" className="text-xs">
                {h.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contracts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {contracts.map((c) => {
          const linkedOutcomes = outcomesByContract[c.id] ?? []
          const sla = c.sla as {
            responseTimeMins?: number
            responseTimeHours?: number
            uptime?: number
            maxRetries?: number
            escalationPath?: string
          }
          const dataAccess = c.dataAccess as {
            scope?: string | string[]
            retention?: string
            retentionDays?: number
            sensitivity?: string
          }
          return (
            <Card key={c.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base leading-snug">
                      {c.objective}
                    </CardTitle>
                    <CardDescription>
                      Contract ID {c.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      c.status === 'active'
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs'
                        : 'text-xs'
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {c.hiringModeLabel}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="size-3" />
                    {c.durationDays}d
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <DollarSign className="size-3" />
                    ${(c.budgetCents / 100).toLocaleString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <Field label="Required Actions">
                  <ul className="flex flex-col gap-1 text-xs">
                    {c.requiredActions.map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="text-teal-600 dark:text-teal-400 mt-0.5 size-3 shrink-0" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </Field>
                <Field label="Constraints">
                  <ul className="flex flex-col gap-1 text-xs">
                    {c.constraints.map((c2, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <XCircle className="text-rose-600 dark:text-rose-400 mt-0.5 size-3 shrink-0" />
                        <span>{c2}</span>
                      </li>
                    ))}
                  </ul>
                </Field>
                <Field label="Success Criteria">
                  <ul className="flex flex-col gap-1 text-xs">
                    {c.successCriteria.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Target className="text-emerald-600 dark:text-emerald-400 mt-0.5 size-3 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="SLA">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {sla.responseTimeMins != null && (
                        <span>response: {sla.responseTimeMins} min</span>
                      )}
                      {sla.responseTimeHours != null && (
                        <span>response: {sla.responseTimeHours}h</span>
                      )}
                      {sla.uptime != null && (
                        <span>uptime: {Math.round((sla.uptime as number) * 100)}%</span>
                      )}
                      {sla.maxRetries != null && (
                        <span>max retries: {sla.maxRetries as number}</span>
                      )}
                      {sla.escalationPath && (
                        <span>escalation: {sla.escalationPath}</span>
                      )}
                    </div>
                  </Field>
                  <Field label="Data Access">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {dataAccess.scope && (
                        <span>
                          scope:{' '}
                          {Array.isArray(dataAccess.scope)
                            ? dataAccess.scope.join(', ')
                            : dataAccess.scope}
                        </span>
                      )}
                      {dataAccess.retention && (
                        <span>retention: {dataAccess.retention}</span>
                      )}
                      {dataAccess.retentionDays != null && (
                        <span>retention: {dataAccess.retentionDays as number}d</span>
                      )}
                      {dataAccess.sensitivity && (
                        <span>sensitivity: {dataAccess.sensitivity}</span>
                      )}
                    </div>
                  </Field>
                </div>
                <Field label="Permissions">
                  <div className="flex flex-wrap gap-1">
                    {c.permissions.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] font-mono">
                        <Lock className="size-2.5" />
                        {p}
                      </Badge>
                    ))}
                  </div>
                </Field>

                {/* Linked outcomes */}
                {linkedOutcomes.length > 0 && (
                  <div className="border-border/60 border-t pt-3">
                    <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                      Recorded Outcomes
                    </div>
                    <div className="flex flex-col gap-2">
                      {linkedOutcomes.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-lg border border-border/60 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              {o.objectiveMet ? (
                                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <XCircle className="size-3 text-rose-600 dark:text-rose-400" />
                              )}
                              <span className="font-medium">
                                objective {o.objectiveMet ? 'met' : 'missed'}
                              </span>
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(o.recordedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                            <span>success {Math.round(o.successRate * 100)}%</span>
                            <span>
                              intervention {Math.round(o.humanInterventionRate * 100)}%
                            </span>
                          </div>
                          {o.clientFeedback && (
                            <p className="text-muted-foreground mt-1 italic">
                              “{o.clientFeedback}”
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
