import { arrange, type ArrangeInput } from "../arrange";
import { quartersPerBar } from "../theory";
import { VOICES, type Arrangement, type NoteEvent, type VoiceName } from "../types";
import { checkArrangementConstraints } from "./constraints";
import { compilePattern } from "./pattern-compiler";
import { searchPatterns } from "./retrieval";
import { arrangementFeatures, pitchDiversity, scoreCandidate } from "./scoring";
import { transformPattern } from "./transformations";
import type { FragmentIndex, PreferenceRecord, StyleCandidate, TransformationTrace } from "./types";

function refreshDerivedReport(arrangement: Arrangement, notes: NoteEvent[], influence: string): Arrangement {
  const qpb = quartersPerBar(arrangement.meter);
  const voices = Object.fromEntries(VOICES.map((voice) => {
    const values = notes.filter((note) => note.voice === voice).map((note) => note.midi).sort((a, b) => a - b);
    const middle = values.length ? values[Math.floor(values.length / 2)] : 0;
    return [voice, {
      min: values.length ? values[0] : 0,
      max: values.length ? values[values.length - 1] : 0,
      median: middle,
      centralRatio: arrangement.report.voices[voice]?.centralRatio ?? 1,
      noteCount: values.length,
    }];
  })) as Arrangement["report"]["voices"];
  const activeBeats = notes.reduce((sum, note) => sum + note.duration, 0);
  const possible = Math.max(1, arrangement.bars.length * qpb * VOICES.length);
  return {
    ...arrangement,
    notes: [...notes].sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice)),
    report: {
      ...arrangement.report,
      density: activeBeats / possible,
      restRatio: Math.max(0, 1 - activeBeats / possible),
      voices,
      influences: [...arrangement.report.influences, influence],
    },
  };
}

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

function applyPattern(base: Arrangement, patternIndex: number, pattern: Parameters<typeof compilePattern>[0], trace: TransformationTrace[]): Arrangement {
  const total = base.bars.length * quartersPerBar(base.meter);
  const blockSpan = Math.max(quartersPerBar(base.meter), pattern.spanBeats);
  const voices = new Set<VoiceName>(pattern.notes.map((note) => note.voice));
  const generated: NoteEvent[] = [];
  for (let start = 0; start < total; start += blockSpan) {
    const span = Math.min(blockSpan, total - start);
    const compiled = compilePattern(pattern, { startBeat: start, spanBeats: span, meter: base.meter, harmonies: harmoniesForBlock(base, start, span), trace });
    generated.push(...compiled.notes);
  }
  const retained = base.notes.filter((note) => !voices.has(note.voice));
  return refreshDerivedReport(base, [...retained, ...generated], `Style V2 : motif ${pattern.sourceFragmentId}, variante ${patternIndex + 1}`);
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
    const arrangement = applyPattern(base, patternIndex, transformed.pattern, transformed.trace);
    return candidate(
      `v2-${hit.pattern.patternId}-${patternIndex + 1}`,
      arrangement,
      "style-v2",
      `Motif local retrouvé puis transformé; ${hit.reasons.join(", ")}.`,
      [hit.pattern.patternId],
      [hit.pattern.workId],
      transformed.trace,
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
