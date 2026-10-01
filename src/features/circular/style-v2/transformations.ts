import { Rng } from "../rng";
import { RANGES } from "../theory";
import { VOICES, type VoiceName } from "../types";
import type { PatternIR, TransformationTrace } from "./types";

export interface PatternTransformOptions {
  seed: number;
  registerShift?: number;
  rhythmScale?: number;
  simplify?: number;
}

export function transformPattern(pattern: PatternIR, options: PatternTransformOptions): { pattern: PatternIR; trace: TransformationTrace[] } {
  const rng = new Rng(options.seed || 1);
  const proposedShift = Math.round(options.registerShift ?? (rng.int(3) - 1) * 2);
  const registerShift = Math.max(-12, Math.min(12, proposedShift || (options.seed % 2 ? 2 : -2)));
  const rhythmScale = Math.max(0.75, Math.min(1.25, options.rhythmScale ?? 1));
  const simplify = Math.max(0, Math.min(0.5, options.simplify ?? 0));
  const trace: TransformationTrace[] = [];
  if (registerShift) trace.push({ id: "register-shift", parameters: { semitones: registerShift } });
  if (rhythmScale !== 1) trace.push({ id: "rhythm-scale", parameters: { factor: rhythmScale } });
  if (simplify > 0) trace.push({ id: "simplify", parameters: { ratio: simplify } });
  const notes = pattern.notes
    .filter((_, index) => simplify === 0 || index === 0 || rng.next() >= simplify)
    .map((note) => ({
      ...note,
      relativePitch: note.relativePitch + registerShift,
      startRatio: Math.min(0.999, note.startRatio * rhythmScale),
      durationRatio: Math.max(0.01, Math.min(1, note.durationRatio * rhythmScale)),
    }))
    .map((note) => ({ ...note, durationRatio: Math.min(note.durationRatio, 1 - note.startRatio) }));
  return { pattern: { ...pattern, patternId: `${pattern.patternId}:t${options.seed}`, notes }, trace };
}

export function remapPatternMelody(pattern: PatternIR, target: VoiceName): { pattern: PatternIR; trace: TransformationTrace[] } {
  if (pattern.anchorVoice === target) return { pattern, trace: [] };
  const original = pattern.anchorVoice;
  const swap = (voice: VoiceName): VoiceName => voice === original ? target : voice === target ? original : voice;
  const targetCenter = RANGES[target].center;
  return {
    pattern: {
      ...pattern,
      patternId: `${pattern.patternId}:m${VOICES.indexOf(target)}`,
      anchorVoice: target,
      notes: pattern.notes.map((note) => {
        const voice = swap(note.voice);
        // Pattern pitches are relative to the old anchor. Rebase every voice
        // around its own register before changing the anchor; otherwise a
        // cello-led pattern can lift all inner voices by several octaves.
        const estimatedMidi = pattern.anchorMidi + note.relativePitch;
        const registerDeviation = estimatedMidi - RANGES[note.voice].center;
        return { ...note, voice, relativePitch: RANGES[voice].center + registerDeviation - targetCenter };
      }),
    },
    trace: [{ id: "melody-role-swap", parameters: { from: original, to: target } }],
  };
}
