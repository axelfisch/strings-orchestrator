import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { arrange, generateGrid } from "../src/features/circular/arrange";
import { toMidi, toMusicXml } from "../src/features/circular/exporters";
import { analyzeParsedSource } from "../src/features/circular/importer";
import { musicXmlToParsed, parseMidi } from "../src/features/circular/midi";

const arrangement = arrange({ bars: generateGrid({ key: "D", mode: "major", length: 8, seed: 7, meter: "3/4", harmonicLanguage: "chamber" }),
  key: "D", mode: "major", style: "Jazz Waltz", meter: "3/4", tempo: 116, seed: 7, influence: 0, title: "Round trip" });
const midi = parseMidi(await toMidi(arrangement).arrayBuffer());
assert.equal(midi.format, 1);
assert.equal(midi.tracks.length, 7, "meta plus six voice tracks");
assert.equal(midi.meters[0]?.beats, 3);
assert.equal(Math.round(midi.tempos[0]?.bpm ?? 0), 116);
assert.ok(midi.tracks.slice(1).every((track) => track.notes.length > 0));
const midiAnalysis = analyzeParsedSource("round-trip.mid", midi);
assert.equal(midiAnalysis.meter, "3/4");
assert.ok(midiAnalysis.melodyTrack !== null);
assert.equal(midiAnalysis.harmonies.length, 8);

const xml = musicXmlToParsed(await toMusicXml(arrangement).text());
assert.equal(xml.tracks.length, 6);
assert.equal(xml.harmonies.length, arrangement.bars.reduce((sum, bar) => sum + bar.harmonies.length, 0));
assert.equal(xml.meters[0]?.beats, 3);
assert.equal(Math.round(xml.tempos[0]?.bpm ?? 0), 116);
assert.ok(xml.tracks.every((track) => track.notes.length > 0));
assert.match(xml.harmonies[0]?.symbol ?? "", /^[A-G]/);

const fixture = await readFile(new URL("../public/corpus/Stay-with-us-my-friend.mid", import.meta.url));
const fixtureParsed = parseMidi(fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength));
const fixtureAnalysis = analyzeParsedSource("Stay-with-us-my-friend.mid", fixtureParsed);
assert.ok(fixtureAnalysis.importedNotes.length > 0);
assert.ok(fixtureAnalysis.tracks.some((track) => track.noteCount > 0));
assert.ok(fixtureAnalysis.harmonies.length >= 1);
assert.ok(fixtureAnalysis.harmonies.flat().every((harmony) => harmony.confidence === undefined || harmony.confidence <= 0.92), "detected harmony confidence stays calibrated");
console.log("import checks ok");
