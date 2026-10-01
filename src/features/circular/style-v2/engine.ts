import { arrange, type ArrangeInput } from "../arrange";
import type { StyleV2Settings } from "../types";
import { generateStyleCandidates } from "./candidate-generator";
import type { FragmentIndex, PreferenceRecord, StyleEngineV2Result } from "./types";

export interface StyleEngineV2Input {
  arrangeInput: ArrangeInput;
  settings?: StyleV2Settings;
  index?: FragmentIndex | null;
  preferences?: PreferenceRecord[];
}

export function runStyleEngine(input: StyleEngineV2Input): StyleEngineV2Result {
  const baseline = arrange(input.arrangeInput);
  if (!input.settings?.enabled) {
    return { arrangement: baseline, candidates: [], selectedCandidateId: "v1-baseline", active: false, reason: "Style V2 désactivé" };
  }
  if (!input.index?.patterns.length) {
    return { arrangement: baseline, candidates: [], selectedCandidateId: "v1-baseline", active: false, reason: "Index Style V2 absent ou vide; repli V1" };
  }
  const candidates = generateStyleCandidates(input.arrangeInput, input.index, input.settings.candidateCount, input.preferences);
  const selected = candidates.find((candidate) => candidate.id === input.settings?.selectedCandidateId && candidate.explanation.constraints.valid)
    ?? candidates.find((candidate) => candidate.explanation.constraints.valid)
    ?? candidates[0];
  if (!selected) return { arrangement: baseline, candidates: [], selectedCandidateId: "v1-baseline", active: false, reason: "Aucun candidat V2 valide; repli V1" };
  return { arrangement: selected.arrangement, candidates, selectedCandidateId: selected.id, active: selected.explanation.engine === "style-v2", reason: selected.explanation.summary };
}
