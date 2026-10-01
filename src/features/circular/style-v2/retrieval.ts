import { featureEntries } from "./features";
import type { FragmentFeatureVector, FragmentIndex, RetrievalQuery, SearchHit } from "./types";

const WEIGHTS: Record<keyof FragmentFeatureVector, number> = {
  density: 1.2,
  restRatio: 0.8,
  syncopation: 1,
  stepwiseRatio: 1,
  leapRatio: 1,
  meanInterval: 0.8,
  register: 1.1,
  duration: 0.5,
  voiceMask: 1.4,
  harmonicRhythm: 0.8,
  functionCode: 1.2,
};

export function featureDistance(a: FragmentFeatureVector, b: FragmentFeatureVector): number {
  const weighted = featureEntries(a).reduce((sum, [key, value]) => sum + WEIGHTS[key] * (value - b[key]) ** 2, 0);
  const total = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
  return Math.sqrt(weighted / total);
}

export function searchPatterns(index: FragmentIndex, query: RetrievalQuery, k = 4): SearchHit[] {
  const excluded = new Set(query.excludedWorkIds ?? []);
  return index.patterns
    .filter((pattern) => !excluded.has(pattern.workId))
    .filter((pattern) => !query.split || pattern.split === query.split)
    .filter((pattern) => !query.harmonicFunction || pattern.harmonicFunction === "unknown" || pattern.harmonicFunction === query.harmonicFunction)
    .filter((pattern) => !query.allowedVoices?.length || pattern.notes.some((note) => query.allowedVoices?.includes(note.voice)))
    .map((pattern) => {
      const distance = featureDistance(pattern.features, query.features);
      const reasons = [
        `distance ${distance.toFixed(3)}`,
        `densité Δ${Math.abs(pattern.features.density - query.features.density).toFixed(2)}`,
        `registre Δ${Math.abs(pattern.features.register - query.features.register).toFixed(2)}`,
      ];
      return { pattern, distance, reasons };
    })
    .sort((a, b) => a.distance - b.distance || a.pattern.patternId.localeCompare(b.pattern.patternId))
    .slice(0, Math.max(0, k));
}
