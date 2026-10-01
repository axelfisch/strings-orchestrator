import type { Arrangement, NoteEvent, VoiceName } from "./types";
import { VOICES } from "./types";
import { quarterToTransport, quartersPerBar } from "./theory";

type ToneModule = typeof import("tone");

const CHAINS: Record<VoiceName, { oscillator: "sine" | "triangle" | "sawtooth"; volume: number }> = {
  "Violin I": { oscillator: "sawtooth", volume: -14 },
  "Violin II": { oscillator: "sawtooth", volume: -18 },
  "Viola I": { oscillator: "triangle", volume: -16 },
  "Viola II": { oscillator: "triangle", volume: -18 },
  Cello: { oscillator: "triangle", volume: -12 },
  Contrabass: { oscillator: "sine", volume: -10 },
};

export interface PlayerHandle {
  play: (arrangement: Arrangement, fromBeat?: number) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  setLoop: (enabled: boolean) => void;
  setTempo: (bpm: number) => void;
  position: () => { beat: number; seconds: number; playing: boolean; paused: boolean };
  dispose: () => void;
}

export function playbackSchedule(arrangement: Arrangement): NoteEvent[] {
  return arrangement.notes
    .map((note) => ({ ...note }))
    .sort((a, b) => a.start - b.start || a.voice.localeCompare(b.voice) || a.midi - b.midi);
}

export async function createPlayer(onEnd: () => void): Promise<PlayerHandle> {
  const Tone: ToneModule = await import("tone");
  const synths = Object.fromEntries(
    VOICES.map((voice) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: CHAINS[voice].oscillator },
        envelope: { attack: 0.06, decay: 0.12, sustain: 0.72, release: 0.45 },
        volume: CHAINS[voice].volume,
      }).toDestination();
      return [voice, synth];
    }),
  ) as Record<VoiceName, import("tone").PolySynth>;
  let part: import("tone").Part | null = null;
  let loop = false;
  let endBeat = 0;
  let playing = false;
  let paused = false;

  const clearPart = () => {
    part?.dispose();
    part = null;
    VOICES.forEach((voice) => synths[voice].releaseAll());
  };

  const schedule = (arrangement: Arrangement) => {
    clearPart();
    const qpb = quartersPerBar(arrangement.meter);
    Tone.getTransport().timeSignature = arrangement.meter === "6/8" ? [6, 8] : [qpb, 4];
    Tone.getTransport().bpm.value = arrangement.tempo;
    const events = playbackSchedule(arrangement).map((note) => ({ ...note, time: quarterToTransport(note.start, qpb) }));
    part = new Tone.Part((time, note: NoteEvent & { time: string }) => {
      const seconds = Math.max(0.05, note.duration * (60 / Tone.getTransport().bpm.value));
      synths[note.voice].triggerAttackRelease(Tone.Frequency(note.midi, "midi").toFrequency(), seconds, time, note.velocity / 127);
    }, events);
    part.start(0);
    const last = arrangement.notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
    endBeat = Math.max(last, arrangement.bars.length * qpb);
    Tone.getTransport().loop = loop;
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = quarterToTransport(endBeat, qpb);
  };

  Tone.getTransport().scheduleRepeat(() => {
    if (!playing || loop) return;
    const ppq = Tone.getTransport().PPQ || 192;
    if (Tone.getTransport().ticks >= endBeat * ppq - 2) {
      playing = false;
      paused = false;
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      VOICES.forEach((voice) => synths[voice].releaseAll());
      onEnd();
    }
  }, "8n");

  return {
    async play(arrangement, fromBeat = 0) {
      await Tone.start();
      if (Tone.getTransport().state !== "stopped") Tone.getTransport().stop();
      schedule(arrangement);
      Tone.getTransport().position = quarterToTransport(fromBeat, quartersPerBar(arrangement.meter));
      Tone.getTransport().start();
      playing = true;
      paused = false;
    },
    pause() {
      if (!playing) return;
      Tone.getTransport().pause();
      VOICES.forEach((voice) => synths[voice].releaseAll());
      paused = true;
      playing = false;
    },
    async resume() {
      await Tone.start();
      if (!paused) return;
      Tone.getTransport().start();
      paused = false;
      playing = true;
    },
    stop() {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      clearPart();
      playing = false;
      paused = false;
    },
    setLoop(enabled) {
      loop = enabled;
      Tone.getTransport().loop = enabled;
    },
    setTempo(bpm) {
      Tone.getTransport().bpm.value = bpm;
    },
    position() {
      const ppq = Tone.getTransport().PPQ || 192;
      const beat = Tone.getTransport().ticks / ppq;
      return { beat, seconds: Tone.getTransport().seconds, playing, paused };
    },
    dispose() {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      clearPart();
      VOICES.forEach((voice) => synths[voice].dispose());
    },
  };
}
