import { ROOTS, type FamilyId, type Meter, type VoiceName } from "./types";

const SHARP_KEYS = new Set(["F#", "B", "E"]);
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

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

export interface ParsedChord {
  symbol: string;
  rootName: string;
  root: number;
  quality: string;
  bassName: string | null;
  bass: number | null;
  tones: number[];
}

export function chordTones(root: number, quality: string): number[] {
  const q = quality.toLowerCase();
  const addOnly = q.includes("add") && !q.includes("7");
  const sus4 = q.includes("sus4") || q.includes("sus13") || q.includes("7sus");
  const sus2 = q.includes("sus2");
  const minor = q.includes("min") || q.includes("dim");
  let third = 4;
  if (sus4) third = 5;
  else if (sus2) third = 2;
  else if (minor) third = 3;

  let fifth = 7;
  if (q.includes("dim") || q.includes("b5")) fifth = 6;
  else if (q.includes("5+") || q.includes("#5")) fifth = 8;

  const tones = [0, third, fifth];
  if (!addOnly) {
    if (q.includes("maj") || q.includes("7+")) tones.push(11);
    else if (/7|9|11|13/.test(q)) tones.push(10);
  }
  if (q.includes("b9")) tones.push(1);
  else if (q.includes("9+") || q.includes("#9")) tones.push(3);
  else if (q.includes("9")) tones.push(2);
  if (q.includes("11+") || q.includes("#11")) tones.push(6);
  else if (q.includes("11")) tones.push(5);
  if (q.includes("b13")) tones.push(8);
  else if (q.includes("13")) tones.push(9);
  return [...new Set(tones.map((tone) => (root + tone) % 12))];
}

export function parseChord(symbol: string): ParsedChord {
  const [head, bassRaw] = symbol.split("/");
  const match = (head ?? "C").trim().match(/^([A-G](?:#|b)?)(.*)$/);
  const rootName = match?.[1] ?? "C";
  const quality = (match?.[2] || "maj").trim() || "maj";
  const bassName = bassRaw?.trim() || null;
  const root = pitchClass(rootName);
  return {
    symbol,
    rootName,
    root,
    quality,
    bassName,
    bass: bassName ? pitchClass(bassName) : null,
    tones: chordTones(root, quality),
  };
}

export function symbolFor(rootName: string, quality: FamilyId | string, bassName?: string | null): string {
  const head = `${rootName}${quality}`;
  if (!bassName || bassName === rootName) return head;
  return `${head}/${bassName}`;
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
  const sharp = preferSharpKey(key);
  return majorMap[spell(relative, sharp)] ?? 0;
}

export const RANGES: Record<VoiceName, { min: number; max: number; center: number }> = {
  "Violin I": { min: 60, max: 93, center: 76 },
  "Violin II": { min: 55, max: 88, center: 70 },
  "Viola I": { min: 48, max: 81, center: 66 },
  "Viola II": { min: 48, max: 76, center: 63 },
  Cello: { min: 36, max: 72, center: 52 },
  Contrabass: { min: 28, max: 55, center: 40 },
};

export function nearest(pc: number, target: number, min: number, max: number): number {
  let best = Math.min(max, Math.max(min, target));
  let distance = Infinity;
  for (let midi = min; midi <= max; midi += 1) {
    if (midi % 12 !== ((pc % 12) + 12) % 12) continue;
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
