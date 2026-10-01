import { STYLE_V2_SCHEMA_VERSION, type FragmentIndex, type PatternIR } from "./types";

export function buildFragmentIndex(patterns: PatternIR[], extractorVersion = "style-v2.1", createdAt = new Date().toISOString()): FragmentIndex {
  const unique = new Map<string, PatternIR>();
  patterns.forEach((pattern) => unique.set(pattern.patternId, pattern));
  const ordered = [...unique.values()].sort((a, b) => a.patternId.localeCompare(b.patternId));
  const signature = ordered.map((pattern) => pattern.patternId).join("|");
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
  return {
    schemaVersion: STYLE_V2_SCHEMA_VERSION,
    indexId: `idx-${(hash >>> 0).toString(16).padStart(8, "0")}`,
    createdAt,
    extractorVersion,
    patterns: ordered,
  };
}
