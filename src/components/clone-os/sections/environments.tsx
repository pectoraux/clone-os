'use client'

import * as React from 'react'
import { Building2, Database, Wrench, Boxes, Users, Server, Cpu, Shield } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneOSData, Environment } from '../types'
import {
  Callout,
  SectionHeading,
  Tag,
} from '../shared'

export function EnvironmentsSection({ data }: { data: CloneOSData }) {
  const { environments } = data
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Environments"
        description="A clone is not limited to one platform. It operates inside environments and reasons in terms of capabilities (ADR-0012)."
        icon={Building2}
      />

      <Callout tone="info" title="Capability over vendor">
        The clone reasons in terms of <strong>capabilities</strong>, not
        vendor-specific implementations. Environments declare what data, tools,
        extensions, people, systems, devices, rules, policies, and constraints are
        available. Long-term target: Sales, Restaurant, Hospital, Factory, Software
        Development, Home, Warehouse.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {environments.map((env) => (
          <EnvironmentCard key={env.id} env={env} />
        ))}
      </div>
    </div>
  )
}

function EnvironmentCard({ env }: { env: Environment }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{env.name}</CardTitle>
          <Tag color="violet">{env.kind}</Tag>
        </div>
        <CardDescription className="text-xs">{env.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-xs">
        <EnvList icon={Database} label="Available Data" items={env.availableData} color="teal" />
        <EnvList icon={Wrench} label="Available Tools" items={env.availableTools} color="amber" />
        <EnvList icon={Boxes} label="Available Extensions" items={env.availableExtensions} color="emerald" />
        <EnvList icon={Users} label="Available People" items={env.availablePeople} color="violet" />
        <EnvList icon={Server} label="Available Systems" items={env.availableSystems} color="teal" />
        <EnvList icon={Cpu} label="Available Devices" items={env.availableDevices} color="orange" />
        <EnvList icon={Shield} label="Rules" items={env.rules} color="muted" />
        <EnvList icon={Shield} label="Policies" items={env.policies} color="muted" />
        <EnvList icon={Shield} label="Constraints" items={env.constraints} color="rose" />
      </CardContent>
    </Card>
  )
}

function EnvList({
  icon: Icon,
  label,
  items,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  items: string[]
  color: string
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] font-medium">
            {it}
          </Badge>
        ))}
      </div>
    </div>
  )
}
