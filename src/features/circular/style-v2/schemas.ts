import { VOICES, type Meter } from "../types";
import { STYLE_V2_SCHEMA_VERSION, type CorpusManifestEntry, type FragmentIndex } from "./types";

const METERS = new Set<Meter>(["4/4", "3/4", "6/8"]);

export function validateManifestEntry(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["manifest_entry_not_object"];
  const row = value as Partial<CorpusManifestEntry>;
  if (row.schemaVersion !== STYLE_V2_SCHEMA_VERSION) errors.push("unsupported_schema_version");
  if (!row.sourceId) errors.push("missing_source_id");
  if (!row.sourceName) errors.push("missing_source_name");
  if (!row.sha256) errors.push("missing_sha256");
  if (row.rights === "unknown" && row.included) errors.push("unknown_rights_cannot_be_included");
  if (row.included && !row.workId) errors.push("included_source_requires_work_id");
  if (row.included && !row.split) errors.push("included_source_requires_split");
  if (row.detected && !METERS.has(row.detected.meter)) errors.push("invalid_meter");
  row.voiceMapping?.mappings.forEach((mapping) => {
    if (mapping.voice && !VOICES.includes(mapping.voice)) errors.push(`invalid_voice:${mapping.voice}`);
  });
  return [...new Set(errors)];
}

export function validateFragmentIndex(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["fragment_index_not_object"];
  const row = value as Partial<FragmentIndex>;
  const errors: string[] = [];
  if (row.schemaVersion !== STYLE_V2_SCHEMA_VERSION) errors.push("unsupported_schema_version");
  if (!row.indexId) errors.push("missing_index_id");
  if (!Array.isArray(row.patterns)) errors.push("patterns_not_array");
  row.patterns?.forEach((pattern, index) => {
    if (!pattern.patternId) errors.push(`pattern_${index}_missing_id`);
    if (!pattern.sourceId || !pattern.workId) errors.push(`pattern_${index}_missing_provenance`);
    if (!pattern.notes.length) errors.push(`pattern_${index}_empty`);
  });
  return errors;
}
