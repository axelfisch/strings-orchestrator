import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { musicXmlToParsed, parseMidi } from "../../src/features/circular/midi";
import { quartersPerBar } from "../../src/features/circular/theory";
import type { Meter } from "../../src/features/circular/types";
import { buildManifestEntry } from "../../src/features/circular/style-v2/manifest";
import { mapTracksToVoices } from "../../src/features/circular/style-v2/voice-mapping";

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  }));
  return nested.flat().filter((file) => /\.(mid|midi|xml|musicxml)$/i.test(file)).sort();
}

function meterOf(beats: number, value: number): Meter {
  if (beats === 3 && value === 4) return "3/4";
  if (beats === 6 && value === 8) return "6/8";
  return "4/4";
}

async function main() {
  const root = process.argv[2];
  const output = process.argv[3];
  if (!root || !output) throw new Error("Usage: tsx scripts/style-v2/build-manifest.ts <dossier> <manifest.json>");
  const paths = await filesUnder(path.resolve(root));
  const entries = [];
  for (const filePath of paths) {
    const bytes = await readFile(filePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const xml = /\.(xml|musicxml)$/i.test(filePath);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const parsed = xml ? musicXmlToParsed(bytes.toString("utf8")) : parseMidi(buffer);
    const meterEvent = parsed.meters[0] ?? { beats: 4, value: 4 };
    const meter = meterOf(meterEvent.beats, meterEvent.value);
    entries.push(buildManifestEntry({
      sourceName: path.relative(path.resolve(root), filePath),
      format: xml ? "musicxml" : "midi",
      sha256,
      bytes: bytes.byteLength,
      durationBeats: parsed.durationBeats,
      bars: Math.ceil(parsed.durationBeats / quartersPerBar(meter)),
      meter,
      tempo: parsed.tempos[0]?.bpm ?? 120,
      trackCount: parsed.tracks.length,
      voiceMapping: mapTracksToVoices(parsed),
    }));
  }
  await writeFile(path.resolve(output), `${JSON.stringify({ schemaVersion: 1, rootLabel: path.basename(path.resolve(root)), entries }, null, 2)}\n`, "utf8");
  console.log(`manifest: ${entries.length} source(s), droits et workId à confirmer`);
}

void main();
