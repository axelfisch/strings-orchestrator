import { Rng } from "./rng";
import {
  nearest,
  parseChord,
  pitchClass,
  preferSharpKey,
  quartersPerBar,
  RANGES,
  spell,
  symbolFor,
} from "./theory";
import {
  FAMILIES,
  STYLES,
  VOICES,
  type Arrangement,
  type ArrangementBar,
  type FamilyId,
  type Meter,
  type NoteEvent,
  type Origin,
  type ProjectBar,
  type SectionId,
  type StyleName,
  type StyleProfile,
  type VoiceName,
} from "./types";

const FAMILY_IDS = new Set(FAMILIES.map((family) => family.id));

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
  holds?: {
    bars?: Record<number, NoteEvent[]>;
    voices?: Partial<Record<VoiceName, NoteEvent[]>>;
  };
}

const STYLE_TEXTURE: Record<StyleName, readonly string[]> = {
  "ECM Ballad": ["Sustained veil", "Off-beat cells", "Rain cascade", "Sustained veil"],
  "Jazz Waltz": ["Waltz cells", "Waltz cells", "Counterpoint", "Waltz cells"],
  "Rain of Notes": ["Rain cascade", "Sustained veil", "Rain cascade", "Ostinato"],
  "Pop-Jazz Drive": ["Off-beat cells", "Ostinato", "Rain cascade", "Off-beat cells"],
  "Lilting 6/8": ["Sustained veil", "6/8 ostinato", "Counterpoint", "6/8 ostinato"],
  "Distanced Perspectives": ["Harmonic mist", "Sustained veil", "Counterpoint", "Harmonic mist"],
};

const MOTIFS = [
  [0, 2, -1, 3],
  [0, -2, 1, -3],
  [0, 4, -2, 1],
  [0, 1, -2, 2],
  [0, -1, 3, -2],
] as const;

export function sectionFor(index: number, length: number): SectionId {
  if (length >= 32) return (["A1", "A2", "B", "A3"] as const)[Math.floor(index / 8)] ?? "A3";
  if (length >= 16) return index < length / 2 ? "A1" : "A2";
  return "A1";
}

export function defaultTempo(style: StyleName): number {
  const map: Record<StyleName, number> = {
    "ECM Ballad": 72,
    "Jazz Waltz": 116,
    "Rain of Notes": 92,
    "Pop-Jazz Drive": 106,
    "Lilting 6/8": 78,
    "Distanced Perspectives": 64,
  };
  return map[style];
}

export function defaultMeter(style: StyleName): Meter {
  if (style === "Jazz Waltz") return "3/4";
  if (style === "Lilting 6/8") return "6/8";
  return "4/4";
}

function degreeSymbol(
  tonic: number,
  degree: number,
  quality: FamilyId,
  sharp: boolean,
  slashDegree?: number,
): string {
  const root = spell(tonic + degree, sharp);
  const bass = slashDegree === undefined ? null : spell(tonic + slashDegree, sharp);
  return symbolFor(root, quality, bass);
}

export function generateGrid(options: {
  key: string;
  mode: "major" | "minor";
  length: number;
  seed: number;
}): ProjectBar[] {
  const rng = new Rng(options.seed || 1);
  const tonic = pitchClass(options.key);
  const sharp = preferSharpKey(options.key);
  const minor = options.mode === "minor";
  const cycles: [number, FamilyId, number?][][] = minor
    ? [
        [[2, "min9(b5)"], [7, "7(b9)"], [0, "min9"], [0, "min9(7+)"]],
        [[5, "min11"], [10, "maj9(11+)"], [8, "7(9+5+)", 7], [0, "min9"]],
        [[3, "maj9(11+)"], [8, "13(b9)"], [1, "min9(b5)"], [7, "7(b9)"]],
        [[2, "min9(b5)", 1], [7, "13(b9)"], [0, "min9(7+)"], [0, "min(add9)"]],
      ]
    : [
        [[2, "min9"], [7, "7(b9)"], [0, "maj9(11+)"], [0, "add9"]],
        [[9, "min9"], [2, "min11"], [7, "13(b9)"], [0, "maj7"]],
        [[5, "maj9(11+)"], [11, "7(b9)"], [4, "min9"], [7, "13(b5)"]],
        [[2, "min9", 1], [7, "7(9+5+)"], [0, "maj9(11+)"], [0, "add9"]],
      ];
  return Array.from({ length: options.length }, (_, index) => {
    const section = Math.floor(index / 8) % cycles.length;
    const cell = cycles[section][index % 4];
    const slash = cell[2] !== undefined && rng.chance(0.65) ? cell[2] : undefined;
    const quality = FAMILY_IDS.has(cell[1]) ? cell[1] : "maj7";
    return {
      chord: degreeSymbol(tonic, cell[0], quality, sharp, slash),
      locked: false,
      origin: "generated" as Origin,
    };
  });
}

function slots(texture: string, meter: Meter, moving: boolean): { at: number; dur: number }[] {
  const bar = quartersPerBar(meter);
  if (!moving) {
    if (texture.includes("mist")) return [{ at: 0, dur: bar * 0.92 }];
    if (texture.includes("Off-beat")) return [{ at: Math.min(1, bar - 0.5), dur: Math.max(0.5, bar - 1.2) }];
    return [{ at: 0, dur: Math.max(0.5, bar - 0.12) }];
  }
  if (texture.includes("Rain")) {
    const count = Math.round(bar * 4);
    return Array.from({ length: count }, (_, index) => ({ at: index * 0.25, dur: 0.22 }));
  }
  if (texture.includes("Waltz") || meter === "3/4") return [{ at: 0, dur: 1 }, { at: 1, dur: 0.5 }, { at: 2, dur: 0.7 }];
  if (texture.includes("6/8") || meter === "6/8") return [{ at: 0, dur: 0.5 }, { at: 1, dur: 0.5 }, { at: 1.5, dur: 0.5 }, { at: 2, dur: 0.7 }];
  if (texture.includes("Ostinato") || texture.includes("Off-beat")) return [{ at: 0.5, dur: 0.45 }, { at: 1.5, dur: 0.45 }, { at: 2.5, dur: 0.4 }, { at: 3.25, dur: 0.4 }].filter((slot) => slot.at < bar);
  if (texture.includes("Counterpoint")) return [{ at: 0.5, dur: 0.75 }, { at: 1.5, dur: 1 }, { at: 3, dur: 0.7 }].filter((slot) => slot.at < bar);
  return [{ at: 0, dur: bar * 0.45 }, { at: bar * 0.5, dur: bar * 0.4 }];
}

function snap(pcOptions: number[], target: number, range: { min: number; max: number }): number {
  let best = nearest(pcOptions[0] ?? 0, target, range.min, range.max);
  let distance = Infinity;
  for (const pc of pcOptions) {
    const midi = nearest(pc, target, range.min, range.max);
    const gap = Math.abs(midi - target);
    if (gap < distance) {
      distance = gap;
      best = midi;
    }
  }
  return best;
}

function intervalClass(a: number, b: number): number {
  return Math.min((a - b + 120) % 12, (b - a + 120) % 12);
}

export function arrange(input: ArrangeInput): Arrangement {
  const style = STYLES.includes(input.style) ? input.style : "ECM Ballad";
  const rng = new Rng(input.seed || 1);
  const weight = Math.min(1, Math.max(0, input.influence / 100));
  const profile = input.profile && input.profile.noteCount > 0 ? input.profile : null;
  const leapBias = profile ? 0.16 * (1 - weight) + profile.leapRatio * weight : 0.16;
  const restBias = profile ? 0.22 * (1 - weight) + profile.restRatio * weight : 0.22;
  const textures = STYLE_TEXTURE[style];
  const qpb = quartersPerBar(input.meter);
  const influences = [
    profile
      ? `Profil du corpus (${profile.sourceFiles} fichiers, ${profile.noteCount} notes) à ${Math.round(weight * 100)} %.`
      : "Profil par défaut de l’ADN de chambre. Aucun corpus, donc l’influence ne change pas les probabilités.",
    "Tierces et septièmes visées au centre. 9, #11 et 13 réservées aux voix hautes.",
    "La basse étrangère ou le renversement reste une basse : elle n’est pas réinterprétée comme extension.",
    "Cinq gammes Live Thinking sont documentées. La sixième n’est pas inventée.",
    "En Ordre Chaostik est exclu du profil par défaut : laboratoire polymétrique, pas le sextuor canonique.",
  ];
  if (profile) {
    influences.push(
      `Mouvement conjoint du corpus ${Math.round(profile.stepwiseRatio * 100)} %, sauts ${Math.round(profile.leapRatio * 100)} %, respiration ${Math.round(profile.restRatio * 100)} %.`,
    );
  }

  const bars: ArrangementBar[] = input.bars.map((bar, index) => ({
    number: index + 1,
    section: sectionFor(index, input.bars.length),
    chord: bar.chord || `${input.key}${input.mode === "minor" ? "min9" : "add9"}`,
    second: bar.second || null,
    texture: textures[Math.min(3, Math.floor(index / Math.max(1, Math.ceil(input.bars.length / 4))))] ?? textures[0],
    origin: bar.origin,
    locked: bar.locked,
  }));

  const motif = [...rng.pick(MOTIFS)];
  const previous: Partial<Record<VoiceName, number>> = {};
  const notes: NoteEvent[] = [];
  let parallels = 0;
  let rangeFaults = 0;
  let activeSlots = 0;
  let possibleSlots = 0;

  bars.forEach((bar, index) => {
    const heldBar = input.holds?.bars?.[bar.number];
    if (heldBar && bar.locked) {
      notes.push(...heldBar.map((note) => ({ ...note, bar: bar.number })));
      heldBar.forEach((note) => {
        previous[note.voice] = note.midi;
      });
      return;
    }
    const regions = bar.second
      ? [
          { symbol: bar.chord, at: 0, span: qpb / 2 },
          { symbol: bar.second, at: qpb / 2, span: qpb / 2 },
        ]
      : [{ symbol: bar.chord, at: 0, span: qpb }];

    regions.forEach((region) => {
    const parsed = parseChord(region.symbol);
    const color = parsed.tones.filter((tone) => {
      const rel = (tone - parsed.root + 12) % 12;
      return rel === 1 || rel === 2 || rel === 3 || rel === 6 || rel === 8 || rel === 9;
    });
    const guide = parsed.tones.filter((tone) => {
      const rel = (tone - parsed.root + 12) % 12;
      return rel === 3 || rel === 4 || rel === 10 || rel === 11;
    });
    const fifth = parsed.tones.find((tone) => (tone - parsed.root + 12) % 12 === 7) ?? parsed.root;
    const bassPc = parsed.bass ?? parsed.root;
    const phase = index % 4;
    const contour = bar.section === "B" ? [...motif].reverse() : motif.map((step, stepIndex) => step + (bar.section === "A2" ? 2 : bar.section === "A3" && stepIndex === 2 ? 1 : 0));
    const stack: number[] = [];

    VOICES.forEach((voice) => {
      possibleSlots += 1;
      const heldVoice = input.holds?.voices?.[voice]?.filter((note) => note.bar === bar.number);
      if (heldVoice && heldVoice.length) {
        if (region.at === 0) {
          notes.push(...heldVoice);
          const last = heldVoice[heldVoice.length - 1]?.midi;
          if (last !== undefined) {
            previous[voice] = last;
            stack.push(last);
          }
          activeSlots += 1;
        }
        return;
      }
      const range = { ...RANGES[voice] };
      if (profile?.centers[voice]) {
        range.center = Math.round(range.center * (1 - weight) + (profile.centers[voice] ?? range.center) * weight);
      }
      const breathe =
        voice !== "Contrabass" &&
        voice !== "Violin I" &&
        rng.chance(restBias) &&
        !(bar.section === "A3" && phase === 3);
      if (breathe) return;
      activeSlots += 1;

      const prior = previous[voice] ?? range.center;
      let pillarPc = parsed.root;
      if (voice === "Contrabass") pillarPc = bassPc;
      else if (voice === "Viola I") pillarPc = guide[0] ?? parsed.tones[1] ?? parsed.root;
      else if (voice === "Viola II") pillarPc = guide[1] ?? guide[0] ?? fifth;
      else if (voice === "Violin II") pillarPc = color[0] ?? guide[0] ?? fifth;
      else if (voice === "Cello") pillarPc = guide[1] ?? fifth;
      else pillarPc = color[color.length - 1] ?? guide[0] ?? parsed.tones[parsed.tones.length - 1] ?? parsed.root;

      let midi = snap([pillarPc], prior, range);
      if (voice === "Violin I" || voice === "Cello") {
        const leap = rng.chance(voice === "Cello" ? Math.min(0.28, leapBias + 0.06) : leapBias);
        const target = prior + (leap ? (rng.chance(0.5) ? 7 : -7) : rng.chance(0.55) ? -2 : 2);
        midi = snap(voice === "Violin I" && color.length ? color : parsed.tones, target, range);
      }
      const other = voice === "Violin I" ? previous["Violin II"] : previous["Violin I"];
      if (other !== undefined && prior !== undefined) {
        const oldIc = intervalClass(prior, other);
        const newIc = intervalClass(midi, nearest(parsed.root, other, RANGES["Violin II"].min, RANGES["Violin II"].max));
        const sameWay = Math.sign(midi - prior) === Math.sign(other - (previous[voice === "Violin I" ? "Violin II" : "Violin I"] ?? other)) && Math.sign(midi - prior) !== 0;
        if ((oldIc === 0 || oldIc === 7) && (newIc === 0 || newIc === 7) && sameWay) {
          parallels += 1;
          const alternate = parsed.tones.find((tone) => tone !== midi % 12) ?? pillarPc;
          midi = snap([alternate], prior + (prior > midi ? 1 : -1), range);
        }
      }
      if (midi < range.min || midi > range.max) rangeFaults += 1;
      const above = stack.length ? stack[stack.length - 1] : undefined;
      if (above !== undefined && midi > above - 3) {
        const lowered = snap(parsed.tones, above - 5, range);
        if (lowered <= above - 2 && lowered >= range.min) midi = lowered;
      }
      stack.push(midi);
      previous[voice] = midi;

      const moving = voice === "Violin I" || (voice === "Cello" && (bar.texture.includes("Counter") || bar.texture.includes("Rain") || rng.chance(0.45))) || (voice === "Violin II" && bar.texture.includes("Rain"));
      let pattern = slots(bar.texture, input.meter, moving).filter((slot) => slot.at < qpb);
      if (!pattern.length) pattern = [{ at: 0, dur: Math.max(0.25, qpb - 0.1) }];
      if (voice === "Violin I" && moving) {
        pattern = pattern.slice(0, Math.max(2, contour.length));
      }
      if (voice === "Cello" && pattern.length > 1) {
        pattern = pattern.map((slot) => ({ ...slot, at: Math.min(qpb - 0.25, slot.at + 0.5) }));
      }
      pattern.forEach((slot, slotIndex) => {
        const scaledAt = (slot.at / qpb) * region.span;
        const room = region.span - scaledAt;
        if (room <= 0.08) return;
        let pitch = midi;
        if (moving) {
          const step = contour[slotIndex % contour.length] ?? 0;
          const direction = voice === "Cello" ? -step : step;
          pitch = snap(voice === "Violin I" && color.length ? color : parsed.tones, midi + direction, range);
          midi = pitch;
          previous[voice] = pitch;
        }
        const duration = Math.max(0.18, Math.min((slot.dur / qpb) * region.span, room - 0.02));
        const velocity = voice === "Violin I" ? 86 : voice === "Contrabass" ? 78 : 62 + (5 - VOICES.indexOf(voice)) * 3;
        notes.push({
          voice,
          midi: pitch,
          start: index * qpb + region.at + scaledAt,
          duration,
          velocity: bar.section === "B" ? Math.min(104, velocity + 8) : velocity,
          bar: bar.number,
        });
      });
    });
    });
  });

  const restRatio = possibleSlots === 0 ? 0 : 1 - activeSlots / possibleSlots;
  let quality = 100 - parallels * 6 - rangeFaults * 4;
  if (restRatio < 0.08) quality -= 6;
  if (restRatio > 0.45) quality -= 8;
  quality = Math.max(35, Math.min(98, Math.round(quality)));

  return {
    title: input.title || "Circular Strings Orchestrator",
    style,
    key: input.key,
    mode: input.mode,
    meter: input.meter,
    tempo: input.tempo,
    seed: input.seed,
    influence: input.influence,
    bars,
    notes,
    report: { quality, parallels, rangeFaults, restRatio, influences },
  };
}

export function previewVoicing(symbol: string): NoteEvent[] {
  const arrangement = arrange({
    bars: [{ chord: symbol, locked: false, origin: "manual" }],
    key: "C",
    mode: "major",
    style: "ECM Ballad",
    meter: "4/4",
    tempo: 72,
    seed: 11,
    influence: 0,
    title: symbol,
  });
  return arrangement.notes;
}
