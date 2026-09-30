import assert from "node:assert/strict";
import { arrange } from "../src/features/circular/arrange";
import { measureUnits, toMusicXml } from "../src/features/circular/exporters";
import { symbolFor } from "../src/features/circular/theory";
import type { StyleProfile } from "../src/features/circular/types";

assert.equal(symbolFor("F", "min9", "C"), "Fmin9/C");
assert.equal(symbolFor("F", "min9", "F"), "Fmin9");

const arrangement = arrange({
  bars: [{ chord: "Fmin9", second: "C13(b9)", locked: false, origin: "manual" }],
  key: "F",
  mode: "minor",
  style: "ECM Ballad",
  meter: "4/4",
  tempo: 72,
  seed: 3,
  influence: 0,
  title: "Split",
});
const starts = arrangement.notes.map((note) => note.start);
assert.ok(starts.some((start) => start < 2), "notes in the first half");
assert.ok(starts.some((start) => start >= 2), "notes in the second half");
const xml = await toMusicXml(arrangement).text();
assert.match(xml, /Fmin9/);
assert.match(xml, /C13\(b9\)/);
const sums = measureUnits(xml);
assert.ok(sums.length >= 6, "six staves");
assert.ok(sums.every((sum) => Math.abs(sum - 4) < 0.01), `durations ${sums.join(",")}`);

const profile: StyleProfile = {
  version: 1,
  sourceFiles: 4,
  noteCount: 400,
  stepwiseRatio: 0.1,
  leapRatio: 0.8,
  restRatio: 0.4,
  centers: { "Violin I": 88, "Violin II": 80, "Viola I": 74, "Viola II": 70, Cello: 60, Contrabass: 36 },
};
const base = {
  key: "D",
  mode: "major" as const,
  style: "ECM Ballad" as const,
  meter: "4/4" as const,
  tempo: 72,
  seed: 11,
  title: "Influence",
};
const bars = [{ chord: "Dmaj9(11+)", locked: false, origin: "generated" as const }];
const low = arrange({ ...base, bars, influence: 0, profile });
const high = arrange({ ...base, bars, influence: 100, profile });
const violin = (notes: { voice: string; midi: number }[]) =>
  notes.filter((note) => note.voice === "Violin I").map((note) => note.midi).join(",");
assert.notEqual(violin(low.notes), violin(high.notes));
console.log("engine checks ok");
