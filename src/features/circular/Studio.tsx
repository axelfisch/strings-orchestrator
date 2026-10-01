import { useEffect, useMemo, useRef, useState } from "react";
import { Circle } from "./Circle";
import { arrange, defaultMeter, defaultTempo, generateGrid } from "./arrange";
import { deleteCorpus, exportAnalysis, exportProfile, ingestBuffer, listCorpus, migrateProfile, profileFrom, renameCorpus, setCorpusIncluded, VALIDATION_LOT, type CorpusFile } from "./corpus";
import { download, printHtml, slug, toAbc, toChart, toHtmlReport, toMidi, toMusicXml, toProjectJson } from "./exporters";
import { analyzeSourceFile } from "./importer";
import { createPlayer, type PlayerHandle } from "./playback";
import { activeProjectId, createProject, deleteProject, duplicateProject, loadProjectLibrary, projectFromFile, saveProject } from "./projects";
import { joinBarHarmony, quartersPerBar, setBarHarmony, splitBarHarmony, symbolFor } from "./theory";
import {
  FAMILIES, GENRES, INVERSIONS, LIVE_THINKING_SCALES, METERS, ROOTS, STYLES, VOICE_LABELS, VOICES,
  type HarmonyLanguage, type ImportAnalysis, type ImportMode, type LegacyStyleProfile, type MelodyMode,
  type Meter, type NoteEvent, type ProjectDocument, type RegisterMode, type ScaleId, type StyleName,
  type StyleProfile, type VoiceName,
} from "./types";
import "./circular.css";

const VOICE_COLOR: Record<VoiceName, string> = {
  "Violin I": "#e8a45a", "Violin II": "#ece5d8", "Viola I": "#7fa7c9",
  "Viola II": "#8fae9a", Cello: "#c4a484", Contrabass: "#8a8d93",
};
const LENGTHS = [8, 16, 32] as const;
const LANGUAGE_LABELS: Record<HarmonyLanguage, string> = {
  automatic: "Automatique selon le style", "pop-soft": "Pop douce",
  chamber: "Chambre · 24 familles", custom: "Grille personnalisée",
};
const MELODY_LABELS: Record<MelodyMode, string> = {
  canonical: "Canonique AABA", controlled: "Rotation contrôlée", manual: "Instrument choisi",
  "preserve-import": "Préserver la mélodie importée",
};
const IMPORT_LABELS: Record<ImportMode, string> = {
  melody: "Mélodie + nouveaux arrangements", grid: "Accords détectés seulement",
  "melody-bass": "Mélodie, basse + nouveaux arrangements", reference: "Conserver les six voix de référence",
  corpus: "Ajouter seulement au profil Axel Style",
};

function closestLength(bars: number): 8 | 16 | 32 { return bars <= 8 ? 8 : bars <= 16 ? 16 : 32; }
function cloneProject(project: ProjectDocument): ProjectDocument { return JSON.parse(JSON.stringify(project)) as ProjectDocument; }
function initialState(): { library: ProjectDocument[]; project: ProjectDocument } {
  const library = loadProjectLibrary();
  const active = activeProjectId();
  const project = library.find((item) => item.id === active) ?? library[0] ?? createProject();
  return { library: library.length ? library : [project], project };
}

export function Studio() {
  const initial = useRef(initialState()).current;
  const [library, setLibrary] = useState(initial.library);
  const [project, setProject] = useState(initial.project);
  const [activeBar, setActiveBar] = useState(0);
  const [activeHarmony, setActiveHarmony] = useState<0 | 1>(0);
  const [family, setFamily] = useState<string>("min9");
  const [root, setRoot] = useState("F");
  const [bass, setBass] = useState<string | null>(null);
  const [foreignBass, setForeignBass] = useState(true);
  const [loop, setLoop] = useState(false);
  const [transport, setTransport] = useState<"stopped" | "playing" | "paused">("stopped");
  const [beat, setBeat] = useState(0);
  const [corpus, setCorpus] = useState<CorpusFile[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [importedProfile, setImportedProfile] = useState<StyleProfile | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportAnalysis | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("melody");
  const [melodyTrack, setMelodyTrack] = useState<number | null>(null);
  const [variantB, setVariantB] = useState<ProjectDocument | null>(null);
  const [showingB, setShowingB] = useState(false);
  const history = useRef<ProjectDocument[]>([]);
  const future = useRef<ProjectDocument[]>([]);
  const player = useRef<PlayerHandle | null>(null);
  const corpusInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const profile = useMemo(() => importedProfile ?? profileFrom(corpus), [corpus, importedProfile]);
  const arrangement = useMemo(() => arrange({
    bars: project.bars, key: project.keyName, mode: project.mode, style: project.style, meter: project.meter,
    tempo: project.tempo, seed: project.seed, influence: project.influence, profile, title: project.name,
    harmonicLanguage: project.harmonicLanguage, scale: project.scale, melodyMode: project.melodyMode,
    manualMelodyVoice: project.manualMelodyVoice, registerMode: project.registerMode,
    importedMelody: project.importedMelody, holds: { voices: project.voiceHolds, bars: project.barHolds },
  }), [project, profile]);
  const totalBeats = Math.max(1, arrangement.bars.length * quartersPerBar(project.meter));
  const playingBar = Math.min(arrangement.bars.length - 1, Math.max(0, Math.floor(beat / quartersPerBar(project.meter))));
  const chordSymbol = symbolFor(root, family, bass);

  const commit = (change: (current: ProjectDocument) => ProjectDocument) => {
    history.current.push(cloneProject(project));
    if (history.current.length > 50) history.current.shift();
    future.current = [];
    setProject((current) => ({ ...change(current), updatedAt: Date.now() }));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = saveProject(project);
      setLibrary((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    void listCorpus().then(setCorpus).catch(() => setCorpus([]));
    let frame = 0;
    let mounted = true;
    void createPlayer(() => { if (mounted) { setTransport("stopped"); setBeat(0); } }).then((handle) => {
      if (!mounted) return handle.dispose();
      player.current = handle;
    });
    const tick = () => {
      const position = player.current?.position();
      if (position?.playing || position?.paused) setBeat(position.beat);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(frame); player.current?.dispose(); };
  }, []);

  const regenerate = () => commit((current) => {
    const generated = generateGrid({ key: current.keyName, mode: current.mode, length: current.length, seed: current.seed,
      meter: current.meter, harmonicLanguage: current.harmonicLanguage, style: current.style });
    return { ...current, bars: generated.map((bar, index) => current.bars[index]?.locked ? current.bars[index] : bar), voiceHolds: {}, lockedVoices: [] };
  });
  const resize = (length: 8 | 16 | 32) => commit((current) => {
    const generated = generateGrid({ key: current.keyName, mode: current.mode, length, seed: current.seed,
      meter: current.meter, harmonicLanguage: current.harmonicLanguage, style: current.style });
    return { ...current, length, bars: generated.map((bar, index) => current.bars[index] ?? bar) };
  });
  const placeChord = () => commit((current) => ({
    ...current, harmonicLanguage: "custom",
    bars: current.bars.map((bar, index) => index === activeBar && !bar.locked ? setBarHarmony(bar, activeHarmony, chordSymbol, current.meter) : bar),
    barHolds: Object.fromEntries(Object.entries(current.barHolds).filter(([number]) => Number(number) !== activeBar + 1)),
  }));
  const toggleSplit = () => commit((current) => ({
    ...current, harmonicLanguage: "custom",
    bars: current.bars.map((bar, index) => index !== activeBar || bar.locked ? bar
      : bar.harmonies.length > 1 ? joinBarHarmony(bar, current.meter) : splitBarHarmony(bar, chordSymbol, current.meter)),
  }));
  const editHarmony = (index: 0 | 1, value: string) => commit((current) => ({
    ...current, harmonicLanguage: "custom",
    bars: current.bars.map((bar, barIndex) => barIndex === activeBar ? setBarHarmony(bar, index, value, current.meter) : bar),
  }));
  const toggleVoice = (voice: VoiceName) => commit((current) => {
    const locked = current.lockedVoices.includes(voice);
    const holds = { ...current.voiceHolds };
    if (locked) delete holds[voice]; else holds[voice] = arrangement.notes.filter((note) => note.voice === voice);
    return { ...current, lockedVoices: locked ? current.lockedVoices.filter((item) => item !== voice) : [...current.lockedVoices, voice], voiceHolds: holds };
  });
  const toggleBarLock = () => commit((current) => {
    const number = activeBar + 1;
    const wasLocked = current.bars[activeBar]?.locked;
    const holds = { ...current.barHolds };
    if (wasLocked) delete holds[number]; else holds[number] = arrangement.notes.filter((note) => note.bar === number);
    return { ...current, bars: current.bars.map((bar, index) => index === activeBar ? { ...bar, locked: !bar.locked } : bar), barHolds: holds };
  });
  const toggleSectionLock = () => commit((current) => {
    const section = arrangement.bars[activeBar]?.section;
    const indexes = arrangement.bars.flatMap((bar, index) => bar.section === section ? [index] : []);
    const locking = indexes.some((index) => !current.bars[index]?.locked);
    const holds = { ...current.barHolds };
    indexes.forEach((index) => { if (locking) holds[index + 1] = arrangement.notes.filter((note) => note.bar === index + 1); else delete holds[index + 1]; });
    return { ...current, bars: current.bars.map((bar, index) => indexes.includes(index) ? { ...bar, locked: locking } : bar), barHolds: holds };
  });

  const play = async () => {
    if (!player.current) return;
    if (transport === "playing") { player.current.pause(); setTransport("paused"); }
    else if (transport === "paused") { await player.current.resume(); setTransport("playing"); }
    else { player.current.setLoop(loop); player.current.setTempo(project.tempo); await player.current.play(arrangement, 0); setTransport("playing"); }
  };
  const stop = () => { player.current?.stop(); setTransport("stopped"); setBeat(0); };
  const undo = () => { const previous = history.current.pop(); if (!previous) return; future.current.push(cloneProject(project)); setProject(previous); };
  const redo = () => { const next = future.current.pop(); if (!next) return; history.current.push(cloneProject(project)); setProject(next); };
  const newProject = () => {
    const next = createProject({ keyName: project.keyName, mode: project.mode, style: project.style });
    setProject(next); setLibrary((current) => [next, ...current]); setActiveBar(0); history.current = []; future.current = [];
  };
  const openProject = (id: string) => {
    const next = library.find((item) => item.id === id); if (!next) return;
    stop(); setProject(cloneProject(next)); setActiveBar(0); history.current = []; future.current = [];
  };
  const removeProject = () => {
    if (library.length <= 1 || !window.confirm(`Supprimer « ${project.name} » de la bibliothèque locale ?`)) return;
    const remaining = deleteProject(project.id); setLibrary(remaining); setProject(remaining[0] ?? createProject());
  };
  const importProject = async (file: File) => {
    try { const saved = saveProject(await projectFromFile(file)); setProject(saved); setLibrary(loadProjectLibrary()); setMessages([`Projet « ${saved.name} » importé.`]); }
    catch { setMessages(["Projet JSON illisible ou incomplet."]); }
  };
  const inspectSource = async (file: File) => {
    try { const analysis = await analyzeSourceFile(file); setPendingImport(analysis); setMelodyTrack(analysis.melodyTrack); setMessages(analysis.warnings); }
    catch (error) { setPendingImport(null); setMessages([error instanceof Error ? error.message : "Ce fichier musical ne peut pas être lu."]); }
  };
  const applyImport = () => {
    if (!pendingImport) return;
    if (importMode === "corpus") { setMessages(["Utilisez “Ajouter au profil” pour enregistrer ce fichier dans Axel Style Data."]); return; }
    const length = closestLength(pendingImport.bars);
    const generated = generateGrid({ key: pendingImport.key ?? project.keyName, mode: project.mode, length, seed: project.seed,
      meter: pendingImport.meter, harmonicLanguage: project.harmonicLanguage, style: project.style });
    const bars = generated.map((bar, index) => pendingImport.harmonies[index]?.length
      ? { harmonies: pendingImport.harmonies[index], origin: "imported" as const, locked: false } : bar);
    const selectedMelody = pendingImport.importedNotes.filter((note) => note.sourceTrack === melodyTrack)
      .map((note) => ({ ...note, voice: project.manualMelodyVoice, role: "melody" as const }));
    const bassNotes = pendingImport.importedNotes.filter((note) => note.sourceTrack === pendingImport.bassTrack)
      .map((note) => ({ ...note, voice: "Contrabass" as const, role: "foundation" as const }));
    let imported: NoteEvent[] = [];
    if (importMode === "melody") imported = selectedMelody;
    if (importMode === "melody-bass") imported = [...selectedMelody, ...bassNotes];
    if (importMode === "reference") imported = pendingImport.importedNotes;
    commit((current) => ({ ...current, length, keyName: pendingImport.key ?? current.keyName, meter: pendingImport.meter,
      tempo: pendingImport.tempo, bars, importedMelody: imported, melodyMode: imported.length ? "preserve-import" : current.melodyMode,
      harmonicLanguage: "custom" }));
    setPendingImport(null); setActiveBar(0);
    setMessages([`${pendingImport.sourceName} appliqué : ${bars.length} mesures, ${imported.length} notes conservées.`]);
  };
  const addCorpusFiles = async (files: FileList | File[]) => {
    const known = await listCorpus(); const notes: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(mid|midi|xml|musicxml|mscz)$/i.test(file.name)) { notes.push(`${file.name} : format non pris en charge`); continue; }
      const result = await ingestBuffer(file.name, await file.arrayBuffer(), known);
      if (result.duplicate) notes.push(`${file.name} : déjà présent`);
      else if (!result.file.valid) notes.push(`${file.name} : ${result.file.reason ?? "rejeté"}`);
      else known.push(result.file);
    }
    setMessages(notes.length ? notes : ["Les fichiers valides ont été ajoutés au profil local."]); setCorpus(await listCorpus());
  };
  const loadValidationLot = async () => {
    const known = await listCorpus(); const notes: string[] = [];
    for (const filename of VALIDATION_LOT) {
      const served = filename.startsWith("Stay with us") ? "Stay-with-us-my-friend.mid" : filename;
      const response = await fetch(`/corpus/${encodeURIComponent(served)}`);
      if (!response.ok) { notes.push(`${filename} : introuvable`); continue; }
      const result = await ingestBuffer(filename, await response.arrayBuffer(), known);
      if (!result.duplicate && result.file.valid) known.push(result.file); else if (!result.duplicate) notes.push(`${filename} : ${result.file.reason ?? "rejeté"}`);
    }
    setMessages(notes.length ? notes : ["Lot de validation chargé."]); setCorpus(await listCorpus());
  };
  const applyCorpusAsStart = (file: CorpusFile) => {
    if (!file.importAnalysis) return; setPendingImport(file.importAnalysis); setMelodyTrack(file.importAnalysis.melodyTrack);
    setImportMode("melody"); setMessages(file.importAnalysis.warnings);
  };
  const importProfileFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as StyleProfile | LegacyStyleProfile;
      if (raw.version !== 1 && raw.version !== 2) throw new Error();
      const migrated = migrateProfile(raw); setImportedProfile(migrated);
      setMessages([`Profil chargé : ${migrated.sourceFiles} fichier(s), ${migrated.noteCount} notes.`]);
    } catch { setMessages(["Profil JSON illisible."]); }
  };
  const audition = async () => {
    const previewBar = splitBarHarmony(project.bars[activeBar], chordSymbol, "4/4");
    const preview = arrange({ bars: [joinBarHarmony(previewBar, "4/4")], key: project.keyName, mode: project.mode,
      style: project.style, meter: "4/4", tempo: 72, seed: 11, influence: 0, title: chordSymbol, harmonicLanguage: "custom" });
    await player.current?.play(preview); setTransport("playing");
  };

  return (
    <div className="cso">
      <header className="cso-header">
        <div><p className="cso-kicker">AiXel · sextuor de chambre</p><h1>Circular Strings Orchestrator</h1>
          <p className="cso-sub">Une grille, six voix, un moteur commun pour l’écoute, le MIDI et la partition.</p></div>
        <div className="cso-project-head">
          <label>Bibliothèque<select value={project.id} onChange={(event) => openProject(event.target.value)}>
            {library.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Nom du projet<input type="text" value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} /></label>
        </div>
      </header>

      <div className="cso-toolbar">
        <label>Forme<select value={project.length} onChange={(event) => resize(Number(event.target.value) as 8 | 16 | 32)}>
          {LENGTHS.map((length) => <option key={length} value={length}>{length} mesures</option>)}</select></label>
        <label>Style<select value={project.style} onChange={(event) => commit((current) => {
          const style = event.target.value as StyleName; return { ...current, style, meter: defaultMeter(style), tempo: defaultTempo(style) };
        })}>{STYLES.map((style) => <option key={style}>{style}</option>)}</select></label>
        <label>Genre<select value={project.genre} onChange={(event) => commit((current) => ({ ...current, genre: event.target.value }))}>
          {GENRES.map((genre) => <option key={genre}>{genre}</option>)}</select></label>
        <label>Tonalité<select value={project.keyName} onChange={(event) => commit((current) => ({ ...current, keyName: event.target.value }))}>
          {ROOTS.map((note) => <option key={note}>{note}</option>)}</select></label>
        <label>Mode<select value={project.mode} onChange={(event) => commit((current) => ({ ...current, mode: event.target.value as "major" | "minor" }))}>
          <option value="minor">Mineur</option><option value="major">Majeur</option></select></label>
        <label>Métrique<select value={project.meter} onChange={(event) => commit((current) => ({ ...current, meter: event.target.value as Meter }))}>
          {METERS.map((meter) => <option key={meter}>{meter}</option>)}</select></label>
        <label>Tempo<input type="number" min={40} max={200} value={project.tempo} onChange={(event) => {
          const tempo = Number(event.target.value) || 72; setProject((current) => ({ ...current, tempo })); player.current?.setTempo(tempo);
        }} /></label>
        <label>Graine<input type="number" value={project.seed} onChange={(event) => setProject((current) => ({ ...current, seed: Number(event.target.value) || 1 }))} /></label>
        <button className="cso-btn primary" onClick={regenerate}>Générer la grille</button>
        <button className="cso-btn" onClick={() => commit((current) => ({ ...current, seed: Math.floor(Math.random() * 999999) + 1 }))}>Nouvelle prise</button>
        <button className="cso-btn" onClick={undo} disabled={!history.current.length}>Annuler</button>
        <button className="cso-btn" onClick={redo} disabled={!future.current.length}>Rétablir</button>
      </div>

      <main className="cso-main">
        <section className="cso-panel">
          <h2>Cercle harmonique</h2><Circle root={root} family={family} onRoot={setRoot} onFamily={setFamily} />
          <div className="cso-center-read"><p className="cso-symbol serif">{chordSymbol}</p><p className="cso-note">24 familles de chambre, transposées depuis un dictionnaire unique.</p></div>
          <div className="cso-qualities" aria-label="Familles harmoniques">
            {FAMILIES.map((item) => <button key={item.id} className={`cso-chip ${item.id === family ? "active" : ""}`} onClick={() => setFamily(item.id)}>{item.label}</button>)}
          </div>
          <div className="cso-row cso-space-top"><button className={`cso-chip ${foreignBass ? "active" : ""}`} onClick={() => setForeignBass(true)}>Basse étrangère</button>
            <button className={`cso-chip ${!foreignBass ? "active" : ""}`} onClick={() => setForeignBass(false)}>Renversement</button>
            <button className="cso-chip" onClick={() => setBass(null)}>Sans basse slash</button></div>
          <div className="cso-bass">{(foreignBass ? ROOTS : INVERSIONS.map((item) => item.label)).map((label) => {
            const value = foreignBass ? label : ROOTS[(ROOTS.indexOf(root as typeof ROOTS[number]) + (INVERSIONS.find((item) => item.label === label)?.semi ?? 0)) % 12];
            return <button key={label} className={`cso-chip ${bass === value ? "active" : ""}`} onClick={() => setBass(value)}>{foreignBass ? label : `${label} → ${value}`}</button>;
          })}</div>
          <div className="cso-segmented cso-space-top"><button className={`cso-chip ${activeHarmony === 0 ? "active" : ""}`} onClick={() => setActiveHarmony(0)}>1re moitié</button>
            <button className={`cso-chip ${activeHarmony === 1 ? "active" : ""}`} onClick={() => setActiveHarmony(1)} disabled={project.bars[activeBar]?.harmonies.length < 2}>2e moitié</button></div>
          <div className="cso-row cso-space-top"><button className="cso-btn primary" onClick={placeChord}>Placer mesure {activeBar + 1}</button>
            <button className="cso-btn" onClick={toggleSplit}>{project.bars[activeBar]?.harmonies.length > 1 ? "Une harmonie" : "Deux harmonies"}</button>
            <button className="cso-btn" onClick={() => void audition()}>Écouter l’accord</button></div>
          <div className="cso-inline-edit">{project.bars[activeBar]?.harmonies.map((harmony, index) => <label key={`${activeBar}-${index}`}>Accord {index + 1}
            <input type="text" value={harmony.symbol} onChange={(event) => editHarmony(index as 0 | 1, event.target.value)} />
            {harmony.confidence !== undefined ? <small>Confiance {Math.round(harmony.confidence * 100)} %</small> : null}</label>)}</div>
        </section>

        <section className="cso-panel">
          <div className="cso-row cso-between"><h2>Arrangement</h2><div className="cso-exports">
            <button className="cso-btn" onClick={() => download(toMidi(arrangement), `${slug(arrangement)}.mid`)}>MIDI</button>
            <button className="cso-btn" onClick={() => download(toMusicXml(arrangement), `${slug(arrangement)}.musicxml`)}>MusicXML</button>
            <button className="cso-btn" onClick={() => download(toAbc(arrangement), `${slug(arrangement)}.abc`)}>ABC</button>
            <button className="cso-btn" onClick={() => download(toChart(arrangement), `${slug(arrangement)}-grille.txt`)}>Grille</button>
            <button className="cso-btn" onClick={() => printHtml(toHtmlReport(arrangement))}>Imprimer</button>
          </div></div>
          <div className="cso-controls-grid">
            <label>Langage harmonique<select value={project.harmonicLanguage} onChange={(event) => commit((current) => ({ ...current, harmonicLanguage: event.target.value as HarmonyLanguage }))}>
              {Object.entries(LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Gamme Live Thinking<select value={project.scale} onChange={(event) => commit((current) => ({ ...current, scale: event.target.value as ScaleId }))}>
              {LIVE_THINKING_SCALES.map((scale) => <option key={scale.id} value={scale.id}>{scale.label}</option>)}</select></label>
            <label>Passage de la mélodie<select value={project.melodyMode} onChange={(event) => commit((current) => ({ ...current, melodyMode: event.target.value as MelodyMode }))}>
              {Object.entries(MELODY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Instrument manuel<select value={project.manualMelodyVoice} disabled={project.melodyMode !== "manual" && project.melodyMode !== "preserve-import"}
              onChange={(event) => commit((current) => ({ ...current, manualMelodyVoice: event.target.value as VoiceName }))}>
              {VOICES.map((voice) => <option key={voice} value={voice}>{VOICE_LABELS[voice]}</option>)}</select></label>
            <label>Registre<select value={project.registerMode} onChange={(event) => commit((current) => ({ ...current, registerMode: event.target.value as RegisterMode }))}>
              <option value="low">Grave</option><option value="medium">Médium mesuré</option><option value="high">Aigu expressif</option></select></label>
          </div>
          <p className="cso-note">{project.meter} · {project.tempo} BPM · graine {project.seed} · anomalies techniques {100 - arrangement.report.quality}/100 · croisements {arrangement.report.crossings} · quintes/octaves parallèles {arrangement.report.parallels}</p>
          <div className="cso-map">{arrangement.bars.map((bar, index) => <button key={bar.number} className={`cso-bar ${index === activeBar ? "on" : ""} ${transport !== "stopped" && index === playingBar ? "live" : ""}`} onClick={() => setActiveBar(index)}>
            <small>{bar.section} · {bar.number}{project.bars[index]?.locked ? " · verrouillée" : ""} · {bar.origin}</small>
            <strong>{bar.harmonies.map((harmony) => harmony.symbol).join(" · ")}</strong><em>{bar.texture}</em></button>)}</div>
          <div className="cso-row cso-space-top"><button className="cso-btn" onClick={toggleBarLock}>{project.bars[activeBar]?.locked ? "Déverrouiller la mesure" : "Verrouiller la mesure"}</button>
            <button className="cso-btn" onClick={toggleSectionLock}>Verrouiller/déverrouiller la section</button>
            <button className="cso-btn" onClick={() => { setVariantB(cloneProject(project)); setShowingB(false); }}>Garder comme variante B</button>
            <button className="cso-btn" disabled={!variantB} onClick={() => { if (!variantB) return; const current = cloneProject(project); setProject(variantB); setVariantB(current); setShowingB((value) => !value); }}>{showingB ? "Revenir à A" : "Comparer B"}</button></div>
          <div className="cso-roll" aria-label="Piano-roll des six voix"><div className="cso-playhead" style={{ left: `${(beat / totalBeats) * 100}%` }} />
            {arrangement.notes.map((note, index) => <div key={`${note.voice}-${index}`} className="cso-note-pip" title={`${VOICE_LABELS[note.voice]} · MIDI ${note.midi}`} style={{
              left: `${(note.start / totalBeats) * 100}%`, width: `${Math.max((note.duration / totalBeats) * 100, 0.25)}%`,
              bottom: `${Math.max(0, Math.min(100, ((note.midi - 28) / 68) * 100))}%`, background: VOICE_COLOR[note.voice],
            }} />)}</div>
          <div className="cso-legend">{VOICES.map((voice) => <button key={voice} className={`cso-chip ${project.lockedVoices.includes(voice) ? "active" : ""}`} onClick={() => toggleVoice(voice)}>
            <i className="cso-swatch" style={{ background: VOICE_COLOR[voice] }} />{VOICE_LABELS[voice]}{project.lockedVoices.includes(voice) ? " verrouillé" : ""}</button>)}</div>
          <div className="cso-transport"><button className="cso-btn primary" onClick={() => void play()}>{transport === "playing" ? "Pause" : transport === "paused" ? "Reprendre" : "Play"}</button>
            <button className="cso-btn" onClick={stop}>Stop</button><button className="cso-btn" onClick={() => { stop(); setActiveBar(0); }}>Début</button>
            <button className={`cso-btn ${loop ? "active" : ""}`} onClick={() => { const next = !loop; setLoop(next); player.current?.setLoop(next); }}>Loop</button>
            <span className="cso-note">Mesure {transport === "stopped" ? activeBar + 1 : playingBar + 1}</span></div>
        </section>

        <aside className="cso-side">
          <section className="cso-panel"><h2>Projets</h2><div className="cso-row">
            <button className="cso-btn primary" onClick={newProject}>Nouveau</button>
            <button className="cso-btn" onClick={() => { const copy = duplicateProject(project); setProject(copy); setLibrary(loadProjectLibrary()); }}>Dupliquer</button>
            <button className="cso-btn" onClick={removeProject}>Supprimer</button>
            <button className="cso-btn" onClick={() => download(toProjectJson(project), `${slug(arrangement)}-projet.json`)}>Exporter JSON</button>
            <button className="cso-btn" onClick={() => projectInput.current?.click()}>Importer JSON</button>
            <input ref={projectInput} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); }} />
          </div><p className="cso-note">Sauvegarde locale automatique. Les projets peuvent être transférés avec leur fichier JSON.</p></section>

          <section className="cso-panel"><h2>Importer une pièce</h2>
            <label className="cso-drop">MIDI ou MusicXML à analyser avant application<input type="file" accept=".mid,.midi,.xml,.musicxml,audio/midi" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectSource(file); }} /></label>
            {pendingImport ? <div className="cso-import-summary"><strong>{pendingImport.sourceName}</strong>
              <p className="cso-note">{pendingImport.bars} mesures détectées · {pendingImport.meter} · {pendingImport.tempo} BPM · {pendingImport.key ?? "tonalité non déclarée"}</p>
              <label>Usage<select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
                {Object.entries(IMPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Piste mélodique<select value={melodyTrack ?? ""} onChange={(event) => setMelodyTrack(Number(event.target.value))}>
                {pendingImport.tracks.filter((track) => track.noteCount && !track.percussion).map((track) => <option key={track.index} value={track.index}>{track.name} · {track.noteCount} notes · score {Math.round(track.melodyScore * 100)} %</option>)}</select></label>
              <div className="cso-row cso-space-top"><button className="cso-btn primary" onClick={applyImport}>Appliquer au projet</button><button className="cso-btn" onClick={() => setPendingImport(null)}>Annuler</button></div>
              <div className="cso-detected">{pendingImport.harmonies.slice(0, 32).map((events, index) => <small key={index}>M{index + 1} {events.map((event) => `${event.symbol}${event.confidence !== undefined ? ` (${Math.round(event.confidence * 100)} %)` : ""}`).join(" · ")}</small>)}</div>
            </div> : null}
          </section>

          <section className="cso-panel"><h2>Rapport musical</h2><ul className="cso-report">
            {arrangement.report.influences.map((line) => <li key={line}>{line}</li>)}
            <li>Mélodie : A1 {VOICE_LABELS[arrangement.report.melodyBySection.A1]}, A2 {VOICE_LABELS[arrangement.report.melodyBySection.A2]}, B {VOICE_LABELS[arrangement.report.melodyBySection.B]}, A3 {VOICE_LABELS[arrangement.report.melodyBySection.A3]}.</li>
            <li>Respiration : {Math.round(arrangement.report.restRatio * 100)} % · densité {arrangement.report.density.toFixed(2)} · espacement médian {arrangement.report.medianSpacing.toFixed(1)} demi-tons.</li>
          </ul><div className="cso-table-wrap"><table><thead><tr><th>Voix</th><th>Min</th><th>Médiane</th><th>Max</th><th>Zone centrale</th></tr></thead><tbody>
            {VOICES.map((voice) => { const stat = arrangement.report.voices[voice]; return <tr key={voice}><td>{VOICE_LABELS[voice]}</td><td>{stat.min}</td><td>{stat.median}</td><td>{stat.max}</td><td>{Math.round(stat.centralRatio * 100)} %</td></tr>; })}
          </tbody></table></div></section>

          <section className="cso-panel"><h2>Axel Style Data</h2><p className="cso-note">Analyse locale de MIDI et MusicXML. Les fichiers ne quittent pas le navigateur et ne forment pas un modèle neuronal.</p>
            <div className="cso-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addCorpusFiles(event.dataTransfer.files); }}>
              Déposer les arrangements de référence ici<div className="cso-row cso-space-top"><button className="cso-btn" onClick={() => corpusInput.current?.click()}>Ajouter au profil</button>
                <button className="cso-btn" onClick={() => void loadValidationLot()}>Lot de validation</button></div>
              <input ref={corpusInput} hidden type="file" accept=".mid,.midi,.xml,.musicxml,.mscz" multiple onChange={(event) => event.target.files && void addCorpusFiles(event.target.files)} />
            </div>
            <label className="cso-space-top">Influence du profil {project.influence} %<input className="cso-slider" type="range" min={0} max={100} value={project.influence} onChange={(event) => setProject((current) => ({ ...current, influence: Number(event.target.value) }))} /></label>
            <p className="cso-note">{corpus.filter((file) => file.valid && file.included).length} source(s) incluse(s) · {profile?.noteCount ?? 0} notes mesurées.</p>
            {corpus.map((file) => <div key={file.id} className="cso-file-block"><div className="cso-file"><span><strong>{file.name}</strong><br /><small>{file.valid ? `${file.analysis?.noteCount ?? 0} notes · ${file.analysis?.tracks.length ?? 0} pistes${file.included ? " · incluse" : " · exclue"}` : file.reason}</small></span></div>
              <div className="cso-row">{file.valid ? <><button className="cso-btn" onClick={() => void setCorpusIncluded(file, !file.included).then(() => listCorpus().then(setCorpus))}>{file.included ? "Exclure" : "Inclure"}</button>
                <button className="cso-btn" onClick={() => applyCorpusAsStart(file)}>Comme départ</button>
                <button className="cso-btn" onClick={() => file.analysis && download(exportAnalysis(file), `${file.name.replace(/\.[^.]+$/, "")}-analyse.json`)}>Analyse</button>
                <button className="cso-btn" onClick={() => { const name = window.prompt("Nouveau nom", file.name); if (name) void renameCorpus(file, name).then(() => listCorpus().then(setCorpus)); }}>Renommer</button></> : null}
                <button className="cso-btn" onClick={() => void deleteCorpus(file.id).then(() => listCorpus().then(setCorpus))}>Retirer</button></div></div>)}
            <div className="cso-row cso-space-top"><button className="cso-btn" disabled={!profile} onClick={() => profile && download(exportProfile(profile), "axel-style-profile.json")}>Exporter le profil</button>
              <label className="cso-btn">Importer un profil<input hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProfileFile(file); }} /></label>
              <button className="cso-btn" onClick={() => setImportedProfile(null)}>Profil calculé localement</button>
              <button className="cso-btn" onClick={() => { if (window.confirm("Vider tout le corpus local ?")) void deleteCorpus().then(() => setCorpus([])); }}>Vider</button></div>
          </section>
          {messages.length ? <section className="cso-panel"><h2>État</h2>{messages.map((message) => <p className="cso-warn" key={message}>{message}</p>)}</section> : null}
        </aside>
      </main>
      <p className="cso-foot cso-note">Violon I · Violon II · Alto I · Alto II · Violoncelle · Contrebasse. Crédit Axel Fisch. Le timbre de préécoute est synthétisé dans le navigateur.</p>
    </div>
  );
}
