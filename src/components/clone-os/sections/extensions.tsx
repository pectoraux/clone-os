'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Boxes, Download, Upload, Shield, AlertTriangle, Cpu, Lock, Wrench } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { CloneOSData, ExtensionToggleResponse } from '../types'
import {
  Callout,
  CapabilityBadge,
  CertBadge,
  Field,
  RiskPill,
  ScrollList,
  SectionHeading,
  useCapabilityLookup,
} from '../shared'

export function ExtensionsSection({ data }: { data: CloneOSData }) {
  const { extensions, catalogs } = data
  const queryClient = useQueryClient()
  const lookup = useCapabilityLookup(catalogs)

  const toggleMutation = useMutation({
    mutationFn: async ({
      extensionId,
      action,
    }: {
      extensionId: string
      action: 'install' | 'uninstall'
    }) => {
      const r = await fetch('/api/clone-os/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId, action }),
      })
      if (!r.ok) throw new Error('Extension action failed')
      return r.json() as Promise<ExtensionToggleResponse>
    },
    onSuccess: (res, vars) => {
      toast.success(`${vars.action === 'install' ? 'Installed' : 'Uninstalled'} successfully`, {
        description: `Extension ${res.extensionId} is now ${res.installed ? 'installed' : 'removed'}`,
      })
      queryClient.invalidateQueries({ queryKey: ['clone-os'] })
    },
    onError: (err) => {
      toast.error('Extension action failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  const highRisk = catalogs.capabilities.filter(
    (c) => c.risk === 'high' || c.risk === 'critical',
  )
  const lowRisk = catalogs.capabilities.filter(
    (c) => c.risk !== 'high' && c.risk !== 'critical',
  )

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Extensions"
        description="Capability-based extensions (ADR-0007, ADR-0027). Agents consume abstract capabilities — never tightly coupled to vendor concrete systems."
        icon={Boxes}
      />

      <Callout tone="warning" title="A malicious extension must NOT silently escalate">
        Capability declarations, permissions, sandboxing, authentication,
        authorization, audit logs, rate limits, resource limits, certification, trust
        levels, versioning, revocation. <strong>A malicious extension must NOT
        silently escalate from <code>READ_CAMERA</code> to <code>CONTROL_ROBOT</code>{' '}
        or <code>TRANSFER_MONEY</code>.</strong>
      </Callout>

      <Tabs defaultValue="extensions">
        <TabsList>
          <TabsTrigger value="extensions">Extensions ({extensions.length})</TabsTrigger>
          <TabsTrigger value="catalog">Capability Catalog ({catalogs.capabilities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="extensions" className="flex flex-col gap-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {extensions.map((ext) => {
              const runtime = ext.runtimeRequirements as Record<string, unknown>
              const security = ext.securityRequirements as Record<string, unknown>
              const hardware = ext.hardwareRequirements as Record<string, unknown>
              const pricing = ext.pricing as {
                perCall?: number
                mode?: string
                amountCents?: number
              }
              return (
                <Card key={ext.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-base">{ext.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {ext.description}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          v{ext.version}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            ext.installed
                              ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px]'
                              : 'text-[10px]'
                          }
                        >
                          {ext.installed ? 'installed' : 'not installed'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CertBadge level={ext.certification} />
                      <Badge variant="secondary" className="text-[10px]">
                        trust: {ext.trustLevel}
                      </Badge>
                      {pricing?.perCall != null && (
                        <Badge variant="outline" className="text-[10px]">
                          {`$${pricing.perCall}/call`}
                        </Badge>
                      )}
                      {pricing?.mode && (
                        <Badge variant="outline" className="text-[10px]">
                          {pricing.mode}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <Field label="Capabilities">
                      <div className="flex flex-wrap gap-1.5">
                        {ext.capabilities.map((cap) => {
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

                    <div className="grid gap-2 sm:grid-cols-3 text-[10px]">
                      <ReqBlock
                        icon={Cpu}
                        label="Runtime"
                        data={runtime}
                      />
                      <ReqBlock
                        icon={Lock}
                        label="Security"
                        data={security}
                      />
                      <ReqBlock
                        icon={Wrench}
                        label="Hardware"
                        data={hardware}
                      />
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={ext.installed ? 'outline' : 'default'}
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            extensionId: ext.id,
                            action: ext.installed ? 'uninstall' : 'install',
                          })
                        }
                      >
                        {ext.installed ? (
                          <>
                            <Upload className="size-3.5" />
                            Uninstall
                          </>
                        ) : (
                          <>
                            <Download className="size-3.5" />
                            Install
                          </>
                        )}
                      </Button>
                      {ext.events.length > 0 && (
                        <span className="text-muted-foreground text-[10px]">
                          {ext.events.length} events
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="flex flex-col gap-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4" />
                21-Capability Catalog
              </CardTitle>
              <CardDescription>
                Vendors are interchangeable; capabilities are not. High/critical
                capabilities require explicit approval policies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                    <AlertTriangle className="text-rose-600 dark:text-rose-400 size-3.5" />
                    High / Critical Risk (require approval)
                  </div>
                  <ScrollList className="max-h-72">
                    <div className="flex flex-col gap-1.5">
                      {highRisk.map((cap) => (
                        <div
                          key={cap.id}
                          className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {cap.id}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {cap.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {cap.category}
                            </Badge>
                            <RiskPill risk={cap.risk} />
                            {cap.requiresApproval && (
                              <Badge
                                variant="outline"
                                className="border-rose-500/40 text-rose-700 dark:text-rose-300 text-[10px]"
                              >
                                approval req.
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollList>
                </div>
                <div>
                  <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                    <Shield className="size-3.5" />
                    Low / Medium Risk
                  </div>
                  <ScrollList className="max-h-72">
                    <div className="flex flex-col gap-1.5">
                      {lowRisk.map((cap) => (
                        <div
                          key={cap.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {cap.id}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {cap.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {cap.category}
                            </Badge>
                            <RiskPill risk={cap.risk} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollList>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReqBlock({
  icon: Icon,
  label,
  data,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  data: Record<string, unknown>
}) {
  return (
    <div className="rounded-lg border border-border/60 p-2">
      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
        <Icon className="size-3" />
        {label}
      </div>
      <pre className="overflow-x-auto text-[9px] leading-tight">
        {Object.keys(data).length === 0
          ? '—'
          : JSON.stringify(data, null, 0).slice(0, 80) + (JSON.stringify(data).length > 80 ? '…' : '')}
      </pre>
    </div>
  )
}
