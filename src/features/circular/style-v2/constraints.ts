import { RANGES, parseChord, quartersPerBar } from "../theory";
import { VOICES, type Arrangement, type NoteEvent } from "../types";
import type { ConstraintIssue, ConstraintReport } from "./types";

function snapshots(notes: NoteEvent[]): [number, Map<string, number>][] {
  const rows = new Map<number, Map<string, number>>();
  notes.forEach((note) => {
    const at = Math.round(note.start * 1000) / 1000;
    if (!rows.has(at)) rows.set(at, new Map());
    rows.get(at)?.set(note.voice, note.midi);
  });
  return [...rows.entries()].sort((a, b) => a[0] - b[0]);
}

export function checkArrangementConstraints(arrangement: Arrangement): ConstraintReport {
  const issues: ConstraintIssue[] = [];
  const qpb = quartersPerBar(arrangement.meter);
  arrangement.notes.forEach((note) => {
    const range = RANGES[note.voice];
    if (!range || note.midi < range.absoluteMin || note.midi > range.absoluteMax) issues.push({ code: "range", severity: "error", message: `${note.voice} hors tessiture`, voice: note.voice, bar: note.bar });
    if (note.duration <= 0 || note.start < 0) issues.push({ code: "time", severity: "error", message: "Durée ou départ invalide", voice: note.voice, bar: note.bar });
    const barStart = (note.bar - 1) * qpb;
    if (note.start < barStart - 0.001 || note.start + note.duration > barStart + qpb + 0.001) issues.push({ code: "bar-overflow", severity: "error", message: "Note hors de sa mesure", voice: note.voice, bar: note.bar });
  });
  VOICES.forEach((voice) => {
    if (!arrangement.notes.some((note) => note.voice === voice)) issues.push({ code: "missing-voice", severity: "error", message: `${voice} est absente`, voice });
  });
  arrangement.bars.forEach((bar) => {
    if (bar.harmonies.length < 1 || bar.harmonies.length > 2) issues.push({ code: "harmony-count", severity: "error", message: "Une mesure doit contenir une ou deux harmonies", bar: bar.number });
    bar.harmonies.forEach((harmony) => {
      const parsed = parseChord(harmony.symbol);
      if (parsed.bassName !== harmony.bass) issues.push({ code: "slash-bass", severity: "error", message: "Basse slash altérée", bar: bar.number });
    });
  });
  let crossings = 0;
  let parallels = 0;
  const ordered = snapshots(arrangement.notes);
  ordered.forEach(([, pitches], snapshotIndex) => {
    VOICES.slice(0, -1).forEach((voice, voiceIndex) => {
      const lowerVoice = VOICES[voiceIndex + 1];
      const upper = pitches.get(voice);
      const lower = pitches.get(lowerVoice);
      if (upper === undefined || lower === undefined) return;
      if (upper < lower) crossings += 1;
      const previous = ordered[snapshotIndex - 1]?.[1];
      const oldUpper = previous?.get(voice);
      const oldLower = previous?.get(lowerVoice);
      if (oldUpper === undefined || oldLower === undefined) return;
      const oldInterval = Math.abs(oldUpper - oldLower) % 12;
      const nextInterval = Math.abs(upper - lower) % 12;
      const upperDirection = Math.sign(upper - oldUpper);
      const lowerDirection = Math.sign(lower - oldLower);
      if ((oldInterval === 0 || oldInterval === 7) && (nextInterval === 0 || nextInterval === 7) && upperDirection === lowerDirection && upperDirection !== 0) parallels += 1;
    });
  });
  if (crossings) issues.push({ code: "crossings", severity: "warning", message: `${crossings} croisement(s)` });
  if (parallels) issues.push({ code: "parallels", severity: "warning", message: `${parallels} parallèle(s) de quinte/octave` });
  return { valid: !issues.some((issue) => issue.severity === "error"), issues, parallels, crossings };
}
