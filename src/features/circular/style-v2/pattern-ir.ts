import { VOICES } from "../types";
import { STYLE_V2_SCHEMA_VERSION, type CorpusFragment, type PatternIR } from "./types";

export function fragmentToPattern(fragment: CorpusFragment): PatternIR {
  if (!fragment.notes.length) throw new Error("Un fragment vide ne peut pas devenir un motif");
  const ordered = [...fragment.notes].sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice) || b.midi - a.midi);
  const anchor = ordered[0];
  const meanVelocity = ordered.reduce((sum, note) => sum + note.velocity, 0) / ordered.length;
  return {
    schemaVersion: STYLE_V2_SCHEMA_VERSION,
    patternId: `pat-${fragment.fragmentId}`,
    sourceFragmentId: fragment.fragmentId,
    sourceId: fragment.sourceId,
    workId: fragment.workId,
    split: fragment.split,
    spanBeats: fragment.durationBeats,
    anchorVoice: anchor.voice,
    anchorMidi: anchor.midi,
    harmonicFunction: fragment.harmonicFunction,
    notes: ordered.map((note) => ({
      voice: note.voice,
      startRatio: note.start / fragment.durationBeats,
      durationRatio: note.duration / fragment.durationBeats,
      relativePitch: note.midi - anchor.midi,
      velocityDelta: Math.round(note.velocity - meanVelocity),
    })),
    features: fragment.features,
  };
}

export function validatePattern(pattern: PatternIR): string[] {
  const issues: string[] = [];
  if (!pattern.notes.length) issues.push("empty_pattern");
  if (pattern.spanBeats <= 0) issues.push("invalid_span");
  pattern.notes.forEach((note, index) => {
    if (!VOICES.includes(note.voice)) issues.push(`note_${index}_invalid_voice`);
    if (note.startRatio < 0 || note.startRatio >= 1) issues.push(`note_${index}_invalid_start`);
    if (note.durationRatio <= 0 || note.startRatio + note.durationRatio > 1.01) issues.push(`note_${index}_invalid_duration`);
  });
  return issues;
}
