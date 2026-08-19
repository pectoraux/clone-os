'use client'

import * as React from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'
import type { CloneOSData } from '../types'
import {
  Callout,
  DimensionBar,
  ScoreBandBadge,
  SectionHeading,
} from '../shared'

export function CloneScoreSection({ data }: { data: CloneOSData }) {
  const { score, clone } = data

  if (!score) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title="Clone Score" icon={Target} />
        <Callout tone="warning" title="No score computed yet">
          The clone has not been evaluated. Run an evaluation in the Training Studio
          or Fidelity Lab.
        </Callout>
      </div>
    )
  }

  const chartData = score.dimensions.map((d) => ({
    dimension: d.label.replace(' Fidelity', ''),
    value: d.value,
  }))

  const aggregate = clone.aggregateScore
  const band =
    aggregate >= 90
      ? 'Faithful'
      : aggregate >= 75
        ? 'Strong'
        : aggregate >= 60
          ? 'Developing'
          : aggregate >= 40
            ? 'Early'
            : 'Untrained'

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Clone Score"
        description="Multidimensional — the public aggregate is just a UI hint. The system preserves all 9 dimensions internally (ADR-0009)."
        icon={Target}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Aggregate */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Public Aggregate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <div className="text-6xl font-bold tabular-nums">
              {aggregate.toFixed(1)}
            </div>
            <ScoreBandBadge score={aggregate} />
            <p className="text-muted-foreground text-xs">
              Band: <span className="font-medium text-foreground">{band}</span>
            </p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Computed at{' '}
              {new Date(score.computedAt).toLocaleString()}. Weighted average —
              decision & outcome fidelity weigh heaviest.
            </p>
          </CardContent>
        </Card>

        {/* Radar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Multidimensional Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="78%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{
                      fill: 'var(--muted-foreground)',
                      fontSize: 11,
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="value"
                    stroke="oklch(0.6 0.13 165)"
                    fill="oklch(0.6 0.13 165)"
                    fillOpacity={0.35}
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: 'oklch(0.6 0.13 165)',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Callout tone="info" title="The dimensions are the truth; the aggregate is a UI hint">
        Reducing the clone to a single number is a presentation choice. Internally,
        the system preserves <strong>all 9 dimensions</strong> — only by tracking
        them separately can we tell whether a regression is in{' '}
        <strong>decision fidelity</strong> vs <strong>communication fidelity</strong>,
        for example.
      </Callout>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Dimension Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {score.dimensions.map((d, i) => {
              const color =
                d.value >= 90
                  ? 'emerald'
                  : d.value >= 75
                    ? 'teal'
                    : d.value >= 60
                      ? 'amber'
                      : d.value >= 40
                        ? 'orange'
                        : 'rose'
              return (
                <DimensionBar
                  key={d.key}
                  label={d.label}
                  value={d.value}
                  description={d.description}
                  color={color}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {score.notes && (
        <Callout tone="neutral" title="Evaluator notes">
          {score.notes}
        </Callout>
      )}
    </div>
  )
}
