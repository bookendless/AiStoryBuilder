export type NarrativeField = 'location' | 'goal' | 'relationships' | 'knowledge' | 'possessions' | 'condition';
export type NarrativeDecision = 'pending' | 'accept' | 'reject';
export interface NarrativeSource {
  kind: 'text' | 'author';
  chapterId: string;
  draftHash: string;
  quote: string;
  start: number;
  end: number;
  reason?: string;
  /** Ambiguous quotation locations require an explicit selection. */
  alternatives?: number[];
}
export interface NarrativeValue {
  id: string;
  text: string;
  knowledge?: 'known' | 'believed' | 'explicitlyUnknown';
  relatedCharacterId?: string;
  source: NarrativeSource;
}
export interface NarrativeItem {
  id: string;
  source: NarrativeSource;
  warnings: string[];
}
export interface CharacterChange extends NarrativeItem {
  characterId: string;
  characterName?: string;
  field: NarrativeField;
  operation: 'set' | 'clear';
  values: NarrativeValue[];
}
export interface PastEvent extends NarrativeItem {
  description: string;
  characterIds: string[];
  storyTime?: string;
}
export interface NarrativeRequirement extends NarrativeItem {
  description: string;
  kind: 'clue' | 'question' | 'promise' | 'confrontation' | 'other';
  characterIds: string[];
  plannedChapterId?: string;
  foreshadowingId?: string;
  status: 'open' | 'resolved' | 'deferred' | 'dropped';
  resolution?: NarrativeSource;
}
export interface RequirementTransition extends NarrativeItem {
  requirementId: string;
  status: NarrativeRequirement['status'];
  reason?: string;
}
export interface NarrativeDelta {
  characterChanges: CharacterChange[];
  addEvents: PastEvent[];
  addRequirements: NarrativeRequirement[];
  transitionRequirements: RequirementTransition[];
}
export interface ChapterNarrativeRecord {
  chapterId: string;
  revision: number;
  proposalId: string;
  draftHash: string;
  basis: string;
  delta: NarrativeDelta;
  acceptedAt: string;
}
export interface NarrativeProposal {
  id: string;
  projectId: string;
  chapterId: string;
  draftHash: string;
  basis: string;
  dependency: string;
  delta: NarrativeDelta;
  decisions: Record<string, NarrativeDecision>;
  createdAt: string;
  warnings?: string[];
}
export interface NarrativeExtractionJob {
  chapterId: string;
  signature: string;
  chunks: Array<{ start: number; end: number; delta?: NarrativeDelta }>;
  status: 'running' | 'paused' | 'error' | 'completed';
  error?: string;
  finished: number;
  warnings?: string[];
}
export interface NarrativeMemory {
  schemaVersion: 1;
  enabled: boolean;
  revision: number;
  records: ChapterNarrativeRecord[];
  proposals: NarrativeProposal[];
  jobs: NarrativeExtractionJob[];
}
export interface NarrativeState {
  characters: Record<string, Partial<Record<NarrativeField, NarrativeValue[]>>>;
  events: PastEvent[];
  requirements: NarrativeRequirement[];
}
