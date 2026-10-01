import type { Meter } from "../types";
import { STYLE_V2_SCHEMA_VERSION, type CorpusManifestEntry, type CorpusRights, type CorpusSplit, type VoiceMappingResult } from "./types";

export interface ManifestInput {
  sourceName: string;
  format: "midi" | "musicxml";
  sha256: string;
  bytes: number;
  durationBeats: number;
  bars: number;
  meter: Meter;
  tempo: number;
  trackCount: number;
  workId?: string | null;
  variantId?: string | null;
  rights?: CorpusRights;
  split?: CorpusSplit | null;
  voiceMapping?: VoiceMappingResult | null;
  extractorVersion?: string;
}

export function stableSourceId(hash: string): string {
  return `src-${hash.slice(0, 16).toLowerCase()}`;
}

export function buildManifestEntry(input: ManifestInput): CorpusManifestEntry {
  const rights = input.rights ?? "unknown";
  const workId = input.workId ?? null;
  const split = input.split ?? null;
  const warnings: string[] = [];
  if (rights === "unknown") warnings.push("Droits à confirmer avant inclusion");
  if (!workId) warnings.push("workId à confirmer; aucune œuvre n’est inférée du nom de fichier");
  if (!split) warnings.push("Split à attribuer au niveau de l’œuvre");
  if (!input.voiceMapping) warnings.push("Mapping des six voix non vérifié");
  const included = rights === "owned" || rights === "licensed";
  return {
    schemaVersion: STYLE_V2_SCHEMA_VERSION,
    sourceId: stableSourceId(input.sha256),
    workId,
    variantId: input.variantId ?? null,
    sourceName: input.sourceName,
    format: input.format,
    sha256: input.sha256.toLowerCase(),
    bytes: input.bytes,
    rights,
    included: included && Boolean(workId && split),
    exclusionReason: included && workId && split ? undefined : "review_required",
    split,
    detected: {
      durationBeats: Math.max(0, input.durationBeats),
      bars: Math.max(0, Math.floor(input.bars)),
      meter: input.meter,
      tempo: Math.max(1, input.tempo),
      trackCount: Math.max(0, Math.floor(input.trackCount)),
    },
    voiceMapping: input.voiceMapping ?? null,
    extractorVersion: input.extractorVersion ?? "style-v2.1",
    warnings,
  };
}

export function exactDuplicateGroups(entries: CorpusManifestEntry[]): CorpusManifestEntry[][] {
  const groups = new Map<string, CorpusManifestEntry[]>();
  entries.forEach((entry) => groups.set(entry.sha256, [...(groups.get(entry.sha256) ?? []), entry]));
  return [...groups.values()].filter((group) => group.length > 1);
}

export function assertNoSplitLeakage(entries: CorpusManifestEntry[]): string[] {
  const byWork = new Map<string, Set<CorpusSplit>>();
  entries.forEach((entry) => {
    if (!entry.workId || !entry.split) return;
    if (!byWork.has(entry.workId)) byWork.set(entry.workId, new Set());
    byWork.get(entry.workId)?.add(entry.split);
  });
  return [...byWork.entries()].filter(([, splits]) => splits.size > 1).map(([workId]) => workId);
}
