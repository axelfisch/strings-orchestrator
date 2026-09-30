import { keyFifths, pitchClass, quartersPerBar } from "./theory";
import { VOICES, type Arrangement, type NoteEvent, type VoiceName } from "./types";

const encoder = new TextEncoder();
const bytes = (value: string) => Array.from(encoder.encode(value));
const u32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const u16 = (value: number) => [(value >>> 8) & 255, value & 255];
const variable = (value: number) => {
  const result = [value & 127];
  let rest = value >> 7;
  while (rest > 0) {
    result.unshift((rest & 127) | 128);
    rest >>= 7;
  }
  return result;
};
const chunk = (id: string, data: number[]) => [...bytes(id), ...u32(data.length), ...data];

function timeSignature(meter: Arrangement["meter"]): number[] {
  if (meter === "3/4") return [3, 2, 24, 8];
  if (meter === "6/8") return [6, 3, 24, 8];
  return [4, 2, 24, 8];
}

function midiTrack(notes: NoteEvent[], name: string, arrangement?: Arrangement): number[] {
  const ticks = 480;
  const title = bytes(name);
  const events: { tick: number; data: number[] }[] = [
    { tick: 0, data: [0xff, 0x03, ...variable(title.length), ...title] },
  ];
  if (arrangement) {
    const micros = Math.round(60000000 / arrangement.tempo);
    events.push({ tick: 0, data: [0xff, 0x51, 0x03, (micros >> 16) & 255, (micros >> 8) & 255, micros & 255] });
    events.push({ tick: 0, data: [0xff, 0x58, 0x04, ...timeSignature(arrangement.meter)] });
  }
  notes.forEach((note) => {
    const start = Math.max(0, Math.round(note.start * ticks));
    const end = Math.max(start + 1, Math.round((note.start + note.duration) * ticks));
    events.push({ tick: start, data: [0x90, note.midi, note.velocity] });
    events.push({ tick: end, data: [0x80, note.midi, 0] });
  });
  events.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);
  let last = 0;
  const data: number[] = [];
  events.forEach((event) => {
    data.push(...variable(event.tick - last), ...event.data);
    last = event.tick;
  });
  data.push(0, 0xff, 0x2f, 0);
  return chunk("MTrk", data);
}

export function toMidi(arrangement: Arrangement): Blob {
  const tracks = [
    midiTrack([], arrangement.title, arrangement),
    ...VOICES.map((voice) => midiTrack(arrangement.notes.filter((note) => note.voice === voice), voice)),
  ];
  const header = chunk("MThd", [...u16(1), ...u16(tracks.length), ...u16(480)]);
  return new Blob([new Uint8Array([...header, ...tracks.flat()])], { type: "audio/midi" });
}

const escapeXml = (value: string) =>
  value
    .split("&").join("&" + "amp;")
    .split("<").join("&" + "lt;")
    .split(">").join("&" + "gt;")
    .split('"').join("&" + "quot;");

function pitchXml(midi: number): string {
  const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
  const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const pc = ((midi % 12) + 12) % 12;
  const alter = alters[pc];
  return `<pitch><step>${names[pc]}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${Math.floor(midi / 12) - 1}</octave></pitch>`;
}

const DURATION_CATALOG = [
  { units: 16, type: "whole", dots: 0 },
  { units: 12, type: "half", dots: 1 },
  { units: 8, type: "half", dots: 0 },
  { units: 6, type: "quarter", dots: 1 },
  { units: 4, type: "quarter", dots: 0 },
  { units: 3, type: "eighth", dots: 1 },
  { units: 2, type: "eighth", dots: 0 },
  { units: 1, type: "16th", dots: 0 },
];

function splitDuration(units: number): { units: number; type: string; dots: number }[] {
  const pieces: { units: number; type: string; dots: number }[] = [];
  let left = units;
  while (left > 0) {
    const piece = DURATION_CATALOG.find((item) => item.units <= left) ?? DURATION_CATALOG[DURATION_CATALOG.length - 1];
    pieces.push(piece);
    left -= piece.units;
  }
  return pieces;
}

function noteXml(midi: number | null, units: number, divisions: number, tie: "start" | "stop" | "continue" | null): string {
  const pieces = splitDuration(units);
  return pieces
    .map((piece, index) => {
      const tieStart = tie === "start" || tie === "continue" || index < pieces.length - 1;
      const tieStop = tie === "stop" || tie === "continue" || index > 0;
      const notation =
        tieStart || tieStop
          ? `<notations>${tieStart ? "<tied type=\"start\"/>" : ""}${tieStop ? "<tied type=\"stop\"/>" : ""}</notations>`
          : piece.units <= 2
            ? `<notations><articulations><staccato/></articulations></notations>`
            : piece.units >= 6
              ? `<notations><articulations><tenuto/></articulations></notations>`
              : "";
      const body = midi === null ? "<rest/>" : pitchXml(midi);
      return `<note>${body}<duration>${piece.units}</duration><voice>1</voice><type>${piece.type}</type>${piece.dots ? "<dot/>" : ""}${tieStart ? "<tie type=\"start\"/>" : ""}${tieStop ? "<tie type=\"stop\"/>" : ""}${notation}</note>`;
    })
    .join("")
    .split(`divisions-unused-${divisions}`).join("");
}

function measureBody(voice: VoiceName, arrangement: Arrangement, barNumber: number, divisions: number): string {
  const qpb = quartersPerBar(arrangement.meter);
  const capacity = qpb * divisions;
  const barStart = (barNumber - 1) * qpb;
  const raw = arrangement.notes
    .filter((note) => note.voice === voice && note.bar === barNumber)
    .map((note) => ({
      midi: note.midi,
      at: Math.max(0, Math.round((note.start - barStart) * divisions)),
      dur: Math.max(1, Math.round(note.duration * divisions)),
    }))
    .sort((a, b) => a.at - b.at);
  let cursor = 0;
  let xml = "";
  raw.forEach((note) => {
    const at = Math.min(capacity, Math.max(cursor, note.at));
    if (at > cursor) xml += noteXml(null, at - cursor, divisions, null);
    const dur = Math.max(0, Math.min(note.dur, capacity - at));
    if (dur > 0) xml += noteXml(note.midi, dur, divisions, null);
    cursor = at + dur;
  });
  if (cursor < capacity) xml += noteXml(null, capacity - cursor, divisions, null);
  return xml || noteXml(null, capacity, divisions, null);
}

const CLEFS: Record<VoiceName, string> = {
  "Violin I": `<clef><sign>G</sign><line>2</line></clef>`,
  "Violin II": `<clef><sign>G</sign><line>2</line></clef>`,
  "Viola I": `<clef><sign>C</sign><line>3</line></clef>`,
  "Viola II": `<clef><sign>C</sign><line>3</line></clef>`,
  Cello: `<clef><sign>F</sign><line>4</line></clef>`,
  Contrabass: `<clef><sign>F</sign><line>4</line></clef>`,
};

function harmonyXml(symbol: string, offset: number | null): string {
  const rootMatch = symbol.match(/^([A-G])(#|b)?/);
  const rootStep = rootMatch?.[1] ?? "C";
  const alter = rootMatch?.[2] === "#" ? "<root-alter>1</root-alter>" : rootMatch?.[2] === "b" ? "<root-alter>-1</root-alter>" : "";
  const shift = offset && offset > 0 ? `<offset>${offset}</offset>` : "";
  return `${shift}<harmony><root><root-step>${rootStep}</root-step>${alter}</root><kind text="${escapeXml(symbol)}">none</kind></harmony>`;
}

export function toMusicXml(arrangement: Arrangement): Blob {
  const divisions = 4;
  const fifths = keyFifths(arrangement.key, arrangement.mode);
  const [beats, beatType] = arrangement.meter.split("/");
  const parts = VOICES.map(
    (voice, index) =>
      `<score-part id="P${index + 1}"><part-name>${escapeXml(voice)}</part-name><part-abbreviation>${escapeXml(voice)}</part-abbreviation></score-part>`,
  ).join("");
  const bodies = VOICES.map((voice, partIndex) => {
    const measures = arrangement.bars
      .map((bar) => {
        const first = bar.number === 1;
        const attributes = first
          ? `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>${CLEFS[voice]}</attributes>`
          : "";
        const tempo = first && partIndex === 0 ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${arrangement.tempo}</per-minute></metronome></direction-type><sound tempo="${arrangement.tempo}"/></direction>` : "";
        const rehearsal =
          partIndex === 0 && (bar.number === 1 || bar.section !== arrangement.bars[bar.number - 2]?.section)
            ? `<direction placement="above"><direction-type><rehearsal>${bar.section}</rehearsal></direction-type></direction>`
            : "";
        const harmony =
          partIndex === 0
            ? `${harmonyXml(bar.chord, null)}${bar.second ? harmonyXml(bar.second, Math.round((quartersPerBar(arrangement.meter) * divisions) / 2)) : ""}`
            : "";
        const dynamic =
          partIndex === 0 && (bar.number === 1 || bar.section !== arrangement.bars[bar.number - 2]?.section)
            ? `<direction placement="below"><direction-type><dynamics><${bar.section === "B" ? "mf" : bar.section === "A2" || bar.section === "A3" ? "mp" : "p"}/></dynamics></direction-type></direction>`
            : "";
        return `<measure number="${bar.number}">${attributes}${tempo}${rehearsal}${harmony}${dynamic}${measureBody(voice, arrangement, bar.number, divisions)}</measure>`;
      })
      .join("");
    return `<part id="P${partIndex + 1}">${measures}</part>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escapeXml(arrangement.title)}</work-title></work>
  <identification>
    <creator type="composer">Axel Fisch</creator>
    <encoding><software>Circular Strings Orchestrator</software></encoding>
  </identification>
  <credit page="1"><credit-words>Axel Fisch — Circular Strings Orchestrator</credit-words></credit>
  <part-list>${parts}</part-list>
  ${bodies}
</score-partwise>`;
  return new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
}

export function measureUnits(xml: string, divisions = 4): number[] {
  const measures = [...xml.matchAll(/<measure number="1">([\s\S]*?)<\/measure>/g)].map((match) => match[1] ?? "");
  return measures.map((measure) => {
    const durations = [...measure.matchAll(/<duration>(\d+)<\/duration>/g)].map((match) => Number(match[1]));
    return durations.reduce((sum, value) => sum + value, 0);
  }).map((sum) => sum / divisions);
}

export function toChart(arrangement: Arrangement): Blob {
  const lines = [
    arrangement.title,
    "Axel Fisch",
    `${arrangement.style} | ${arrangement.key} ${arrangement.mode} | ${arrangement.meter} | ${arrangement.tempo} BPM | seed ${arrangement.seed}`,
    `Qualité symbolique ${arrangement.report.quality}/100 · parallèles ${arrangement.report.parallels} · respiration ${Math.round(arrangement.report.restRatio * 100)} %`,
    "",
    ...(["A1", "A2", "B", "A3"] as const).flatMap((section) => {
      const bars = arrangement.bars.filter((bar) => bar.section === section);
      if (!bars.length) return [];
      return [`[${section}]`, ...chunkLines(bars.map((bar) => (bar.second ? `${bar.chord} ${bar.second}` : bar.chord))), ""];
    }),
  ];
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}

function chunkLines(chords: string[]): string[] {
  const lines: string[] = [];
  for (let index = 0; index < chords.length; index += 4) {
    lines.push(`| ${chords.slice(index, index + 4).map((chord) => chord.padEnd(28)).join("| ")}|`);
  }
  return lines;
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(arrangement: Arrangement): string {
  return `${arrangement.key}-${arrangement.mode}-${arrangement.style}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function midiNumber(name: string): number {
  return 60 + pitchClass(name);
}
