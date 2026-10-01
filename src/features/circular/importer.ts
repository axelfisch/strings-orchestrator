import { FAMILIES, ROOTS, VOICES, type HarmonyCandidate, type HarmonyEvent, type ImportAnalysis, type ImportedTrackSummary, type NoteEvent, type VoiceName } from "./types";
import { chordTones, makeHarmonyEvent, median, pitchClass, quartersPerBar, spell } from "./theory";
import { meterFromParsed, musicXmlToParsed, parseMidi, type MidiNote, type MidiTrack, type ParsedMidi } from "./midi";

function trackMedian(track: MidiTrack): number {
  return median(track.notes.map((note) => note.midi));
}

function monophony(track: MidiTrack): number {
  const notes = [...track.notes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  if (notes.length < 2) return notes.length ? 1 : 0;
  let overlaps = 0;
  let previousEnd = 0;
  notes.forEach((note) => {
    if (note.startBeat < previousEnd - 0.02) overlaps += 1;
    previousEnd = Math.max(previousEnd, note.startBeat + note.durationBeat);
  });
  return Math.max(0, 1 - overlaps / notes.length);
}

function melodyScore(track: MidiTrack, allMedians: number[]): number {
  if (!track.notes.length || track.percussion) return 0;
  const name = track.name.toLowerCase();
  const named = /melod|lead|theme|chant|soprano|violin\s*1|violon\s*1/.test(name) ? 0.35 : 0;
  const mono = monophony(track) * 0.35;
  const med = trackMedian(track);
  const medianRank = allMedians.length <= 1 ? 1 : allMedians.filter((value) => value <= med).length / allMedians.length;
  const register = Math.max(0, 1 - Math.abs(medianRank - 0.78)) * 0.18;
  const meanDuration = track.notes.reduce((sum, note) => sum + note.durationBeat, 0) / track.notes.length;
  const duration = Math.min(0.12, meanDuration / 16);
  return Math.min(1, named + mono + register + duration);
}

function pitchClassWeights(parsed: ParsedMidi, start: number, end: number): { weights: number[]; bass: number | null } {
  const weights = Array.from({ length: 12 }, () => 0);
  let bassMidi = Infinity;
  parsed.tracks.filter((track) => !track.percussion).forEach((track) => track.notes.forEach((note) => {
    const overlap = Math.max(0, Math.min(end, note.startBeat + note.durationBeat) - Math.max(start, note.startBeat));
    if (overlap <= 0) return;
    const metric = Math.abs(note.startBeat - start) < 0.06 ? 1.35 : 1;
    weights[((note.midi % 12) + 12) % 12] += overlap * metric * (0.6 + note.velocity / 160);
    if (note.startBeat <= start + (end - start) * 0.55) bassMidi = Math.min(bassMidi, note.midi);
  }));
  return { weights, bass: Number.isFinite(bassMidi) ? bassMidi % 12 : null };
}

export function detectHarmonyCandidates(parsed: ParsedMidi, start: number, end: number, preferSharp = false): HarmonyCandidate[] {
  const { weights, bass } = pitchClassWeights(parsed, start, end);
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  const rows: { symbol: string; score: number; coverage: number; extras: number; missing: number; size: number }[] = [];
  ROOTS.forEach((rootName) => {
    const root = pitchClass(rootName);
    FAMILIES.forEach((family) => {
      const tones = new Set(chordTones(root, family.id));
      const covered = weights.reduce((sum, value, pc) => sum + (tones.has(pc) ? value : 0), 0);
      const extras = weights.reduce((sum, value, pc) => sum + (!tones.has(pc) ? value : 0), 0);
      const missing = [...tones].filter((pc) => weights[pc] <= 0.001).length;
      const bassBonus = bass === root ? total * 0.13 : bass !== null && tones.has(bass) ? total * 0.05 : 0;
      const complexityPenalty = Math.max(0, tones.size - 4) * total * 0.012;
      rows.push({
        symbol: `${spell(root, preferSharp)}${family.id}${bass !== null && bass !== root ? `/${spell(bass, preferSharp)}` : ""}`,
        score: covered - extras * 0.32 - missing * total * 0.018 + bassBonus - complexityPenalty,
        coverage: covered / total,
        extras: extras / total,
        missing,
        size: tones.size,
      });
    });
  });
  rows.sort((a, b) => b.score - a.score);
  const best = rows[0]?.score ?? 1;
  const runner = rows[1]?.score ?? 0;
  const separation = Math.max(0, Math.min(1, (best - runner) / Math.max(total, 0.001)));
  return rows.slice(0, 4).map((row, index) => {
    const relative = Math.max(0, Math.min(1, row.score / Math.max(best, 0.001)));
    const completeness = 1 - row.missing / Math.max(1, row.size);
    const confidence = row.coverage * 0.45 + (1 - row.extras) * 0.15 + completeness * 0.15
      + relative * 0.12 + (index === 0 ? separation * 0.13 : 0) - Math.max(0, row.size - 5) * 0.025;
    return { symbol: row.symbol, confidence: Math.max(0.05, Math.min(0.92, confidence)) };
  });
}

function keyFromFifths(fifths: number, minor: boolean): string {
  const major: Record<number, string> = { [-7]: "Cb", [-6]: "Gb", [-5]: "Db", [-4]: "Ab", [-3]: "Eb", [-2]: "Bb", [-1]: "F", 0: "C", 1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F#", 7: "C#" };
  const majorKey = major[fifths] ?? "C";
  if (!minor) return majorKey;
  return spell(pitchClass(majorKey) + 9, fifths >= 0);
}

function namedVoice(name: string): VoiceName | null {
  const value = name.toLowerCase();
  if (/violin\s*(ii|2)|violon\s*(ii|2)/.test(value)) return "Violin II";
  if (/violin\s*(i|1)(?:\D|$)|violon\s*(i|1)(?:\D|$)/.test(value)) return "Violin I";
  if (/viola\s*(ii|2)|alto\s*(ii|2)/.test(value)) return "Viola II";
  if (/viola\s*(i|1)(?:\D|$)|alto\s*(i|1)(?:\D|$)/.test(value)) return "Viola I";
  if (/cello|violoncelle/.test(value)) return "Cello";
  if (/contrabass|double\s*bass|contrebasse|bass/.test(value)) return "Contrabass";
  return null;
}

function voiceMapping(parsed: ParsedMidi): Map<number, VoiceName> {
  const map = new Map<number, VoiceName>();
  const occupied = new Set<VoiceName>();
  parsed.tracks.forEach((track, index) => {
    const voice = namedVoice(track.name);
    if (voice && !occupied.has(voice)) {
      map.set(index, voice);
      occupied.add(voice);
    }
  });
  const remainingTracks = parsed.tracks
    .map((track, index) => ({ track, index, median: trackMedian(track) }))
    .filter((item) => item.track.notes.length && !item.track.percussion && !map.has(item.index))
    .sort((a, b) => b.median - a.median);
  const remainingVoices = VOICES.filter((voice) => !occupied.has(voice));
  remainingTracks.slice(0, remainingVoices.length).forEach((item, index) => map.set(item.index, remainingVoices[index]));
  return map;
}

function importedNotes(parsed: ParsedMidi, map: Map<number, VoiceName>, qpb: number): NoteEvent[] {
  return parsed.tracks.flatMap((track, index) => {
    const voice = map.get(index);
    if (!voice || track.percussion) return [];
    return track.notes.map((note) => ({
      voice,
      midi: note.midi,
      start: note.startBeat,
      duration: note.durationBeat,
      velocity: note.velocity,
      bar: Math.floor(note.startBeat / qpb) + 1,
      source: "imported" as const,
      sourceTrack: index,
      articulation: "none" as const,
    }));
  }).sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice));
}

export function analyzeParsedSource(sourceName: string, parsed: ParsedMidi): ImportAnalysis {
  const meter = meterFromParsed(parsed);
  const qpb = quartersPerBar(meter);
  const tempo = Math.round(parsed.tempos[0]?.bpm ?? 120);
  const bars = Math.max(1, Math.ceil(parsed.durationBeats / qpb));
  const musical = parsed.tracks.filter((track) => track.notes.length && !track.percussion);
  const medians = musical.map(trackMedian);
  const summaries: ImportedTrackSummary[] = parsed.tracks.map((track, index) => {
    const values = track.notes.map((note) => note.midi);
    return {
      index,
      name: track.name,
      channel: track.channels.length === 1 ? track.channels[0] : null,
      program: track.programs[0]?.program ?? null,
      noteCount: track.notes.length,
      low: values.length ? Math.min(...values) : 0,
      high: values.length ? Math.max(...values) : 0,
      median: values.length ? Math.round(median(values)) : 0,
      monophony: monophony(track),
      melodyScore: melodyScore(track, medians),
      percussion: track.percussion,
    };
  });
  const melodyTrack = summaries.filter((track) => !track.percussion && track.noteCount).sort((a, b) => b.melodyScore - a.melodyScore)[0]?.index ?? null;
  const bassTrack = summaries.filter((track) => !track.percussion && track.noteCount).sort((a, b) => a.median - b.median)[0]?.index ?? null;
  const preferSharp = (parsed.keys[0]?.fifths ?? 0) >= 0;
  const harmonies: HarmonyEvent[][] = Array.from({ length: bars }, (_, barIndex) => {
    const explicit = parsed.harmonies.filter((item) => item.bar === barIndex + 1).sort((a, b) => a.offsetBeat - b.offsetBeat);
    if (explicit.length) return explicit.slice(0, 2).map((item, index, list) => {
      const next = list[index + 1]?.offsetBeat ?? qpb;
      return makeHarmonyEvent(item.symbol, item.offsetBeat, Math.max(0.25, next - item.offsetBeat), "imported", "unknown", 1, [{ symbol: item.symbol, confidence: 1 }]);
    });
    const start = barIndex * qpb;
    const first = detectHarmonyCandidates(parsed, start, start + qpb / 2, preferSharp);
    const second = detectHarmonyCandidates(parsed, start + qpb / 2, start + qpb, preferSharp);
    const firstBest = first[0];
    const secondBest = second[0];
    if (!firstBest && !secondBest) return [makeHarmonyEvent("Cmaj", 0, qpb, "imported", "unknown", 0, [])];
    if (firstBest && secondBest && firstBest.symbol !== secondBest.symbol && secondBest.confidence >= 0.42) {
      return [
        makeHarmonyEvent(firstBest.symbol, 0, qpb / 2, "imported", "unknown", firstBest.confidence, first),
        makeHarmonyEvent(secondBest.symbol, qpb / 2, qpb / 2, "imported", "unknown", secondBest.confidence, second),
      ];
    }
    const best = firstBest ?? secondBest;
    return [makeHarmonyEvent(best?.symbol ?? "Cmaj", 0, qpb, "imported", "unknown", best?.confidence ?? 0, firstBest ? first : second)];
  });
  const map = voiceMapping(parsed);
  const warnings: string[] = [];
  if (!parsed.harmonies.length) warnings.push("Aucune balise d’harmonie explicite : les accords sont des propositions avec confiance, à corriger avant orchestration.");
  if (parsed.tracks.some((track) => track.percussion)) warnings.push("Les pistes de percussion ont été exclues de l’analyse harmonique.");
  if (bars > 32) warnings.push(`La source contient ${bars} mesures; l’espace de travail actif en affichera au maximum 32.`);
  return {
    sourceName,
    format: parsed.source,
    durationBeats: parsed.durationBeats,
    bars,
    tempo,
    meter,
    key: parsed.keys[0] ? keyFromFifths(parsed.keys[0].fifths, parsed.keys[0].minor) : null,
    tracks: summaries,
    melodyTrack,
    bassTrack,
    harmonies,
    importedNotes: importedNotes(parsed, map, qpb),
    warnings,
  };
}

export async function analyzeSourceFile(file: File): Promise<ImportAnalysis> {
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  const parsed = lower.endsWith(".xml") || lower.endsWith(".musicxml")
    ? musicXmlToParsed(new TextDecoder().decode(buffer))
    : parseMidi(buffer);
  return analyzeParsedSource(file.name, parsed);
}

export function melodyNotesForTrack(analysis: ImportAnalysis, parsed: ParsedMidi, trackIndex: number, voice: VoiceName): NoteEvent[] {
  const qpb = quartersPerBar(analysis.meter);
  return (parsed.tracks[trackIndex]?.notes ?? []).map((note: MidiNote) => ({
    voice,
    midi: note.midi,
    start: note.startBeat,
    duration: note.durationBeat,
    velocity: note.velocity,
    bar: Math.floor(note.startBeat / qpb) + 1,
    source: "imported",
    sourceTrack: trackIndex,
    role: "melody",
    articulation: "none",
  }));
}
