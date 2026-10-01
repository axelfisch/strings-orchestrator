import { FAMILIES, LIVE_THINKING_SCALES, VOICES } from "../types";
import type { AxelStyleBlueprint } from "./types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

export function loadAxelStyleBlueprint(value: unknown): { blueprint: AxelStyleBlueprint | null; errors: string[]; warnings: string[] } {
  const root = record(value);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (root.schema !== "circular-strings-orchestrator.style-profile") errors.push("schema_incorrect");
  if (root.version !== 2) errors.push("version_incorrecte");
  const ensemble = record(root.ensemble);
  const voices = strings(ensemble.voices);
  if (!sameSet(voices, [...VOICES])) errors.push("six_voix_canoniques_incorrectes");
  const harmonic = record(root.harmonicContract);
  const chordFamilies = strings(harmonic.chordFamilies);
  if (!sameSet(chordFamilies, FAMILIES.map((family) => family.id))) errors.push("familles_harmoniques_incorrectes");
  const scales = strings(harmonic.documentedScaleCollections).map((scale) => scale.split("_").join("-"));
  if (!sameSet(scales, LIVE_THINKING_SCALES.map((scale) => scale.id))) errors.push("gammes_documentees_incorrectes");
  const sixthScale = record(harmonic.sixthScale);
  if (sixthScale.status !== "unconfirmed") warnings.push("sixième gamme non explicitement marquée comme non confirmée");
  const extraction = record(root.featureExtraction);
  const scoring = record(root.candidateScoring);
  const feedback = record(root.humanFeedback);
  if (scoring.hardConstraintsBeforeScore !== true) errors.push("contraintes_dures_doivent_preceder_le_score");
  if (scoring.weightsStatus !== "to_be_learned_or_user_tuned") warnings.push("statut des poids à vérifier");
  if (root.status !== "blueprint_not_fitted") warnings.push("le profil n’est plus marqué blueprint_not_fitted; vérifier les poids et leur provenance");
  if (errors.length) return { blueprint: null, errors, warnings };
  return {
    blueprint: {
      schema: "circular-strings-orchestrator.style-profile",
      version: 2,
      status: typeof root.status === "string" ? root.status : "unknown",
      voices: voices as AxelStyleBlueprint["voices"],
      chordFamilies,
      scales,
      perPieceFeatures: strings(extraction.perPiece),
      perBarFeatures: strings(extraction.perBar),
      perVoiceFeatures: strings(extraction.perVoice),
      hardValidation: strings(extraction.hardValidation),
      scoringFormula: typeof scoring.formula === "string" ? scoring.formula : "",
      scoringWeightsStatus: typeof scoring.weightsStatus === "string" ? scoring.weightsStatus : "unknown",
      feedbackReasonTags: strings(feedback.recommendedReasonTags),
    },
    errors,
    warnings,
  };
}
