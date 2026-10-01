import { generateGrid } from "./arrange";
import { migrateProjectBar } from "./theory";
import {
  SCHEMA_VERSION,
  STYLES,
  type LegacyProjectBar,
  type Meter,
  type ProjectDocument,
  type StyleName,
} from "./types";

export const PROJECT_LIBRARY_KEY = "cso-project-library-v2";
export const ACTIVE_PROJECT_KEY = "cso-active-project-v2";
const LEGACY_PROJECT_KEY = "cso-project-v1";

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cso-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createProject(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  const now = Date.now();
  const length = overrides.length ?? 32;
  const keyName = overrides.keyName ?? "F";
  const mode = overrides.mode ?? "minor";
  const meter = overrides.meter ?? "4/4";
  const seed = overrides.seed ?? 2026;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: overrides.id ?? id(),
    name: overrides.name ?? "Sextuor sans titre",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    length,
    keyName,
    mode,
    style: overrides.style ?? "ECM Ballad",
    genre: overrides.genre ?? "Cinematic Strings",
    meter,
    tempo: overrides.tempo ?? 72,
    seed,
    influence: overrides.influence ?? 0,
    harmonicLanguage: overrides.harmonicLanguage ?? "automatic",
    scale: overrides.scale ?? (mode === "minor" ? "harmonic-minor" : "major"),
    melodyMode: overrides.melodyMode ?? "canonical",
    manualMelodyVoice: overrides.manualMelodyVoice ?? "Violin I",
    registerMode: overrides.registerMode ?? "medium",
    bars: overrides.bars?.length
      ? overrides.bars
      : generateGrid({ key: keyName, mode, length, seed, meter, harmonicLanguage: overrides.harmonicLanguage ?? "automatic" }),
    importedMelody: overrides.importedMelody ?? [],
    lockedVoices: overrides.lockedVoices ?? [],
    voiceHolds: overrides.voiceHolds ?? {},
    barHolds: overrides.barHolds ?? {},
  };
}

function validLength(value: unknown): 8 | 16 | 32 {
  return value === 8 || value === 16 || value === 32 ? value : 32;
}

function validMeter(value: unknown): Meter {
  return value === "3/4" || value === "6/8" ? value : "4/4";
}

function validStyle(value: unknown): StyleName {
  return STYLES.includes(value as StyleName) ? value as StyleName : "ECM Ballad";
}

export function migrateProject(value: unknown): ProjectDocument {
  if (!value || typeof value !== "object") return createProject();
  const raw = value as Record<string, unknown>;
  const meter = validMeter(raw.meter);
  const length = validLength(raw.length);
  const bars = Array.isArray(raw.bars)
    ? (raw.bars as LegacyProjectBar[]).slice(0, length).map((bar) => migrateProjectBar(bar, meter))
    : [];
  const base = createProject({
    id: typeof raw.id === "string" ? raw.id : undefined,
    name: typeof raw.name === "string" ? raw.name : undefined,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : undefined,
    length,
    keyName: typeof raw.keyName === "string" ? raw.keyName : undefined,
    mode: raw.mode === "major" ? "major" : "minor",
    style: validStyle(raw.style),
    genre: typeof raw.genre === "string" ? raw.genre : undefined,
    meter,
    tempo: typeof raw.tempo === "number" ? raw.tempo : undefined,
    seed: typeof raw.seed === "number" ? raw.seed : undefined,
    influence: typeof raw.influence === "number" ? raw.influence : undefined,
    harmonicLanguage:
      raw.harmonicLanguage === "pop-soft" || raw.harmonicLanguage === "chamber" || raw.harmonicLanguage === "custom"
        ? raw.harmonicLanguage
        : "automatic",
    scale:
      raw.scale === "melodic-minor" || raw.scale === "harmonic-minor" || raw.scale === "diminished" || raw.scale === "whole-tone"
        ? raw.scale
        : "major",
    melodyMode:
      raw.melodyMode === "controlled" || raw.melodyMode === "manual" || raw.melodyMode === "preserve-import"
        ? raw.melodyMode
        : "canonical",
    manualMelodyVoice:
      raw.manualMelodyVoice === "Violin II" || raw.manualMelodyVoice === "Viola I" || raw.manualMelodyVoice === "Viola II" || raw.manualMelodyVoice === "Cello" || raw.manualMelodyVoice === "Contrabass"
        ? raw.manualMelodyVoice
        : "Violin I",
    registerMode: raw.registerMode === "low" || raw.registerMode === "high" || raw.registerMode === "custom" ? raw.registerMode : "medium",
    bars: bars.length ? bars : undefined,
    importedMelody: Array.isArray(raw.importedMelody) ? raw.importedMelody as ProjectDocument["importedMelody"] : [],
    lockedVoices: Array.isArray(raw.lockedVoices) ? raw.lockedVoices as ProjectDocument["lockedVoices"] : [],
    voiceHolds: raw.voiceHolds && typeof raw.voiceHolds === "object" ? raw.voiceHolds as ProjectDocument["voiceHolds"] : {},
    barHolds: raw.barHolds && typeof raw.barHolds === "object" ? raw.barHolds as ProjectDocument["barHolds"] : {},
  });
  while (base.bars.length < base.length) {
    const generated = generateGrid({
      key: base.keyName,
      mode: base.mode,
      length: base.length,
      seed: base.seed,
      meter: base.meter,
      harmonicLanguage: base.harmonicLanguage,
    });
    base.bars.push(generated[base.bars.length]);
  }
  return base;
}

export function loadProjectLibrary(): ProjectDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY) ?? "[]") as unknown;
    if (Array.isArray(parsed) && parsed.length) return parsed.map(migrateProject).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    // Continue to the legacy migration.
  }
  try {
    const legacy = localStorage.getItem(LEGACY_PROJECT_KEY);
    if (!legacy) return [];
    const migrated = migrateProject(JSON.parse(legacy));
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify([migrated]));
    localStorage.setItem(ACTIVE_PROJECT_KEY, migrated.id);
    return [migrated];
  } catch {
    return [];
  }
}

export function saveProject(project: ProjectDocument): ProjectDocument {
  const saved = { ...migrateProject(project), schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
  if (typeof window === "undefined") return saved;
  const library = loadProjectLibrary().filter((item) => item.id !== saved.id);
  localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify([saved, ...library]));
  localStorage.setItem(ACTIVE_PROJECT_KEY, saved.id);
  return saved;
}

export function deleteProject(projectId: string): ProjectDocument[] {
  const remaining = loadProjectLibrary().filter((project) => project.id !== projectId);
  if (typeof window !== "undefined") {
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(remaining));
    if (localStorage.getItem(ACTIVE_PROJECT_KEY) === projectId) localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
  return remaining;
}

export function duplicateProject(project: ProjectDocument): ProjectDocument {
  return saveProject({
    ...project,
    id: id(),
    name: `${project.name} — copie`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bars: project.bars.map((bar) => ({ ...bar, harmonies: bar.harmonies.map((event) => ({ ...event })) })),
    importedMelody: project.importedMelody.map((note) => ({ ...note })),
    lockedVoices: [...project.lockedVoices],
    voiceHolds: Object.fromEntries(Object.entries(project.voiceHolds).map(([voice, notes]) => [voice, notes?.map((note) => ({ ...note }))])),
    barHolds: Object.fromEntries(Object.entries(project.barHolds).map(([bar, notes]) => [bar, notes.map((note) => ({ ...note }))])),
  });
}

export function activeProjectId(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function projectJson(project: ProjectDocument): Blob {
  return new Blob([JSON.stringify({ ...project, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2)], {
    type: "application/json;charset=utf-8",
  });
}

export async function projectFromFile(file: File): Promise<ProjectDocument> {
  const parsed = JSON.parse(await file.text()) as unknown;
  return migrateProject(parsed);
}
