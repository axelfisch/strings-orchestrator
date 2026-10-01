import { keyFifths, parseChord, quartersPerBar } from "./theory";
import { SCHEMA_VERSION, VOICE_LABELS, VOICES, type Arrangement, type Articulation, type DynamicMark, type NoteEvent, type ProjectDocument, type VoiceName } from "./types";

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

const CHANNELS: Record<VoiceName, number> = {
  "Violin I": 0, "Violin II": 1, "Viola I": 2, "Viola II": 3, Cello: 4, Contrabass: 5,
};
const PROGRAMS: Record<VoiceName, number> = {
  "Violin I": 40, "Violin II": 40, "Viola I": 41, "Viola II": 41, Cello: 42, Contrabass: 43,
};

function timeSignature(meter: Arrangement["meter"]): number[] {
  if (meter === "3/4") return [3, 2, 24, 8];
  if (meter === "6/8") return [6, 3, 24, 8];
  return [4, 2, 24, 8];
}

function keyMeta(fifths: number, minor: boolean): number[] {
  return [fifths < 0 ? 256 + fifths : fifths, minor ? 1 : 0];
}

interface MidiEvent { tick: number; order: number; data: number[] }

function encodeTrack(events: MidiEvent[], totalTicks: number): number[] {
  events.push({ tick: totalTicks, order: 99, data: [0xff, 0x2f, 0] });
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  let last = 0;
  const data: number[] = [];
  events.forEach((event) => {
    data.push(...variable(Math.max(0, event.tick - last)), ...event.data);
    last = event.tick;
  });
  return chunk("MTrk", data);
}

function metaTrack(arrangement: Arrangement, ticks: number, totalTicks: number): number[] {
  const name = bytes(arrangement.title);
  const micros = Math.round(60000000 / arrangement.tempo);
  const events: MidiEvent[] = [
    { tick: 0, order: 0, data: [0xff, 0x03, ...variable(name.length), ...name] },
    { tick: 0, order: 1, data: [0xff, 0x51, 0x03, (micros >> 16) & 255, (micros >> 8) & 255, micros & 255] },
    { tick: 0, order: 2, data: [0xff, 0x58, 0x04, ...timeSignature(arrangement.meter)] },
    { tick: 0, order: 3, data: [0xff, 0x59, 0x02, ...keyMeta(keyFifths(arrangement.key, arrangement.mode), arrangement.mode === "minor")] },
  ];
  arrangement.bars.forEach((bar, index) => {
    if (index === 0 || arrangement.bars[index - 1]?.section !== bar.section) {
      const label = bytes(bar.section);
      events.push({ tick: Math.round(index * quartersPerBar(arrangement.meter) * ticks), order: 4, data: [0xff, 0x06, ...variable(label.length), ...label] });
    }
    bar.harmonies.forEach((harmony) => {
      const label = bytes(harmony.symbol);
      events.push({ tick: Math.round((index * quartersPerBar(arrangement.meter) + harmony.position) * ticks), order: 5, data: [0xff, 0x06, ...variable(label.length), ...label] });
    });
  });
  return encodeTrack(events, totalTicks);
}

function voiceTrack(arrangement: Arrangement, voice: VoiceName, ticks: number, totalTicks: number): number[] {
  const channel = CHANNELS[voice];
  const title = bytes(VOICE_LABELS[voice]);
  const events: MidiEvent[] = [
    { tick: 0, order: 0, data: [0xff, 0x03, ...variable(title.length), ...title] },
    { tick: 0, order: 1, data: [0xc0 | channel, PROGRAMS[voice]] },
  ];
  arrangement.notes.filter((note) => note.voice === voice).forEach((note) => {
    if (note.midi < 0 || note.midi > 127) throw new Error(`Note MIDI invalide ${note.midi} pour ${voice}`);
    const start = Math.max(0, Math.round(note.start * ticks));
    const end = Math.max(start + 1, Math.round((note.start + note.duration) * ticks));
    events.push({ tick: start, order: 3, data: [0x90 | channel, note.midi, Math.max(1, Math.min(127, Math.round(note.velocity)))] });
    events.push({ tick: end, order: 2, data: [0x80 | channel, note.midi, 0] });
  });
  return encodeTrack(events, totalTicks);
}

export function toMidi(arrangement: Arrangement): Blob {
  const ticks = 480;
  const totalTicks = Math.round(arrangement.bars.length * quartersPerBar(arrangement.meter) * ticks);
  const tracks = [metaTrack(arrangement, ticks, totalTicks), ...VOICES.map((voice) => voiceTrack(arrangement, voice, ticks, totalTicks))];
  const header = chunk("MThd", [...u16(1), ...u16(tracks.length), ...u16(ticks)]);
  return new Blob([new Uint8Array([...header, ...tracks.flat()])], { type: "audio/midi" });
}

export const escapeXml = (value: string) => value.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split("\"").join("&quot;").split("'").join("&apos;");

function pitchXml(midi: number, preferFlats: boolean, transposeOctave = 0): string {
  const sharps = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]] as const;
  const flats = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]] as const;
  const written = midi + transposeOctave * 12;
  const [step, alter] = (preferFlats ? flats : sharps)[((written % 12) + 12) % 12];
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${Math.floor(written / 12) - 1}</octave></pitch>`;
}

const DURATION_CATALOG = [
  { units: 96, type: "whole", dots: 2 }, { units: 72, type: "whole", dots: 1 }, { units: 48, type: "whole", dots: 0 },
  { units: 36, type: "half", dots: 1 }, { units: 24, type: "half", dots: 0 }, { units: 18, type: "quarter", dots: 1 },
  { units: 12, type: "quarter", dots: 0 }, { units: 9, type: "eighth", dots: 1 }, { units: 6, type: "eighth", dots: 0 },
  { units: 3, type: "16th", dots: 0 }, { units: 1, type: "32nd", dots: 0 },
];

function splitDuration(units: number): { units: number; type: string; dots: number }[] {
  const pieces: { units: number; type: string; dots: number }[] = [];
  let left = Math.max(1, units);
  while (left > 0) {
    const piece = DURATION_CATALOG.find((item) => item.units <= left) ?? DURATION_CATALOG[DURATION_CATALOG.length - 1];
    pieces.push(piece);
    left -= piece.units;
  }
  return pieces;
}

function articulationXml(articulation?: Articulation): string {
  if (!articulation || articulation === "none" || articulation === "legato") return "";
  return `<articulations><${articulation}/></articulations>`;
}

function noteXml(options: { midi: number | null; units: number; voice: number; tieStart: boolean; tieStop: boolean; articulation?: Articulation; preferFlats: boolean; transposeOctave: number }): string {
  const pieces = splitDuration(options.units);
  return pieces.map((piece, index) => {
    const tieStart = options.tieStart || index < pieces.length - 1;
    const tieStop = options.tieStop || index > 0;
    const ties = `${tieStart ? `<tie type="start"/>` : ""}${tieStop ? `<tie type="stop"/>` : ""}`;
    const notationBits = `${tieStart ? `<tied type="start"/>` : ""}${tieStop ? `<tied type="stop"/>` : ""}${articulationXml(options.articulation)}`;
    const notations = notationBits ? `<notations>${notationBits}</notations>` : "";
    const body = options.midi === null ? "<rest/>" : pitchXml(options.midi, options.preferFlats, options.transposeOctave);
    return `<note>${body}<duration>${piece.units}</duration><voice>${options.voice}</voice><type>${piece.type}</type>${piece.dots ? "<dot/>".repeat(piece.dots) : ""}${ties}${notations}</note>`;
  }).join("");
}

interface Fragment { midi: number; at: number; dur: number; tieStart: boolean; tieStop: boolean; articulation?: Articulation }

function fragments(voice: VoiceName, arrangement: Arrangement, barNumber: number, divisions: number): Fragment[] {
  const qpb = quartersPerBar(arrangement.meter);
  const start = (barNumber - 1) * qpb;
  const end = start + qpb;
  return arrangement.notes.filter((note) => note.voice === voice && note.start < end && note.start + note.duration > start).map((note) => ({
    midi: note.midi,
    at: Math.round((Math.max(start, note.start) - start) * divisions),
    dur: Math.max(1, Math.round((Math.min(end, note.start + note.duration) - Math.max(start, note.start)) * divisions)),
    tieStop: note.start < start,
    tieStart: note.start + note.duration > end,
    articulation: note.articulation,
  })).sort((a, b) => a.at - b.at || a.midi - b.midi);
}

function allocateLanes(items: Fragment[]): Fragment[][] {
  const lanes: Fragment[][] = [];
  items.forEach((item) => {
    const lane = lanes.find((row) => (row[row.length - 1]?.at ?? 0) + (row[row.length - 1]?.dur ?? 0) <= item.at);
    if (lane) lane.push(item);
    else lanes.push([item]);
  });
  return lanes.length ? lanes : [[]];
}

function measureBody(voice: VoiceName, arrangement: Arrangement, barNumber: number, divisions: number): string {
  const capacity = quartersPerBar(arrangement.meter) * divisions;
  const preferFlats = keyFifths(arrangement.key, arrangement.mode) < 0;
  const transposeOctave = voice === "Contrabass" ? 1 : 0;
  const lanes = allocateLanes(fragments(voice, arrangement, barNumber, divisions));
  return lanes.map((lane, laneIndex) => {
    let cursor = 0;
    let xml = laneIndex ? `<backup><duration>${capacity}</duration></backup>` : "";
    lane.forEach((item) => {
      if (item.at > cursor) xml += noteXml({ midi: null, units: item.at - cursor, voice: laneIndex + 1, tieStart: false, tieStop: false, preferFlats, transposeOctave });
      xml += noteXml({ midi: item.midi, units: item.dur, voice: laneIndex + 1, tieStart: item.tieStart, tieStop: item.tieStop, articulation: item.articulation, preferFlats, transposeOctave });
      cursor = item.at + item.dur;
    });
    if (cursor < capacity) xml += noteXml({ midi: null, units: capacity - cursor, voice: laneIndex + 1, tieStart: false, tieStop: false, preferFlats, transposeOctave });
    return xml;
  }).join("");
}

const CLEFS: Record<VoiceName, string> = {
  "Violin I": `<clef><sign>G</sign><line>2</line></clef>`, "Violin II": `<clef><sign>G</sign><line>2</line></clef>`,
  "Viola I": `<clef><sign>C</sign><line>3</line></clef>`, "Viola II": `<clef><sign>C</sign><line>3</line></clef>`,
  Cello: `<clef><sign>F</sign><line>4</line></clef>`, Contrabass: `<clef><sign>F</sign><line>4</line></clef>`,
};

function kindFor(quality: string): string {
  if (quality === "maj") return "major";
  if (quality === "min") return "minor";
  if (quality === "maj7") return "major-seventh";
  if (quality === "min7") return "minor-seventh";
  if (quality === "maj9" || quality.startsWith("maj9")) return "major-ninth";
  if (quality === "min9" || quality.startsWith("min9")) return "minor-ninth";
  if (quality === "min7(b5)") return "half-diminished";
  if (quality === "9") return "dominant-ninth";
  if (quality === "11") return "dominant-11th";
  if (quality === "13" || quality.startsWith("13")) return "dominant-13th";
  if (quality === "dim" || quality === "dim7") return "diminished";
  if (quality === "sus2") return "suspended-second";
  if (quality.includes("sus")) return "suspended-fourth";
  if (quality.startsWith("7")) return "dominant";
  return quality.startsWith("min") ? "minor" : "major";
}

function stepAlter(name: string, prefix: string): string {
  const match = name.match(/^([A-G])(#|b)?$/);
  const step = match?.[1] ?? "C";
  const alter = match?.[2] === "#" ? 1 : match?.[2] === "b" ? -1 : 0;
  return `<${prefix}-step>${step}</${prefix}-step>${alter ? `<${prefix}-alter>${alter}</${prefix}-alter>` : ""}`;
}

function harmonyXml(symbol: string, offset: number): string {
  const parsed = parseChord(symbol);
  const bass = parsed.bassName ? `<bass>${stepAlter(parsed.bassName, "bass")}</bass>` : "";
  return `<harmony><root>${stepAlter(parsed.rootName, "root")}</root><kind text="${escapeXml(parsed.symbol)}">${kindFor(parsed.quality)}</kind>${bass}${offset > 0 ? `<offset>${offset}</offset>` : ""}</harmony>`;
}

function dynamicDirection(dynamic: DynamicMark): string {
  return `<direction placement="below"><direction-type><dynamics><${dynamic}/></dynamics></direction-type></direction>`;
}

export function toMusicXml(arrangement: Arrangement): Blob {
  const divisions = 24;
  const fifths = keyFifths(arrangement.key, arrangement.mode);
  const [beats, beatType] = arrangement.meter.split("/");
  const parts = VOICES.map((voice, index) => `<score-part id="P${index + 1}"><part-name>${escapeXml(VOICE_LABELS[voice])}</part-name><part-abbreviation>${escapeXml(voice)}</part-abbreviation><score-instrument id="P${index + 1}-I1"><instrument-name>${escapeXml(VOICE_LABELS[voice])}</instrument-name></score-instrument><midi-instrument id="P${index + 1}-I1"><midi-channel>${CHANNELS[voice] + 1}</midi-channel><midi-program>${PROGRAMS[voice] + 1}</midi-program></midi-instrument></score-part>`).join("");
  const bodies = VOICES.map((voice, partIndex) => {
    const measures = arrangement.bars.map((bar) => {
      const first = bar.number === 1;
      const transpose = voice === "Contrabass" ? `<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>` : "";
      const attributes = first ? `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths><mode>${arrangement.mode}</mode></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>${transpose}${CLEFS[voice]}</attributes>` : "";
      const tempo = first && partIndex === 0 ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${arrangement.tempo}</per-minute></metronome></direction-type><sound tempo="${arrangement.tempo}"/></direction>` : "";
      const sectionChange = first || bar.section !== arrangement.bars[bar.number - 2]?.section;
      const rehearsal = partIndex === 0 && sectionChange ? `<direction placement="above"><direction-type><rehearsal>${bar.section}</rehearsal></direction-type></direction>` : "";
      const harmony = partIndex === 0 ? bar.harmonies.map((event) => harmonyXml(event.symbol, Math.round(event.position * divisions))).join("") : "";
      const dynamic = sectionChange ? dynamicDirection(bar.dynamic) : "";
      return `<measure number="${bar.number}">${attributes}${tempo}${rehearsal}${harmony}${dynamic}${measureBody(voice, arrangement, bar.number, divisions)}</measure>`;
    }).join("");
    return `<part id="P${partIndex + 1}">${measures}</part>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escapeXml(arrangement.title)}</work-title></work>
  <movement-title>${escapeXml(arrangement.title)}</movement-title>
  <identification><creator type="composer">Axel Fisch</creator><encoding><software>Circular Strings Orchestrator</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>
  <credit page="1"><credit-words>Axel Fisch — Circular Strings Orchestrator</credit-words></credit>
  <part-list>${parts}</part-list>${bodies}
</score-partwise>`;
  return new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
}

export function measureUnits(xml: string, divisions = 24): number[] {
  const parts = [...xml.matchAll(/<part\s+id="[^"]+"[^>]*>([\s\S]*?)<\/part>/g)];
  return parts.flatMap((part) => [...((part[1] ?? "").matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g))].map((measure) => {
    const body = measure[1] ?? "";
    const lane = body.split(/<backup>/)[0];
    return [...lane.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, match) => sum + Number(match[1]), 0) / divisions;
  }));
}

function abcPitch(midi: number): string {
  const names = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  const pc = names[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  if (octave >= 5) return `${pc.toLowerCase()}${"'".repeat(octave - 5)}`;
  if (octave < 4) return `${pc}${",".repeat(4 - octave)}`;
  return pc;
}

function abcLength(eighths: number): string {
  const value = Math.max(1, Math.round(eighths));
  return value === 1 ? "" : String(value);
}

function abcVoice(arrangement: Arrangement, voice: VoiceName): string {
  const qpb = quartersPerBar(arrangement.meter);
  return arrangement.bars.map((bar) => {
    const start = (bar.number - 1) * qpb;
    const end = start + qpb;
    const notes = arrangement.notes.filter((note) => note.voice === voice && note.start >= start && note.start < end).sort((a, b) => a.start - b.start);
    let cursor = start;
    const tokens: string[] = [];
    notes.forEach((note) => {
      if (note.start > cursor + 0.05) tokens.push(`z${abcLength((note.start - cursor) * 2)}`);
      tokens.push(`${abcPitch(note.midi)}${abcLength(Math.min(note.duration, end - note.start) * 2)}`);
      cursor = Math.max(cursor, note.start + note.duration);
    });
    if (cursor < end - 0.05) tokens.push(`z${abcLength((end - cursor) * 2)}`);
    return tokens.join(" ") || `z${abcLength(qpb * 2)}`;
  }).join(" | ");
}

export function toAbc(arrangement: Arrangement): Blob {
  const meter = arrangement.meter;
  const key = `${arrangement.key}${arrangement.mode === "minor" ? "m" : ""}`;
  const voices = VOICES.map((voice, index) => `V:V${index + 1} name="${VOICE_LABELS[voice]}" clef=${index < 2 ? "treble" : index < 4 ? "alto" : "bass"}`).join("\n");
  const bodies = VOICES.map((voice, index) => `[V:V${index + 1}] ${abcVoice(arrangement, voice)} |]`).join("\n");
  const abc = `X:1\nT:${arrangement.title}\nC:Axel Fisch\nM:${meter}\nL:1/8\nQ:1/4=${arrangement.tempo}\nK:${key}\n%%score (${VOICES.map((_, index) => `V${index + 1}`).join(" ")})\n${voices}\n${bodies}\n`;
  return new Blob([abc], { type: "text/vnd.abc;charset=utf-8" });
}

function chunkLines(chords: string[]): string[] {
  const lines: string[] = [];
  for (let index = 0; index < chords.length; index += 4) lines.push(`| ${chords.slice(index, index + 4).map((chord) => chord.padEnd(30)).join("| ")}|`);
  return lines;
}

export function toChart(arrangement: Arrangement): Blob {
  const lines = [
    arrangement.title, "Axel Fisch",
    `${arrangement.style} | ${arrangement.key} ${arrangement.mode} | ${arrangement.meter} | ${arrangement.tempo} BPM | graine ${arrangement.seed}`,
    `Langage ${arrangement.report.language} | gamme ${arrangement.report.scale} | contrôle technique ${arrangement.report.quality}/100`, "",
    ...(["A1", "A2", "B", "A3"] as const).flatMap((section) => {
      const bars = arrangement.bars.filter((bar) => bar.section === section);
      return bars.length ? [`[${section}] — mélodie ${arrangement.report.melodyBySection[section]}`, ...chunkLines(bars.map((bar) => bar.harmonies.map((event) => event.symbol).join(" → "))), ""] : [];
    }),
  ];
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}

const escapeHtml = (value: string) => escapeXml(value);

export function toHtmlReport(arrangement: Arrangement): Blob {
  const grid = arrangement.bars.map((bar) => `<tr><td>${bar.number}</td><td>${bar.section}</td><td>${bar.harmonies.map((event) => escapeHtml(event.symbol)).join(" → ")}</td><td>${escapeHtml(bar.texture)}</td><td>${VOICE_LABELS[arrangement.report.melodyBySection[bar.section]]}</td></tr>`).join("");
  const voices = VOICES.map((voice) => {
    const stats = arrangement.report.voices[voice];
    return `<tr><td>${VOICE_LABELS[voice]}</td><td>${stats.noteCount}</td><td>${stats.min}</td><td>${stats.median}</td><td>${stats.max}</td><td>${Math.round(stats.centralRatio * 100)} %</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(arrangement.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;color:#181512}h1,h2{font-family:Georgia,serif}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #bbb;padding:7px;text-align:left}small{color:#555}@media print{body{margin:12mm}button{display:none}tr{break-inside:avoid}}</style></head><body><button onclick="window.print()">Imprimer / enregistrer en PDF</button><h1>${escapeHtml(arrangement.title)}</h1><p>Axel Fisch · ${escapeHtml(arrangement.style)} · ${escapeHtml(arrangement.key)} ${arrangement.mode} · ${arrangement.meter} · ${arrangement.tempo} BPM</p><p>Langage : ${arrangement.report.language} · Gamme : ${arrangement.report.scale} · Graine : ${arrangement.seed}</p><h2>Grille et orchestration</h2><table><thead><tr><th>Mesure</th><th>Section</th><th>Harmonie</th><th>Texture</th><th>Porteur mélodique</th></tr></thead><tbody>${grid}</tbody></table><h2>Contrôle des registres</h2><table><thead><tr><th>Voix</th><th>Notes</th><th>Min</th><th>Médiane</th><th>Max</th><th>Zone centrale</th></tr></thead><tbody>${voices}</tbody></table><h2>Rapport</h2><ul>${arrangement.report.influences.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p><small>Contrôle technique ${arrangement.report.quality}/100 · croisements ${arrangement.report.crossings} · parallèles détectées ${arrangement.report.parallels} · espacement médian ${arrangement.report.medianSpacing} demi-tons · mesures/voix en respiration ${Math.round(arrangement.report.restRatio * 100)} %. Ce score ne prétend pas mesurer la beauté musicale.</small></p></body></html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

export function toProjectJson(project: ProjectDocument): Blob {
  return new Blob([JSON.stringify({ ...project, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json;charset=utf-8" });
}

export function normalizedEvents(arrangement: Arrangement): Pick<NoteEvent, "voice" | "midi" | "start" | "duration" | "velocity">[] {
  return arrangement.notes.map(({ voice, midi, start, duration, velocity }) => ({ voice, midi, start, duration, velocity })).sort((a, b) => a.start - b.start || VOICES.indexOf(a.voice) - VOICES.indexOf(b.voice) || a.midi - b.midi);
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHtml(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const target = window.open(url, "_blank", "noopener,noreferrer");
  if (!target) download(blob, "circular-strings-report.html");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function slug(arrangement: Arrangement): string {
  return `${arrangement.title}-${arrangement.key}-${arrangement.mode}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
