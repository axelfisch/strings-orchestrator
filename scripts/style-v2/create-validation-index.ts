import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFragmentIndex } from "../../src/features/circular/style-v2/fragment-index";
import { STYLE_V2_SCHEMA_VERSION, type FragmentFeatureVector, type PatternIR } from "../../src/features/circular/style-v2/types";
import { VOICES, type VoiceName } from "../../src/features/circular/types";

const centers: Record<VoiceName, number> = {
  "Violin I": 74,
  "Violin II": 69,
  "Viola I": 65,
  "Viola II": 61,
  Cello: 50,
  Contrabass: 38,
};

const baseFeatures: FragmentFeatureVector = {
  density: 0.72,
  restRatio: 0.18,
  syncopation: 0.16,
  stepwiseRatio: 0.62,
  leapRatio: 0.1,
  meanInterval: 0.2,
  register: 0.52,
  duration: 0.25,
  voiceMask: 1,
  harmonicRhythm: 0.5,
  functionCode: 0,
};

function pattern(index: number, melody: VoiceName): PatternIR {
  const anchorMidi = centers[melody];
  const contour = index === 0 ? [0, 2, 3, 5] : index === 1 ? [0, -2, 2, 4] : [0, 3, 1, 5];
  return {
    schemaVersion: STYLE_V2_SCHEMA_VERSION,
    patternId: `validation-pattern-${index + 1}`,
    sourceFragmentId: `synthetic-fragment-${index + 1}`,
    sourceId: `synthetic-source-${index + 1}`,
    workId: `synthetic-work-${index + 1}`,
    split: "train",
    spanBeats: 8,
    anchorVoice: melody,
    anchorMidi,
    harmonicFunction: "unknown",
    notes: VOICES.flatMap((voice, voiceIndex) => Array.from({ length: voice === melody ? 8 : 4 }, (_, step) => {
      const startBeat = voice === melody ? step : step * 2;
      const melodicOffset = voice === melody ? contour[step % contour.length] : step % 2;
      return {
        voice,
        startRatio: startBeat / 8,
        durationRatio: voice === melody ? 0.1 : 0.22,
        relativePitch: centers[voice] - anchorMidi + melodicOffset,
        velocityDelta: voice === melody ? 8 : voiceIndex - 4,
      };
    })),
    features: { ...baseFeatures, syncopation: baseFeatures.syncopation + index * 0.04, density: baseFeatures.density - index * 0.04 },
  };
}

async function main() {
  const output = path.resolve(process.argv[2] ?? "tmp/style-v2/validation-index.json");
  await mkdir(path.dirname(output), { recursive: true });
  const index = buildFragmentIndex([
    pattern(0, "Violin I"),
    pattern(1, "Cello"),
    pattern(2, "Viola I"),
  ], "style-v2.validation", "2026-10-01T00:00:00.000Z");
  await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`${output}: ${index.patterns.length} synthetic validation patterns, ${index.indexId}`);
}

void main();
