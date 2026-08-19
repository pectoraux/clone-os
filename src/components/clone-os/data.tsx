'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Types — mirror the API contract in /api/clone-os/route.ts
// ---------------------------------------------------------------------------
export interface CloneOsState {
  tenant: { id: string; kind: string; name: string; slug: string }
  clone: {
    id: string
    slug: string
    name: string
    summary: string
    domain: string
    status: string
    visibility: string
    certificationLevel: string
    aggregateScore: number | null
    createdAt: string
    updatedAt: string
    persona: Record<string, any>
    personality: Record<string, any>
    preferences: Record<string, any>
    behavior: Record<string, any>
    professionalIdentity: {
      title: string
      domain: string
      bio: string
      values: string[]
      culture: Record<string, any>
      user: { name: string; email: string; publicKey: string | null } | null
    } | null
    currentVersion: {
      version: string
      changeSet: string[]
      trainingInputs: Record<string, any>
      evaluationResults: Record<string, any>
      performanceImpact: number | null
      dependencies: Record<string, any>
      provenance: Record<string, any>
      releasedAt: string
      author: string
    } | null
  }
  versions: any[]
  expertise: any[]
  skills: any[]
  knowledge: any[]
  experiences: any[]
  memories: any[]
  workflows: any[]
  policies: any[]
  trainingSessions: any[]
  evaluations: any[]
  score: {
    dimensions: { key: string; label: string; description: string; value: number }[]
    aggregate: number
    notes: string | null
    computedAt: string
  } | null
  divergences: any[]
  certifications: any[]
  agents: any[]
  environments: any[]
  extensions: any[]
  tools: any[]
  contracts: any[]
  outcomes: any[]
  reputation: any
  license: any[]
  marketplace: any[]
  events: any[]
  auditLogs: any[]
  catalogs: {
    scoreDimensions: any[]
    fidelityDimensions: any[]
    autonomyLevels: any[]
    capabilities: any[]
    modelProviders: any[]
    routingRules: Record<string, string>
    trainingLoop: any[]
    trainingModes: any[]
    domainEvents: any[]
    certificationLevels: any[]
    packageTypes: any[]
    sourceKinds: any[]
    nodeTypes: any[]
    edgeTypes: any[]
    hiringModes: any[]
    reputationMetrics: any[]
  }
}

// ---------------------------------------------------------------------------
// QueryClient singleton
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function CloneOsProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useCloneOs() {
  return useQuery<CloneOsState>({
    queryKey: ['clone-os'],
    queryFn: async () => {
      const res = await fetch('/api/clone-os')
      if (!res.ok) throw new Error(`Failed to load clone state (${res.status})`)
      return res.json() as Promise<CloneOsState>
    },
  })
}

export function useTrainSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { cloneId: string; mode: string; stage?: string; input?: Record<string, unknown>; ownerId?: string; tenantId?: string }) => {
      const res = await fetch('/api/clone-os/train', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) throw new Error(`Training failed (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clone-os'] })
    },
  })
}

export function useMarketplaceMatch() {
  return useMutation({
    mutationFn: async (vars: { intent: string }) => {
      const res = await fetch('/api/clone-os/marketplace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) throw new Error(`Match failed (${res.status})`)
      return res.json()
    },
  })
}

export function useExtensionInstall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { extensionId: string; action: 'install' | 'uninstall' }) => {
      const res = await fetch('/api/clone-os/extensions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) throw new Error(`Extension action failed (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clone-os'] })
    },
  })
}
