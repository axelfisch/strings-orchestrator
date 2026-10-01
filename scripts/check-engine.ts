import assert from "node:assert/strict";
import { arrange, generateGrid } from "../src/features/circular/arrange";
import { CHORD_INTERVALS, RANGES, chordTones, makeHarmonyEvent, splitBarHarmony, symbolFor } from "../src/features/circular/theory";
import { FAMILIES, LIVE_THINKING_SCALES, VOICES, type StyleProfile } from "../src/features/circular/types";

assert.equal(FAMILIES.length, 24, "exactly 24 canonical chord families");
assert.equal(new Set(FAMILIES.map((family) => family.id)).size, 24, "canonical families are unique");
assert.equal(LIVE_THINKING_SCALES.length, 5, "exactly five documented scales");
FAMILIES.forEach((family) => {
  assert.ok(CHORD_INTERVALS[family.id], `intervals exist for ${family.id}`);
  assert.ok(chordTones(0, family.id).every((pitch) => pitch >= 0 && pitch < 12), `${family.id} transposes safely`);
});
assert.equal(symbolFor("F", "min9", "C"), "Fmin9/C");
assert.equal(symbolFor("F", "min9", "F"), "Fmin9");

const generated = generateGrid({ key: "F", mode: "minor", length: 32, seed: 2026, meter: "4/4", harmonicLanguage: "chamber" });
assert.equal(generated.length, 32);
assert.deepEqual(generated, generateGrid({ key: "F", mode: "minor", length: 32, seed: 2026, meter: "4/4", harmonicLanguage: "chamber" }), "generation is deterministic");

const split = splitBarHarmony({ harmonies: [makeHarmonyEvent("Fmin9", 0, 4, "manual")], locked: false, origin: "manual" }, "C13(b9)", "4/4");
const arrangement = arrange({
  bars: [split], key: "F", mode: "minor", style: "ECM Ballad", meter: "4/4", tempo: 72,
  seed: 3, influence: 0, title: "Split", melodyMode: "manual", manualMelodyVoice: "Cello",
});
assert.ok(arrangement.notes.some((note) => note.start < 2), "notes exist in first half");
assert.ok(arrangement.notes.some((note) => note.start >= 2), "notes exist in second half");
assert.equal(arrangement.sectionPlans[0].melody, "Cello");
assert.ok(arrangement.notes.every((note) => note.midi >= RANGES[note.voice].absoluteMin && note.midi <= RANGES[note.voice].absoluteMax));
assert.deepEqual(new Set(arrangement.notes.map((note) => note.voice)), new Set(VOICES), "all six voices are generated");

const profile: StyleProfile = {
  version: 2, sourceFiles: 4, noteCount: 400, stepwiseRatio: 0.65, leapRatio: 0.12, restRatio: 0.25,
  centers: { "Violin I": 77, "Violin II": 70, "Viola I": 66, "Viola II": 63, Cello: 51, Contrabass: 40 },
  density: 0.72, syncopationRatio: 0.2, meanPhraseLength: 5, contraryMotionRatio: 0.35,
  obliqueMotionRatio: 0.4, parallelMotionRatio: 0.25, medianSpacing: 5, crossingRatio: 0,
  doublingRatio: 0.08, harmonicRhythm: 1.3, midBarChangeRatio: 0.3, transferRatio: 0.2, dynamicRange: 0.3,
};
const profiled = arrange({ bars: generated, key: "F", mode: "minor", style: "ECM Ballad", meter: "4/4", tempo: 72,
  seed: 3, influence: 100, title: "Profile", profile });
assert.match(profiled.report.influences.join(" "), /400 notes/);
assert.equal(profiled.report.rangeFaults, 0);
console.log("engine checks ok");
