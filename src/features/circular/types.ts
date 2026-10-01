export const SCHEMA_VERSION = 2 as const;

export const VOICES = ["Violin I", "Violin II", "Viola I", "Viola II", "Cello", "Contrabass"] as const;
export type VoiceName = (typeof VOICES)[number];

export const VOICE_LABELS: Record<VoiceName, string> = {
  "Violin I": "Violon I",
  "Violin II": "Violon II",
  "Viola I": "Alto I",
  "Viola II": "Alto II",
  Cello: "Violoncelle",
  Contrabass: "Contrebasse",
};

export const METERS = ["4/4", "3/4", "6/8"] as const;
export type Meter = (typeof METERS)[number];

export const STYLES = [
  "ECM Ballad",
  "Jazz Waltz",
  "Rain of Notes",
  "Pop-Jazz Drive",
  "Lilting 6/8",
  "Distanced Perspectives",
] as const;
export type StyleName = (typeof STYLES)[number];

export const GENRES = [
  "Bossa Nova",
  "Jazz Fusion",
  "Waltz Jazz",
  "Lo-fi Chill",
  "Cinematic Strings",
  "Modern Pop-Jazz",
  "Swing Mid-tempo",
  "Afro 6/8",
  "Soul / R&B Slow",
  "Funk Ballad",
  "Ballad Jazz",
] as const;

export type SectionId = "A1" | "A2" | "B" | "A3";
export type Origin = "generated" | "manual" | "imported" | "empty";
export type HarmonyLanguage = "pop-soft" | "chamber" | "automatic" | "custom";
export type HarmonyFunction = "approach" | "tension" | "resolution" | "color" | "unknown";
export type MelodyMode = "canonical" | "controlled" | "manual" | "preserve-import";
export type RegisterMode = "low" | "medium" | "high" | "custom";
export type VoiceRole = "melody" | "counterline" | "harmony" | "inner" | "foundation" | "rest";
export type DynamicMark = "pp" | "p" | "mp" | "mf" | "f";
export type Articulation = "legato" | "tenuto" | "staccato" | "accent" | "none";

export interface NoteEvent {
  voice: VoiceName;
  midi: number;
  /** Quarter-note offset from the downbeat of the piece. */
  start: number;
  /** Duration in quarter notes. */
  duration: number;
  velocity: number;
  bar: number;
  role?: VoiceRole;
  articulation?: Articulation;
  dynamic?: DynamicMark;
  source?: Origin;
  sourceTrack?: number;
}

export interface HarmonyCandidate {
  symbol: string;
  confidence: number;
}

export interface HarmonyEvent {
  symbol: string;
  /** Quarter-note position inside the bar. */
  position: number;
  /** Duration in quarter notes. */
  duration: number;
  root: string;
  quality: string;
  bass: string | null;
  function: HarmonyFunction;
  confidence?: number;
  candidates?: HarmonyCandidate[];
  source: Origin;
}

export interface SectionPlan {
  section: SectionId;
  melody: VoiceName;
  counterline: VoiceName;
  roles: Record<VoiceName, VoiceRole>;
  density: number;
  dynamic: DynamicMark;
  registerOffset: number;
  explanation: string;
}

export interface ArrangementBar {
  number: number;
  section: SectionId;
  harmonies: HarmonyEvent[];
  texture: string;
  origin: Origin;
  locked: boolean;
  dynamic: DynamicMark;
}

export interface ProjectBar {
  harmonies: HarmonyEvent[];
  locked: boolean;
  origin: Origin;
}

/** Loading-only shape for projects saved before schema v2. */
export interface LegacyProjectBar {
  chord?: string;
  second?: string | null;
  locked?: boolean;
  origin?: Origin;
  harmonies?: HarmonyEvent[];
}

export interface VoiceStatistics {
  min: number;
  max: number;
  median: number;
  centralRatio: number;
  noteCount: number;
}

export interface StyleProfile {
  version: 2;
  sourceFiles: number;
  noteCount: number;
  stepwiseRatio: number;
  leapRatio: number;
  restRatio: number;
  centers: Partial<Record<VoiceName, number>>;
  density: number;
  syncopationRatio: number;
  meanPhraseLength: number;
  contraryMotionRatio: number;
  obliqueMotionRatio: number;
  parallelMotionRatio: number;
  medianSpacing: number;
  crossingRatio: number;
  doublingRatio: number;
  harmonicRhythm: number;
  midBarChangeRatio: number;
  transferRatio: number;
  dynamicRange: number;
}

export interface LegacyStyleProfile {
  version: 1;
  sourceFiles: number;
  noteCount: number;
  stepwiseRatio: number;
  leapRatio: number;
  restRatio: number;
  centers: Partial<Record<VoiceName, number>>;
}

export interface ArrangementReport {
  /** Technical anomaly score only; never presented as beauty. */
  quality: number;
  parallels: number;
  crossings: number;
  rangeFaults: number;
  restRatio: number;
  density: number;
  medianSpacing: number;
  language: HarmonyLanguage;
  scale: ScaleId;
  substitutions: string[];
  bassBehaviors: string[];
  melodyBySection: Record<SectionId, VoiceName>;
  voices: Record<VoiceName, VoiceStatistics>;
  outOfCentral: string[];
  excessiveRepetitions: number;
  influences: string[];
}

export interface Arrangement {
  schemaVersion: typeof SCHEMA_VERSION;
  title: string;
  style: StyleName;
  key: string;
  mode: "major" | "minor";
  meter: Meter;
  tempo: number;
  seed: number;
  influence: number;
  harmonicLanguage: HarmonyLanguage;
  scale: ScaleId;
  melodyMode: MelodyMode;
  registerMode: RegisterMode;
  bars: ArrangementBar[];
  notes: NoteEvent[];
  sectionPlans: SectionPlan[];
  report: ArrangementReport;
}

export interface ImportedTrackSummary {
  index: number;
  name: string;
  channel: number | null;
  program: number | null;
  noteCount: number;
  low: number;
  high: number;
  median: number;
  monophony: number;
  melodyScore: number;
  percussion: boolean;
}

export interface ImportAnalysis {
  sourceName: string;
  format: "midi" | "musicxml";
  durationBeats: number;
  bars: number;
  tempo: number;
  meter: Meter;
  key: string | null;
  tracks: ImportedTrackSummary[];
  melodyTrack: number | null;
  bassTrack: number | null;
  harmonies: HarmonyEvent[][];
  importedNotes: NoteEvent[];
  warnings: string[];
}

export type ImportMode = "melody" | "grid" | "melody-bass" | "reference" | "corpus";

export interface ProjectDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  length: 8 | 16 | 32;
  keyName: string;
  mode: "major" | "minor";
  style: StyleName;
  genre: string;
  meter: Meter;
  tempo: number;
  seed: number;
  influence: number;
  harmonicLanguage: HarmonyLanguage;
  scale: ScaleId;
  melodyMode: MelodyMode;
  manualMelodyVoice: VoiceName;
  registerMode: RegisterMode;
  bars: ProjectBar[];
  importedMelody: NoteEvent[];
  lockedVoices: VoiceName[];
  voiceHolds: Partial<Record<VoiceName, NoteEvent[]>>;
  barHolds: Record<number, NoteEvent[]>;
  /** Optional and disabled by default so every existing project keeps the V1 engine. */
  styleV2?: StyleV2Settings;
}

export interface StyleV2Settings {
  enabled: boolean;
  candidateCount: 2 | 3 | 4;
  indexId?: string;
}

/** Canonical chamber dictionary, transposed from one interval table in theory.ts. */
export const FAMILIES = [
  { id: "maj", group: "Majeur", label: "maj" },
  { id: "add9", group: "Majeur", label: "add9" },
  { id: "maj7", group: "Majeur", label: "maj7" },
  { id: "maj9(#11)", group: "Majeur", label: "maj9(#11)" },
  { id: "maj7(#5)", group: "Majeur", label: "maj7(#5)" },
  { id: "min", group: "Mineur", label: "min" },
  { id: "min6", group: "Mineur", label: "min6" },
  { id: "min7", group: "Mineur", label: "min7" },
  { id: "min(add9)", group: "Mineur", label: "min(add9)" },
  { id: "min9", group: "Mineur", label: "min9" },
  { id: "min11", group: "Mineur", label: "min11" },
  { id: "min7(b5)", group: "Mineur", label: "min7(b5)" },
  { id: "min9(b5)", group: "Mineur", label: "min9(b5)" },
  { id: "min(maj7)", group: "Mineur", label: "min(maj7)" },
  { id: "min9(maj7)", group: "Mineur", label: "min9(maj7)" },
  { id: "9", group: "Dominante", label: "9" },
  { id: "11", group: "Dominante", label: "11" },
  { id: "13(b5)", group: "Dominante", label: "13(b5)" },
  { id: "7(#9#5)", group: "Dominante", label: "7(#9#5)" },
  { id: "7(b9)", group: "Dominante", label: "7(b9)" },
  { id: "13(b9)", group: "Dominante", label: "13(b9)" },
  { id: "dim", group: "Diminué", label: "dim" },
  { id: "sus13", group: "Suspendu", label: "sus13" },
  { id: "7sus4(b9)", group: "Suspendu", label: "7sus4(b9)" },
] as const;

export type FamilyId = (typeof FAMILIES)[number]["id"];

export const POP_QUALITIES = ["add9", "sus2", "sus4", "maj7(#11)", "min9", "7(#9#5)", "13(b9)", "min(maj7)"] as const;
export type PopQualityId = (typeof POP_QUALITIES)[number];

export const EXTRA_QUALITIES = ["min7(#5)", "7sus4", "maj9", "13", "7", "dim7"] as const;

/** Five documented Live Thinking scales. There is deliberately no sixth entry. */
export const LIVE_THINKING_SCALES = [
  { id: "major", label: "Majeure" },
  { id: "melodic-minor", label: "Mineure mélodique" },
  { id: "harmonic-minor", label: "Mineure harmonique" },
  { id: "diminished", label: "Diminuée" },
  { id: "whole-tone", label: "Par tons" },
] as const;
export type ScaleId = (typeof LIVE_THINKING_SCALES)[number]["id"];

export const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

export const INVERSIONS = [
  { label: "b2", semi: 1 },
  { label: "2", semi: 2 },
  { label: "b3", semi: 3 },
  { label: "3", semi: 4 },
  { label: "4", semi: 5 },
  { label: "#4", semi: 6 },
  { label: "5", semi: 7 },
  { label: "b6", semi: 8 },
  { label: "6", semi: 9 },
  { label: "b7", semi: 10 },
  { label: "7", semi: 11 },
] as const;
