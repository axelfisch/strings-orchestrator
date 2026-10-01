import type { Origin, VoiceName, VoiceRole } from "../types";

/** Stable voice identities. The values point at the CSS tokens defined in circular.css. */
export const VOICE_COLOR: Record<VoiceName, string> = {
  "Violin I": "var(--voice-vn1)",
  "Violin II": "var(--voice-vn2)",
  "Viola I": "var(--voice-va1)",
  "Viola II": "var(--voice-va2)",
  Cello: "var(--voice-vc)",
  Contrabass: "var(--voice-cb)",
};

export const VOICE_SHORT: Record<VoiceName, string> = {
  "Violin I": "Vn I",
  "Violin II": "Vn II",
  "Viola I": "Alt I",
  "Viola II": "Alt II",
  Cello: "Vc",
  Contrabass: "Cb",
};

export const ORIGIN_LABELS: Record<Origin, string> = {
  generated: "Générée",
  manual: "Manuelle",
  imported: "Importée",
  empty: "Vide",
};

export const ROLE_LABELS: Record<VoiceRole, string> = {
  melody: "Mélodie",
  counterline: "Contrechant",
  harmony: "Harmonie",
  inner: "Voix intérieure",
  foundation: "Fondation",
  rest: "Silence",
};

export type NoticeTone = "info" | "success" | "warning" | "error";

/** Scientific pitch name (MIDI 60 = C4) used for the piano-roll guides. */
export function pitchName(midi: number): string {
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function formatDuration(beats: number, tempo: number): string {
  const seconds = Math.max(0, Math.round((beats * 60) / Math.max(1, tempo)));
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
