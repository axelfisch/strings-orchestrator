import { quartersPerBar } from "../theory";
import { VOICES, type Arrangement } from "../types";
import { extractFeatureVector } from "./features";
import type { CandidateScore, ConstraintReport, FragmentFeatureVector, PreferenceRecord, TransformationTrace } from "./types";

export function arrangementFeatures(arrangement: Arrangement): FragmentFeatureVector {
  const duration = arrangement.bars.length * quartersPerBar(arrangement.meter);
  return extractFeatureVector(arrangement.notes.map((note) => ({
    voice: note.voice,
    midi: note.midi,
    start: note.start,
    duration: note.duration,
    velocity: note.velocity,
  })), duration, arrangement.meter, arrangement.bars[0]?.harmonies[0]?.function ?? "unknown", arrangement.bars.reduce((sum, bar) => sum + bar.harmonies.length, 0));
}

function closeness(value: number): number {
  return Math.max(0, Math.min(1, 1 - value));
}

function averagePreferenceAdjustment(records: PreferenceRecord[], trace: TransformationTrace[]): number {
  if (!records.length || !trace.length) return 0;
  const ids = new Set(trace.map((item) => item.id));
  const matching = records.filter((record) => record.transformationIds.some((id) => ids.has(id)));
  return Math.min(0.05, matching.length / Math.max(20, records.length) * 0.05);
}

export function scoreCandidate(options: {
  arrangement: Arrangement;
  constraints: ConstraintReport;
  target: FragmentFeatureVector;
  sourceDistance: number;
  trace: TransformationTrace[];
  preferences?: PreferenceRecord[];
  diversity?: number;
}): CandidateScore {
  const current = arrangementFeatures(options.arrangement);
  const styleDelta = Object.keys(current).reduce((sum, rawKey) => {
    const key = rawKey as keyof FragmentFeatureVector;
    return sum + Math.abs(current[key] - options.target[key]);
  }, 0) / Object.keys(current).length;
  const voiceCoverage = VOICES.filter((voice) => options.arrangement.notes.some((note) => note.voice === voice)).length / VOICES.length;
  const errorCount = options.constraints.issues.filter((issue) => issue.severity === "error").length;
  const validity = options.constraints.valid ? 1 : Math.max(0, 1 - errorCount * 0.25);
  const voiceLeading = closeness(Math.min(1, (options.constraints.parallels + options.constraints.crossings) / Math.max(8, options.arrangement.notes.length)));
  const registerBalance = closeness(options.arrangement.report.rangeFaults / Math.max(1, options.arrangement.notes.length));
  const melodyAssignment = new Set(options.arrangement.sectionPlans.map((plan) => plan.melody)).size / Math.max(1, options.arrangement.sectionPlans.length);
  const styleMatch = closeness(Math.min(1, styleDelta + options.sourceDistance * 0.25));
  const form = options.arrangement.bars.every((bar) => bar.harmonies.length >= 1 && bar.harmonies.length <= 2) ? 1 : 0;
  const diversity = Math.max(0, Math.min(1, options.diversity ?? 0.5));
  const imitationPenalty = Math.max(0, 0.2 - options.sourceDistance) * 0.5;
  const preferenceAdjustment = averagePreferenceAdjustment(options.preferences ?? [], options.trace);
  const total = validity * 0.24 + voiceCoverage * 0.05 + voiceLeading * 0.14 + registerBalance * 0.12
    + melodyAssignment * 0.1 + styleMatch * 0.17 + form * 0.08 + diversity * 0.1
    - imitationPenalty + preferenceAdjustment;
  return {
    total: Math.max(0, Math.min(1, total)), validity, harmony: form, voiceLeading, registerBalance,
    melodyAssignment, styleMatch, form, diversity, imitationPenalty, preferenceAdjustment,
  };
}

export function pitchDiversity(a: Arrangement, b: Arrangement): number {
  const left = a.notes.map((note) => `${note.voice}:${note.start.toFixed(2)}:${note.midi}`);
  const right = new Set(b.notes.map((note) => `${note.voice}:${note.start.toFixed(2)}:${note.midi}`));
  if (!left.length) return 0;
  return left.filter((item) => !right.has(item)).length / left.length;
}
