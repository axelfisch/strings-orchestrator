import type { MidiTrack, ParsedMidi } from "../midi";
import { RANGES, median } from "../theory";
import { VOICES, type VoiceName } from "../types";
import type { TrackVoiceMapping, VoiceMappingCandidate, VoiceMappingResult } from "./types";

const NAME_HINTS: Record<VoiceName, RegExp[]> = {
  "Violin I": [/violin\s*(i|1|one)\b/i, /violon\s*(i|1)\b/i, /vln\s*1\b/i],
  "Violin II": [/violin\s*(ii|2|two)\b/i, /violon\s*(ii|2)\b/i, /vln\s*2\b/i],
  "Viola I": [/viola\s*(i|1|one)\b/i, /alto\s*(i|1)\b/i, /vla\s*1\b/i],
  "Viola II": [/viola\s*(ii|2|two)\b/i, /alto\s*(ii|2)\b/i, /vla\s*2\b/i],
  Cello: [/cello/i, /violoncelle/i, /vc\b/i],
  Contrabass: [/contra\s*bass/i, /contrabasse/i, /double\s*bass/i, /upright\s*bass/i, /\bcb\b/i],
};

function trackMedian(track: MidiTrack): number {
  return median(track.notes.map((note) => note.midi));
}

function monophony(track: MidiTrack): number {
  const notes = [...track.notes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  let overlap = 0;
  let end = -Infinity;
  notes.forEach((note) => {
    if (note.startBeat < end - 0.02) overlap += 1;
    end = Math.max(end, note.startBeat + note.durationBeat);
  });
  return notes.length ? 1 - overlap / notes.length : 0;
}

function candidatesFor(track: MidiTrack): VoiceMappingCandidate[] {
  const med = trackMedian(track);
  return VOICES.map((voice) => {
    const range = RANGES[voice];
    const reasons: string[] = [];
    const named = NAME_HINTS[voice].some((pattern) => pattern.test(track.name));
    if (named) reasons.push("nom de piste explicite");
    const outside = med < range.absoluteMin ? range.absoluteMin - med : med > range.absoluteMax ? med - range.absoluteMax : 0;
    const centerDistance = Math.abs(med - range.center);
    const registerScore = outside ? Math.max(0, 0.35 - outside * 0.04) : Math.max(0.2, 0.82 - centerDistance * 0.035);
    if (!outside) reasons.push("médiane dans la tessiture");
    const mono = monophony(track);
    if (mono > 0.9) reasons.push("piste monodique");
    const score = Math.min(1, (named ? 0.72 : 0) + registerScore * (named ? 0.28 : 0.9) + mono * 0.1);
    return { voice, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

export function mapTracksToVoices(parsed: ParsedMidi, corrections: Partial<Record<number, VoiceName | null>> = {}): VoiceMappingResult {
  const musical = parsed.tracks.map((track, trackIndex) => ({ track, trackIndex })).filter(({ track }) => track.notes.length && !track.percussion);
  const rows = musical.map(({ track, trackIndex }) => ({ track, trackIndex, candidates: candidatesFor(track) }));
  const claimed = new Set<VoiceName>();
  const mappings = new Map<number, TrackVoiceMapping>();

  Object.entries(corrections).forEach(([rawIndex, voice]) => {
    const trackIndex = Number(rawIndex);
    const row = rows.find((item) => item.trackIndex === trackIndex);
    if (!row) return;
    if (voice) claimed.add(voice);
    mappings.set(trackIndex, {
      trackIndex,
      trackName: row.track.name,
      voice: voice ?? null,
      confidence: 1,
      candidates: row.candidates,
      corrected: true,
    });
  });

  rows.filter((row) => !mappings.has(row.trackIndex))
    .sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0))
    .forEach((row) => {
      const choice = row.candidates.find((candidate) => !claimed.has(candidate.voice));
      const confident = choice && choice.score >= 0.48 ? choice : null;
      if (confident) claimed.add(confident.voice);
      mappings.set(row.trackIndex, {
        trackIndex: row.trackIndex,
        trackName: row.track.name,
        voice: confident?.voice ?? null,
        confidence: confident?.score ?? 0,
        candidates: row.candidates.slice(0, 3),
        corrected: false,
      });
    });

  const ordered = [...mappings.values()].sort((a, b) => a.trackIndex - b.trackIndex);
  const warnings: string[] = [];
  const unmappedTracks = ordered.filter((row) => !row.voice).map((row) => row.trackIndex);
  if (unmappedTracks.length) warnings.push(`${unmappedTracks.length} piste(s) sans mapping fiable`);
  ordered.filter((row) => row.voice && row.confidence < 0.65).forEach((row) => warnings.push(`Mapping à vérifier : ${row.trackName} → ${row.voice}`));
  const absent = VOICES.filter((voice) => !ordered.some((row) => row.voice === voice));
  if (absent.length) warnings.push(`Voix absentes : ${absent.join(", ")}`);
  return { mappings: ordered, unmappedTracks, warnings };
}
