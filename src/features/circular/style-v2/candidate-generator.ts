import { arrange, type ArrangeInput } from "../arrange";
import { quartersPerBar } from "../theory";
import { VOICES, type Arrangement, type NoteEvent, type VoiceName, type VoiceRole } from "../types";
import { checkArrangementConstraints } from "./constraints";
import { compilePattern } from "./pattern-compiler";
import { recalculateArrangementReport } from "./report";
import { searchPatterns } from "./retrieval";
import { arrangementFeatures, pitchDiversity, scoreCandidate } from "./scoring";
import { remapPatternMelody, transformPattern } from "./transformations";
import type { FragmentIndex, PreferenceRecord, StyleCandidate, TransformationTrace } from "./types";

function harmoniesForBlock(arrangement: Arrangement, start: number, span: number) {
  const qpb = quartersPerBar(arrangement.meter);
  return arrangement.bars.flatMap((bar) => bar.harmonies.map((event) => ({
    absoluteStart: (bar.number - 1) * qpb + event.position,
    absoluteEnd: (bar.number - 1) * qpb + event.position + event.duration,
    event,
  }))).filter((row) => row.absoluteEnd > start && row.absoluteStart < start + span).map((row) => ({
    startRatio: Math.max(0, (row.absoluteStart - start) / span),
    endRatio: Math.min(1, (row.absoluteEnd - start) / span),
    event: row.event,
  }));
}

function applyPattern(base: Arrangement, patternIndex: number, pattern: Parameters<typeof compilePattern>[0], melody: VoiceName, trace: TransformationTrace[]): Arrangement {
  const total = base.bars.length * quartersPerBar(base.meter);
  const blockSpan = Math.max(quartersPerBar(base.meter), pattern.spanBeats);
  const voices = new Set<VoiceName>(pattern.notes.map((note) => note.voice));
  const generated: NoteEvent[] = [];
  for (let start = 0; start < total; start += blockSpan) {
    const span = Math.min(blockSpan, total - start);
    const compiled = compilePattern(pattern, { startBeat: start, spanBeats: span, meter: base.meter, harmonies: harmoniesForBlock(base, start, span), trace, scale: base.scale });
    generated.push(...compiled.notes);
  }
  const retained = base.notes.filter((note) => !voices.has(note.voice));
  const sectionPlans = base.sectionPlans.map((plan) => {
    const roles = { ...plan.roles };
    roles[plan.melody] = plan.melody === "Contrabass" ? "foundation" : "harmony";
    roles[melody] = "melody";
    const counterline = plan.counterline === melody ? (melody === "Cello" ? "Violin II" : "Cello") : plan.counterline;
    roles[counterline] = "counterline";
    return { ...plan, melody, counterline, roles: roles as Record<VoiceName, VoiceRole>, explanation: `Style V2 : motif local adapté, mélodie confiée à ${melody}.` };
  });
  return recalculateArrangementReport({ ...base, sectionPlans, notes: [...retained, ...generated] }, [`Style V2 : motif ${pattern.sourceFragmentId}, variante ${patternIndex + 1}.`]);
}

function candidate(id: string, arrangement: Arrangement, engine: "v1" | "style-v2", summary: string, sourcePatternIds: string[], sourceWorkIds: string[], trace: TransformationTrace[], target: ReturnType<typeof arrangementFeatures>, sourceDistance: number, preferences: PreferenceRecord[], diversity: number): StyleCandidate {
  const constraints = checkArrangementConstraints(arrangement);
  const score = scoreCandidate({ arrangement, constraints, target, sourceDistance, trace, preferences, diversity });
  return { id, arrangement, explanation: { engine, summary, sourcePatternIds, sourceWorkIds, transformations: trace, constraints, score } };
}

export function generateStyleCandidates(input: ArrangeInput, index: FragmentIndex, count = 3, preferences: PreferenceRecord[] = []): StyleCandidate[] {
  const base = arrange(input);
  const target = arrangementFeatures(base);
  const baseline = candidate("v1-baseline", base, "v1", "Moteur déterministe V1 conservé comme référence.", [], [], [], target, 1, preferences, 0);
  const hits = searchPatterns(index, { features: target, split: "train", allowedVoices: [...VOICES] }, Math.max(1, count - 1));
  const derived = hits.map((hit, patternIndex) => {
    const transformed = transformPattern(hit.pattern, { seed: input.seed + patternIndex + 1, simplify: patternIndex ? 0.08 : 0 });
    const melody = input.melodyMode === "manual" ? input.manualMelodyVoice ?? "Violin I"
      : input.melodyMode === "preserve-import" && input.importedMelody?.[0] ? input.importedMelody[0].voice
        : base.sectionPlans[patternIndex % Math.max(1, base.sectionPlans.length)]?.melody ?? "Violin I";
    const remapped = remapPatternMelody(transformed.pattern, melody);
    const trace = [...transformed.trace, ...remapped.trace];
    const arrangement = applyPattern(base, patternIndex, remapped.pattern, melody, trace);
    return candidate(
      `v2-${hit.pattern.patternId}-${patternIndex + 1}`,
      arrangement,
      "style-v2",
      `Motif local retrouvé puis transformé; ${hit.reasons.join(", ")}.`,
      [hit.pattern.patternId],
      [hit.pattern.workId],
      trace,
      target,
      hit.distance,
      preferences,
      pitchDiversity(arrangement, base),
    );
  }).filter((item) => item.explanation.constraints.valid);
  return [baseline, ...derived]
    .sort((a, b) => b.explanation.score.total - a.explanation.score.total || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(4, count)));
}
