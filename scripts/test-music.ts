import assert from "node:assert/strict";
import { arrange, generateGrid } from "../src/features/circular/arrange";
import { RANGES } from "../src/features/circular/theory";
import { STYLES, VOICES, type Meter, type NoteEvent } from "../src/features/circular/types";

const meterFor = (style: typeof STYLES[number]): Meter => style === "Jazz Waltz" ? "3/4" : style === "Lilting 6/8" ? "6/8" : "4/4";
for (const style of STYLES) {
  const meter = meterFor(style);
  const bars = generateGrid({ key: "F", mode: "minor", length: 32, seed: 2026, meter, harmonicLanguage: "chamber", style });
  const result = arrange({ bars, key: "F", mode: "minor", style, meter, tempo: 76, seed: 2026, influence: 0, title: style });
  assert.equal(result.bars.length, 32);
  assert.equal(result.report.rangeFaults, 0, `${style} has no technical range fault`);
  assert.ok(result.notes.length > 100, `${style} produces a developed arrangement`);
  VOICES.forEach((voice) => {
    const notes = result.notes.filter((note) => note.voice === voice);
    assert.ok(notes.length > 0, `${style}: ${voice} is present`);
    assert.ok(notes.every((note) => note.midi >= RANGES[voice].absoluteMin && note.midi <= RANGES[voice].absoluteMax));
  });
  assert.equal(result.report.melodyBySection.A1, "Violin I");
  assert.equal(result.report.melodyBySection.B, "Cello", "canonical B section gives the melody to cello");
}

const controlled = arrange({ bars: generateGrid({ key: "C", mode: "major", length: 32, seed: 4 }), key: "C", mode: "major",
  style: "ECM Ballad", meter: "4/4", tempo: 72, seed: 4, influence: 0, melodyMode: "controlled" });
assert.ok(Object.values(controlled.report.melodyBySection).every((voice) => voice !== "Contrabass"));
assert.ok(new Set(Object.values(controlled.report.melodyBySection)).size >= 3, "controlled mode transfers melody between voices");

const imported: NoteEvent[] = [
  { voice: "Viola I", midi: 64, start: 0, duration: 1, velocity: 82, bar: 1, role: "melody", source: "imported" },
  { voice: "Viola I", midi: 67, start: 1, duration: 1, velocity: 82, bar: 1, role: "melody", source: "imported" },
];
const preserveInput = { bars: generateGrid({ key: "C", mode: "major", length: 8, seed: 5 }), key: "C", mode: "major" as const,
  style: "ECM Ballad" as const, meter: "4/4" as const, tempo: 72, seed: 5, influence: 0, melodyMode: "preserve-import" as const, importedMelody: imported };
const preserved = arrange(preserveInput);
assert.deepEqual(preserved.notes.filter((note) => note.source === "imported").map((note) => [note.voice, note.midi, note.start]),
  [["Viola I", 64, 0], ["Viola I", 67, 1]]);
assert.deepEqual(arrange(preserveInput).notes, preserved.notes, "same seed and input are deterministic");
console.log("musical checks ok");
