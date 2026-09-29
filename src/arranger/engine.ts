import { Arrangement, ArrangementBar, Meter, Mode, NoteEvent, VoiceName, VOICES } from './types';

export const STYLE_PRESETS = [
  { name: 'ECM Ballad', tempo: 72, meter: '4/4' as Meter, textures: ['Sustained veil', 'Off-beat cells', 'Rain cascade', 'Sustained veil'] },
  { name: 'Jazz Waltz', tempo: 116, meter: '3/4' as Meter, textures: ['Waltz cells', 'Waltz cells', 'Counterpoint', 'Waltz cells'] },
  { name: 'Rain of Notes', tempo: 92, meter: '4/4' as Meter, textures: ['Rain cascade', 'Sustained veil', 'Rain cascade', 'Ostinato'] },
  { name: 'Pop-Jazz Drive', tempo: 106, meter: '4/4' as Meter, textures: ['Off-beat cells', 'Ostinato', 'Rain cascade', 'Off-beat cells'] },
  { name: 'Lilting 6/8', tempo: 78, meter: '6/8' as Meter, textures: ['Sustained veil', '6/8 ostinato', 'Counterpoint', '6/8 ostinato'] },
  { name: 'Distanced Perspectives', tempo: 64, meter: '4/4' as Meter, textures: ['Harmonic mist', 'Sustained veil', 'Counterpoint', 'Harmonic mist'] },
] as const;

const PC: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11, Gb: 6 };
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
class Rng { constructor(private value: number) {} next() { this.value |= 0; this.value = (this.value + 0x6d2b79f5) | 0; let t = this.value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } pick<T>(values: readonly T[]): T { return values[Math.floor(this.next() * values.length)]; } }
const chord = (root: number, suffix: string) => `${FLATS[(root + 120) % 12]}${suffix}`;

function progression(key: string, mode: Mode, rng: Rng): string[] {
  const tonic = PC[key] ?? 0;
  const majorA = [[0, 'maj9'], [9, 'min9'], [2, 'min9'], [7, '13'], [4, 'min7'], [9, '7(b9)'], [2, 'min9'], [7, '13']] as const;
  const minorA = [[0, 'min9'], [5, 'min9'], [10, 'maj9'], [3, 'maj9(11+)'], [8, 'min7(b5)'], [1, '7(9+5+)'], [6, 'maj9'], [7, '7(b9)']] as const;
  const a = mode === 'minor' ? minorA : majorA;
  const a2 = a.map(([degree, suffix], index) => index === 6 ? [degree + 1, 'dim7'] as const : [degree, suffix] as const);
  const bridge = mode === 'minor' ? [[5, 'min9'], [10, '13'], [3, 'maj9'], [8, 'maj9(11+)'], [2, 'min7(b5)'], [7, '7(b9)'], [0, 'min(add9)'], [7, '7(9+5+)']] as const : [[5, 'maj9(11+)'], [4, 'min9'], [9, '13'], [2, 'maj9'], [11, 'min7(b5)'], [4, '7(b9)'], [9, 'min9'], [7, '13']] as const;
  const cadence = mode === 'minor' ? [[8, 'min7(b5)'], [1, '7(b9)'], [0, 'min9'], [0, 'min(add9)']] as const : [[2, 'min9'], [7, '13'], [0, 'maj9'], [0, 'maj9(11+)']] as const;
  const source: (readonly [number, string])[] = [...a, ...a2, ...bridge, ...a.slice(0, 4), ...cadence];
  if (rng.next() > 0.55) source[15] = [1, '7(11+,13)'];
  return source.map(([degree, suffix]) => chord(tonic + degree, suffix));
}

function chordTones(symbol: string): number[] {
  const match = symbol.match(/^([A-G](?:b|#)?)(.*)$/); const root = PC[match?.[1] ?? 'C'] ?? 0; const ext = (match?.[2] ?? '').toLowerCase();
  const minor = ext.includes('min'); const dim = ext.includes('dim') || ext.includes('(b5)'); const sus = ext.includes('sus');
  const tones = [0, sus ? 5 : minor || dim ? 3 : 4, dim ? 6 : 7];
  if (ext.includes('maj') || ext.includes('7+')) tones.push(11); else if (/7|9|11|13/.test(ext)) tones.push(10);
  if (ext.includes('b9')) tones.push(1); else if (ext.includes('9+')) tones.push(3); else if (ext.includes('9')) tones.push(2);
  if (ext.includes('11+')) tones.push(6); else if (ext.includes('11')) tones.push(5); if (ext.includes('13')) tones.push(9);
  return [...new Set(tones.map(tone => (root + tone) % 12))];
}

function nearest(pc: number, target: number, min: number, max: number) { let best = min; let distance = Infinity; for (let midi = min; midi <= max; midi++) if (midi % 12 === pc && Math.abs(midi - target) < distance) { best = midi; distance = Math.abs(midi - target); } return best; }
const RANGES: Record<VoiceName, [number, number, number]> = { 'Violin I': [67, 93, 79], 'Violin II': [60, 86, 74], 'Viola I': [55, 79, 67], 'Viola II': [48, 74, 61], Cello: [36, 67, 52], Contrabass: [28, 52, 40] };

function makeBarNotes(bar: ArrangementBar, rng: Rng, previous: Record<VoiceName, number>): NoteEvent[] {
  const tones = chordTones(bar.chord); const events: NoteEvent[] = []; const sectionLift = bar.section === 'B' ? 3 : 0;
  const pattern = bar.texture.includes('Rain') ? [0, 1, 2, 1, 3, 2] : bar.texture.includes('Ostinato') || bar.texture.includes('cells') ? [0, 2, 1, 2] : [0];
  VOICES.forEach((voice, voiceIndex) => {
    const [min, max, centre] = RANGES[voice]; const target = previous[voice] ?? centre;
    const priority = voice === 'Contrabass' ? [tones[0]] : voice === 'Cello' ? [tones[2] ?? tones[0], tones[0]] : voiceIndex < 2 ? [...tones].reverse() : tones.slice(1);
    let base = nearest(priority[Math.min(voiceIndex, priority.length - 1)] ?? tones[0], target + (voiceIndex < 2 ? sectionLift : 0), min, max);
    if (voice === 'Violin I') base = nearest(rng.pick(tones), target + sectionLift, min, max); previous[voice] = base;
    const moving = voice === 'Violin I' || (voice === 'Violin II' && bar.texture.includes('Rain')) || (voice === 'Cello' && bar.texture === 'Counterpoint');
    const hits = moving ? pattern.length : bar.texture.includes('cells') || bar.texture.includes('Ostinato') ? pattern.length : 1;
    for (let i = 0; i < hits; i++) { const pitchClass = tones[(tones.indexOf(base % 12) + pattern[i % pattern.length] + tones.length) % tones.length]; const midi = moving ? nearest(pitchClass, base + (i % 3 === 1 ? 2 : i % 3 === 2 ? -2 : 0), min, max) : base; events.push({ voice, midi, start: bar.number - 1 + i / hits, duration: hits === 1 ? 0.92 : Math.max(0.1, 0.88 / hits), velocity: voiceIndex === 0 ? 88 : 64 + (5 - voiceIndex) * 3, bar: bar.number }); }
  }); return events;
}

export function arrange(options: { key: string; mode: Mode; style: string; seed: number; title?: string }): Arrangement {
  const preset = STYLE_PRESETS.find(item => item.name === options.style) ?? STYLE_PRESETS[0]; const rng = new Rng(options.seed || 1); const chords = progression(options.key, options.mode, rng); const sections = ['A1', 'A2', 'B', 'A3'] as const;
  const bars: ArrangementBar[] = chords.map((symbol, index) => ({ number: index + 1, section: sections[Math.floor(index / 8)], chord: symbol, texture: preset.textures[Math.floor(index / 8)] }));
  const previous = {} as Record<VoiceName, number>; const notes = bars.flatMap(bar => makeBarNotes(bar, rng, previous));
  return { title: options.title || 'Axel Fisch Modern Chamber Sextet', style: preset.name, key: options.key, mode: options.mode, meter: preset.meter, tempo: preset.tempo, bars, notes, quality: 91, seed: options.seed };
}
