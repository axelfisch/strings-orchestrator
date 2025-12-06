// Audio Engine for StringsOrchestrator
// Orchestral Strings with ECM-style sound using 6-voice ensemble
// by AxelFisch©2025/2026

import * as Tone from 'tone';
import { ChordInSequence, BarConfig } from '../App';
import { chordToMidiNotes, getChordSymbol } from './chordMapper';
import { StringsEngine, getStringsEngine } from './stringsEngine';

interface ScheduledChord {
  midiNotes: number[];
  chordSymbol: string;
  startTime: number;
  duration: number;
  barIndex: number;
  position?: 1 | 2;
}

export class AudioEngine {
  private stringsEngine: StringsEngine;
  private scheduledChords: ScheduledChord[] = [];
  private initialized = false;
  private animationFrameId: number | null = null;
  private startTimestamp: number = 0;
  private isPlaying: boolean = false;
  private currentTempo: number = 120;
  private loopEnabled: boolean = false;
  private totalDuration: number = 0;
  private onBeatCallback?: (barIndex: number) => void;
  private lastPlayedIndex: number = -1;

  constructor() {
    this.stringsEngine = getStringsEngine();
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.stringsEngine.initialize();
      this.initialized = true;
      console.log('🎼 AudioEngine initialized with 6-voice String Orchestra');
    }
  }

  scheduleSequence(
    sequence: ChordInSequence[],
    barConfigs: BarConfig[],
    tempo: number,
    loop: boolean,
    onBeat?: (barIndex: number) => void
  ): void {
    this.scheduledChords = [];
    this.currentTempo = tempo;
    this.loopEnabled = loop;
    this.onBeatCallback = onBeat;
    this.lastPlayedIndex = -1;

    const beatsPerBar = 4;
    const secondsPerBeat = 60 / tempo;

    barConfigs.forEach((config, barIndex) => {
      const chordsInBar = sequence.filter(c => c.beat === barIndex + 1);

      if (config.chordCount === 1 && chordsInBar.length > 0) {
        const chord = chordsInBar[0];
        const midiNotes = chordToMidiNotes(
          chord.key,
          chord.extension,
          chord.bassInversion,
          chord.isForeignBass
        );
        const chordSymbol = getChordSymbol(chord.key, chord.extension);

        this.scheduledChords.push({
          midiNotes,
          chordSymbol,
          startTime: barIndex * beatsPerBar * secondsPerBeat,
          duration: beatsPerBar * secondsPerBeat * 0.95,
          barIndex
        });
      } else if (config.chordCount === 2) {
        const firstChord = chordsInBar.find(c => c.position === 1);
        const secondChord = chordsInBar.find(c => c.position === 2);

        if (firstChord) {
          const midiNotes = chordToMidiNotes(
            firstChord.key,
            firstChord.extension,
            firstChord.bassInversion,
            firstChord.isForeignBass
          );
          const chordSymbol = getChordSymbol(firstChord.key, firstChord.extension);

          this.scheduledChords.push({
            midiNotes,
            chordSymbol,
            startTime: barIndex * beatsPerBar * secondsPerBeat,
            duration: (beatsPerBar / 2) * secondsPerBeat * 0.95,
            barIndex,
            position: 1
          });
        }

        if (secondChord) {
          const midiNotes = chordToMidiNotes(
            secondChord.key,
            secondChord.extension,
            secondChord.bassInversion,
            secondChord.isForeignBass
          );
          const chordSymbol = getChordSymbol(secondChord.key, secondChord.extension);

          this.scheduledChords.push({
            midiNotes,
            chordSymbol,
            startTime: (barIndex * beatsPerBar + beatsPerBar / 2) * secondsPerBeat,
            duration: (beatsPerBar / 2) * secondsPerBeat * 0.95,
            barIndex,
            position: 2
          });
        }
      }
    });

    // Calculate total duration
    if (this.scheduledChords.length > 0) {
      const lastChord = this.scheduledChords[this.scheduledChords.length - 1];
      this.totalDuration = lastChord.startTime + lastChord.duration;
    } else {
      this.totalDuration = 0;
    }
  }

  private playbackLoop = (timestamp: number): void => {
    if (!this.isPlaying) return;

    let currentTime = (timestamp - this.startTimestamp) / 1000;

    // Handle looping
    if (this.loopEnabled && this.totalDuration > 0 && currentTime >= this.totalDuration) {
      this.startTimestamp = timestamp;
      currentTime = 0;
      this.lastPlayedIndex = -1;
      this.stringsEngine.releaseAll();
    }

    // Check if we've reached the end (non-loop mode)
    if (!this.loopEnabled && this.totalDuration > 0 && currentTime >= this.totalDuration) {
      this.stop();
      return;
    }

    // Find current chord to play
    for (let i = 0; i < this.scheduledChords.length; i++) {
      const chord = this.scheduledChords[i];
      const chordEndTime = chord.startTime + chord.duration;

      if (currentTime >= chord.startTime && currentTime < chordEndTime) {
        if (this.lastPlayedIndex !== i) {
          // Release previous notes before playing new ones
          this.stringsEngine.releaseAll();
          
          // Small delay to allow release, then play
          setTimeout(() => {
            if (this.isPlaying) {
              this.stringsEngine.triggerAttack(chord.midiNotes, chord.chordSymbol);
            }
          }, 15);

          this.lastPlayedIndex = i;

          // Notify callback
          if (this.onBeatCallback) {
            this.onBeatCallback(chord.barIndex);
          }
        }
        break;
      }
    }

    this.animationFrameId = requestAnimationFrame(this.playbackLoop);
  };

  async play(): Promise<void> {
    await this.initialize();
    
    if (this.scheduledChords.length === 0) {
      console.warn('No chords scheduled to play');
      return;
    }

    this.isPlaying = true;
    this.startTimestamp = performance.now();
    this.lastPlayedIndex = -1;
    this.stringsEngine.releaseAll();

    this.animationFrameId = requestAnimationFrame(this.playbackLoop);
    console.log('▶️ String Orchestra playback started');
  }

  pause(): void {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stringsEngine.releaseAll();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stringsEngine.releaseAll();
    this.lastPlayedIndex = -1;
    
    if (this.onBeatCallback) {
      this.onBeatCallback(-1);
    }
  }

  setTempo(bpm: number): void {
    this.currentTempo = bpm;
  }

  getPlaybackState(): 'started' | 'paused' | 'stopped' {
    return this.isPlaying ? 'started' : 'stopped';
  }

  // Play a single chord immediately (for preview)
  async playPreviewChord(
    key: string,
    extension: string,
    bassInversion?: string,
    isForeignBass?: boolean
  ): Promise<void> {
    await this.initialize();
    
    const midiNotes = chordToMidiNotes(key, extension, bassInversion, isForeignBass);
    const chordSymbol = getChordSymbol(key, extension);
    
    await this.stringsEngine.playChord(midiNotes, chordSymbol, 2.5);
  }

  dispose(): void {
    this.stop();
    this.stringsEngine.dispose();
  }
}
