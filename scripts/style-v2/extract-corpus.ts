import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { musicXmlToParsed, parseMidi } from "../../src/features/circular/midi";
import { extractFragments } from "../../src/features/circular/style-v2/fragments";
import { buildFragmentIndex } from "../../src/features/circular/style-v2/fragment-index";
import { fragmentToPattern } from "../../src/features/circular/style-v2/pattern-ir";
import { validateManifestEntry } from "../../src/features/circular/style-v2/schemas";
import type { CorpusManifestEntry } from "../../src/features/circular/style-v2/types";

async function main() {
  const root = process.argv[2];
  const manifestPath = process.argv[3];
  const output = process.argv[4];
  if (!root || !manifestPath || !output) throw new Error("Usage: tsx scripts/style-v2/extract-corpus.ts <dossier> <manifest.json> <index.json>");
  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8")) as { entries: CorpusManifestEntry[] };
  const invalid = manifest.entries.flatMap((entry) => validateManifestEntry(entry).map((error) => `${entry.sourceName}: ${error}`));
  if (invalid.length) throw new Error(`Manifeste invalide:\n${invalid.join("\n")}`);
  const patterns = [];
  for (const entry of manifest.entries.filter((item) => item.included)) {
    const bytes = await readFile(path.join(path.resolve(root), entry.sourceName));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const parsed = entry.format === "musicxml" ? musicXmlToParsed(bytes.toString("utf8")) : parseMidi(buffer);
    patterns.push(...extractFragments(parsed, entry).map(fragmentToPattern));
  }
  const index = buildFragmentIndex(patterns);
  await writeFile(path.resolve(output), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`index: ${index.patterns.length} motif(s), ${index.indexId}`);
}

void main();
