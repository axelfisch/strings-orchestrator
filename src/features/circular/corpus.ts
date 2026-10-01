import { analyzeParsedSource } from "./importer";
import { musicXmlToParsed, parseMidi, type MidiNote, type MidiTrack, type ParsedMidi } from "./midi";
import { median } from "./theory";
import { VOICES, type ImportAnalysis, type LegacyStyleProfile, type StyleProfile, type VoiceName } from "./types";

const DB = "cso-corpus";
const STORE = "files";

export interface CorpusFile {
  version: 2;
  id: string;
  name: string;
  hash: string;
  bytes: number;
  addedAt: number;
  updatedAt: number;
  valid: boolean;
  included: boolean;
  reason?: string;
  parsed?: ParsedMidi;
  importAnalysis?: ImportAnalysis;
  analysis?: FileAnalysis;
}

export interface FileAnalysis {
  tracks: { name: string; notes: number; low: number; high: number; median: number; monophony: number; percussion: boolean }[];
  noteCount: number;
  stepwiseRatio: number;
  leapRatio: number;
  restRatio: number;
  centers: Partial<Record<VoiceName, number>>;
  density: number;
  syncopationRatio: number;
  meanPhraseLength: number;
  contraryMotionRatio: number;
  obliqueMotionRatio: number;
  parallelMotionRatio: number;
  medianSpacing: number;
  crossingRatio: number;
  doublingRatio: number;
  harmonicRhythm: number;
  midBarChangeRatio: number;
  transferRatio: number;
  dynamicRange: number;
}

function monophony(track: MidiTrack): number {
  const ordered = [...track.notes].sort((a, b) => a.startBeat - b.startBeat);
  let overlaps = 0;
  let end = -Infinity;
  ordered.forEach((note) => {
    if (note.startBeat < end - 0.02) overlaps += 1;
    end = Math.max(end, note.startBeat + note.durationBeat);
  });
  return ordered.length ? Math.max(0, 1 - overlaps / ordered.length) : 0;
}

function trackMotion(notes: MidiNote[]): { stepwise: number; leaps: number; moves: number; rests: number; phrases: number[] } {
  const ordered = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  let stepwise = 0;
  let leaps = 0;
  let moves = 0;
  let rests = 0;
  let phrase = 0;
  const phrases: number[] = [];
  let previous: MidiNote | null = null;
  ordered.forEach((note) => {
    if (previous) {
      const gap = note.startBeat - (previous.startBeat + previous.durationBeat);
      if (gap > 0.25) rests += gap;
      if (gap > 1) {
        if (phrase) phrases.push(phrase);
        phrase = 0;
      }
      const interval = Math.abs(note.midi - previous.midi);
      moves += 1;
      if (interval <= 2) stepwise += 1;
      if (interval >= 7) leaps += 1;
    }
    phrase += note.durationBeat;
    previous = note;
  });
  if (phrase) phrases.push(phrase);
  return { stepwise, leaps, moves, rests, phrases };
}

function verticalMetrics(parsed: ParsedMidi): Pick<FileAnalysis, "contraryMotionRatio" | "obliqueMotionRatio" | "parallelMotionRatio" | "medianSpacing" | "crossingRatio" | "doublingRatio"> {
  const tracks = parsed.tracks.filter((track) => track.notes.length && !track.percussion).sort((a, b) => median(b.notes.map((note) => note.midi)) - median(a.notes.map((note) => note.midi))).slice(0, 6);
  const snapshots = new Map<number, number[]>();
  tracks.forEach((track) => track.notes.forEach((note) => {
    const at = Math.round(note.startBeat * 4) / 4;
    if (!snapshots.has(at)) snapshots.set(at, []);
    snapshots.get(at)?.push(note.midi);
  }));
  const ordered = [...snapshots.entries()].sort((a, b) => a[0] - b[0]);
  const spacings: number[] = [];
  let crossings = 0;
  let doublings = 0;
  let pairs = 0;
  let contrary = 0;
  let oblique = 0;
  let parallel = 0;
  ordered.forEach(([, pitches], index) => {
    const sorted = [...pitches].sort((a, b) => b - a);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const gap = sorted[i] - sorted[i + 1];
      spacings.push(gap);
      pairs += 1;
      if (gap < 0) crossings += 1;
      if (gap % 12 === 0) doublings += 1;
    }
    const previous = ordered[index - 1]?.[1];
    if (!previous || pitches.length < 2 || previous.length < 2) return;
    const a = Math.sign(pitches[0] - previous[0]);
    const b = Math.sign(pitches[1] - previous[1]);
    if (a === 0 || b === 0) oblique += 1;
    else if (a === b) parallel += 1;
    else contrary += 1;
  });
  const motions = contrary + oblique + parallel || 1;
  return {
    contraryMotionRatio: contrary / motions,
    obliqueMotionRatio: oblique / motions,
    parallelMotionRatio: parallel / motions,
    medianSpacing: median(spacings),
    crossingRatio: pairs ? crossings / pairs : 0,
    doublingRatio: pairs ? doublings / pairs : 0,
  };
}

export function analyzeMidi(parsed: ParsedMidi): FileAnalysis {
  const musical = parsed.tracks.filter((track) => track.notes.length > 0 && !track.percussion);
  const ranked = [...musical].sort((a, b) => median(b.notes.map((note) => note.midi)) - median(a.notes.map((note) => note.midi)));
  const centers: Partial<Record<VoiceName, number>> = {};
  ranked.slice(0, VOICES.length).forEach((track, index) => {
    centers[VOICES[index]] = Math.round(median(track.notes.map((note) => note.midi)));
  });
  const motions = musical.map((track) => trackMotion(track.notes));
  const moveCount = motions.reduce((sum, row) => sum + row.moves, 0);
  const duration = Math.max(0.01, parsed.durationBeats);
  const all = musical.flatMap((track) => track.notes);
  const syncopated = all.filter((note) => {
    const eighth = Math.round(note.startBeat * 2) / 2;
    return Math.abs(note.startBeat - eighth) > 0.04 || Math.abs(note.startBeat - Math.round(note.startBeat)) > 0.12;
  }).length;
  const phraseLengths = motions.flatMap((row) => row.phrases);
  const vertical = verticalMetrics(parsed);
  const velocities = all.map((note) => note.velocity);
  const harmonicBars = new Set(parsed.harmonies.map((harmony) => harmony.bar));
  return {
    tracks: parsed.tracks.filter((track) => track.notes.length).map((track) => ({
      name: track.name,
      notes: track.notes.length,
      low: Math.min(...track.notes.map((note) => note.midi)),
      high: Math.max(...track.notes.map((note) => note.midi)),
      median: Math.round(median(track.notes.map((note) => note.midi))),
      monophony: monophony(track),
      percussion: track.percussion,
    })),
    noteCount: all.length,
    stepwiseRatio: moveCount ? motions.reduce((sum, row) => sum + row.stepwise, 0) / moveCount : 0,
    leapRatio: moveCount ? motions.reduce((sum, row) => sum + row.leaps, 0) / moveCount : 0,
    restRatio: musical.length ? motions.reduce((sum, row) => sum + Math.min(1, row.rests / duration), 0) / musical.length : 0,
    centers,
    density: musical.length ? all.reduce((sum, note) => sum + note.durationBeat, 0) / (duration * musical.length) : 0,
    syncopationRatio: all.length ? syncopated / all.length : 0,
    meanPhraseLength: phraseLengths.length ? phraseLengths.reduce((sum, value) => sum + value, 0) / phraseLengths.length : 0,
    ...vertical,
    harmonicRhythm: harmonicBars.size ? parsed.harmonies.length / harmonicBars.size : 1,
    midBarChangeRatio: harmonicBars.size ? parsed.harmonies.filter((harmony) => harmony.offsetBeat > 0).length / harmonicBars.size : 0,
    transferRatio: 0,
    dynamicRange: velocities.length ? (Math.max(...velocities) - Math.min(...velocities)) / 127 : 0,
  };
}

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function upgradeFile(value: CorpusFile | Record<string, unknown>): CorpusFile {
  const raw = value as Partial<CorpusFile>;
  const legacy = raw.analysis as Partial<FileAnalysis> | undefined;
  const defaults: FileAnalysis = {
    tracks: legacy?.tracks ?? [], noteCount: legacy?.noteCount ?? 0, stepwiseRatio: legacy?.stepwiseRatio ?? 0,
    leapRatio: legacy?.leapRatio ?? 0, restRatio: legacy?.restRatio ?? 0, centers: legacy?.centers ?? {}, density: 0,
    syncopationRatio: 0, meanPhraseLength: 0, contraryMotionRatio: 0, obliqueMotionRatio: 0, parallelMotionRatio: 0,
    medianSpacing: 0, crossingRatio: 0, doublingRatio: 0, harmonicRhythm: 1, midBarChangeRatio: 0,
    transferRatio: 0, dynamicRange: 0,
  };
  return {
    version: 2,
    id: raw.id ?? `legacy-${Date.now()}`,
    name: raw.name ?? "Fichier sans nom",
    hash: raw.hash ?? raw.id ?? "",
    bytes: raw.bytes ?? 0,
    addedAt: raw.addedAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? raw.addedAt ?? Date.now(),
    valid: raw.valid ?? false,
    included: raw.included ?? true,
    reason: raw.reason,
    parsed: raw.parsed,
    importAnalysis: raw.importAnalysis,
    analysis: raw.analysis ? { ...defaults, ...raw.analysis } : undefined,
  };
}

export async function listCorpus(): Promise<CorpusFile[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as CorpusFile[]).map(upgradeFile).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveCorpus(file: CorpusFile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(upgradeFile(file));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCorpus(id?: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const request = id ? store.delete(id) : store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function renameCorpus(file: CorpusFile, name: string): Promise<void> {
  await saveCorpus({ ...file, name: name.trim() || file.name, updatedAt: Date.now() });
}

export async function setCorpusIncluded(file: CorpusFile, included: boolean): Promise<void> {
  await saveCorpus({ ...file, included, updatedAt: Date.now() });
}

export function countsTowardProfile(name: string): boolean {
  return !/chaostik/i.test(name);
}

export function profileFrom(files: CorpusFile[]): StyleProfile | null {
  const usable = files.filter((file) => file.valid && file.included && file.analysis && file.analysis.noteCount > 0 && countsTowardProfile(file.name));
  if (!usable.length) return null;
  const weight = usable.reduce((sum, file) => sum + (file.analysis?.noteCount ?? 0), 0);
  const mix = (pick: (analysis: FileAnalysis) => number) => usable.reduce((sum, file) => sum + pick(file.analysis as FileAnalysis) * (file.analysis?.noteCount ?? 0), 0) / weight;
  const centers: StyleProfile["centers"] = {};
  VOICES.forEach((voice) => {
    const rows = usable.filter((file) => file.analysis?.centers[voice] !== undefined);
    if (!rows.length) return;
    const total = rows.reduce((sum, file) => sum + (file.analysis?.noteCount ?? 0), 0);
    centers[voice] = Math.round(rows.reduce((sum, file) => sum + (file.analysis?.centers[voice] ?? 0) * (file.analysis?.noteCount ?? 0), 0) / total);
  });
  return {
    version: 2, sourceFiles: usable.length, noteCount: weight, centers,
    stepwiseRatio: mix((analysis) => analysis.stepwiseRatio), leapRatio: mix((analysis) => analysis.leapRatio),
    restRatio: mix((analysis) => analysis.restRatio), density: mix((analysis) => analysis.density),
    syncopationRatio: mix((analysis) => analysis.syncopationRatio), meanPhraseLength: mix((analysis) => analysis.meanPhraseLength),
    contraryMotionRatio: mix((analysis) => analysis.contraryMotionRatio), obliqueMotionRatio: mix((analysis) => analysis.obliqueMotionRatio),
    parallelMotionRatio: mix((analysis) => analysis.parallelMotionRatio), medianSpacing: mix((analysis) => analysis.medianSpacing),
    crossingRatio: mix((analysis) => analysis.crossingRatio), doublingRatio: mix((analysis) => analysis.doublingRatio),
    harmonicRhythm: mix((analysis) => analysis.harmonicRhythm), midBarChangeRatio: mix((analysis) => analysis.midBarChangeRatio),
    transferRatio: mix((analysis) => analysis.transferRatio), dynamicRange: mix((analysis) => analysis.dynamicRange),
  };
}

export function migrateProfile(profile: StyleProfile | LegacyStyleProfile): StyleProfile {
  if (profile.version === 2) return profile;
  return {
    ...profile, version: 2, density: 0.7, syncopationRatio: 0, meanPhraseLength: 4,
    contraryMotionRatio: 0.33, obliqueMotionRatio: 0.33, parallelMotionRatio: 0.34,
    medianSpacing: 5, crossingRatio: 0, doublingRatio: 0.05, harmonicRhythm: 1,
    midBarChangeRatio: 0, transferRatio: 0, dynamicRange: 0.25,
  };
}

export async function ingestBuffer(name: string, buffer: ArrayBuffer, known: CorpusFile[]): Promise<{ file: CorpusFile; duplicate: boolean }> {
  const hash = await sha256(buffer);
  const duplicate = known.find((file) => file.hash === hash);
  if (duplicate) return { duplicate: true, file: duplicate };
  const lower = name.toLowerCase();
  if (lower.endsWith(".mscz")) {
    return { duplicate: false, file: { version: 2, id: `${hash}-mscz`, name, hash, bytes: buffer.byteLength, addedAt: Date.now(), updatedAt: Date.now(), valid: false, included: false, reason: "MuseScore .mscz doit être exporté en MusicXML ou MIDI" } };
  }
  try {
    const parsed = lower.endsWith(".xml") || lower.endsWith(".musicxml") ? musicXmlToParsed(new TextDecoder().decode(buffer)) : parseMidi(buffer);
    const analysis = analyzeMidi(parsed);
    if (!analysis.noteCount) throw new Error("Aucune note musicale");
    const file: CorpusFile = {
      version: 2, id: hash, name, hash, bytes: buffer.byteLength, addedAt: Date.now(), updatedAt: Date.now(),
      valid: true, included: countsTowardProfile(name), parsed, analysis, importAnalysis: analyzeParsedSource(name, parsed),
    };
    await saveCorpus(file);
    return { file, duplicate: false };
  } catch (error) {
    return { duplicate: false, file: { version: 2, id: `${hash}-bad`, name, hash, bytes: buffer.byteLength, addedAt: Date.now(), updatedAt: Date.now(), valid: false, included: false, reason: error instanceof Error ? error.message : "Fichier rejeté" } };
  }
}

export function exportProfile(profile: StyleProfile): Blob {
  return new Blob([JSON.stringify({ ...profile, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json;charset=utf-8" });
}

export function exportAnalysis(file: CorpusFile): Blob {
  return new Blob([JSON.stringify({ name: file.name, hash: file.hash, analysis: file.analysis, importAnalysis: file.importAnalysis }, null, 2)], { type: "application/json;charset=utf-8" });
}

export const VALIDATION_LOT = [
  "AFRI-CAN REUNION-17-02-2022.midi", "Flying-Circus-27-04-2021.mid", "HAZEL THEME PART 1.mid",
  "Joy’s Seven Spirits.mid", "pluie de notes .mid", "POUR-TOI-MA-BELLE -26-05-2021 2.mid",
  "Stay with us, my friend .mid", "New tune for Laureat 2019. Soprano.mid", "Softly as you are(2).mid",
  "En-Ordre-Chaostik.mid",
];
