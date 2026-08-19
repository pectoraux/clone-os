// Clone OS — Fidelity Engine (N0.8)
//
// The frozen architecture requires the platform to compare Human vs Human's
// Clone on equivalent scenarios and produce a Divergence Report:
//   give human scenario → capture human answer → give clone same scenario →
//   normalize both → compare → score → produce divergence → store evidence
//
// STATUS: DATA MODEL + FIXTURES; ENGINE NOT IMPLEMENTED. The schema has
// FidelityDivergence records (seeded for the MVP) but there is no runtime
// that actually runs the clone against a scenario and computes divergence.
// This file defines the FidelityEngine interface so the runtime can be
// filled in without changing call sites.
//
// See HARDENING.md (N0.8) for the honest status.

import type { RoutingSignal } from '@/lib/runtime/model-provider'

export interface FidelityScenario {
  id: string
  title: string
  description: string
  domain: string
  difficulty: 'low' | 'medium' | 'high' | 'adversarial'
  // The structured prompt that goes to both human and clone
  prompt: string
  // Expected response dimensions
  expectedDimensions: string[]
}

export interface FidelityComparison {
  scenarioId: string
  scenario: string
  humanResponse: {
    decision: string
    reasoning: string
    actions: string[]
    communication: string
    priorities: string[]
    riskTolerance: number
    expectedOutcome: string
  }
  cloneResponse: {
    decision: string
    reasoning: string
    actions: string[]
    communication: string
    priorities: string[]
    riskTolerance: number
    expectedOutcome: string
  }
  divergence: {
    decision: number
    reasoning: number
    actions: number
    communication: number
    priorities: number
    riskTolerance: number
    ambiguityHandling: number
    expectedOutcome: number
  }
  agreementRate: number
  headline: string
  // Evidence (the actual responses, stored for audit)
  evidence: {
    humanResponseRaw: string
    cloneResponseRaw: string
    modelProvider: string
    modelLatencyMs: number
    computedAt: string
  }
}

export interface FidelityEngine {
  // Run a scenario against the clone and capture the response
  runCloneScenario(cloneId: string, scenario: FidelityScenario, signal?: RoutingSignal): Promise<{
    decision: string
    reasoning: string
    actions: string[]
    communication: string
    priorities: string[]
    riskTolerance: number
    expectedOutcome: string
    rawResponse: string
    modelProvider: string
    modelLatencyMs: number
  }>
  // Capture a human response to a scenario (via the UI / a review form)
  captureHumanResponse(scenarioId: string, response: FidelityComparison['humanResponse']): Promise<void>
  // Compare the human + clone responses and produce a divergence report
  compare(human: FidelityComparison['humanResponse'], clone: FidelityComparison['cloneResponse'], scenarioId: string): Promise<FidelityComparison>
  // Store the comparison as a FidelityDivergence record + emit evidence
  storeEvidence(cloneId: string, comparison: FidelityComparison): Promise<{ divergenceId: string }>
  // Recompute the CloneScore dimensions from recent divergence reports
  recomputeCloneScore(cloneId: string): Promise<{ dimensions: Record<string, number>; aggregate: number }>
}

// ---- Stub implementation ----
export class StubFidelityEngine implements FidelityEngine {
  async runCloneScenario(): Promise<any> {
    throw new Error('NOT_IMPLEMENTED: FidelityEngine.runCloneScenario — see HARDENING.md (N0.8)')
  }
  async captureHumanResponse(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: FidelityEngine.captureHumanResponse — see HARDENING.md (N0.8)')
  }
  async compare(): Promise<FidelityComparison> {
    throw new Error('NOT_IMPLEMENTED: FidelityEngine.compare — see HARDENING.md (N0.8)')
  }
  async storeEvidence(): Promise<{ divergenceId: string }> {
    throw new Error('NOT_IMPLEMENTED: FidelityEngine.storeEvidence — see HARDENING.md (N0.8)')
  }
  async recomputeCloneScore(): Promise<{ dimensions: Record<string, number>; aggregate: number }> {
    throw new Error('NOT_IMPLEMENTED: FidelityEngine.recomputeCloneScore — see HARDENING.md (N0.8)')
  }
}
