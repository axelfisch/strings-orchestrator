import { Rng } from "./rng";
import {
  C_APPROACHES,
  POP_SOFT_FIXTURE,
  RANGES,
  chooseScaleForChord,
  makeHarmonyEvent,
  median,
  nearest,
  parseChord,
  pitchClass,
  preferSharpKey,
  quartersPerBar,
  registerCenter,
  scalePitchClasses,
  spell,
  transposeApproach,
  transposeSymbol,
} from "./theory";
import {
  SCHEMA_VERSION,
  STYLES,
  VOICES,
  type Arrangement,
  type ArrangementBar,
  type DynamicMark,
  type HarmonyLanguage,
  type MelodyMode,
  type Meter,
  type NoteEvent,
  type ProjectBar,
  type RegisterMode,
  type ScaleId,
  type SectionId,
  type SectionPlan,
  type StyleName,
  type StyleProfile,
  type VoiceName,
  type VoiceRole,
  type VoiceStatistics,
} from "./types";

export interface ArrangeInput {
  bars: ProjectBar[];
  key: string;
  mode: "major" | "minor";
  style: StyleName;
  meter: Meter;
  tempo: number;
  seed: number;
  influence: number;
  profile?: StyleProfile | null;
  title?: string;
  harmonicLanguage?: HarmonyLanguage;
  scale?: ScaleId;
  melodyMode?: MelodyMode;
  manualMelodyVoice?: VoiceName;
  registerMode?: RegisterMode;
  importedMelody?: NoteEvent[];
  holds?: {
    bars?: Record<number, NoteEvent[]>;
    voices?: Partial<Record<VoiceName, NoteEvent[]>>;
  };
}

const STYLE_TEXTURE: Record<StyleName, readonly string[]> = {
  "ECM Ballad": ["Voile soutenu", "Cellules décalées", "Cascade légère", "Voile soutenu"],
  "Jazz Waltz": ["Cellules de valse", "Réponse de valse", "Contrepoint", "Cellules de valse"],
  "Rain of Notes": ["Cascade légère", "Voile soutenu", "Pluie contrapuntique", "Ostinato"],
  "Pop-Jazz Drive": ["Cellules décalées", "Ostinato", "Cascade légère", "Cellules décalées"],
  "Lilting 6/8": ["Voile soutenu", "Ostinato 6/8", "Contrepoint", "Ostinato 6/8"],
  "Distanced Perspectives": ["Brume harmonique", "Voile soutenu", "Contrepoint", "Brume harmonique"],
};

const SECTION_IDS: SectionId[] = ["A1", "A2", "B", "A3"];
const MELODY_POOL: VoiceName[] = ["Violin I", "Violin II", "Viola I", "Viola II", "Cello"];

export function sectionFor(index: number, length: number): SectionId {
  if (length >= 32) return SECTION_IDS[Math.min(3, Math.floor(index / 8))];
  if (length >= 16) return index < length / 2 ? "A1" : "A2";
  return "A1";
}

export function defaultTempo(style: StyleName): number {
  return {
    "ECM Ballad": 72,
    "Jazz Waltz": 116,
    "Rain of Notes": 92,
    "Pop-Jazz Drive": 106,
    "Lilting 6/8": 78,
    "Distanced Perspectives": 64,
  }[style];
}

export function defaultMeter(style: StyleName): Meter {
  if (style === "Jazz Waltz") return "3/4";
  if (style === "Lilting 6/8") return "6/8";
  return "4/4";
}

function effectiveLanguage(language: HarmonyLanguage, style?: StyleName): HarmonyLanguage {
  if (language !== "automatic") return language;
  return style === "Pop-Jazz Drive" ? "pop-soft" : "chamber";
}

function functionForIndex(index: number): "approach" | "tension" | "resolution" | "color" {
  const phase = index % 4;
  return phase === 1 ? "approach" : phase === 2 ? "tension" : phase === 3 ? "resolution" : "color";
}

export function generateGrid(options: {
  key: string;
  mode: "major" | "minor";
  length: number;
  seed: number;
  meter?: Meter;
  harmonicLanguage?: HarmonyLanguage;
  style?: StyleName;
}): ProjectBar[] {
  const meter = options.meter ?? "4/4";
  const qpb = quartersPerBar(meter);
  const language = effectiveLanguage(options.harmonicLanguage ?? "automatic", options.style);
  const rng = new Rng(options.seed || 1);
  const tonic = pitchClass(options.key);
  const sharp = preferSharpKey(options.key);

  if (language === "pop-soft") {
    const source = POP_SOFT_FIXTURE.flat();
    const shift = tonic - pitchClass("Eb");
    return Array.from({ length: options.length }, (_, index) => {
      const symbol = transposeSymbol(source[index % source.length], shift, sharp);
      const fn = functionForIndex(index);
      return {
        harmonies: [makeHarmonyEvent(symbol, 0, qpb, "generated", fn)],
        locked: false,
        origin: "generated",
      };
    });
  }

  const minorApproach = [
    `${spell(tonic + 2, sharp)}min7(b5)`,
    `${spell(tonic + 7, sharp)}7(b9)`,
    `${options.key}min(maj7)`,
  ] as const;
  const sectionTargets = [tonic, tonic, tonic + (options.mode === "minor" ? 3 : 5), tonic];
  return Array.from({ length: options.length }, (_, index) => {
    const sectionIndex = Math.min(3, Math.floor(index / Math.max(1, options.length / 4)));
    const target = sectionTargets[sectionIndex] % 12;
    const phase = index % 4;
    let symbol: string;
    let fn = functionForIndex(index);
    if (options.mode === "minor" && sectionIndex !== 2) {
      symbol = phase === 1 ? minorApproach[0] : phase === 2 ? minorApproach[1] : phase === 3 ? minorApproach[2] : `${options.key}min9`;
    } else {
      const targetName = spell(target, sharp);
      const rows = transposeApproach(targetName);
      const row = rows[(Math.floor(index / 4) + sectionIndex * 3 + Math.floor(rng.next() * rows.length)) % rows.length];
      symbol = phase === 1 ? row[0] : phase === 2 ? row[1] : phase === 3 ? row[2] : `${targetName}${sectionIndex === 2 ? "maj9(#11)" : "add9"}`;
    }
    if (index === options.length - 1) {
      symbol = `${options.key}${options.mode === "minor" ? "min9(maj7)" : "maj9(#11)"}`;
      fn = "resolution";
    }
    return {
      harmonies: [makeHarmonyEvent(symbol, 0, qpb, "generated", fn)],
      locked: false,
      origin: "generated",
    };
  });
}

function planRoles(melody: VoiceName, counterline: VoiceName): Record<VoiceName, VoiceRole> {
  const roles = Object.fromEntries(VOICES.map((voice) => [voice, "harmony"])) as Record<VoiceName, VoiceRole>;
  roles[melody] = "melody";
  roles[counterline] = "counterline";
  roles["Viola I"] = melody === "Viola I" || counterline === "Viola I" ? roles["Viola I"] : "inner";
  roles["Viola II"] = melody === "Viola II" || counterline === "Viola II" ? roles["Viola II"] : "inner";
  roles.Contrabass = melody === "Contrabass" ? "melody" : "foundation";
  return roles;
}

export function createSectionPlans(input: Pick<ArrangeInput, "bars" | "seed" | "melodyMode" | "manualMelodyVoice" | "registerMode" | "importedMelody">): SectionPlan[] {
  const sections = [...new Set(input.bars.map((_, index) => sectionFor(index, input.bars.length)))] as SectionId[];
  const mode = input.melodyMode ?? "canonical";
  const rng = new Rng((input.seed || 1) ^ 0x51a7);
  const rotated = [...MELODY_POOL];
  const shift = Math.floor(rng.next() * rotated.length);
  const ordered = rotated.map((_, index) => rotated[(index + shift) % rotated.length]);
  const importedVoice = input.importedMelody?.[0]?.voice;
  return sections.map((section, index) => {
    let melody: VoiceName;
    if (mode === "manual") melody = input.manualMelodyVoice ?? "Violin I";
    else if (mode === "preserve-import" && importedVoice) melody = importedVoice;
    else if (mode === "controlled") melody = ordered[index % ordered.length];
    else melody = section === "B" ? "Cello" : "Violin I";
    const counterline: VoiceName = melody === "Cello" ? "Violin II" : melody === "Violin II" ? "Cello" : "Cello";
    const density = section === "A1" ? 0.72 : section === "A2" ? 0.78 : section === "B" ? 0.62 : 0.84;
    const dynamic: DynamicMark = section === "A1" ? "p" : section === "A2" ? "mp" : section === "B" ? "mf" : "mp";
    const registerOffset = section === "B" ? (input.registerMode === "low" ? -2 : 2) : section === "A3" ? 1 : 0;
    return {
      section,
      melody,
      counterline,
      roles: planRoles(melody, counterline),
      density,
      dynamic,
      registerOffset,
      explanation:
        mode === "canonical"
          ? section === "B" ? "Le violoncelle devient le second moteur mélodique au pont." : "Mode Canonique Axel : Violon I au premier plan."
          : mode === "controlled"
            ? `Rotation contrôlée : transfert vers ${melody}, motivé par le changement de section.`
            : mode === "manual"
              ? `Porteur choisi manuellement : ${melody}.`
              : `Porteur conservé depuis l’import : ${melody}.`,
    };
  });
}

function snap(options: readonly number[], target: number, voice: VoiceName, expressive = false): number {
  const range = RANGES[voice];
  const min = expressive ? range.absoluteMin : range.centralMin;
  const max = expressive ? range.absoluteMax : range.centralMax;
  let best = nearest(options[0] ?? 0, target, min, max);
  let score = Infinity;
  for (const pc of options) {
    const candidate = nearest(pc, target, min, max);
    const centralPenalty = candidate < range.centralMin ? (range.centralMin - candidate) * 2 : candidate > range.centralMax ? (candidate - range.centralMax) * 2 : 0;
    const next = Math.abs(candidate - target) + centralPenalty;
    if (next < score) {
      best = candidate;
      score = next;
    }
  }
  return Math.max(range.absoluteMin, Math.min(range.absoluteMax, best));
}

function roleSlots(role: VoiceRole, meter: Meter, texture: string): { at: number; duration: number }[] {
  const qpb = quartersPerBar(meter);
  if (role === "melody") {
    if (meter === "3/4") return [{ at: 0, duration: 0.8 }, { at: 1, duration: 0.7 }, { at: 2, duration: 0.85 }];
    if (meter === "6/8") return [{ at: 0, duration: 0.45 }, { at: 0.75, duration: 0.65 }, { at: 1.5, duration: 0.45 }, { at: 2.25, duration: 0.65 }];
    return texture.includes("Cascade") || texture.includes("Pluie")
      ? [{ at: 0, duration: 0.7 }, { at: 0.75, duration: 0.45 }, { at: 1.5, duration: 0.7 }, { at: 2.5, duration: 0.45 }, { at: 3, duration: 0.85 }]
      : [{ at: 0, duration: 0.9 }, { at: 1, duration: 0.8 }, { at: 2, duration: 0.9 }, { at: 3, duration: 0.85 }];
  }
  if (role === "counterline") return [{ at: Math.min(0.5, qpb / 4), duration: Math.max(0.5, qpb * 0.32) }, { at: qpb * 0.58, duration: qpb * 0.3 }];
  if (role === "foundation") return [{ at: 0, duration: qpb * 0.42 }, { at: qpb * 0.5, duration: qpb * 0.4 }];
  return [{ at: 0, duration: Math.max(0.5, qpb - 0.12) }];
}

function dynamicVelocity(dynamic: DynamicMark, role: VoiceRole): number {
  const base: Record<DynamicMark, number> = { pp: 48, p: 58, mp: 68, mf: 78, f: 90 };
  return Math.min(112, base[dynamic] + (role === "melody" ? 12 : role === "counterline" ? 5 : role === "foundation" ? 2 : 0));
}

function guideTones(root: number, tones: number[]): number[] {
  const wanted = new Set([3, 4, 10, 11]);
  const guides = tones.filter((tone) => wanted.has((tone - root + 12) % 12));
  return guides.length ? guides : tones;
}

function colorTones(root: number, tones: number[]): number[] {
  const wanted = new Set([1, 2, 3, 6, 8, 9]);
  const colors = tones.filter((tone) => wanted.has((tone - root + 12) % 12));
  return colors.length ? colors : tones;
}

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

function simultaneousSnapshots(notes: NoteEvent[]): Map<number, Map<VoiceName, number>> {
  const snapshots = new Map<number, Map<VoiceName, number>>();
  notes.forEach((note) => {
    const at = Math.round(note.start * 1000) / 1000;
    if (!snapshots.has(at)) snapshots.set(at, new Map());
    snapshots.get(at)?.set(note.voice, note.midi);
  });
  return snapshots;
}

function technicalMetrics(notes: NoteEvent[]): { crossings: number; parallels: number; medianSpacing: number; repetitions: number } {
  const ordered = [...simultaneousSnapshots(notes).entries()].sort((a, b) => a[0] - b[0]);
  let crossings = 0;
  let parallels = 0;
  const spacings: number[] = [];
  ordered.forEach(([, pitches], snapshotIndex) => {
    for (let index = 0; index < VOICES.length - 1; index += 1) {
      const upper = pitches.get(VOICES[index]);
      const lower = pitches.get(VOICES[index + 1]);
      if (upper === undefined || lower === undefined) continue;
      if (upper < lower) crossings += 1;
      spacings.push(Math.abs(upper - lower));
      const previous = ordered[snapshotIndex - 1]?.[1];
      const previousUpper = previous?.get(VOICES[index]);
      const previousLower = previous?.get(VOICES[index + 1]);
      if (previousUpper === undefined || previousLower === undefined) continue;
      const oldInterval = Math.abs(previousUpper - previousLower) % 12;
      const nextInterval = Math.abs(upper - lower) % 12;
      const directionUpper = Math.sign(upper - previousUpper);
      const directionLower = Math.sign(lower - previousLower);
      if ((oldInterval === 0 || oldInterval === 7) && (nextInterval === 0 || nextInterval === 7) && directionUpper === directionLower && directionUpper !== 0) parallels += 1;
    }
  });
  let repetitions = 0;
  VOICES.forEach((voice) => {
    const line = notes.filter((note) => note.voice === voice).sort((a, b) => a.start - b.start);
    let run = 1;
    for (let index = 1; index < line.length; index += 1) {
      if (line[index].midi === line[index - 1].midi) run += 1;
      else run = 1;
      if (run > 4) repetitions += 1;
    }
  });
  return { crossings, parallels, medianSpacing: Math.round(median(spacings) * 10) / 10, repetitions };
}

export function arrange(input: ArrangeInput): Arrangement {
  const style = STYLES.includes(input.style) ? input.style : "ECM Ballad";
  const qpb = quartersPerBar(input.meter);
  const rng = new Rng(input.seed || 1);
  const language = effectiveLanguage(input.harmonicLanguage ?? "automatic", style);
  const selectedScale = input.scale ?? (input.mode === "minor" ? "harmonic-minor" : "major");
  const melodyMode = input.melodyMode ?? "canonical";
  const registerMode = input.registerMode ?? "medium";
  const weight = Math.max(0, Math.min(1, input.influence / 100));
  const profile = input.profile?.version === 2 && input.profile.noteCount > 0 ? input.profile : null;
  const plans = createSectionPlans(input);
  const textures = STYLE_TEXTURE[style];
  const bars: ArrangementBar[] = input.bars.map((bar, index) => {
    const section = sectionFor(index, input.bars.length);
    const plan = plans.find((item) => item.section === section) ?? plans[0];
    return {
      number: index + 1,
      section,
      harmonies: bar.harmonies.length ? bar.harmonies : [makeHarmonyEvent(`${input.key}${input.mode === "minor" ? "min9" : "add9"}`, 0, qpb, "generated", "resolution")],
      texture: textures[Math.min(3, SECTION_IDS.indexOf(section))] ?? textures[0],
      origin: bar.origin,
      locked: bar.locked,
      dynamic: plan?.dynamic ?? "mp",
    };
  });

  const previous: Partial<Record<VoiceName, number>> = {};
  const notes: NoteEvent[] = [];
  const activeVoiceBars = new Set<string>();

  bars.forEach((bar, barIndex) => {
    const plan = plans.find((item) => item.section === bar.section) ?? plans[0];
    const heldBar = input.holds?.bars?.[bar.number];
    if (heldBar?.length && bar.locked) {
      heldBar.forEach((note) => {
        notes.push({ ...note, bar: bar.number });
        previous[note.voice] = note.midi;
        activeVoiceBars.add(`${bar.number}:${note.voice}`);
      });
      return;
    }
    const imported = melodyMode === "preserve-import"
      ? (input.importedMelody ?? []).filter((note) => note.start >= barIndex * qpb && note.start < (barIndex + 1) * qpb)
      : [];
    const importedVoices = new Set(imported.map((note) => note.voice));
    if (imported.length) {
      imported.forEach((note) => {
        const range = RANGES[note.voice];
        const midi = Math.max(range.absoluteMin, Math.min(range.absoluteMax, note.midi));
        notes.push({ ...note, midi, bar: bar.number, role: "melody", source: "imported" });
        previous[note.voice] = midi;
        activeVoiceBars.add(`${bar.number}:${note.voice}`);
      });
    }

    bar.harmonies.forEach((harmony, harmonyIndex) => {
      const parsed = parseChord(harmony.symbol);
      const chordScale = input.scale ?? chooseScaleForChord(harmony.symbol);
      const scale = scalePitchClasses(chordScale, parsed.root).filter((pc) => !(parsed.quality.includes("#11") && (pc - parsed.root + 12) % 12 === 5));
      const guides = guideTones(parsed.root, parsed.tones);
      const colors = colorTones(parsed.root, parsed.tones);
      let upperPitch: number | null = null;

      VOICES.forEach((voice) => {
        const heldVoice = input.holds?.voices?.[voice]?.filter((note) => note.bar === bar.number);
        if (heldVoice?.length) {
          if (harmonyIndex === 0) heldVoice.forEach((note) => {
            notes.push(note);
            previous[voice] = note.midi;
            activeVoiceBars.add(`${bar.number}:${voice}`);
          });
          return;
        }
        const role = plan.roles[voice];
        if (importedVoices.has(voice)) return;
        const breathe = role !== "melody" && role !== "foundation" && rng.next() > plan.density;
        if (breathe) return;
        activeVoiceBars.add(`${bar.number}:${voice}`);
        const range = RANGES[voice];
        const corpusCenter = profile?.centers[voice];
        const profileTarget = corpusCenter === undefined ? range.center : Math.max(range.centralMin, Math.min(range.centralMax, corpusCenter));
        const center = Math.round(registerCenter(voice, registerMode) * (1 - weight) + profileTarget * weight) + plan.registerOffset;
        const prior = previous[voice] ?? center;
        let choices = parsed.tones;
        if (role === "inner") choices = guides;
        else if (role === "harmony" && voice === "Violin II") choices = colors;
        else if (role === "foundation") choices = [parsed.bass ?? parsed.root, parsed.root];
        else if (role === "melody" || role === "counterline") choices = [...new Set([...parsed.tones, ...scale])];
        const expressive = role === "melody" && ((barIndex + 1) % 8 === 7 || harmony.function === "tension") && harmonyIndex === bar.harmonies.length - 1;
        const direction = role === "counterline" ? -1 : 1;
        const motion = role === "melody"
          ? rng.pick([3, 4, 8, 9, -3, -4] as const)
          : role === "counterline" ? rng.pick([-4, -3, 3] as const) : 0;
        let base = snap(choices, prior + direction * motion, voice, expressive);
        if (upperPitch !== null && role !== "melody" && base >= upperPitch - 1) {
          base = snap(choices, upperPitch - 4, voice, false);
        }
        upperPitch = base;
        previous[voice] = base;

        const slots = roleSlots(role, input.meter, bar.texture)
          .map((slot) => ({
            at: harmony.position + (slot.at / qpb) * harmony.duration,
            duration: Math.min((slot.duration / qpb) * harmony.duration, harmony.duration - (slot.at / qpb) * harmony.duration - 0.02),
          }))
          .filter((slot) => slot.duration > 0.08 && slot.at < harmony.position + harmony.duration);
        slots.forEach((slot, slotIndex) => {
          let midi = base;
          if (role === "melody" || role === "counterline") {
            const melodicSteps = role === "melody" ? [0, 3, -2, 4, -3] : [0, -3, 2];
            const target = base + (melodicSteps[slotIndex % melodicSteps.length] ?? 0) * (role === "counterline" ? -1 : 1);
            const pitchChoices = slotIndex === 0 || slotIndex === slots.length - 1 ? parsed.tones : choices;
            midi = snap(pitchChoices, target, voice, expressive && slotIndex === Math.floor(slots.length / 2));
          } else if (role === "foundation" && slotIndex > 0) {
            const bassOptions = parsed.bass === null ? [parsed.root, (parsed.root + 7) % 12, (parsed.root + 4) % 12] : [parsed.bass, parsed.root, (parsed.root + 7) % 12];
            midi = snap([bassOptions[slotIndex % bassOptions.length]], base + (slotIndex % 2 ? 5 : -2), voice, false);
          }
          notes.push({
            voice,
            midi,
            start: barIndex * qpb + slot.at,
            duration: Math.max(0.08, slot.duration),
            velocity: dynamicVelocity(bar.dynamic, role),
            bar: bar.number,
            role,
            articulation: role === "melody" || role === "counterline" ? "legato" : bar.texture.includes("Ostinato") ? "staccato" : "tenuto",
            dynamic: bar.dynamic,
            source: harmony.source,
          });
        });
      });
    });
  });

  const voices = noteStats(notes);
  const rangeFaults = VOICES.reduce((sum, voice) => sum + notes.filter((note) => note.voice === voice && (note.midi < RANGES[voice].absoluteMin || note.midi > RANGES[voice].absoluteMax)).length, 0);
  const outOfCentral = VOICES.flatMap((voice) => voices[voice].centralRatio < 0.9
    ? [`${voice}: ${Math.round(voices[voice].centralRatio * 100)} % dans la zone centrale ${RANGES[voice].centralMin}–${RANGES[voice].centralMax}.`]
    : []);
  const metrics = technicalMetrics(notes);
  const density = bars.length ? activeVoiceBars.size / (bars.length * VOICES.length) : 0;
  const restRatio = 1 - density;
  const melodyBySection = Object.fromEntries(SECTION_IDS.map((section) => [section, plans.find((plan) => plan.section === section)?.melody ?? "Violin I"])) as Record<SectionId, VoiceName>;
  const substitutions = [...new Set(bars.flatMap((bar) => bar.harmonies.filter((event) => event.bass && event.bass !== event.root).map((event) => event.symbol)))];
  const bassBehaviors = [...new Set(bars.map((bar, index) => {
    if (bar.harmonies.some((event) => event.bass && event.bass !== event.root)) return "basse slash";
    if (bar.section === "B") return "liaison chromatique";
    if ((index + 1) % 8 === 0) return "saut de cadence";
    return "fondation arpégée";
  }))];
  const technicalScore = Math.max(0, Math.min(100, Math.round(100 - rangeFaults * 5 - metrics.crossings * 1.5 - metrics.parallels * 1.5 - metrics.repetitions * 0.4 - outOfCentral.length * 4)));
  const influences = [
    `Langage harmonique : ${language === "pop-soft" ? "Pop doux" : language === "chamber" ? "Chambre — 24 familles" : language}.`,
    `Gamme de projet : ${selectedScale}. Les notes de passage sont transposées depuis le centre de l’accord.`,
    ...plans.map((plan) => `${plan.section} — ${plan.explanation}`),
    profile
      ? `Profil Axel Style Data v2 : ${profile.sourceFiles} fichiers et ${profile.noteCount} notes, influence ${Math.round(weight * 100)} %.`
      : "Profil de chambre documenté; aucun corpus actif n’est présenté comme entraînement neuronal.",
    "Les tierces et septièmes restent au centre; les couleurs 9, #11 et 13 restent en couronne sans 11 naturelle contre une #11.",
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    title: input.title || "Circular Strings Orchestrator",
    style,
    key: input.key,
    mode: input.mode,
    meter: input.meter,
    tempo: input.tempo,
    seed: input.seed,
    influence: input.influence,
    harmonicLanguage: language,
    scale: selectedScale,
    melodyMode,
    registerMode,
    bars,
    notes: notes.sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice)),
    sectionPlans: plans,
    report: {
      quality: technicalScore,
      parallels: metrics.parallels,
      crossings: metrics.crossings,
      rangeFaults,
      restRatio,
      density,
      medianSpacing: metrics.medianSpacing,
      language,
      scale: selectedScale,
      substitutions,
      bassBehaviors,
      melodyBySection,
      voices,
      outOfCentral,
      excessiveRepetitions: metrics.repetitions,
      influences,
    },
  };
}

export function previewVoicing(symbol: string): NoteEvent[] {
  const meter: Meter = "4/4";
  return arrange({
    bars: [{ harmonies: [makeHarmonyEvent(symbol, 0, 4, "manual")], locked: false, origin: "manual" }],
    key: "C",
    mode: "major",
    style: "ECM Ballad",
    meter,
    tempo: 72,
    seed: 11,
    influence: 0,
    title: symbol,
    harmonicLanguage: "chamber",
    scale: chooseScaleForChord(symbol),
    melodyMode: "canonical",
    registerMode: "medium",
  }).notes;
}

export const DOCUMENTED_APPROACH_COUNT = C_APPROACHES.length;
