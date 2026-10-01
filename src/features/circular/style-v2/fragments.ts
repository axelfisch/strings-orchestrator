import type { ParsedMidi } from "../midi";
import { quartersPerBar } from "../theory";
import type { VoiceName } from "../types";
import { extractFeatureVector } from "./features";
import { STYLE_V2_SCHEMA_VERSION, type CorpusFragment, type CorpusManifestEntry } from "./types";

export function extractFragments(parsed: ParsedMidi, manifest: CorpusManifestEntry, barsPerFragment = 2): CorpusFragment[] {
  if (!manifest.included || !manifest.workId || !manifest.split || !manifest.voiceMapping) return [];
  const qpb = quartersPerBar(manifest.detected.meter);
  const span = Math.max(1, Math.floor(barsPerFragment)) * qpb;
  const mapping = new Map<number, VoiceName>();
  manifest.voiceMapping.mappings.forEach((row) => {
    if (row.voice) mapping.set(row.trackIndex, row.voice);
  });
  const result: CorpusFragment[] = [];
  for (let startBeat = 0; startBeat < parsed.durationBeats; startBeat += span) {
    const endBeat = Math.min(parsed.durationBeats, startBeat + span);
    const notes = parsed.tracks.flatMap((track, trackIndex) => {
      const voice = mapping.get(trackIndex);
      if (!voice) return [];
      return track.notes.filter((note) => note.startBeat >= startBeat && note.startBeat < endBeat).map((note) => ({
        voice,
        midi: note.midi,
        start: note.startBeat - startBeat,
        duration: Math.min(note.durationBeat, endBeat - note.startBeat),
        velocity: note.velocity,
      }));
    });
    if (!notes.length) continue;
    const harmonyCount = parsed.harmonies.filter((harmony) => {
      const absolute = harmony.bar * qpb + harmony.offsetBeat;
      return absolute >= startBeat && absolute < endBeat;
    }).length;
    const fragmentId = `${manifest.sourceId}:b${Math.floor(startBeat / qpb) + 1}`;
    result.push({
      schemaVersion: STYLE_V2_SCHEMA_VERSION,
      fragmentId,
      sourceId: manifest.sourceId,
      workId: manifest.workId,
      split: manifest.split,
      startBeat,
      durationBeats: endBeat - startBeat,
      meter: manifest.detected.meter,
      notes,
      harmonicFunction: "unknown",
      features: extractFeatureVector(notes, endBeat - startBeat, manifest.detected.meter, "unknown", harmonyCount || 1),
      evidence: "B",
    });
  }
  return result;
}
