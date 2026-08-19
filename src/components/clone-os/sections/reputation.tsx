'use client'

import * as React from 'react'
import { Trophy, BadgeCheck, Star, Clock, ShieldCheck, TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneOSData, Reputation } from '../types'
import {
  Callout,
  SectionHeading,
  colorClasses,
} from '../shared'
import { cn } from '@/lib/utils'

export function ReputationSection({ data }: { data: CloneOSData }) {
  const { reputation, catalogs } = data

  if (!reputation) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title="Reputation" icon={Trophy} />
        <Callout tone="warning" title="No reputation yet">
          Reputation aggregates from outcomes — record outcomes on contracts first.
        </Callout>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Reputation"
        description="Verified outcome metrics separated from subjective review (ADR-0034)."
        icon={Trophy}
      />

      <Callout tone="info" title="Verified outcome metrics are separated from subjective review">
        Reputation tracks <strong>verified metrics</strong> (tasks completed, success
        rate, outcome rate, reliability, client retention, certification, experience,
        response time, SLA compliance, human intervention rate) — separated from{' '}
        <strong>subjective review</strong> (ratings, testimonials). No marketplace
        certification without evidence.
      </Callout>

      {/* Verified metrics grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="size-4" />
            Verified Outcome Metrics
          </CardTitle>
          <CardDescription>
            Aggregated from real outcome records. Each metric carries a verified
            badge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogs.reputationMetrics.map((m) => {
              const value = (reputation as any)[m.key] as number
              const isPercent =
                m.key === 'successRate' ||
                m.key === 'outcomeRate' ||
                m.key === 'reliability' ||
                m.key === 'clientRetention' ||
                m.key === 'slaCompliance' ||
                m.key === 'humanInterventionRate'
              const display = isPercent
                ? `${Math.round(value * 100)}%`
                : value.toLocaleString()
              const isGood = !(
                m.key === 'responseTimeMins' ||
                m.key === 'humanInterventionRate' ||
                m.key === 'averageRating' ||
                m.key === 'experienceYears' ||
                m.key === 'certificationsCount' ||
                m.key === 'tasksCompleted'
              )
              // Good-direction 0..1 metrics are emerald when high.
              // For "bad-direction" or non-0..1 metrics we use muted.
              const color = isGood
                ? value >= 0.85
                  ? 'emerald'
                  : value >= 0.6
                    ? 'amber'
                    : 'rose'
                : 'muted'
              const c = colorClasses(color)
              return (
                <div
                  key={m.key}
                  className="flex flex-col gap-1 rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-medium">
                      {m.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        m.verified
                          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px]'
                          : 'text-[10px]'
                      }
                    >
                      {m.verified ? 'verified' : 'subjective'}
                    </Badge>
                  </div>
                  <div className={cn('text-2xl font-bold tabular-nums', c.text)}>
                    {display}
                  </div>
                  {isPercent && (
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={cn('h-full rounded-full', c.bar)}
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subjective reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4" />
            Subjective Reviews
          </CardTitle>
          <CardDescription>
            Ratings and testimonials are kept separate from verified outcome
            metrics — never aggregated into the same number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {reputation.subjectiveReviews.length === 0 && (
              <span className="text-muted-foreground text-sm">
                No subjective reviews yet.
              </span>
            )}
            {reputation.subjectiveReviews.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {r.author ?? 'Anonymous'}
                  </span>
                  {r.rating != null && (
                    <div className="flex items-center gap-1">
                      <Star className="fill-amber-400 text-amber-400 size-3.5" />
                      <span className="text-xs tabular-nums">{r.rating}/5</span>
                    </div>
                  )}
                </div>
                {r.text && (
                  <p className="text-muted-foreground mt-1 text-sm italic">
                    “{r.text}”
                  </p>
                )}
                {r.date && (
                  <span className="text-muted-foreground mt-1 block text-[10px]">
                    {new Date(r.date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="text-emerald-600 dark:text-emerald-400 size-4" />
            <span className="font-medium">{reputation.tasksCompleted}</span>
            <span className="text-muted-foreground text-xs">tasks completed</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="text-teal-600 dark:text-teal-400 size-4" />
            <span className="font-medium">{reputation.responseTimeMins} min</span>
            <span className="text-muted-foreground text-xs">response</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="text-violet-600 dark:text-violet-400 size-4" />
            <span className="font-medium">
              {Math.round(reputation.slaCompliance * 100)}%
            </span>
            <span className="text-muted-foreground text-xs">SLA compliance</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
