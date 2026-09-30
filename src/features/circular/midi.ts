export interface MidiNote {
  midi: number;
  startBeat: number;
  durationBeat: number;
  velocity: number;
}

export interface MidiTrack {
  name: string;
  notes: MidiNote[];
}

export interface ParsedMidi {
  format: number;
  ppq: number;
  tracks: MidiTrack[];
  tempos: { beat: number; bpm: number }[];
  meters: { beat: number; beats: number; value: number }[];
}

function text(data: Uint8Array, start: number, length: number): string {
  return new TextDecoder().decode(data.slice(start, start + length));
}

export function parseMidi(buffer: ArrayBuffer): ParsedMidi {
  const data = new Uint8Array(buffer);
  let offset = 0;
  const read = (size: number) => {
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
  const header = text(data, offset, 4);
  offset += 4;
  if (header !== "MThd") throw new Error("En-tête MIDI absente");
  u32();
  const format = u16();
  const trackCount = u16();
  const division = u16();
  if (division & 0x8000) throw new Error("Division SMPTE non prise en charge");
  const ppq = division || 480;
  const tracks: MidiTrack[] = [];
  const tempos: ParsedMidi["tempos"] = [];
  const meters: ParsedMidi["meters"] = [];

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    const id = text(data, offset, 4);
    offset += 4;
    if (id !== "MTrk") throw new Error("Piste MIDI illisible");
    const length = u32();
    const end = offset + length;
    let tick = 0;
    let running = 0;
    const open = new Map<number, { tick: number; velocity: number }>();
    const notes: MidiNote[] = [];
    let name = `Piste ${trackIndex + 1}`;
    while (offset < end) {
      let delta = 0;
      let byte = 0;
      do {
        byte = data[offset++] ?? 0;
        delta = (delta << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      tick += delta;
      let status = data[offset] ?? 0;
      if (status & 0x80) {
        offset += 1;
        running = status;
      } else status = running;
      const kind = status & 0xf0;
      if (status === 0xff) {
        const type = data[offset++] ?? 0;
        let metaLength = 0;
        let metaByte = 0;
        do {
          metaByte = data[offset++] ?? 0;
          metaLength = (metaLength << 7) | (metaByte & 0x7f);
        } while (metaByte & 0x80);
        const meta = read(metaLength);
        if (type === 0x03 && meta.length) name = text(meta, 0, meta.length);
        if (type === 0x51 && meta.length >= 3) {
          const micros = (meta[0] << 16) | (meta[1] << 8) | meta[2];
          tempos.push({ beat: tick / ppq, bpm: micros > 0 ? Math.round(60000000 / micros) : 120 });
        }
        if (type === 0x58 && meta.length >= 2) meters.push({ beat: tick / ppq, beats: meta[0], value: 2 ** meta[1] });
      } else if (status === 0xf0 || status === 0xf7) {
        let sysLength = 0;
        let sysByte = 0;
        do {
          sysByte = data[offset++] ?? 0;
          sysLength = (sysLength << 7) | (sysByte & 0x7f);
        } while (sysByte & 0x80);
        offset += sysLength;
      } else if (kind === 0xc0 || kind === 0xd0) {
        offset += 1;
      } else {
        const data1 = data[offset++] ?? 0;
        const data2 = data[offset++] ?? 0;
        if (kind === 0x90 && data2 > 0) open.set(data1, { tick, velocity: data2 });
        if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
          const started = open.get(data1);
          if (started) {
            notes.push({
              midi: data1,
              startBeat: started.tick / ppq,
              durationBeat: Math.max(1 / ppq, (tick - started.tick) / ppq),
              velocity: started.velocity,
            });
            open.delete(data1);
          }
        }
      }
    }
    offset = end;
    tracks.push({ name, notes });
  }
  return { format, ppq, tracks, tempos, meters };
}

export function musicXmlToParsed(xml: string): ParsedMidi {
  const divisionsDefault = Number(xml.match(/<divisions>(\d+)<\/divisions>/)?.[1] ?? 1);
  const partMatches = [...xml.matchAll(/<part\b[^>]*>([\s\S]*?)<\/part>/g)];
  const chunks = partMatches.length ? partMatches.map((match) => match[1] ?? "") : [xml];
  const tracks = chunks.map((part, index) => {
    const name = xml.match(new RegExp(`<score-part id="P${index + 1}"[\\s\\S]*?<part-name>([^<]*)</part-name>`))?.[1] ?? `Part ${index + 1}`;
    let beat = 0;
    let divisions = divisionsDefault;
    const notes: MidiNote[] = [];
    for (const token of part.matchAll(/<divisions>(\d+)<\/divisions>|<note>([\s\S]*?)<\/note>/g)) {
      if (token[1]) {
        divisions = Number(token[1]) || 1;
        continue;
      }
      const body = token[2] ?? "";
      const quarters = (Number(body.match(/<duration>(\d+)<\/duration>/)?.[1] ?? 0) || 0) / divisions;
      const chord = body.includes("<chord");
      if (!body.includes("<rest")) {
        const step = body.match(/<step>([A-G])<\/step>/)?.[1];
        const alter = Number(body.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0);
        const octave = Number(body.match(/<octave>(\d+)<\/octave>/)?.[1] ?? 4);
        if (step) {
          const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
          const pc = (steps[step] ?? 0) + alter;
          notes.push({ midi: (octave + 1) * 12 + pc, startBeat: beat, durationBeat: Math.max(0.05, quarters), velocity: 80 });
        }
      }
      if (!chord) beat += quarters;
    }
    return { name, notes };
  });
  return { format: 1, ppq: 480, tracks, tempos: [], meters: [] };
}
