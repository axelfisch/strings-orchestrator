import {
  FAMILIES,
  ROOTS,
  type FamilyId,
  type HarmonyCandidate,
  type HarmonyEvent,
  type HarmonyFunction,
  type LegacyProjectBar,
  type Meter,
  type Origin,
  type ProjectBar,
  type RegisterMode,
  type ScaleId,
  type VoiceName,
} from "./types";

const SHARP_KEYS = new Set(["F#", "B", "E", "A", "D", "G"]);
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

/**
 * Single executable chord source of truth.
 * The master JSON confirms the 24 names but contains inconsistent transpositions;
 * these intervals encode the documented symbol semantics once and are transposed.
 */
export const CHORD_INTERVALS: Record<string, readonly number[]> = {
  maj: [0, 4, 7],
  add9: [0, 2, 4, 7],
  maj7: [0, 4, 7, 11],
  "maj9(#11)": [0, 2, 4, 6, 7, 11],
  "maj7(#5)": [0, 4, 8, 11],
  min: [0, 3, 7],
  min6: [0, 3, 7, 9],
  min7: [0, 3, 7, 10],
  "min(add9)": [0, 2, 3, 7],
  min9: [0, 2, 3, 7, 10],
  min11: [0, 2, 3, 5, 7, 10],
  "min7(b5)": [0, 3, 6, 10],
  "min9(b5)": [0, 2, 3, 6, 10],
  "min(maj7)": [0, 3, 7, 11],
  "min9(maj7)": [0, 2, 3, 7, 11],
  "9": [0, 2, 4, 7, 10],
  "11": [0, 2, 4, 5, 7, 10],
  "13(b5)": [0, 2, 4, 6, 9, 10],
  "7(#9#5)": [0, 3, 4, 8, 10],
  "7(b9)": [0, 1, 4, 7, 10],
  "13(b9)": [0, 1, 4, 7, 9, 10],
  dim: [0, 3, 6, 9],
  sus13: [0, 5, 7, 9],
  "7sus4(b9)": [0, 1, 5, 7, 10],
  // Pop-soft and documented extensions stay outside the canonical 24 list.
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  "min7(#5)": [0, 3, 8, 10],
  maj9: [0, 2, 4, 7, 11],
  "13": [0, 2, 4, 7, 9, 10],
  "7": [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  "9(#5)": [0, 2, 4, 8, 10],
  "11(#5)": [0, 2, 4, 5, 8, 10],
};

export const QUALITY_ALIASES: Record<string, string> = {
  "maj9(11+)": "maj9(#11)",
  "maj7(5+)": "maj7(#5)",
  "min(7+)": "min(maj7)",
  "min9(7+)": "min9(maj7)",
  "7(9+5+)": "7(#9#5)",
  "7(#5#9)": "7(#9#5)",
  "7(5+9+)": "7(#9#5)",
  "9(5+)": "9(#5)",
  "11(5+)": "11(#5)",
  "min7(5+)": "min7(#5)",
  m: "min",
  m6: "min6",
  m7: "min7",
  m9: "min9",
  m11: "min11",
  ø7: "min7(b5)",
  "m7b5": "min7(b5)",
  "m9b5": "min9(b5)",
  "m(maj7)": "min(maj7)",
  "m9(maj7)": "min9(maj7)",
};

export const SCALE_INTERVALS: Record<ScaleId, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
  diminished: [0, 1, 3, 4, 6, 7, 9, 10],
  "whole-tone": [0, 2, 4, 6, 8, 10],
};

export interface RegisterRange {
  absoluteMin: number;
  absoluteMax: number;
  centralMin: number;
  centralMax: number;
  center: number;
}

/** Measured centers from seven canonical sextets, with wider technical safety limits. */
export const RANGES: Record<VoiceName, RegisterRange> = {
  "Violin I": { absoluteMin: 55, absoluteMax: 96, centralMin: 67, centralMax: 81, center: 74 },
  "Violin II": { absoluteMin: 55, absoluteMax: 91, centralMin: 63, centralMax: 76, center: 69 },
  "Viola I": { absoluteMin: 48, absoluteMax: 84, centralMin: 60, centralMax: 71, center: 66 },
  "Viola II": { absoluteMin: 48, absoluteMax: 79, centralMin: 58, centralMax: 69, center: 63 },
  Cello: { absoluteMin: 36, absoluteMax: 72, centralMin: 44, centralMax: 58, center: 51 },
  Contrabass: { absoluteMin: 28, absoluteMax: 57, centralMin: 33, centralMax: 46, center: 40 },
};

export const C_APPROACHES = [
  ["Dmin7", "G7", "Cmaj7"],
  ["Amin7", "Abmaj7(#11)", "Cmaj7"],
  ["Amin7", "Abdim", "Cmaj7"],
  ["Fmin7", "Bb7", "Cmaj7"],
  ["Bbmin7", "Bdim", "Cmaj7"],
  ["Fmin", "C11(#5)", "Cmaj7"],
  ["Abmin7", "Db7", "Cmaj7"],
  ["Dmin7", "Dbmaj7", "Cmaj7"],
  ["Dmin7", "Ddim", "Cmaj7"],
  ["Bbmin7", "Eb7", "Cmaj7"],
  ["Gbmaj7", "Fmin7", "Cmaj7"],
  ["Fmin7", "Fdim", "Cmaj7"],
] as const;

export const POP_SOFT_FIXTURE = [
  ["Ebadd9/G", "Bb/Ab", "Cmin(add9)", "Absus2"],
  ["Fmin/Ab", "Bb7sus4", "Gmin(add9)", "Ab/C"],
  ["Cmin/Eb", "F7/A", "Bbadd9", "Abadd9/C"],
  ["Fmin(add9)", "Bb/D", "Ebsus2", "Absus2"],
  ["Gmin7", "Cmin(add9)/Eb", "Bbadd9/D", "Ab/Bb"],
  ["Fmin(add9)", "F7/A", "Bbadd9", "Cmin/Bb"],
] as const;

export function pitchClass(name: string): number {
  return PC[name] ?? 0;
}

export function spell(pc: number, preferSharp: boolean): string {
  const index = ((pc % 12) + 12) % 12;
  return (preferSharp ? SHARP_NAMES : FLAT_NAMES)[index];
}

export function preferSharpKey(key: string): boolean {
  return SHARP_KEYS.has(key);
}

export function normalizeQuality(value: string): string {
  const clean = value.trim().split("♯").join("#").split("♭").join("b");
  return QUALITY_ALIASES[clean] ?? (clean || "maj");
}

export interface ParsedChord {
  symbol: string;
  rootName: string;
  root: number;
  quality: string;
  bassName: string | null;
  bass: number | null;
  tones: number[];
}

export function chordIntervals(quality: string): readonly number[] {
  const normalized = normalizeQuality(quality);
  return CHORD_INTERVALS[normalized] ?? (normalized.startsWith("min") ? CHORD_INTERVALS.min : CHORD_INTERVALS.maj);
}

export function chordTones(root: number, quality: string): number[] {
  return chordIntervals(quality).map((interval) => (root + interval) % 12);
}

export function parseChord(symbol: string): ParsedChord {
  const clean = symbol.trim() || "Cmaj";
  const slash = clean.lastIndexOf("/");
  const head = slash >= 0 ? clean.slice(0, slash) : clean;
  const bassRaw = slash >= 0 ? clean.slice(slash + 1) : "";
  const match = head.match(/^([A-G](?:#|b)?)(.*)$/);
  const rootName = match?.[1] ?? "C";
  const quality = normalizeQuality(match?.[2] || "maj");
  const bassName = /^[A-G](?:#|b)?$/.test(bassRaw.trim()) ? bassRaw.trim() : null;
  const root = pitchClass(rootName);
  return {
    symbol: symbolFor(rootName, quality, bassName),
    rootName,
    root,
    quality,
    bassName,
    bass: bassName ? pitchClass(bassName) : null,
    tones: chordTones(root, quality),
  };
}

export function symbolFor(rootName: string, quality: FamilyId | string, bassName?: string | null): string {
  const normalized = normalizeQuality(quality);
  const head = `${rootName}${normalized}`;
  if (!bassName || bassName === rootName) return head;
  return `${head}/${bassName}`;
}

export function transposeSymbol(symbol: string, semitones: number, preferSharp = false): string {
  const parsed = parseChord(symbol);
  const root = spell(parsed.root + semitones, preferSharp);
  const bass = parsed.bass === null ? null : spell(parsed.bass + semitones, preferSharp);
  return symbolFor(root, parsed.quality, bass);
}

export function transposeApproach(targetRoot: string): [string, string, string][] {
  const shift = pitchClass(targetRoot);
  const sharp = preferSharpKey(targetRoot);
  return C_APPROACHES.map((row) => row.map((symbol) => transposeSymbol(symbol, shift, sharp)) as [string, string, string]);
}

export function preserveDominantBass(originalDominant: string, replacementColor: string): string {
  const original = parseChord(originalDominant);
  const replacement = parseChord(replacementColor);
  return symbolFor(replacement.rootName, replacement.quality, original.rootName);
}

export function makeHarmonyEvent(
  symbol: string,
  position: number,
  duration: number,
  source: Origin,
  harmonicFunction: HarmonyFunction = "unknown",
  confidence?: number,
  candidates?: HarmonyCandidate[],
): HarmonyEvent {
  const parsed = parseChord(symbol);
  return {
    symbol: parsed.symbol,
    position,
    duration,
    root: parsed.rootName,
    quality: parsed.quality,
    bass: parsed.bassName,
    function: harmonicFunction,
    confidence,
    candidates,
    source,
  };
}

export function migrateProjectBar(bar: LegacyProjectBar, meter: Meter): ProjectBar {
  const qpb = quartersPerBar(meter);
  if (Array.isArray(bar.harmonies) && bar.harmonies.length) {
    const harmonies = bar.harmonies
      .slice(0, 2)
      .map((event, index, list) => makeHarmonyEvent(
        event.symbol,
        Number.isFinite(event.position) ? event.position : index * (qpb / list.length),
        Number.isFinite(event.duration) ? event.duration : qpb / list.length,
        event.source ?? bar.origin ?? "manual",
        event.function ?? "unknown",
        event.confidence,
        event.candidates,
      ));
    return { harmonies, locked: Boolean(bar.locked), origin: bar.origin ?? harmonies[0]?.source ?? "manual" };
  }
  const first = bar.chord?.trim() || "Cmaj";
  const symbols = bar.second?.trim() ? [first, bar.second.trim()] : [first];
  const span = qpb / symbols.length;
  return {
    harmonies: symbols.map((symbol, index) => makeHarmonyEvent(symbol, index * span, span, bar.origin ?? "manual")),
    locked: Boolean(bar.locked),
    origin: bar.origin ?? "manual",
  };
}

export function setBarHarmony(bar: ProjectBar, index: 0 | 1, symbol: string, meter: Meter): ProjectBar {
  const qpb = quartersPerBar(meter);
  const existing = [...bar.harmonies];
  if (index === 1 && existing.length < 2) {
    const firstSymbol = existing[0]?.symbol ?? symbol;
    existing.splice(0, existing.length,
      makeHarmonyEvent(firstSymbol, 0, qpb / 2, existing[0]?.source ?? "manual", existing[0]?.function ?? "unknown"),
      makeHarmonyEvent(symbol, qpb / 2, qpb / 2, "manual"),
    );
  } else if (index === 0 && existing.length === 0) {
    existing.push(makeHarmonyEvent(symbol, 0, qpb, "manual"));
  } else if (existing[index]) {
    existing[index] = makeHarmonyEvent(
      symbol,
      existing[index].position,
      existing[index].duration,
      "manual",
      existing[index].function,
    );
  }
  return { ...bar, harmonies: existing.slice(0, 2), origin: "manual" };
}

export function splitBarHarmony(bar: ProjectBar, secondSymbol: string, meter: Meter): ProjectBar {
  const qpb = quartersPerBar(meter);
  const firstSymbol = bar.harmonies[0]?.symbol ?? "Cmaj";
  return {
    ...bar,
    origin: "manual",
    harmonies: [
      makeHarmonyEvent(firstSymbol, 0, qpb / 2, bar.harmonies[0]?.source ?? "manual", bar.harmonies[0]?.function ?? "unknown"),
      makeHarmonyEvent(secondSymbol, qpb / 2, qpb / 2, "manual"),
    ],
  };
}

export function joinBarHarmony(bar: ProjectBar, meter: Meter): ProjectBar {
  const symbol = bar.harmonies[0]?.symbol ?? "Cmaj";
  return { ...bar, origin: "manual", harmonies: [makeHarmonyEvent(symbol, 0, quartersPerBar(meter), bar.harmonies[0]?.source ?? "manual", bar.harmonies[0]?.function ?? "unknown")] };
}

export function quartersPerBar(meter: Meter): number {
  if (meter === "3/4") return 3;
  if (meter === "6/8") return 3;
  return 4;
}

/** Tone.Transport time: bars:quarter-beats:sixteenths, one bar = quartersPerBar. */
export function quarterToTransport(quarters: number, qpb: number): string {
  const safe = Math.max(0, quarters);
  let bar = Math.floor(safe / qpb + 1e-8);
  const rem = safe - bar * qpb;
  let beat = Math.floor(rem + 1e-8);
  let sixteenth = Math.round((rem - beat) * 4);
  if (sixteenth >= 4) {
    sixteenth = 0;
    beat += 1;
  }
  if (beat >= qpb) {
    beat -= qpb;
    bar += 1;
  }
  return `${bar}:${beat}:${sixteenth}`;
}

export function keyFifths(key: string, mode: "major" | "minor"): number {
  const majorMap: Record<string, number> = {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1,
  };
  if (mode === "major") return majorMap[key] ?? 0;
  const relative = (pitchClass(key) + 3) % 12;
  return majorMap[spell(relative, preferSharpKey(key))] ?? 0;
}

export function scalePitchClasses(scale: ScaleId, tonic: number): number[] {
  return SCALE_INTERVALS[scale].map((interval) => (tonic + interval) % 12);
}

export function chooseScaleForChord(symbol: string): ScaleId {
  const { quality } = parseChord(symbol);
  if (quality === "dim" || quality === "dim7" || quality === "7(b9)" || quality === "13(b9)" || quality === "7sus4(b9)") return "diminished";
  if (quality === "9(#5)" || quality === "11(#5)") return "whole-tone";
  if (["min(maj7)", "min9(maj7)", "min7(b5)", "min9(b5)"].includes(quality)) return "harmonic-minor";
  if (["maj7(#5)", "13(b5)", "7(#9#5)"].includes(quality)) return "melodic-minor";
  return "major";
}

export function registerCenter(voice: VoiceName, mode: RegisterMode): number {
  const range = RANGES[voice];
  if (mode === "low") return Math.max(range.centralMin, range.center - 4);
  if (mode === "high") return Math.min(range.centralMax, range.center + 4);
  return range.center;
}

export function nearest(pc: number, target: number, min: number, max: number): number {
  let best = Math.min(max, Math.max(min, target));
  let distance = Infinity;
  for (let midi = min; midi <= max; midi += 1) {
    if (((midi % 12) + 12) % 12 !== ((pc % 12) + 12) % 12) continue;
    const gap = Math.abs(midi - target);
    if (gap < distance) {
      distance = gap;
      best = midi;
    }
  }
  return best;
}

export function isRootName(value: string): value is (typeof ROOTS)[number] {
  return (ROOTS as readonly string[]).includes(value);
}

export function isCanonicalFamily(value: string): value is FamilyId {
  return FAMILIES.some((family) => family.id === value);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
