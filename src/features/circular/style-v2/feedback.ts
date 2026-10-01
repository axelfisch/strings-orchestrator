import { STYLE_V2_SCHEMA_VERSION, type PreferenceRecord, type StyleCandidate } from "./types";

const STORAGE_KEY = "cso-style-v2-preferences-v1";

export function preferenceRecord(
  contextHash: string,
  candidates: StyleCandidate[],
  winnerId: string,
  createdAt = Date.now(),
  details: Pick<PreferenceRecord, "ratings" | "reasonTags" | "freeNote"> = {},
): PreferenceRecord {
  const winner = candidates.find((candidate) => candidate.id === winnerId);
  if (!winner) throw new Error("Le candidat gagnant doit appartenir à la comparaison");
  return {
    schemaVersion: STYLE_V2_SCHEMA_VERSION,
    id: `pref-${createdAt}-${winnerId}`,
    createdAt,
    contextHash,
    candidateIds: candidates.map((candidate) => candidate.id),
    winnerId,
    winnerEngine: winner.explanation.engine,
    transformationIds: winner.explanation.transformations.map((item) => item.id),
    ...details,
  };
}

export function loadPreferences(): PreferenceRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as PreferenceRecord[];
    return value.filter((row) => row.schemaVersion === STYLE_V2_SCHEMA_VERSION && row.winnerId);
  } catch {
    return [];
  }
}

export function savePreference(record: PreferenceRecord): void {
  if (typeof localStorage === "undefined") return;
  const current = loadPreferences();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, record].slice(-500)));
}

export function clearPreferences(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
