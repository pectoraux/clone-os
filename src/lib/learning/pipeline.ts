// Clone OS — Learning Pipeline (N0.7)
//
// The frozen architecture requires:
//   User teaches → Observation → Raw interaction → Structured extraction →
//   Candidate knowledge/procedure/preference → Human confirmation →
//   Persisted learning artifact → Evaluation
//
// STATUS: PROTOTYPE / SIMULATED. The current training endpoint records a
// TrainingSession and emits events, but the "output" is canned. This file
// defines the real LearningEvent interface so the runtime can be filled in
// without changing call sites.
//
// See HARDENING.md (N0.7) for the honest status.

export type LearningEventKind =
  | 'teach'           // user explains how they do something
  | 'demonstrate'     // user performs a task; clone observes
  | 'correct'         // clone attempts; user corrects
  | 'shadow'          // clone observes user performing work
  | 'assisted'        // clone proposes; user approves
  | 'delegated'       // clone performs under predefined policies
  | 'simulation'      // system generates scenarios
  | 'adversarial'     // edge cases, ambiguity, failure modes
  | 'real_world'      // system observes actual outcomes

export interface LearningEvent {
  id: string
  kind: LearningEventKind
  // The raw interaction captured (text, transcript, action sequence, etc.)
  rawInteraction: {
    type: 'text' | 'transcript' | 'actions' | 'screen_recording' | 'audio'
    content: string
    capturedAt: string
  }
  // Structured extraction (the candidate artifact)
  candidateArtifact?: {
    type: 'knowledge' | 'procedure' | 'preference' | 'skill' | 'behavior' | 'policy'
    name: string
    content: string
    // Confidence 0..1 (how sure the extraction is)
    confidence: number
    // Skills/knowledge this artifact references
    references?: string[]
  }
  // Human confirmation state
  confirmation?: {
    state: 'pending' | 'confirmed' | 'rejected' | 'modified'
    confirmedBy?: string
    confirmedAt?: string
    modifications?: string
  }
  // The persisted learning artifact (after confirmation)
  persistedArtifactId?: string
  // Link to the evaluation that validated this learning
  evaluationId?: string
  // Provenance (ADR-0003)
  provenance: {
    owner: string
    source: string
    portability: string
    sensitivity: string
  }
}

export interface LearningPipeline {
  // Capture a raw interaction (from chat, from a demonstration, from shadowing)
  capture(input: CaptureInput): Promise<LearningEvent>
  // Extract a candidate artifact from a captured interaction
  extract(eventId: string): Promise<LearningEvent>
  // Request human confirmation of a candidate artifact
  requestConfirmation(eventId: string): Promise<{ approvalRequestId: string }>
  // Confirm (or modify-and-confirm) a candidate artifact
  confirm(eventId: string, confirmation: LearningEvent['confirmation']): Promise<LearningEvent>
  // Persist the confirmed artifact as a real Knowledge / Memory / Skill /
  // Workflow / Policy / Behavior record on the clone (creates a new
  // CloneVersionCandidate — see N0.9)
  persist(eventId: string): Promise<{ cloneVersionCandidateId: string }>
}

export interface CaptureInput {
  cloneId: string
  principalId: string
  kind: LearningEventKind
  rawInteraction: LearningEvent['rawInteraction']
}

// ---- Stub implementation ----
// The real pipeline is NOT implemented yet. This stub exists to make the
// interface real and to document what the future runtime will do.
export class StubLearningPipeline implements LearningPipeline {
  async capture(_input: CaptureInput): Promise<LearningEvent> {
    throw new Error('NOT_IMPLEMENTED: LearningPipeline.capture — see HARDENING.md (N0.7)')
  }
  async extract(_eventId: string): Promise<LearningEvent> {
    throw new Error('NOT_IMPLEMENTED: LearningPipeline.extract — see HARDENING.md (N0.7)')
  }
  async requestConfirmation(_eventId: string): Promise<{ approvalRequestId: string }> {
    throw new Error('NOT_IMPLEMENTED: LearningPipeline.requestConfirmation — see HARDENING.md (N0.7)')
  }
  async confirm(_eventId: string, _confirmation: LearningEvent['confirmation']): Promise<LearningEvent> {
    throw new Error('NOT_IMPLEMENTED: LearningPipeline.confirm — see HARDENING.md (N0.7)')
  }
  async persist(_eventId: string): Promise<{ cloneVersionCandidateId: string }> {
    throw new Error('NOT_IMPLEMENTED: LearningPipeline.persist — see HARDENING.md (N0.7)')
  }
}
