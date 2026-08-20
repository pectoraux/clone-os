'use client'

import * as React from 'react'
import { ScrollText, Layers, ShieldCheck, X, FileText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { CloneOSData } from '../types'
import {
  Callout,
  SectionHeading,
} from '../shared'

const ARCH_MODEL_DIAGRAM = `                         HUMAN
                           |
                 PROFESSIONAL IDENTITY
                           |
                         CLONE
       +-------------------+-------------------+
       v                   v                   v
   EXPERTISE           BEHAVIOR           PERSONALITY
       +-------------------+-------------------+
                           |
                     LEARNING SYSTEM
                           |
                    EVALUATION SYSTEM
                           |
                     CLONE SCORE
                           |
                     AGENT PACKAGES
              +------------+------------+
              v            v            v
          Environment   Environment   Environment
              |            |            |
          Extensions   Extensions   Extensions
              +------------+------------+
                           |
                    REAL-WORLD WORK
                           |
                       OUTCOMES
                           |
                       FEEDBACK -----> CLONE

Above:    MARKETPLACE -> Hiring / Licensing / Freelance -> ECONOMY
Below:    Identity, Security, Permissions, Provenance, Persistence,
          Events, Observability, Model Abstraction, Interoperability`

const ARCHITECTURAL_LAYERS = [
  'Identity',
  'Tenant / Organization',
  'Professional Identity',
  'Clone',
  'Expertise / Knowledge',
  'Learning',
  'Evaluation / Certification',
  'Agent Runtime',
  'Environment',
  'Extension / Tool',
  'Interoperability',
  'Marketplace / Economy',
  'Model Abstraction',
  'Persistence / Data',
  'Security / Governance',
]

const PRINCIPLES = [
  { num: 1, text: 'Clone over Agent' },
  { num: 2, text: 'User ownership over model ownership' },
  { num: 3, text: 'Capability over vendor' },
  { num: 4, text: 'Environment over platform' },
  { num: 5, text: 'Evidence over claims' },
  { num: 6, text: 'Outcome over benchmark' },
  { num: 7, text: 'Provenance everywhere' },
  { num: 8, text: 'Explicit permissions' },
  { num: 9, text: 'Version everything' },
  { num: 10, text: 'Portable by design' },
  { num: 11, text: 'Multi-tenant from the foundation' },
  { num: 12, text: 'Extension-first physical integration' },
]

const WHAT_NOT_TO_BUILD = [
  'a generic ChatGPT wrapper',
  'a prompt marketplace',
  'a simple RAG chatbot',
  'an LLM fine-tuning dashboard',
  'an AI agent marketplace where every agent is a prompt',
  'a monolithic Agent database object containing everything',
  'vendor-specific agent/memory/identity/training-history implementations',
  'an ecosystem locked to this platform',
  'uncontrolled autonomous tool execution',
]

const ADRS = [
  { id: 'ADR-0001', title: 'Clone as the Primary Asset', summary: 'Clone is first-class; Agent is a runtime manifestation. Never collapse them.' },
  { id: 'ADR-0002', title: 'Model Abstraction Layer', summary: 'ModelProvider interface + ModelRouter. No vendor SDKs in domain code.' },
  { id: 'ADR-0003', title: 'Data Ownership & Provenance', summary: 'Every artifact carries provenance. Data boundary is representable even if legal policy is configured later.' },
  { id: 'ADR-0004', title: 'Multi-Tenancy from the Foundation', summary: 'Tenant is the root of the data graph. Tenant filtering is NOT merely a UI concern.' },
  { id: 'ADR-0005', title: 'Package-Oriented Architecture', summary: 'Packages are the universal distribution primitive. 11 package types.' },
  { id: 'ADR-0006', title: 'Agent Portability & Interoperability Protocol', summary: 'Agents must not be trapped inside this platform.' },
  { id: 'ADR-0007', title: 'Extension Architecture (Capability-Based)', summary: 'Capability-based extensions; never tightly coupled to vendor concrete systems.' },
  { id: 'ADR-0008', title: 'Capability-Based Permissions & Autonomy Levels', summary: 'Autonomy levels 0–5; high-risk capabilities require explicit approval.' },
  { id: 'ADR-0009', title: 'Clone Evaluation & Fidelity', summary: 'Multidimensional Clone Score; Fidelity Engine compares Human vs Clone.' },
  { id: 'ADR-0010', title: 'Versioning Everything Important', summary: 'Silently mutating production intelligence is unacceptable. Rollback supported.' },
  { id: 'ADR-0011', title: 'Marketplace Outcome Contracts', summary: 'Intent-based hiring; Outcome Contracts specify SLA, budget, permissions.' },
  { id: 'ADR-0012', title: 'Environment Abstraction', summary: 'Environment is first-class. Clones reason in capabilities, not vendors.' },
  { id: 'ADR-0013', title: 'Real-Time Clone Conversation via Socket.io Mini-Service', summary: 'LLM SDK confined to backend; the clone state is loaded each session.' },
  { id: 'ADR-0014', title: 'Single Comprehensive Dashboard Route', summary: 'All sections reachable from /; the dashboard is the user-facing proof.' },
]

export function ArchitectureSection({ data: _data }: { data: CloneOSData }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Architecture"
        description="The frozen architectural constitution of the platform. Subsystems may evolve; the core primitives, layering, and design principles must not be silently violated."
        icon={ScrollText}
      />

      <Callout tone="warning" title="If a proposed implementation contradicts this architecture, stop and identify the conflict before coding.">
        This dashboard demonstrates the <strong>complete loop</strong> end-to-end on
        one deep vertical (Sales / Revenue Operations, anchored on the Sarah example
        from the spec). Every section maps to a frozen architectural principle.
      </Callout>

      <Tabs defaultValue="diagram">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="diagram">
            <Layers className="size-3.5" />
            Model
          </TabsTrigger>
          <TabsTrigger value="layers">
            <Layers className="size-3.5" />
            15 Layers
          </TabsTrigger>
          <TabsTrigger value="principles">
            <ShieldCheck className="size-3.5" />
            12 Principles
          </TabsTrigger>
          <TabsTrigger value="adrs">
            <FileText className="size-3.5" />
            14 ADRs
          </TabsTrigger>
          <TabsTrigger value="dont">
            <X className="size-3.5" />
            What NOT to build
          </TabsTrigger>
        </TabsList>

        {/* Diagram */}
        <TabsContent value="diagram">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final Architectural Model</CardTitle>
              <CardDescription>
                Human → Professional Identity → Clone → Agents → Environments →
                Extensions → Real-World Work → Outcomes → Feedback → Clone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs leading-tight font-mono">
                {ARCH_MODEL_DIAGRAM}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layers */}
        <TabsContent value="layers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">15 Architectural Layers</CardTitle>
              <CardDescription>
                Boundaries are explicit. Each layer has its own service(s) and
                persistence semantics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1.5">
                {ARCHITECTURAL_LAYERS.map((l, i) => (
                  <li
                    key={l}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{l}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Principles */}
        <TabsContent value="principles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">12 Non-Negotiable Design Principles</CardTitle>
              <CardDescription>
                These are the design rules the architecture will not silently
                violate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRINCIPLES.map((p) => (
                  <div
                    key={p.num}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {p.num}
                    </span>
                    <span className="text-sm">{p.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADRs */}
        <TabsContent value="adrs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">14 Architecture Decision Records</CardTitle>
              <CardDescription>
                Accepted ADRs. Conflicts with the architecture require a new ADR —
                not silent code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {ADRS.map((adr) => (
                  <div
                    key={adr.id}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {adr.id}
                      </Badge>
                      <span className="text-sm font-semibold">{adr.title}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {adr.summary}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* What NOT to build */}
        <TabsContent value="dont">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What NOT to Build</CardTitle>
              <CardDescription>
                If a proposed implementation matches anything on this list, the
                conflict must be identified before coding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {WHAT_NOT_TO_BUILD.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm"
                  >
                    <X className="text-rose-600 dark:text-rose-400 mt-0.5 size-3.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Callout tone="neutral" title="Frozen architecture; incremental implementation">
        The architecture is frozen; the implementation is incremental. Phases:
        Foundation → Clone Core → Learning Studio → Agent Runtime → Evaluation →
        Extensions → Marketplace → Enterprise → Portability → Physical World.
      </Callout>

      <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
        <FileText className="size-3.5" />
        Full docs at <code className="font-mono">/docs/ARCHITECTURE.md</code> and{' '}
        <code className="font-mono">/docs/adr/README.md</code>
      </div>
    </div>
  )
}
