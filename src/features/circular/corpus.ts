import { musicXmlToParsed, parseMidi, type MidiNote, type ParsedMidi } from "./midi";
import { VOICES, type StyleProfile, type VoiceName } from "./types";

const DB = "cso-corpus";
const STORE = "files";

export interface CorpusFile {
  id: string;
  name: string;
  hash: string;
  bytes: number;
  addedAt: number;
  valid: boolean;
  reason?: string;
  analysis?: FileAnalysis;
}

export interface FileAnalysis {
  tracks: { name: string; notes: number; low: number; high: number; median: number }[];
  noteCount: number;
  stepwiseRatio: number;
  leapRatio: number;
  restRatio: number;
  centers: Partial<Record<VoiceName, number>>;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function motion(notes: MidiNote[]): { stepwise: number; leaps: number; total: number; rest: number; span: number } {
  const ordered = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  let stepwise = 0;
  let leaps = 0;
  let total = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = Math.abs(ordered[index].midi - ordered[index - 1].midi);
    total += 1;
    if (gap <= 2) stepwise += 1;
    if (gap >= 7) leaps += 1;
  }
  const start = ordered[0]?.startBeat ?? 0;
  const end = ordered.reduce((max, note) => Math.max(max, note.startBeat + note.durationBeat), start);
  const sounding = ordered.reduce((sum, note) => sum + note.durationBeat, 0);
  const span = Math.max(0.01, end - start);
  return { stepwise, leaps, total, rest: Math.max(0, 1 - Math.min(1, sounding / span)), span };
}

export function analyzeMidi(parsed: ParsedMidi): FileAnalysis {
  const musical = parsed.tracks.filter((track) => track.notes.length > 0);
  const ranked = [...musical].sort((a, b) => median(b.notes.map((note) => note.midi)) - median(a.notes.map((note) => note.midi)));
  const centers: Partial<Record<VoiceName, number>> = {};
  ranked.slice(0, VOICES.length).forEach((track, index) => {
    centers[VOICES[index]] = Math.round(median(track.notes.map((note) => note.midi)));
  });
  const all = musical.flatMap((track) => track.notes);
  const stats = motion(all);
  return {
    tracks: musical.map((track) => ({
      name: track.name,
      notes: track.notes.length,
      low: Math.min(...track.notes.map((note) => note.midi)),
      high: Math.max(...track.notes.map((note) => note.midi)),
      median: Math.round(median(track.notes.map((note) => note.midi))),
    })),
    noteCount: all.length,
    stepwiseRatio: stats.total ? stats.stepwise / stats.total : 0,
    leapRatio: stats.total ? stats.leaps / stats.total : 0,
    restRatio: stats.rest,
    centers,
  };
}

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listCorpus(): Promise<CorpusFile[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as CorpusFile[]).sort((a, b) => b.addedAt - a.addedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveCorpus(file: CorpusFile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(file);
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

export function countsTowardProfile(name: string): boolean {
  return !/chaostik/i.test(name);
}

export function profileFrom(files: CorpusFile[]): StyleProfile | null {
  const usable = files.filter(
    (file) => file.valid && file.analysis && file.analysis.noteCount > 0 && countsTowardProfile(file.name),
  );
  if (!usable.length) return null;
  const weight = usable.reduce((sum, file) => sum + (file.analysis?.noteCount ?? 0), 0);
  const mix = (pick: (file: FileAnalysis) => number) =>
    usable.reduce((sum, file) => sum + pick(file.analysis as FileAnalysis) * (file.analysis?.noteCount ?? 0), 0) / weight;
  const centers: StyleProfile["centers"] = {};
  VOICES.forEach((voice) => {
    const rows = usable.filter((file) => file.analysis?.centers[voice] !== undefined);
    if (!rows.length) return;
    const total = rows.reduce((sum, file) => sum + (file.analysis?.noteCount ?? 0), 0);
    centers[voice] = Math.round(
      rows.reduce((sum, file) => sum + (file.analysis?.centers[voice] ?? 0) * (file.analysis?.noteCount ?? 0), 0) / total,
    );
  });
  return {
    version: 1,
    sourceFiles: usable.length,
    noteCount: weight,
    stepwiseRatio: mix((file) => file.stepwiseRatio),
    leapRatio: mix((file) => file.leapRatio),
    restRatio: mix((file) => file.restRatio),
    centers,
  };
}

export async function ingestBuffer(name: string, buffer: ArrayBuffer, known: CorpusFile[]): Promise<{ file: CorpusFile; duplicate: boolean }> {
  const hash = await sha256(buffer);
  if (known.some((file) => file.hash === hash)) {
    return {
      duplicate: true,
      file: { id: hash, name, hash, bytes: buffer.byteLength, addedAt: Date.now(), valid: false, reason: "Doublon" },
    };
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".mscz")) {
    return {
      duplicate: false,
      file: { id: `${hash}-mscz`, name, hash, bytes: buffer.byteLength, addedAt: Date.now(), valid: false, reason: "MuseScore .mscz non décompressé dans le navigateur" },
    };
  }
  try {
    const parsed: ParsedMidi = lower.endsWith(".xml") || lower.endsWith(".musicxml")
      ? musicXmlToParsed(new TextDecoder().decode(buffer))
      : parseMidi(buffer);
    const analysis = analyzeMidi(parsed);
    if (!analysis.noteCount) throw new Error("Aucune note");
    const file: CorpusFile = {
      id: hash,
      name,
      hash,
      bytes: buffer.byteLength,
      addedAt: Date.now(),
      valid: true,
      analysis,
    };
    await saveCorpus(file);
    return { file, duplicate: false };
  } catch (error) {
    const file: CorpusFile = {
      id: `${hash}-bad`,
      name,
      hash,
      bytes: buffer.byteLength,
      addedAt: Date.now(),
      valid: false,
      reason: error instanceof Error ? error.message : "Fichier rejeté",
    };
    return { file, duplicate: false };
  }
}

export function exportProfile(profile: StyleProfile): Blob {
  return new Blob([JSON.stringify({ ...profile, exportedAt: new Date().toISOString() }, null, 2)], {
    type: "application/json",
  });
}

export const VALIDATION_LOT = [
  "AFRI-CAN REUNION-17-02-2022.midi",
  "Flying-Circus-27-04-2021.mid",
  "HAZEL THEME PART 1.mid",
  "Joy’s Seven Spirits.mid",
  "pluie de notes .mid",
  "POUR-TOI-MA-BELLE -26-05-2021 2.mid",
  "Stay with us, my friend .mid",
  "New tune for Laureat 2019. Soprano.mid",
  "Softly as you are(2).mid",
  "En-Ordre-Chaostik.mid",
];
