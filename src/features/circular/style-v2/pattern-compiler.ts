import { RANGES, chooseScaleForChord, parseChord, scalePitchClasses } from "../theory";
import type { HarmonyEvent, Meter, NoteEvent, ScaleId, VoiceName } from "../types";
import type { CompiledPattern, PatternIR, TransformationTrace } from "./types";

export interface CompileContext {
  startBeat: number;
  spanBeats: number;
  meter: Meter;
  harmonies: { startRatio: number; endRatio: number; event: HarmonyEvent }[];
  velocity?: number;
  trace?: TransformationTrace[];
  scale?: ScaleId;
}

function allowedFor(event: HarmonyEvent, scaleOverride?: ScaleId): number[] {
  const chord = parseChord(event.symbol);
  const scale = scalePitchClasses(scaleOverride ?? chooseScaleForChord(event.symbol), chord.root);
  return [...new Set([...chord.tones, ...scale, ...(chord.bass === null ? [] : [chord.bass])])];
}

function fitPitch(voice: VoiceName, target: number, allowed: number[]): number {
  const range = RANGES[voice];
  let best = Math.max(range.absoluteMin, Math.min(range.absoluteMax, Math.round(target)));
  let distance = Infinity;
  for (let midi = range.absoluteMin; midi <= range.absoluteMax; midi += 1) {
    if (!allowed.includes(((midi % 12) + 12) % 12)) continue;
    const next = Math.abs(midi - target) + (midi < range.centralMin || midi > range.centralMax ? 1.5 : 0);
    if (next < distance) {
      best = midi;
      distance = next;
    }
  }
  return best;
}

export function compilePattern(pattern: PatternIR, context: CompileContext): CompiledPattern {
  if (!pattern.notes.length || context.spanBeats <= 0) return { notes: [], trace: context.trace ?? [] };
  const qpb = context.meter === "4/4" ? 4 : 3;
  const anchorRange = RANGES[pattern.anchorVoice];
  const anchorDelta = anchorRange.center - pattern.anchorMidi;
  const notes: NoteEvent[] = pattern.notes.map((note) => {
    const segment = context.harmonies.find((row) => note.startRatio >= row.startRatio && note.startRatio < row.endRatio)
      ?? context.harmonies[0];
    const event = segment?.event;
    const allowed = event ? allowedFor(event, context.scale) : Array.from({ length: 12 }, (_, index) => index);
    const start = context.startBeat + note.startRatio * context.spanBeats;
    const duration = Math.max(0.08, Math.min(note.durationRatio * context.spanBeats, context.startBeat + context.spanBeats - start));
    return {
      voice: note.voice,
      midi: fitPitch(note.voice, pattern.anchorMidi + anchorDelta + note.relativePitch, allowed),
      start,
      duration,
      velocity: Math.max(1, Math.min(127, Math.round((context.velocity ?? 72) + note.velocityDelta))),
      bar: Math.floor(start / qpb) + 1,
      role: note.voice === pattern.anchorVoice ? "melody" : note.voice === "Contrabass" ? "foundation" : "harmony",
      articulation: note.voice === pattern.anchorVoice ? "legato" : "tenuto",
      dynamic: "mp",
      source: "generated",
    };
  });
  return { notes, trace: context.trace ?? [] };
}
