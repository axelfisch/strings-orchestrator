import { median } from "../theory";
import { VOICES, type HarmonyFunction, type Meter } from "../types";
import type { FragmentFeatureVector, FragmentNote } from "./types";

const FUNCTION_CODE: Record<HarmonyFunction, number> = {
  unknown: 0,
  approach: 0.25,
  color: 0.5,
  tension: 0.75,
  resolution: 1,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function extractFeatureVector(
  notes: FragmentNote[],
  durationBeats: number,
  meter: Meter,
  harmonicFunction: HarmonyFunction,
  harmonyCount = 1,
): FragmentFeatureVector {
  const duration = Math.max(0.25, durationBeats);
  const voices = VOICES.filter((voice) => notes.some((note) => note.voice === voice));
  const moves: number[] = [];
  let stepwise = 0;
  let leaps = 0;
  let gaps = 0;
  voices.forEach((voice) => {
    const line = notes.filter((note) => note.voice === voice).sort((a, b) => a.start - b.start || a.midi - b.midi);
    for (let index = 1; index < line.length; index += 1) {
      const interval = Math.abs(line[index].midi - line[index - 1].midi);
      moves.push(interval);
      if (interval <= 2) stepwise += 1;
      if (interval >= 7) leaps += 1;
      gaps += Math.max(0, line[index].start - (line[index - 1].start + line[index - 1].duration));
    }
  });
  const noteDuration = notes.reduce((sum, note) => sum + note.duration, 0);
  const offBeat = notes.filter((note) => Math.abs(note.start * 2 - Math.round(note.start * 2)) > 0.08 || Math.abs(note.start - Math.round(note.start)) > 0.12).length;
  const voiceMask = VOICES.reduce((mask, voice, index) => mask + (voices.includes(voice) ? 2 ** index : 0), 0) / 63;
  const qpb = meter === "4/4" ? 4 : 3;
  return {
    density: clamp01(noteDuration / (duration * Math.max(1, voices.length))),
    restRatio: clamp01(gaps / (duration * Math.max(1, voices.length))),
    syncopation: notes.length ? offBeat / notes.length : 0,
    stepwiseRatio: moves.length ? stepwise / moves.length : 0,
    leapRatio: moves.length ? leaps / moves.length : 0,
    meanInterval: moves.length ? clamp01(median(moves) / 12) : 0,
    register: notes.length ? clamp01((median(notes.map((note) => note.midi)) - 28) / 68) : 0,
    duration: clamp01(duration / (qpb * 8)),
    voiceMask,
    harmonicRhythm: clamp01(harmonyCount / Math.max(1, duration / qpb) / 2),
    functionCode: FUNCTION_CODE[harmonicFunction],
  };
}

export function featureEntries(vector: FragmentFeatureVector): [keyof FragmentFeatureVector, number][] {
  return Object.entries(vector) as [keyof FragmentFeatureVector, number][];
}
