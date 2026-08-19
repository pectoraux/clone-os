'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit, Activity, Target, Network, Sparkles, FlaskConical, GitBranch, Cpu,
  Layers, Globe, Plug, Store, FileText, ShieldCheck, MessageSquare, BookOpen,
  Sun, Moon, Menu, X, ChevronRight, Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { CloneOsProvider, useCloneOs } from '@/components/clone-os/data'
import {
  OverviewSection, CloneScoreSection, ExpertiseGraphSection, TrainingStudioSection,
  FidelityLabSection, VersionsSection, AgentsSection, ModelRouterSection,
  EnvironmentsSection, ExtensionsSection, MarketplaceSection, OutcomeContractsSection,
  ReputationSection, LiveChatSection, ArchitectureSection,
} from '@/components/clone-os/sections/sections'

type SectionId =
  | 'overview' | 'score' | 'graph' | 'training' | 'fidelity' | 'versions'
  | 'agents' | 'router' | 'environments' | 'extensions' | 'marketplace'
  | 'contracts' | 'reputation' | 'chat' | 'architecture'

interface NavItem {
  id: SectionId
  label: string
  icon: React.ReactNode
  layer: string
}

const NAV: NavItem[] = [
  { id: 'overview',     label: 'Overview',           icon: <Activity className="h-4 w-4" />,        layer: 'L4 Clone' },
  { id: 'score',        label: 'Clone Score',         icon: <Target className="h-4 w-4" />,          layer: 'L7 Eval' },
  { id: 'graph',        label: 'Expertise Graph',    icon: <Network className="h-4 w-4" />,         layer: 'L5 Expertise' },
  { id: 'training',     label: 'Training Studio',    icon: <Sparkles className="h-4 w-4" />,       layer: 'L6 Learning' },
  { id: 'fidelity',     label: 'Fidelity Lab',        icon: <FlaskConical className="h-4 w-4" />,    layer: 'L7 Eval' },
  { id: 'versions',     label: 'Versions',             icon: <GitBranch className="h-4 w-4" />,       layer: 'L4 Clone' },
  { id: 'agents',       label: 'Agents',              icon: <Cpu className="h-4 w-4" />,             layer: 'L8 Runtime' },
  { id: 'router',       label: 'Model Router',        icon: <Layers className="h-4 w-4" />,          layer: 'L13 Model' },
  { id: 'environments', label: 'Environments',         icon: <Globe className="h-4 w-4" />,           layer: 'L9 Environment' },
  { id: 'extensions',   label: 'Extensions',           icon: <Plug className="h-4 w-4" />,            layer: 'L10 Extension' },
  { id: 'marketplace',  label: 'Marketplace',          icon: <Store className="h-4 w-4" />,           layer: 'L12 Market' },
  { id: 'contracts',    label: 'Outcome Contracts',    icon: <FileText className="h-4 w-4" />,        layer: 'L12 Market' },
  { id: 'reputation',   label: 'Reputation',           icon: <ShieldCheck className="h-4 w-4" />,    layer: 'L12 Market' },
  { id: 'chat',         label: 'Live Chat',            icon: <MessageSquare className="h-4 w-4" />,    layer: 'L8 Runtime' },
  { id: 'architecture', label: 'Architecture',         icon: <BookOpen className="h-4 w-4" />,        layer: 'L15 Governance' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-9 w-9" />
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="h-9 w-9"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
        <BrainCircuit className="h-5 w-5" />
      </div>
      <div className="leading-none">
        <div className="font-semibold text-sm tracking-tight">Clone OS</div>
        <div className="text-[10px] text-muted-foreground">Operating system for portable professional clones</div>
      </div>
    </div>
  )
}

function CloneBadge() {
  const { data } = useCloneOs()
  if (!data) return null
  const { clone, tenant } = data
  return (
    <div className="hidden md:flex items-center gap-3 text-xs">
      <div className="flex flex-col leading-tight">
        <span className="text-muted-foreground">Tenant</span>
        <span className="font-medium">{tenant.name}</span>
      </div>
      <div className="w-px h-8 bg-border" />
      <div className="flex flex-col leading-tight">
        <span className="text-muted-foreground">Active clone</span>
        <span className="font-medium">{clone.name} <span className="text-muted-foreground">· v{clone.currentVersion?.version}</span></span>
      </div>
      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[10px] capitalize">
        {clone.certificationLevel.replace(/_/g, ' ')}
      </Badge>
    </div>
  )
}

function NavList({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            active === item.id
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 font-medium'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className={active === item.id ? 'text-emerald-600' : ''}>{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <span className="text-[10px] text-muted-foreground/70 font-mono">{item.layer}</span>
          {active === item.id && <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />}
        </button>
      ))}
    </nav>
  )
}

function ActiveSection({ id }: { id: SectionId }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {id === 'overview' && <OverviewSection />}
        {id === 'score' && <CloneScoreSection />}
        {id === 'graph' && <ExpertiseGraphSection />}
        {id === 'training' && <TrainingStudioSection />}
        {id === 'fidelity' && <FidelityLabSection />}
        {id === 'versions' && <VersionsSection />}
        {id === 'agents' && <AgentsSection />}
        {id === 'router' && <ModelRouterSection />}
        {id === 'environments' && <EnvironmentsSection />}
        {id === 'extensions' && <ExtensionsSection />}
        {id === 'marketplace' && <MarketplaceSection />}
        {id === 'contracts' && <OutcomeContractsSection />}
        {id === 'reputation' && <ReputationSection />}
        {id === 'chat' && <LiveChatSection />}
        {id === 'architecture' && <ArchitectureSection />}
      </motion.div>
    </AnimatePresence>
  )
}

function Dashboard() {
  const [active, setActive] = React.useState<SectionId>('overview')
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Mobile nav trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden h-9 w-9" aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mb-4"><BrandMark /></div>
              <NavList
                active={active}
                onSelect={(id) => { setActive(id); setMobileOpen(false) }}
              />
            </SheetContent>
          </Sheet>

          <BrandMark />
          <div className="flex-1" />
          <CloneBadge />
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-9"
            onClick={() => toast.info('Architecture documentation', { description: 'docs/ARCHITECTURE.md · docs/adr/README.md' })}
          >
            <BookOpen className="h-4 w-4 mr-2" /> Docs
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Body: nav rail + main */}
      <div className="flex-1 flex">
        {/* Desktop nav rail */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-background/60">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
            <NavList active={active} onSelect={setActive} />
            <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5 mb-1 font-medium text-foreground">
                <Database className="h-3 w-3" /> Multi-tenant
              </div>
              Tenant boundaries are architectural, not UI features (ADR-0004). Every record is scoped by tenantId.
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <ActiveSection id={active} />
          </div>
        </main>
      </div>

      {/* Footer — sticky when short, pushed when long */}
      <footer className="mt-auto border-t bg-background/95">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <div className="max-w-xl">
              <span className="font-medium text-foreground">Clone OS</span> — Open, multi-tenant operating system for creating, training, evaluating, deploying, transporting, and monetizing portable digital clones of people's professional selves.
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">14 ADRs</Badge>
              <Badge variant="outline" className="text-[10px]">15 layers</Badge>
              <Badge variant="outline" className="text-[10px]">12 principles</Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function Page() {
  return (
    <CloneOsProvider>
      <Dashboard />
    </CloneOsProvider>
  )
}
