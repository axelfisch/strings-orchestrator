import type { Meter } from "./types";

export interface MidiNote {
  midi: number;
  startBeat: number;
  durationBeat: number;
  velocity: number;
  channel: number;
}

export interface MidiTrack {
  name: string;
  notes: MidiNote[];
  channels: number[];
  programs: { beat: number; channel: number; program: number }[];
  percussion: boolean;
}

export interface ParsedHarmony {
  bar: number;
  offsetBeat: number;
  symbol: string;
}

export interface ParsedMidi {
  source: "midi" | "musicxml";
  format: number;
  ppq: number;
  tracks: MidiTrack[];
  tempos: { beat: number; bpm: number }[];
  meters: { beat: number; beats: number; value: number }[];
  keys: { beat: number; fifths: number; minor: boolean }[];
  markers: { beat: number; text: string }[];
  harmonies: ParsedHarmony[];
  durationBeats: number;
}

function text(data: Uint8Array, start: number, length: number): string {
  return new TextDecoder().decode(data.slice(start, start + length));
}

function keySignature(byte: number): number {
  return byte > 127 ? byte - 256 : byte;
}

export function parseMidi(buffer: ArrayBuffer): ParsedMidi {
  const data = new Uint8Array(buffer);
  let offset = 0;
  const ensure = (size: number) => {
    if (offset + size > data.length) throw new Error("Fichier MIDI tronqué");
  };
  const read = (size: number) => {
    ensure(size);
    const slice = data.slice(offset, offset + size);
    offset += size;
    return slice;
  };
  const u32 = () => {
    const bytes = read(4);
    return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  };
  const u16 = () => {
    const bytes = read(2);
    return (bytes[0] << 8) | bytes[1];
  };
  const variable = () => {
    let value = 0;
    let byte = 0;
    let count = 0;
    do {
      ensure(1);
      byte = data[offset++] ?? 0;
      value = (value << 7) | (byte & 0x7f);
      count += 1;
      if (count > 4) throw new Error("Valeur MIDI variable invalide");
    } while (byte & 0x80);
    return value;
  };

  ensure(14);
  const header = text(data, offset, 4);
  offset += 4;
  if (header !== "MThd") throw new Error("En-tête MIDI absente");
  const headerLength = u32();
  if (headerLength < 6) throw new Error("En-tête MIDI invalide");
  const format = u16();
  if (format > 1) throw new Error("Le format MIDI 2 n’est pas pris en charge");
  const trackCount = u16();
  const division = u16();
  if (division & 0x8000) throw new Error("Division SMPTE non prise en charge");
  if (headerLength > 6) read(headerLength - 6);
  const ppq = division || 480;
  const tracks: MidiTrack[] = [];
  const tempos: ParsedMidi["tempos"] = [];
  const meters: ParsedMidi["meters"] = [];
  const keys: ParsedMidi["keys"] = [];
  const markers: ParsedMidi["markers"] = [];
  let durationBeats = 0;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    ensure(8);
    const id = text(data, offset, 4);
    offset += 4;
    if (id !== "MTrk") throw new Error(`Piste MIDI ${trackIndex + 1} illisible`);
    const length = u32();
    const end = offset + length;
    if (end > data.length) throw new Error(`Piste MIDI ${trackIndex + 1} tronquée`);
    let tick = 0;
    let running = 0;
    const open = new Map<string, { tick: number; velocity: number; channel: number; midi: number }[]>();
    const notes: MidiNote[] = [];
    const programs: MidiTrack["programs"] = [];
    const channels = new Set<number>();
    let name = `Piste ${trackIndex + 1}`;
    while (offset < end) {
      const delta = variable();
      tick += delta;
      let status = data[offset] ?? 0;
      if (status & 0x80) {
        offset += 1;
        if (status < 0xf0) running = status;
      } else {
        if (!running) throw new Error("Running status MIDI invalide");
        status = running;
      }
      if (status === 0xff) {
        ensure(1);
        const type = data[offset++] ?? 0;
        const metaLength = variable();
        const meta = read(metaLength);
        if (type === 0x03 && meta.length) name = text(meta, 0, meta.length);
        if (type === 0x06 && meta.length) markers.push({ beat: tick / ppq, text: text(meta, 0, meta.length) });
        if (type === 0x51 && meta.length >= 3) {
          const micros = (meta[0] << 16) | (meta[1] << 8) | meta[2];
          tempos.push({ beat: tick / ppq, bpm: micros > 0 ? 60000000 / micros : 120 });
        }
        if (type === 0x58 && meta.length >= 2) meters.push({ beat: tick / ppq, beats: meta[0], value: 2 ** meta[1] });
        if (type === 0x59 && meta.length >= 2) keys.push({ beat: tick / ppq, fifths: keySignature(meta[0]), minor: meta[1] === 1 });
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const sysexLength = variable();
        read(sysexLength);
        continue;
      }
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      channels.add(channel);
      if (kind === 0xc0) {
        ensure(1);
        programs.push({ beat: tick / ppq, channel, program: data[offset++] ?? 0 });
        continue;
      }
      if (kind === 0xd0) {
        read(1);
        continue;
      }
      const bytes = read(2);
      const data1 = bytes[0] ?? 0;
      const data2 = bytes[1] ?? 0;
      const key = `${channel}:${data1}`;
      if (kind === 0x90 && data2 > 0) {
        const stack = open.get(key) ?? [];
        stack.push({ tick, velocity: data2, channel, midi: data1 });
        open.set(key, stack);
      }
      if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        const stack = open.get(key);
        const started = stack?.shift();
        if (started) {
          notes.push({
            midi: data1,
            startBeat: started.tick / ppq,
            durationBeat: Math.max(1 / ppq, (tick - started.tick) / ppq),
            velocity: started.velocity,
            channel,
          });
          if (!stack?.length) open.delete(key);
        }
      }
    }
    open.forEach((stack) => stack.forEach((started) => notes.push({
      midi: started.midi,
      startBeat: started.tick / ppq,
      durationBeat: Math.max(1 / ppq, (tick - started.tick) / ppq),
      velocity: started.velocity,
      channel: started.channel,
    })));
    offset = end;
    notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
    durationBeats = Math.max(durationBeats, tick / ppq, ...notes.map((note) => note.startBeat + note.durationBeat));
    const channelList = [...channels].sort((a, b) => a - b);
    tracks.push({ name, notes, channels: channelList, programs, percussion: channelList.length > 0 && channelList.every((channel) => channel === 9) });
  }
  return {
    source: "midi",
    format,
    ppq,
    tracks,
    tempos: tempos.sort((a, b) => a.beat - b.beat),
    meters: meters.sort((a, b) => a.beat - b.beat),
    keys: keys.sort((a, b) => a.beat - b.beat),
    markers: markers.sort((a, b) => a.beat - b.beat),
    harmonies: [],
    durationBeats,
  };
}

function entities(value: string): string {
  return value
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join("\"")
    .split("&apos;").join("'");
}

function tag(body: string, name: string): string | null {
  const match = body.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? entities((match[1] ?? "").trim()) : null;
}

function alterName(step: string, alter: number): string {
  return `${step}${alter === 1 ? "#" : alter === -1 ? "b" : ""}`;
}

function musicXmlKind(body: string): string {
  const kindTag = body.match(/<kind(?:\s[^>]*)?>([\s\S]*?)<\/kind>/i);
  const textAttribute = body.match(/<kind[^>]*\btext="([^"]+)"/i)?.[1];
  if (textAttribute) {
    const full = entities(textAttribute).trim();
    const root = body.match(/<root-step[^>]*>([A-G])<\/root-step>/i)?.[1] ?? "";
    return full.startsWith(root) ? full.slice(root.length) : full;
  }
  const kind = entities((kindTag?.[1] ?? "major").replace(/<[^>]+>/g, "").trim());
  const map: Record<string, string> = {
    major: "maj", minor: "min", dominant: "7", "major-seventh": "maj7", "minor-seventh": "min7",
    "major-ninth": "maj9", "minor-ninth": "min9", "dominant-ninth": "9", "dominant-11th": "11",
    "dominant-13th": "13", diminished: "dim", "half-diminished": "min7(b5)", "suspended-second": "sus2",
    "suspended-fourth": "sus4", none: "maj",
  };
  return map[kind] ?? kind;
}

function harmonyFromXml(body: string): string {
  const rootStep = body.match(/<root-step[^>]*>([A-G])<\/root-step>/i)?.[1] ?? "C";
  const rootAlter = Number(body.match(/<root-alter[^>]*>(-?\d+)<\/root-alter>/i)?.[1] ?? 0);
  const root = alterName(rootStep, rootAlter);
  const quality = musicXmlKind(body);
  const bassStep = body.match(/<bass-step[^>]*>([A-G])<\/bass-step>/i)?.[1];
  const bassAlter = Number(body.match(/<bass-alter[^>]*>(-?\d+)<\/bass-alter>/i)?.[1] ?? 0);
  const bass = bassStep ? alterName(bassStep, bassAlter) : null;
  const fullText = body.match(/<kind[^>]*\btext="([^"]+)"/i)?.[1];
  if (fullText && /^[A-G](?:#|b)?/.test(entities(fullText))) {
    const symbol = entities(fullText);
    return bass && !symbol.includes("/") ? `${symbol}/${bass}` : symbol;
  }
  return `${root}${quality}${bass && bass !== root ? `/${bass}` : ""}`;
}

export function musicXmlToParsed(xml: string): ParsedMidi {
  if (!/<score-(?:partwise|timewise)\b/i.test(xml)) throw new Error("MusicXML non reconnu");
  if (/<score-timewise\b/i.test(xml)) throw new Error("MusicXML timewise non pris en charge; exporter en score-partwise");
  const partNames = new Map<string, string>();
  for (const match of xml.matchAll(/<score-part\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/score-part>/gi)) {
    partNames.set(match[1], tag(match[2] ?? "", "part-name") ?? match[1]);
  }
  const tracks: MidiTrack[] = [];
  const harmonies: ParsedHarmony[] = [];
  const tempos: ParsedMidi["tempos"] = [];
  const meters: ParsedMidi["meters"] = [];
  const keys: ParsedMidi["keys"] = [];
  const markers: ParsedMidi["markers"] = [];
  let globalDuration = 0;
  let globalBar = 0;

  for (const partMatch of xml.matchAll(/<part\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/part>/gi)) {
    const partId = partMatch[1];
    const partBody = partMatch[2] ?? "";
    let divisions = 1;
    let beats = 4;
    let beatType = 4;
    let partBeat = 0;
    let lastStart = 0;
    let barIndex = 0;
    const notes: MidiNote[] = [];
    for (const measureMatch of partBody.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/gi)) {
      const measure = measureMatch[1] ?? "";
      const div = Number(tag(measure, "divisions") ?? divisions);
      if (Number.isFinite(div) && div > 0) divisions = div;
      const nextBeats = Number(tag(measure, "beats") ?? beats);
      const nextBeatType = Number(tag(measure, "beat-type") ?? beatType);
      if (Number.isFinite(nextBeats) && nextBeats > 0) beats = nextBeats;
      if (Number.isFinite(nextBeatType) && nextBeatType > 0) beatType = nextBeatType;
      if (tracks.length === 0) {
        const meterBeat = partBeat;
        if (!meters.some((item) => item.beat === meterBeat && item.beats === beats && item.value === beatType)) meters.push({ beat: meterBeat, beats, value: beatType });
        const fifths = Number(tag(measure, "fifths"));
        if (Number.isFinite(fifths) && !keys.some((item) => item.beat === meterBeat)) keys.push({ beat: meterBeat, fifths, minor: tag(measure, "mode") === "minor" });
        for (const sound of measure.matchAll(/<sound\b[^>]*\btempo="([0-9.]+)"[^>]*\/?\s*>/gi)) tempos.push({ beat: partBeat, bpm: Number(sound[1]) });
        for (const rehearsal of measure.matchAll(/<rehearsal(?:\s[^>]*)?>([\s\S]*?)<\/rehearsal>/gi)) markers.push({ beat: partBeat, text: entities((rehearsal[1] ?? "").trim()) });
        for (const harmonyMatch of measure.matchAll(/<harmony\b[^>]*>([\s\S]*?)<\/harmony>/gi)) {
          const body = harmonyMatch[1] ?? "";
          const offsetUnits = Number(tag(body, "offset") ?? 0);
          harmonies.push({ bar: barIndex + 1, offsetBeat: offsetUnits / divisions, symbol: harmonyFromXml(body) });
        }
      }
      let cursor = partBeat;
      const tokenPattern = /<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      for (const token of measure.matchAll(tokenPattern)) {
        const kind = token[1].toLowerCase();
        const body = token[2] ?? "";
        const duration = Math.max(0, Number(tag(body, "duration") ?? 0) / divisions);
        if (kind === "backup") {
          cursor = Math.max(partBeat, cursor - duration);
          continue;
        }
        if (kind === "forward") {
          cursor += duration;
          continue;
        }
        const chord = /<chord\b[^>]*\/?\s*>/i.test(body);
        const start = chord ? lastStart : cursor;
        if (!/<rest\b[^>]*\/?\s*>/i.test(body)) {
          const step = tag(body, "step");
          const alter = Number(tag(body, "alter") ?? 0);
          const octave = Number(tag(body, "octave") ?? 4);
          const dynamic = Number(body.match(/<sound[^>]*\bdynamics="([0-9.]+)"/i)?.[1] ?? 80);
          if (step && /^[A-G]$/.test(step)) {
            const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            notes.push({
              midi: (octave + 1) * 12 + (steps[step] ?? 0) + alter,
              startBeat: start,
              durationBeat: Math.max(0.01, duration),
              velocity: Math.max(1, Math.min(127, Math.round(dynamic))),
              channel: tracks.length % 16,
            });
          }
        }
        lastStart = start;
        if (!chord) cursor += duration;
      }
      const measureDuration = beats * (4 / beatType);
      partBeat += Math.max(measureDuration, cursor - partBeat);
      barIndex += 1;
    }
    globalBar = Math.max(globalBar, barIndex);
    globalDuration = Math.max(globalDuration, partBeat, ...notes.map((note) => note.startBeat + note.durationBeat));
    tracks.push({
      name: partNames.get(partId) ?? partId,
      notes: notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi),
      channels: [Math.min(15, tracks.length)],
      programs: [],
      percussion: false,
    });
  }
  if (!tracks.length) throw new Error("Aucune partie MusicXML lisible");
  if (!tempos.length) tempos.push({ beat: 0, bpm: 120 });
  if (!meters.length) meters.push({ beat: 0, beats: 4, value: 4 });
  void globalBar;
  return {
    source: "musicxml",
    format: 1,
    ppq: 480,
    tracks,
    tempos,
    meters,
    keys,
    markers,
    harmonies,
    durationBeats: globalDuration,
  };
}

export function meterFromParsed(parsed: ParsedMidi): Meter {
  const meter = parsed.meters[0];
  if (meter?.beats === 3 && meter.value === 4) return "3/4";
  if (meter?.beats === 6 && meter.value === 8) return "6/8";
  return "4/4";
}
