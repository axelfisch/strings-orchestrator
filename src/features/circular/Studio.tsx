import { useEffect, useMemo, useRef, useState } from "react";
import { Circle } from "./Circle";
import { arrange, defaultMeter, defaultTempo, generateGrid } from "./arrange";
import {
  deleteCorpus,
  exportProfile,
  ingestBuffer,
  listCorpus,
  profileFrom,
  VALIDATION_LOT,
  type CorpusFile,
} from "./corpus";
import { download, slug, toChart, toMidi, toMusicXml } from "./exporters";
import { createPlayer, type PlayerHandle } from "./playback";
import { quartersPerBar, symbolFor } from "./theory";
import {
  FAMILIES,
  GENRES,
  INVERSIONS,
  LIVE_THINKING_SCALES,
  METERS,
  ROOTS,
  STYLES,
  VOICES,
  type FamilyId,
  type Meter,
  type NoteEvent,
  type ProjectBar,
  type StyleName,
  type StyleProfile,
  type VoiceName,
} from "./types";
import "./circular.css";

const VOICE_COLOR: Record<VoiceName, string> = {
  "Violin I": "#e8a45a",
  "Violin II": "#ece5d8",
  "Viola I": "#7fa7c9",
  "Viola II": "#8fae9a",
  Cello: "#c4a484",
  Contrabass: "#8a8d93",
};

const STORAGE = "cso-project-v1";

interface Persisted {
  name: string;
  length: 8 | 16 | 32;
  keyName: string;
  mode: "major" | "minor";
  style: StyleName;
  genre: string;
  meter: Meter;
  tempo: number;
  seed: number;
  influence: number;
  bars: ProjectBar[];
  active: number;
  family: FamilyId;
  root: string;
  bass: string | null;
  foreign: boolean;
  variantB: ProjectBar[] | null;
}

function loadPersisted(): Partial<Persisted> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

export function Studio() {
  const saved = useRef(loadPersisted()).current;
  const initialLength = saved?.length ?? 32;
  const initialKey = saved?.keyName ?? "F";
  const initialMode = saved?.mode ?? "minor";
  const initialSeed = saved?.seed ?? 2026;
  const [name, setName] = useState(saved?.name ?? "Sextuor sans titre");
  const [length, setLength] = useState<8 | 16 | 32>(initialLength);
  const [keyName, setKeyName] = useState(initialKey);
  const [mode, setMode] = useState<"major" | "minor">(initialMode);
  const [style, setStyle] = useState<StyleName>(saved?.style ?? "ECM Ballad");
  const [genre, setGenre] = useState(saved?.genre ?? "Cinematic Strings");
  const [meter, setMeter] = useState<Meter>(saved?.meter ?? "4/4");
  const [tempo, setTempo] = useState(saved?.tempo ?? 72);
  const [seed, setSeed] = useState(initialSeed);
  const [influence, setInfluence] = useState(saved?.influence ?? 0);
  const [bars, setBars] = useState<ProjectBar[]>(
    saved?.bars?.length ? saved.bars : generateGrid({ key: initialKey, mode: initialMode, length: initialLength, seed: initialSeed }),
  );
  const [active, setActive] = useState(saved?.active ?? 0);
  const [family, setFamily] = useState<FamilyId>(saved?.family ?? "min9");
  const [root, setRoot] = useState(saved?.root ?? "F");
  const [bass, setBass] = useState<string | null>(saved?.bass ?? null);
  const [foreign, setForeign] = useState(saved?.foreign ?? true);
  const [loop, setLoop] = useState(false);
  const [transport, setTransport] = useState<"stopped" | "playing" | "paused">("stopped");
  const [beat, setBeat] = useState(0);
  const [corpus, setCorpus] = useState<CorpusFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [lockedVoices, setLockedVoices] = useState<VoiceName[]>([]);
  const [voiceHolds, setVoiceHolds] = useState<Partial<Record<VoiceName, NoteEvent[]>>>({});
  const [barHolds, setBarHolds] = useState<Record<number, NoteEvent[]>>({});
  const [importedProfile, setImportedProfile] = useState<StyleProfile | null>(null);
  const [profileNote, setProfileNote] = useState("");
  const [variantB, setVariantB] = useState<ProjectBar[] | null>(saved?.variantB ?? null);
  const [showingB, setShowingB] = useState(false);
  const history = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const player = useRef<PlayerHandle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const profile = useMemo(() => importedProfile ?? profileFrom(corpus), [corpus, importedProfile]);
  const arrangement = useMemo(
    () =>
      arrange({
        bars,
        key: keyName,
        mode,
        style,
        meter,
        tempo,
        seed,
        influence,
        profile,
        title: name,
        holds: { voices: voiceHolds, bars: barHolds },
      }),
    [bars, keyName, mode, style, meter, tempo, seed, influence, profile, name, voiceHolds, barHolds],
  );

  const symbol = symbolFor(root, family, bass);
  const totalBeats = Math.max(1, arrangement.bars.length * quartersPerBar(meter));
  const activeBar = Math.min(arrangement.bars.length - 1, Math.max(0, Math.floor(beat / quartersPerBar(meter))));

  useEffect(() => {
    const payload: Persisted = { name, length, keyName, mode, style, genre, meter, tempo, seed, influence, bars, active, family, root, bass, foreign, variantB };
    localStorage.setItem(STORAGE, JSON.stringify(payload));
  }, [name, length, keyName, mode, style, genre, meter, tempo, seed, influence, bars, active, family, root, bass, foreign, variantB]);

  useEffect(() => {
    listCorpus().then(setCorpus).catch(() => setCorpus([]));
    let frame = 0;
    let mounted = true;
    createPlayer(() => {
      if (mounted) {
        setTransport("stopped");
        setBeat(0);
      }
    }).then((handle) => {
      if (!mounted) {
        handle.dispose();
        return;
      }
      player.current = handle;
    });
    const tick = () => {
      const position = player.current?.position();
      if (position?.playing || position?.paused) setBeat(position.beat);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      player.current?.dispose();
    };
  }, []);

  const snapshot = () => JSON.stringify(bars);
  const remember = () => {
    history.current.push(snapshot());
    if (history.current.length > 40) history.current.shift();
    future.current = [];
  };

  const toggleSplit = () => {
    remember();
    setBars((current) =>
      current.map((bar, index) => {
        if (index !== active || bar.locked) return bar;
        return bar.second ? { ...bar, second: null } : { ...bar, second: symbol, origin: "manual" };
      }),
    );
  };

  const lockSection = () => {
    const section = arrangement.bars[active]?.section;
    if (!section) return;
    remember();
    const indexes = arrangement.bars.flatMap((bar, index) => (bar.section === section ? [index] : []));
    const locking = indexes.some((index) => !bars[index]?.locked);
    setBars((current) => current.map((bar, index) => (indexes.includes(index) ? { ...bar, locked: locking } : bar)));
    setBarHolds((current) => {
      const copy = { ...current };
      indexes.forEach((index) => {
        const number = index + 1;
        if (locking) copy[number] = arrangement.notes.filter((note) => note.bar === number);
        else delete copy[number];
      });
      return copy;
    });
  };

  const freshProject = () => {
    remember();
    setName("Sextuor sans titre");
    setBars(generateGrid({ key: keyName, mode, length, seed }));
    setVariantB(null);
    setVoiceHolds({});
    setLockedVoices([]);
    setBarHolds({});
    setBeat(0);
  };

  const importProfileFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as StyleProfile;
      if (data?.version !== 1 || typeof data.noteCount !== "number") {
        setProfileNote("Profil refusé : JSON version 1 attendu.");
        return;
      }
      setImportedProfile(data);
      setProfileNote(`Profil importé : ${data.sourceFiles} fichier(s), ${data.noteCount} notes.`);
    } catch {
      setProfileNote("Profil illisible.");
    }
  };

  const placeChord = () => {
    remember();
    setBars((current) =>
      current.map((bar, index) => (index === active && !bar.locked ? { ...bar, chord: symbol, origin: "manual" } : bar)),
    );
    setBarHolds((current) => {
      const copy = { ...current };
      delete copy[active + 1];
      return copy;
    });
    setActive((index) => (index + 1) % bars.length);
  };

  const generate = () => {
    remember();
    const next = generateGrid({ key: keyName, mode, length, seed });
    setBars((current) => next.map((bar, index) => (current[index]?.locked ? current[index] : bar)));
    setVoiceHolds({});
    setLockedVoices([]);
  };

  const resize = (next: 8 | 16 | 32) => {
    remember();
    setLength(next);
    setBars((current) => {
      if (current.length === next) return current;
      if (current.length > next) return current.slice(0, next);
      const extra = generateGrid({ key: keyName, mode, length: next, seed }).slice(current.length);
      return [...current, ...extra];
    });
  };

  const toggleVoice = (voice: VoiceName) => {
    setLockedVoices((current) => {
      if (current.includes(voice)) {
        setVoiceHolds((holds) => {
          const copy = { ...holds };
          delete copy[voice];
          return copy;
        });
        return current.filter((item) => item !== voice);
      }
      setVoiceHolds((holds) => ({ ...holds, [voice]: arrangement.notes.filter((note) => note.voice === voice) }));
      return [...current, voice];
    });
  };

  const play = async () => {
    const handle = player.current;
    if (!handle) return;
    if (transport === "playing") {
      handle.pause();
      setTransport("paused");
      return;
    }
    if (transport === "paused") {
      await handle.resume();
      setTransport("playing");
      return;
    }
    handle.setLoop(loop);
    handle.setTempo(tempo);
    await handle.play(arrangement, 0);
    setTransport("playing");
  };

  const stop = () => {
    player.current?.stop();
    setTransport("stopped");
    setBeat(0);
  };

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(snapshot());
    setBars(JSON.parse(previous) as ProjectBar[]);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(snapshot());
    setBars(JSON.parse(next) as ProjectBar[]);
  };

  const onFiles = async (list: FileList | File[]) => {
    const known = await listCorpus();
    const notes: string[] = [];
    for (const file of Array.from(list)) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".mid") && !lower.endsWith(".midi") && !lower.endsWith(".xml") && !lower.endsWith(".musicxml") && !lower.endsWith(".mscz")) {
        notes.push(`${file.name} : format non lu`);
        continue;
      }
      const result = await ingestBuffer(file.name, await file.arrayBuffer(), known);
      if (result.duplicate) notes.push(`${file.name} : doublon`);
      else if (!result.file.valid) notes.push(`${file.name} : ${result.file.reason ?? "rejeté"}`);
      else known.push(result.file);
    }
    setRejected(notes);
    setCorpus(await listCorpus());
  };

  const loadLot = async () => {
    const known = await listCorpus();
    const notes: string[] = [];
    for (const filename of VALIDATION_LOT) {
      const served = filename.startsWith("Stay with us") ? "Stay-with-us-my-friend.mid" : filename;
      const response = await fetch(`/corpus/${encodeURIComponent(served)}`);
      if (!response.ok) {
        notes.push(`${filename} : introuvable`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      const result = await ingestBuffer(filename, buffer, known);
      if (result.duplicate) notes.push(`${filename} : déjà dans le corpus`);
      else if (!result.file.valid) notes.push(`${filename} : ${result.file.reason}`);
      else known.push(result.file);
    }
    setRejected(notes);
    setCorpus(await listCorpus());
  };

  const importAsStart = async (file: File) => {
    const { musicXmlToParsed, parseMidi } = await import("./midi");
    const buffer = await file.arrayBuffer();
    const lower = file.name.toLowerCase();
    const parsed = lower.endsWith(".xml") || lower.endsWith(".musicxml") ? musicXmlToParsed(new TextDecoder().decode(buffer)) : parseMidi(buffer);
    const track = parsed.tracks.filter((item) => item.notes.length).sort((a, b) => b.notes.length - a.notes.length)[0];
    if (!track) return;
    const qpb = quartersPerBar(meter);
    const next = bars.map((bar, index) => {
      if (bar.locked) return bar;
      const start = index * qpb;
      const notes = track.notes.filter((note) => note.startBeat >= start && note.startBeat < start + qpb);
      const low = notes.sort((a, b) => a.midi - b.midi)[0];
      if (!low) return { ...bar, origin: "imported" as const };
      const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
      return { ...bar, chord: `${names[low.midi % 12] ?? "C"}add9`, origin: "imported" as const };
    });
    remember();
    setBars(next);
  };

  const audition = async () => {
    const stub = arrange({
      bars: [{ chord: symbol, locked: false, origin: "manual" }],
      key: keyName,
      mode,
      style,
      meter: "4/4",
      tempo: 72,
      seed: 11,
      influence: 0,
      title: symbol,
    });
    await player.current?.play(stub);
    setTransport("playing");
  };

  return (
    <div className="cso">
      <header className="cso-header">
        <div>
          <p className="cso-kicker">AiXel · sextuor de chambre</p>
          <h1>Circular Strings Orchestrator</h1>
          <p className="cso-sub">Un seul projet : le cercle écrit la grille, six voix l’orchestrent, et l’écoute est exactement l’export.</p>
        </div>
        <label>
          Projet
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </header>

      <div className="cso-toolbar">
        <label>Forme
          <select value={length} onChange={(event) => resize(Number(event.target.value) as 8 | 16 | 32)}>
            <option value={8}>8 mesures</option>
            <option value={16}>16 mesures</option>
            <option value={32}>32 mesures</option>
          </select>
        </label>
        <label>Style
          <select value={style} onChange={(event) => {
            const next = event.target.value as StyleName;
            setStyle(next);
            setMeter(defaultMeter(next));
            setTempo(defaultTempo(next));
          }}>
            {STYLES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Genre du cercle
          <select value={genre} onChange={(event) => setGenre(event.target.value)}>
            {GENRES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Tonalité
          <select value={keyName} onChange={(event) => setKeyName(event.target.value)}>
            {ROOTS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as "major" | "minor")}>
            <option value="minor">Mineur</option>
            <option value="major">Majeur</option>
          </select>
        </label>
        <label>Métrique
          <select value={meter} onChange={(event) => setMeter(event.target.value as Meter)}>
            {METERS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Tempo
          <input type="number" min={40} max={200} value={tempo} onChange={(event) => {
            const next = Number(event.target.value) || 72;
            setTempo(next);
            player.current?.setTempo(next);
          }} />
        </label>
        <label>Graine
          <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} />
        </label>
        <button className="cso-btn primary" onClick={generate}>Générer la grille</button>
        <button className="cso-btn" onClick={freshProject}>Nouveau projet</button>
        <button className="cso-btn" onClick={() => setSeed(Math.floor(Math.random() * 999999))}>Nouvelle prise</button>
        <button className="cso-btn" onClick={undo}>Annuler</button>
        <button className="cso-btn" onClick={redo}>Rétablir</button>
      </div>

      <main className="cso-main">
        <section className="cso-panel">
          <h2>Cercle</h2>
          <Circle root={root} family={family} onRoot={setRoot} onFamily={setFamily} />
          <div className="cso-center-read">
            <p className="cso-symbol serif">{symbol}</p>
            <p className="cso-note">{transport !== "stopped" ? `En lecture · ${arrangement.bars[activeBar]?.chord ?? ""}${arrangement.bars[activeBar]?.second ? ` puis ${arrangement.bars[activeBar]?.second}` : ""}` : "Le cercle prépare l’accord. La timeline le joue."}</p>
          </div>
          <div className="cso-qualities" aria-label="Qualités harmoniques">
            {FAMILIES.filter((item) => item.group === FAMILIES.find((entry) => entry.id === family)?.group).map((item) => (
              <button key={item.id} className={`cso-chip ${item.id === family ? "active" : ""}`} onClick={() => setFamily(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="cso-row" style={{ marginTop: 10 }}>
            <button className={`cso-chip ${foreign ? "active" : ""}`} onClick={() => setForeign(true)}>Basse étrangère</button>
            <button className={`cso-chip ${!foreign ? "active" : ""}`} onClick={() => setForeign(false)}>Renversement</button>
            <button className="cso-chip" onClick={() => setBass(null)}>Sans slash</button>
          </div>
          <div className="cso-bass">
            {(foreign ? ROOTS : INVERSIONS.map((item) => item.label)).map((label) => {
              const value = foreign
                ? label
                : ROOTS[(ROOTS.indexOf(root as (typeof ROOTS)[number]) + (INVERSIONS.find((item) => item.label === label)?.semi ?? 0)) % 12];
              const shown = foreign ? label : `${label} → ${value}`;
              return (
                <button key={label} className={`cso-chip ${bass === value ? "active" : ""}`} onClick={() => setBass(value)}>{shown}</button>
              );
            })}
          </div>
          <div className="cso-row" style={{ marginTop: 10 }}>
            <button className="cso-btn primary" onClick={placeChord}>Placer sur la mesure {active + 1}</button>
            <button className="cso-btn" onClick={toggleSplit}>{bars[active]?.second ? "Une seule harmonie" : "Deux harmonies"}</button>
            <button className="cso-btn" onClick={audition}>Écouter l’accord</button>
          </div>
          <p className="cso-note">20 qualités viennent du dictionnaire du dépôt. Quatre familles manquantes pour arriver à 24 ne sont pas inventées. Gammes Live Thinking documentées : {LIVE_THINKING_SCALES.map((scale) => scale.label).join(", ")}. La sixième n’est pas inventée.</p>
        </section>

        <section className="cso-panel">
          <div className="cso-row" style={{ justifyContent: "space-between" }}>
            <h2>Timeline</h2>
            <div className="cso-exports">
              <button className="cso-btn" onClick={() => download(toMidi(arrangement), `${slug(arrangement)}.mid`)}>MIDI</button>
              <button className="cso-btn" onClick={() => download(toMusicXml(arrangement), `${slug(arrangement)}.musicxml`)}>MusicXML</button>
              <button className="cso-btn" onClick={() => download(toChart(arrangement), `${slug(arrangement)}-chart.txt`)}>Grille</button>
              <button className="cso-btn" onClick={() => { setVariantB(bars.map((bar) => ({ ...bar }))); }}>Garder B</button>
              <button className="cso-btn" disabled={!variantB} onClick={() => {
                if (!variantB) return;
                const current = bars;
                setBars(variantB);
                setVariantB(current);
                setShowingB((value) => !value);
              }}>{showingB ? "Entendre A" : "Comparer B"}</button>
            </div>
          </div>
          <p className="cso-note">{meter} · {tempo} BPM · graine {seed} · qualité symbolique {arrangement.report.quality}/100 · parallèles relevées {arrangement.report.parallels}</p>
          <div className="cso-map">
            {arrangement.bars.map((bar, index) => (
              <button key={bar.number} className={`cso-bar ${index === active ? "on" : ""} ${transport !== "stopped" && index === activeBar ? "live" : ""}`} onClick={() => setActive(index)}>
                <small>{bar.section} · {bar.number}{bars[index]?.locked ? " · lock" : ""} · {bar.origin}</small>
                <strong>{bar.second ? `${bar.chord} · ${bar.second}` : bar.chord}</strong>
                <em>{bar.texture}</em>
              </button>
            ))}
          </div>
          <div className="cso-row" style={{ margin: "10px 0" }}>
            <button className="cso-btn" onClick={() => {
              remember();
              const number = active + 1;
              setBars((current) => current.map((bar, index) => (index === active ? { ...bar, locked: !bar.locked } : bar)));
              setBarHolds((current) => {
                if (bars[active]?.locked) {
                  const copy = { ...current };
                  delete copy[number];
                  return copy;
                }
                return { ...current, [number]: arrangement.notes.filter((note) => note.bar === number) };
              });
            }}>{bars[active]?.locked ? "Déverrouiller la mesure" : "Verrouiller la mesure"}</button>
            <button className="cso-btn" onClick={lockSection}>Verrouiller la section</button>
            <label className="cso-field">Importer un MIDI de départ
              <input type="file" accept=".mid,.midi,.xml,.musicxml,audio/midi" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importAsStart(file);
              }} />
            </label>
          </div>
          <div className="cso-roll" aria-label="Piano-roll des six voix">
            <div className="cso-playhead" style={{ left: `${(beat / totalBeats) * 100}%` }} />
            {arrangement.notes.map((note, index) => (
              <div
                key={`${note.voice}-${index}`}
                className="cso-note-pip"
                title={`${note.voice} ${note.midi}`}
                style={{
                  left: `${(note.start / totalBeats) * 100}%`,
                  width: `${Math.max((note.duration / totalBeats) * 100, 0.25)}%`,
                  bottom: `${((note.midi - 28) / 66) * 100}%`,
                  background: VOICE_COLOR[note.voice],
                }}
              />
            ))}
          </div>
          <div className="cso-legend">
            {VOICES.map((voice) => (
              <button key={voice} className={`cso-chip ${lockedVoices.includes(voice) ? "active" : ""}`} onClick={() => toggleVoice(voice)}>
                <i className="cso-swatch" style={{ background: VOICE_COLOR[voice] }} />
                {voice}{lockedVoices.includes(voice) ? " verrouillé" : ""}
              </button>
            ))}
          </div>
          <div className="cso-transport">
            <button className="cso-btn primary" onClick={() => void play()}>{transport === "playing" ? "Pause" : transport === "paused" ? "Reprendre" : "Play"}</button>
            <button className="cso-btn" onClick={stop}>Stop</button>
            <button className="cso-btn" onClick={() => { setBeat(0); player.current?.stop(); setTransport("stopped"); }}>Début</button>
            <button className={`cso-btn ${loop ? "active" : ""}`} onClick={() => {
              const next = !loop;
              setLoop(next);
              player.current?.setLoop(next);
            }}>Loop</button>
            <span className="cso-note">Mesure {transport === "stopped" ? active + 1 : activeBar + 1}</span>
          </div>
        </section>

        <aside className="cso-side">
          <section className="cso-panel">
            <h2>Pourquoi cette prise</h2>
            <ul className="cso-report">
              {arrangement.report.influences.map((line) => <li key={line}>{line}</li>)}
              <li>Respiration mesurée : {Math.round(arrangement.report.restRatio * 100)} %. Registres hors tessiture : {arrangement.report.rangeFaults}.</li>
              <li>Le PDF n’est pas proposé : il n’est pas produit ici.</li>
            </ul>
          </section>
          <section className="cso-panel">
            <h2>Axel Style Data</h2>
            <p className="cso-note">{importedProfile ? "Profil JSON actif, prioritaire sur le corpus local." : "Analyse locale. Rien n’est envoyé. Ce n’est pas un modèle neuronal."}</p>
            {profileNote ? <p className="cso-warn">{profileNote}</p> : null}
            <div
              className="cso-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void onFiles(event.dataTransfer.files);
              }}
            >
              Déposer des MIDI ici
              <div className="cso-row" style={{ marginTop: 8 }}>
                <button className="cso-btn" onClick={() => fileRef.current?.click()}>Choisir des fichiers</button>
                <button className="cso-btn" onClick={() => void loadLot()}>Lot de validation (10)</button>
              </div>
              <input ref={fileRef} hidden type="file" accept=".mid,.midi,.xml,.musicxml,.mscz" multiple onChange={(event) => event.target.files && void onFiles(event.target.files)} />
            </div>
            <label style={{ marginTop: 8 }}>Influence du profil {influence} %
              <input className="cso-slider" type="range" min={0} max={100} value={influence} onChange={(event) => setInfluence(Number(event.target.value))} />
            </label>
            <p className="cso-note">{corpus.filter((file) => file.valid).length} fichier(s) valide(s) · {profile?.noteCount ?? 0} notes dans le profil. En Ordre Chaostik, s’il est importé, reste visible mais n’entre pas dans ce profil.</p>
            {rejected.map((line) => <p key={line} className="cso-warn">{line}</p>)}
            {corpus.map((file) => (
              <div key={file.id} className="cso-file">
                <span>{file.name}<br /><small>{file.valid ? `${file.analysis?.noteCount ?? 0} notes · ${file.analysis?.tracks.length ?? 0} pistes` : file.reason}</small></span>
                <button className="cso-btn" onClick={() => void deleteCorpus(file.id).then(() => listCorpus().then(setCorpus))}>Retirer</button>
              </div>
            ))}
            <div className="cso-row">
              <button className="cso-btn" disabled={!profile} onClick={() => profile && download(exportProfile(profile), "axel-style-profile.json")}>Exporter le profil</button>
              <label className="cso-btn">
                Réimporter
                <input hidden type="file" accept="application/json,.json" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importProfileFile(file);
                }} />
              </label>
              <button className="cso-btn" onClick={() => { setImportedProfile(null); setProfileNote(""); }}>Oublier le profil</button>
              <button className="cso-btn" onClick={() => void deleteCorpus().then(() => setCorpus([]))}>Vider le corpus</button>
            </div>
          </section>
        </aside>
      </main>
      <p className="cso-foot cso-note">Violon I · Violon II · Alto I · Alto II · Violoncelle · Contrebasse. Crédit Axel Fisch. Timbre synthétisé dans le navigateur, pas une banque d’échantillons.</p>
    </div>
  );
}
