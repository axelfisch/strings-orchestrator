import { RANGES, median } from "../theory";
import { VOICES, type Arrangement, type NoteEvent, type SectionId, type VoiceName, type VoiceStatistics } from "../types";

function noteStats(notes: NoteEvent[]): Record<VoiceName, VoiceStatistics> {
  return Object.fromEntries(VOICES.map((voice) => {
    const values = notes.filter((note) => note.voice === voice).map((note) => note.midi);
    const range = RANGES[voice];
    const central = values.filter((value) => value >= range.centralMin && value <= range.centralMax).length;
    return [voice, {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      median: values.length ? Math.round(median(values)) : 0,
      centralRatio: values.length ? central / values.length : 1,
      noteCount: values.length,
    }];
  })) as Record<VoiceName, VoiceStatistics>;
}

function technicalMetrics(notes: NoteEvent[]): { crossings: number; parallels: number; medianSpacing: number; repetitions: number } {
  const snapshots = new Map<number, Map<VoiceName, number>>();
  notes.forEach((note) => {
    const at = Math.round(note.start * 1000) / 1000;
    if (!snapshots.has(at)) snapshots.set(at, new Map());
    snapshots.get(at)?.set(note.voice, note.midi);
  });
  const ordered = [...snapshots.entries()].sort((a, b) => a[0] - b[0]);
  const spacings: number[] = [];
  let crossings = 0;
  let parallels = 0;
  ordered.forEach(([, pitches], snapshotIndex) => {
    VOICES.slice(0, -1).forEach((voice, voiceIndex) => {
      const lowerVoice = VOICES[voiceIndex + 1];
      const upper = pitches.get(voice);
      const lower = pitches.get(lowerVoice);
      if (upper === undefined || lower === undefined) return;
      if (upper < lower) crossings += 1;
      spacings.push(Math.abs(upper - lower));
      const previous = ordered[snapshotIndex - 1]?.[1];
      const previousUpper = previous?.get(voice);
      const previousLower = previous?.get(lowerVoice);
      if (previousUpper === undefined || previousLower === undefined) return;
      const oldInterval = Math.abs(previousUpper - previousLower) % 12;
      const nextInterval = Math.abs(upper - lower) % 12;
      const upperDirection = Math.sign(upper - previousUpper);
      const lowerDirection = Math.sign(lower - previousLower);
      if ((oldInterval === 0 || oldInterval === 7) && (nextInterval === 0 || nextInterval === 7) && upperDirection === lowerDirection && upperDirection !== 0) parallels += 1;
    });
  });
  let repetitions = 0;
  VOICES.forEach((voice) => {
    const line = notes.filter((note) => note.voice === voice).sort((a, b) => a.start - b.start);
    let run = 1;
    for (let index = 1; index < line.length; index += 1) {
      run = line[index].midi === line[index - 1].midi ? run + 1 : 1;
      if (run > 4) repetitions += 1;
    }
  });
  return { crossings, parallels, medianSpacing: Math.round(median(spacings) * 10) / 10, repetitions };
}

export function recalculateArrangementReport(arrangement: Arrangement, additionalInfluences: string[] = []): Arrangement {
  const notes = [...arrangement.notes].sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice));
  const voices = noteStats(notes);
  const rangeFaults = notes.filter((note) => note.midi < RANGES[note.voice].absoluteMin || note.midi > RANGES[note.voice].absoluteMax).length;
  const outOfCentral = VOICES.flatMap((voice) => voices[voice].centralRatio < 0.9
    ? [`${voice}: ${Math.round(voices[voice].centralRatio * 100)} % dans la zone centrale ${RANGES[voice].centralMin}–${RANGES[voice].centralMax}.`]
    : []);
  const metrics = technicalMetrics(notes);
  const activeVoiceBars = new Set(notes.map((note) => `${note.bar}:${note.voice}`));
  const density = arrangement.bars.length ? activeVoiceBars.size / (arrangement.bars.length * VOICES.length) : 0;
  const melodyBySection = Object.fromEntries((["A1", "A2", "B", "A3"] as SectionId[]).map((section) => [section, arrangement.sectionPlans.find((plan) => plan.section === section)?.melody ?? "Violin I"])) as Record<SectionId, VoiceName>;
  const substitutions = [...new Set(arrangement.bars.flatMap((bar) => bar.harmonies.filter((event) => event.bass && event.bass !== event.root).map((event) => event.symbol)))];
  const bassBehaviors = [...new Set(arrangement.bars.map((bar, index) => {
    if (bar.harmonies.some((event) => event.bass && event.bass !== event.root)) return "basse slash";
    if (bar.section === "B") return "liaison chromatique";
    if ((index + 1) % 8 === 0) return "saut de cadence";
    return "fondation arpégée";
  }))];
  const quality = Math.max(0, Math.min(100, Math.round(100 - rangeFaults * 5 - metrics.crossings * 1.5 - metrics.parallels * 1.5 - metrics.repetitions * 0.4 - outOfCentral.length * 4)));
  return {
    ...arrangement,
    notes,
    report: {
      ...arrangement.report,
      quality,
      parallels: metrics.parallels,
      crossings: metrics.crossings,
      rangeFaults,
      restRatio: 1 - density,
      density,
      medianSpacing: metrics.medianSpacing,
      substitutions,
      bassBehaviors,
      melodyBySection,
      voices,
      outOfCentral,
      excessiveRepetitions: metrics.repetitions,
      influences: [...arrangement.report.influences, ...additionalInfluences],
    },
  };
}
