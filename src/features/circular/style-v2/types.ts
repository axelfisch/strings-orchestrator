import type { Arrangement, HarmonyFunction, Meter, NoteEvent, VoiceName } from "../types";

export const STYLE_V2_SCHEMA_VERSION = 1 as const;

export type EvidenceTier = "A" | "B" | "C";
export type CorpusRights = "owned" | "licensed" | "reference_only" | "unknown" | "excluded";
export type CorpusSplit = "train" | "validation" | "test" | "holdout";

export interface CorpusManifestEntry {
  schemaVersion: typeof STYLE_V2_SCHEMA_VERSION;
  sourceId: string;
  workId: string | null;
  variantId: string | null;
  sourceName: string;
  format: "midi" | "musicxml";
  sha256: string;
  bytes: number;
  rights: CorpusRights;
  included: boolean;
  exclusionReason?: string;
  split: CorpusSplit | null;
  composer?: string;
  arranger?: string;
  detected: {
    durationBeats: number;
    bars: number;
    meter: Meter;
    tempo: number;
    trackCount: number;
  };
  voiceMapping: VoiceMappingResult | null;
  extractorVersion: string;
  warnings: string[];
}

export interface VoiceMappingCandidate {
  voice: VoiceName;
  score: number;
  reasons: string[];
}

export interface TrackVoiceMapping {
  trackIndex: number;
  trackName: string;
  voice: VoiceName | null;
  confidence: number;
  candidates: VoiceMappingCandidate[];
  corrected: boolean;
}

export interface VoiceMappingResult {
  mappings: TrackVoiceMapping[];
  unmappedTracks: number[];
  warnings: string[];
}

export interface FragmentFeatureVector {
  density: number;
  restRatio: number;
  syncopation: number;
  stepwiseRatio: number;
  leapRatio: number;
  meanInterval: number;
  register: number;
  duration: number;
  voiceMask: number;
  harmonicRhythm: number;
  functionCode: number;
}

export interface FragmentNote {
  voice: VoiceName;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
}

export interface CorpusFragment {
  schemaVersion: typeof STYLE_V2_SCHEMA_VERSION;
  fragmentId: string;
  sourceId: string;
  workId: string;
  split: CorpusSplit;
  startBeat: number;
  durationBeats: number;
  meter: Meter;
  notes: FragmentNote[];
  harmonicFunction: HarmonyFunction;
  features: FragmentFeatureVector;
  evidence: EvidenceTier;
}

export interface PatternNote {
  voice: VoiceName;
  startRatio: number;
  durationRatio: number;
  relativePitch: number;
  velocityDelta: number;
}

export interface PatternIR {
  schemaVersion: typeof STYLE_V2_SCHEMA_VERSION;
  patternId: string;
  sourceFragmentId: string;
  sourceId: string;
  workId: string;
  split: CorpusSplit;
  spanBeats: number;
  anchorVoice: VoiceName;
  anchorMidi: number;
  harmonicFunction: HarmonyFunction;
  notes: PatternNote[];
  features: FragmentFeatureVector;
}

export interface FragmentIndex {
  schemaVersion: typeof STYLE_V2_SCHEMA_VERSION;
  indexId: string;
  createdAt: string;
  extractorVersion: string;
  patterns: PatternIR[];
}

export interface RetrievalQuery {
  features: FragmentFeatureVector;
  allowedVoices?: VoiceName[];
  harmonicFunction?: HarmonyFunction;
  excludedWorkIds?: string[];
  split?: CorpusSplit;
}

export interface SearchHit {
  pattern: PatternIR;
  distance: number;
  reasons: string[];
}

export interface TransformationTrace {
  id: string;
  parameters: Record<string, number | string | boolean>;
}

export interface ConstraintIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  voice?: VoiceName;
  bar?: number;
}

export interface ConstraintReport {
  valid: boolean;
  issues: ConstraintIssue[];
  parallels: number;
  crossings: number;
}

export interface CandidateScore {
  total: number;
  validity: number;
  harmony: number;
  voiceLeading: number;
  registerBalance: number;
  melodyAssignment: number;
  styleMatch: number;
  form: number;
  diversity: number;
  imitationPenalty: number;
  preferenceAdjustment: number;
}

export interface CandidateExplanation {
  engine: "v1" | "style-v2";
  summary: string;
  sourcePatternIds: string[];
  sourceWorkIds: string[];
  transformations: TransformationTrace[];
  constraints: ConstraintReport;
  score: CandidateScore;
}

export interface StyleCandidate {
  id: string;
  arrangement: Arrangement;
  explanation: CandidateExplanation;
}

export interface PreferenceRecord {
  schemaVersion: typeof STYLE_V2_SCHEMA_VERSION;
  id: string;
  createdAt: number;
  contextHash: string;
  candidateIds: string[];
  winnerId: string;
  winnerEngine: "v1" | "style-v2";
  transformationIds: string[];
  ratings?: {
    harmonicLegality?: number;
    playability?: number;
    fluidity?: number;
    axelSimilarity?: number;
    interest?: number;
    repetition?: number;
    melodicClarity?: number;
  };
  reasonTags?: string[];
  freeNote?: string;
}

export interface AxelStyleBlueprint {
  schema: "circular-strings-orchestrator.style-profile";
  version: 2;
  status: string;
  voices: VoiceName[];
  chordFamilies: string[];
  scales: string[];
  perPieceFeatures: string[];
  perBarFeatures: string[];
  perVoiceFeatures: string[];
  hardValidation: string[];
  scoringFormula: string;
  scoringWeightsStatus: string;
  feedbackReasonTags: string[];
}

export interface StyleEngineV2Result {
  arrangement: Arrangement;
  candidates: StyleCandidate[];
  selectedCandidateId: string;
  active: boolean;
  reason: string;
}

export interface CompiledPattern {
  notes: NoteEvent[];
  trace: TransformationTrace[];
}
