import { Rng } from "../rng";
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
