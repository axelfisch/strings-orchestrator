export const VOICES = ["Violin I", "Violin II", "Viola I", "Viola II", "Cello", "Contrabass"] as const;
export type VoiceName = (typeof VOICES)[number];

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

export interface NoteEvent {
  voice: VoiceName;
  midi: number;
  /** Quarter-note offset from the downbeat of the piece. */
  start: number;
  /** Duration in quarter notes. */
  duration: number;
  velocity: number;
  bar: number;
}

export interface ArrangementBar {
  number: number;
  section: SectionId;
  chord: string;
  second: string | null;
  texture: string;
  origin: Origin;
  locked: boolean;
}

export interface StyleProfile {
  version: 1;
  sourceFiles: number;
  noteCount: number;
  stepwiseRatio: number;
  leapRatio: number;
  restRatio: number;
  centers: Partial<Record<VoiceName, number>>;
}

export interface ArrangementReport {
  quality: number;
  parallels: number;
  rangeFaults: number;
  restRatio: number;
  influences: string[];
}

export interface Arrangement {
  title: string;
  style: StyleName;
  key: string;
  mode: "major" | "minor";
  meter: Meter;
  tempo: number;
  seed: number;
  influence: number;
  bars: ArrangementBar[];
  notes: NoteEvent[];
  report: ArrangementReport;
}

export interface ProjectBar {
  chord: string;
  /** Optional harmony on the second half of the bar. Never simplified into the first chord. */
  second?: string | null;
  locked: boolean;
  origin: Origin;
}

export const FAMILIES = [
  { id: "maj", group: "Majeur", label: "maj" },
  { id: "add9", group: "Majeur", label: "add9" },
  { id: "maj7", group: "Majeur", label: "maj7" },
  { id: "maj9(11+)", group: "Majeur", label: "maj9(#11)" },
  { id: "maj7(5+)", group: "Majeur", label: "maj7(#5)" },
  { id: "min", group: "Mineur", label: "min" },
  { id: "min(add9)", group: "Mineur", label: "min(add9)" },
  { id: "min9", group: "Mineur", label: "min9" },
  { id: "min11", group: "Mineur", label: "min11" },
  { id: "min9(7+)", group: "Mineur", label: "min9(maj7)" },
  { id: "min7(5+)", group: "Mineur", label: "min7(#5)" },
  { id: "9", group: "Dominante", label: "9" },
  { id: "13(b5)", group: "Dominante", label: "13(b5)" },
  { id: "7(9+5+)", group: "Dominante", label: "7(#9#5)" },
  { id: "7(b9)", group: "Dominante", label: "7(b9)" },
  { id: "13(b9)", group: "Dominante", label: "13(b9)" },
  { id: "dim", group: "Diminué", label: "dim" },
  { id: "min9(b5)", group: "Diminué", label: "min9(b5)" },
  { id: "sus13", group: "Suspendu", label: "sus13" },
  { id: "7sus4(b9)", group: "Suspendu", label: "7sus4(b9)" },
] as const;

export type FamilyId = (typeof FAMILIES)[number]["id"];

/** Five documented Live Thinking scales. The sixth is not invented. */
export const LIVE_THINKING_SCALES = [
  { id: "major", label: "Majeure" },
  { id: "melodic-minor", label: "Mineure mélodique" },
  { id: "harmonic-minor", label: "Mineure harmonique" },
  { id: "diminished", label: "Diminuée" },
  { id: "whole-tone", label: "Par tons" },
] as const;

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
