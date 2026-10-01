import assert from "node:assert/strict";
import { arrange, generateGrid } from "../src/features/circular/arrange";
import { measureUnits, normalizedEvents, toAbc, toChart, toHtmlReport, toMidi, toMusicXml, toProjectJson } from "../src/features/circular/exporters";
import { parseMidi } from "../src/features/circular/midi";
import { createProject } from "../src/features/circular/projects";

const project = createProject({ name: "Exports vérifiés", length: 8, keyName: "Bb", mode: "major", meter: "6/8", tempo: 78,
  bars: generateGrid({ key: "Bb", mode: "major", length: 8, seed: 19, meter: "6/8", harmonicLanguage: "chamber" }) });
const arrangement = arrange({ bars: project.bars, key: project.keyName, mode: project.mode, style: "Lilting 6/8", meter: project.meter,
  tempo: project.tempo, seed: project.seed, influence: 0, title: project.name });

const midiBlob = toMidi(arrangement);
assert.equal(midiBlob.type, "audio/midi");
const parsed = parseMidi(await midiBlob.arrayBuffer());
assert.equal(parsed.tracks.length, 7);
assert.ok(Math.abs(parsed.durationBeats - 24) < 0.01, `MIDI duration ${parsed.durationBeats}`);

const xml = await toMusicXml(arrangement).text();
assert.match(xml, /<score-partwise version="4.0">/);
assert.equal((xml.match(/<score-part id=/g) ?? []).length, 6);
assert.equal((xml.match(/<score-instrument id=/g) ?? []).length, 6);
assert.match(xml, /<octave-change>-1<\/octave-change>/);
const units = measureUnits(xml);
assert.equal(units.length, 48, "six parts times eight measures");
assert.ok(units.every((sum) => Math.abs(sum - 3) < 0.01), `measure durations ${units.join(",")}`);

const abc = await toAbc(arrangement).text();
assert.equal((abc.match(/^V:V\d/mg) ?? []).length, 6);
assert.match(abc, /M:6\/8/);
const chart = await toChart(arrangement).text();
assert.match(chart, /Exports vérifiés/);
assert.match(chart, /\[A1\]/);
const html = await toHtmlReport(arrangement).text();
assert.match(html, /Imprimer \/ enregistrer en PDF/);
assert.match(html, /Contrôle des registres/);
const projectRoundTrip = JSON.parse(await toProjectJson(project).text()) as { schemaVersion: number; bars: unknown[] };
assert.equal(projectRoundTrip.schemaVersion, 2);
assert.equal(projectRoundTrip.bars.length, 8);
assert.equal(normalizedEvents(arrangement).length, arrangement.notes.length);
console.log("export checks ok");
