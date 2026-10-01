import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAxelStyleBlueprint } from "../../src/features/circular/style-v2/profile";

async function main() {
  const profilePath = process.argv[2];
  if (!profilePath) throw new Error("Usage: tsx scripts/style-v2/validate-profile.ts <axel-style-profile-v2.json>");
  const parsed = JSON.parse(await readFile(path.resolve(profilePath), "utf8")) as unknown;
  const result = loadAxelStyleBlueprint(parsed);
  if (result.errors.length || !result.blueprint) throw new Error(result.errors.join("\n"));
  console.log(`profile ok: ${result.blueprint.voices.length} voix, ${result.blueprint.chordFamilies.length} familles, ${result.blueprint.scales.length} gammes`);
  result.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
}

void main();
