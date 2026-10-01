import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { arrange, generateGrid } from "../../src/features/circular/arrange";
import { toMidi, toMusicXml } from "../../src/features/circular/exporters";
import { musicXmlToParsed, parseMidi } from "../../src/features/circular/midi";
import { runStyleEngine, validateFragmentIndex, type FragmentIndex } from "../../src/features/circular/style-v2";
import { VOICES } from "../../src/features/circular/types";

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function main() {
  const indexPath = path.resolve(process.argv[2] ?? "tmp/style-v2/validation-index.json");
  const output = path.resolve(process.argv[3] ?? "output/phase3-ab");
  const index = JSON.parse(await readFile(indexPath, "utf8")) as FragmentIndex;
  assert.deepEqual(validateFragmentIndex(index), [], "the validation index must be structurally valid");

  const arrangeInput = {
    bars: generateGrid({ key: "F", mode: "minor", length: 8, seed: 2026, meter: "4/4", harmonicLanguage: "chamber" }),
    key: "F",
    mode: "minor" as const,
    style: "ECM Ballad" as const,
    meter: "4/4" as const,
    tempo: 72,
    seed: 2026,
    influence: 0,
    melodyMode: "manual" as const,
    manualMelodyVoice: "Cello" as const,
  };
  const v1 = arrange(arrangeInput);
  const result = runStyleEngine({ arrangeInput, settings: { enabled: true, candidateCount: 3 }, index });
  const v2 = result.candidates.find((candidate) => candidate.explanation.engine === "style-v2");
  assert.ok(v2, "a valid V2 candidate is required for the A/B package");

  await mkdir(output, { recursive: true });
  const entries = [
    { blindName: "candidate-A", engine: "v1", arrangement: v1 },
    { blindName: "candidate-B", engine: "style-v2", arrangement: v2.arrangement },
  ] as const;

  const verification = [];
  for (const entry of entries) {
    const midi = await blobBytes(toMidi(entry.arrangement));
    const xml = await toMusicXml(entry.arrangement).text();
    await writeFile(path.join(output, `${entry.blindName}.mid`), midi);
    await writeFile(path.join(output, `${entry.blindName}.musicxml`), xml, "utf8");

    const parsedMidi = parseMidi(midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength));
    const parsedXml = musicXmlToParsed(xml);
    const midiVoiceTracks = parsedMidi.tracks.filter((track) => track.notes.length > 0);
    assert.equal(midiVoiceTracks.length, VOICES.length, `${entry.blindName} MIDI must contain six sounding tracks`);
    assert.equal(parsedXml.tracks.filter((track) => track.notes.length > 0).length, VOICES.length, `${entry.blindName} MusicXML must contain six sounding parts`);
    assert.ok(parsedMidi.tracks.some((track) => track.name === "Violoncelle"), `${entry.blindName} MIDI must name the cello track`);
    assert.ok(parsedXml.tracks.some((track) => track.name === "Violoncelle"), `${entry.blindName} MusicXML must name the cello part`);
    verification.push({
      candidate: entry.blindName,
      engine: entry.engine,
      midiBytes: midi.byteLength,
      midiTracks: parsedMidi.tracks.length,
      midiSoundingTracks: midiVoiceTracks.length,
      midiNotes: parsedMidi.tracks.reduce((sum, track) => sum + track.notes.length, 0),
      musicXmlBytes: Buffer.byteLength(xml),
      musicXmlParts: parsedXml.tracks.length,
      musicXmlSoundingParts: parsedXml.tracks.filter((track) => track.notes.length > 0).length,
      musicXmlNotes: parsedXml.tracks.reduce((sum, track) => sum + track.notes.length, 0),
      melodyCarrier: entry.arrangement.report.melodyBySection.A1,
      technicalQuality: entry.arrangement.report.quality,
      technicalAnomalies: 100 - entry.arrangement.report.quality,
    });
  }

  await writeFile(path.join(output, "README.md"), `# Écoute humaine A/B — Phase 3\n\nÉcouter les deux fichiers MIDI sans consulter la clé, puis noter pour chacun : fluidité, clarté mélodique, équilibre des registres, naturel des six voix et proximité avec le style Axel. La mélodie est volontairement confiée au violoncelle afin de vérifier qu’elle n’est ni imposée au Violon I ni forcée comme note supérieure.\n`, "utf8");
  await writeFile(path.join(output, "answer-key.json"), `${JSON.stringify({ "candidate-A": "V1", "candidate-B": "Style V2", indexId: index.indexId }, null, 2)}\n`, "utf8");
  await writeFile(path.join(output, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, indexId: index.indexId, verification }, null, 2));
}

void main();
