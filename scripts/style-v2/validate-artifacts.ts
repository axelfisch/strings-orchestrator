import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertNoSplitLeakage } from "../../src/features/circular/style-v2/manifest";
import { validateFragmentIndex, validateManifestEntry } from "../../src/features/circular/style-v2/schemas";
import type { CorpusManifestEntry, FragmentIndex } from "../../src/features/circular/style-v2/types";

async function main() {
  const manifestPath = process.argv[2];
  const indexPath = process.argv[3];
  if (!manifestPath || !indexPath) throw new Error("Usage: tsx scripts/style-v2/validate-artifacts.ts <manifest.json> <index.json>");
  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8")) as { entries: CorpusManifestEntry[] };
  const index = JSON.parse(await readFile(path.resolve(indexPath), "utf8")) as FragmentIndex;
  const errors = manifest.entries.flatMap((entry) => validateManifestEntry(entry).map((error) => `${entry.sourceName}: ${error}`));
  errors.push(...assertNoSplitLeakage(manifest.entries).map((workId) => `split leakage: ${workId}`));
  errors.push(...validateFragmentIndex(index));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`artifacts ok: ${manifest.entries.length} source(s), ${index.patterns.length} motif(s)`);
}

void main();
