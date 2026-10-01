import assert from "node:assert/strict";
import { arrange, generateGrid } from "../src/features/circular/arrange";
import type { MidiTrack, ParsedMidi } from "../src/features/circular/midi";
import { createProject, migrateProject } from "../src/features/circular/projects";
import { FAMILIES, LIVE_THINKING_SCALES, VOICES, type VoiceName } from "../src/features/circular/types";
import {
  assertNoSplitLeakage,
  buildFragmentIndex,
  buildManifestEntry,
  checkArrangementConstraints,
  exactDuplicateGroups,
  extractFragments,
  featureDistance,
  fragmentToPattern,
  generateStyleCandidates,
  mapTracksToVoices,
  loadAxelStyleBlueprint,
  preferenceRecord,
  runStyleEngine,
  searchPatterns,
  transformPattern,
  validateFragmentIndex,
  validateManifestEntry,
  validatePattern,
} from "../src/features/circular/style-v2";

const pitches: Record<VoiceName, number> = {
  "Violin I": 74,
  "Violin II": 69,
  "Viola I": 65,
  "Viola II": 61,
  Cello: 50,
  Contrabass: 38,
};

function track(name: VoiceName, index: number): MidiTrack {
  return {
    name,
    channels: [index],
    programs: [],
    percussion: false,
    notes: Array.from({ length: 8 }, (_, beat) => ({
      midi: pitches[name] + (name === "Violin I" ? [0, 2, 3, 5][beat % 4] : beat % 2),
      startBeat: beat,
      durationBeat: 0.8,
      velocity: 70 + index,
      channel: index,
    })),
  };
}

const parsed: ParsedMidi = {
  source: "midi",
  format: 1,
  ppq: 480,
  tracks: VOICES.map(track),
  tempos: [{ beat: 0, bpm: 72 }],
  meters: [{ beat: 0, beats: 4, value: 4 }],
  keys: [{ beat: 0, fifths: -4, minor: true }],
  markers: [],
  harmonies: [{ bar: 0, offsetBeat: 0, symbol: "Fmin9" }, { bar: 1, offsetBeat: 0, symbol: "C7(b9)" }],
  durationBeats: 8,
};

const mapping = mapTracksToVoices(parsed);
assert.equal(mapping.unmappedTracks.length, 0);
assert.deepEqual(mapping.mappings.map((row) => row.voice), [...VOICES]);
assert.ok(mapping.mappings.every((row) => row.confidence >= 0.65));

const corrected = mapTracksToVoices(parsed, { 0: "Cello", 4: "Violin I" });
assert.equal(corrected.mappings.find((row) => row.trackIndex === 0)?.voice, "Cello");
assert.equal(corrected.mappings.find((row) => row.trackIndex === 0)?.corrected, true);

const blueprint = loadAxelStyleBlueprint({
  schema: "circular-strings-orchestrator.style-profile",
  version: 2,
  status: "blueprint_not_fitted",
  ensemble: { voices: [...VOICES] },
  harmonicContract: {
    chordFamilies: FAMILIES.map((family) => family.id),
    documentedScaleCollections: LIVE_THINKING_SCALES.map((scale) => scale.id.split("-").join("_")),
    sixthScale: { status: "unconfirmed" },
  },
  featureExtraction: { perPiece: ["form"], perBar: ["harmony"], perVoice: ["role"], hardValidation: ["range"] },
  candidateScoring: { formula: "fit - penalties", hardConstraintsBeforeScore: true, weightsStatus: "to_be_learned_or_user_tuned" },
  humanFeedback: { recommendedReasonTags: ["too_high", "sounds_like_axel"] },
});
assert.deepEqual(blueprint.errors, []);
assert.equal(blueprint.blueprint?.voices.length, 6);
assert.equal(blueprint.blueprint?.scales.length, 5);

const manifest = buildManifestEntry({
  sourceName: "fixture.mid",
  format: "midi",
  sha256: "a".repeat(64),
  bytes: 2048,
  durationBeats: 8,
  bars: 2,
  meter: "4/4",
  tempo: 72,
  trackCount: 6,
  workId: "work-fixture",
  rights: "owned",
  split: "train",
  voiceMapping: mapping,
});
assert.equal(manifest.included, true);
assert.deepEqual(validateManifestEntry(manifest), []);
assert.equal(exactDuplicateGroups([manifest, { ...manifest, sourceId: "copy" }]).length, 1);
assert.deepEqual(assertNoSplitLeakage([manifest]), []);
assert.deepEqual(assertNoSplitLeakage([manifest, { ...manifest, sourceId: "test", split: "test" }]), ["work-fixture"]);

const fragments = extractFragments(parsed, manifest);
assert.equal(fragments.length, 1);
assert.deepEqual(new Set(fragments[0].notes.map((note) => note.voice)), new Set(VOICES));
const pattern = fragmentToPattern(fragments[0]);
assert.deepEqual(validatePattern(pattern), []);

const index = buildFragmentIndex([pattern]);
assert.deepEqual(validateFragmentIndex(index), []);
assert.equal(featureDistance(pattern.features, pattern.features), 0);
const hits = searchPatterns(index, { features: pattern.features, split: "train" }, 2);
assert.equal(hits[0]?.pattern.patternId, pattern.patternId);
assert.equal(searchPatterns(index, { features: pattern.features, excludedWorkIds: [pattern.workId] }).length, 0);

const transformedA = transformPattern(pattern, { seed: 42 });
const transformedB = transformPattern(pattern, { seed: 42 });
assert.deepEqual(transformedA, transformedB, "transformations are seeded and deterministic");

const bars = generateGrid({ key: "F", mode: "minor", length: 8, seed: 2026, meter: "4/4", harmonicLanguage: "chamber" });
const arrangeInput = {
  bars,
  key: "F",
  mode: "minor" as const,
  style: "ECM Ballad" as const,
  meter: "4/4" as const,
  tempo: 72,
  seed: 2026,
  influence: 0,
  melodyMode: "controlled" as const,
};
const baseline = arrange(arrangeInput);
const disabled = runStyleEngine({ arrangeInput, settings: { enabled: false, candidateCount: 3 }, index });
assert.equal(disabled.active, false);
assert.deepEqual(disabled.arrangement, baseline, "disabled feature flag is an exact V1 fallback");
const missing = runStyleEngine({ arrangeInput, settings: { enabled: true, candidateCount: 3 }, index: null });
assert.deepEqual(missing.arrangement, baseline, "missing index is an exact V1 fallback");

const candidates = generateStyleCandidates(arrangeInput, index, 3);
assert.ok(candidates.length >= 2, "a local pattern produces at least one V2 candidate plus V1");
assert.ok(candidates.every((candidate) => candidate.explanation.constraints.valid));
assert.ok(candidates.every((candidate) => checkArrangementConstraints(candidate.arrangement).valid));
assert.deepEqual(generateStyleCandidates(arrangeInput, index, 3), candidates, "candidate generation is deterministic");
const enabled = runStyleEngine({ arrangeInput, settings: { enabled: true, candidateCount: 3 }, index });
assert.ok(enabled.candidates.length >= 2);
assert.ok(enabled.candidates.some((candidate) => candidate.explanation.engine === "style-v2"));

const record = preferenceRecord("context-fixture", candidates, candidates[0].id, 1000, { ratings: { axelSimilarity: 4 }, reasonTags: ["sounds_like_axel"] });
assert.equal(record.winnerId, candidates[0].id);
assert.equal(record.ratings?.axelSimilarity, 4);
assert.throws(() => preferenceRecord("context-fixture", candidates, "absent", 1000));

const oldProject = migrateProject({ name: "Ancien", length: 8 });
assert.deepEqual(oldProject.styleV2, { enabled: false, candidateCount: 3 });
const project = createProject({ length: 8, styleV2: { enabled: true, candidateCount: 4, indexId: index.indexId } });
assert.equal(migrateProject(project).styleV2?.indexId, index.indexId);

console.log("style v2 checks ok");
