export const VOICES = ['Violin I', 'Violin II', 'Viola I', 'Viola II', 'Cello', 'Contrabass'] as const;
export type VoiceName = (typeof VOICES)[number];
export type Meter = '4/4' | '3/4' | '6/8';
export type Mode = 'major' | 'minor';
export interface NoteEvent { voice: VoiceName; midi: number; start: number; duration: number; velocity: number; bar: number; }
export interface ArrangementBar { number: number; section: 'A1' | 'A2' | 'B' | 'A3'; chord: string; texture: string; }
export interface Arrangement { title: string; style: string; key: string; mode: Mode; meter: Meter; tempo: number; bars: ArrangementBar[]; notes: NoteEvent[]; quality: number; seed: number; }
