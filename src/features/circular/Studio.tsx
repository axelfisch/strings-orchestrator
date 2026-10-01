import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, Copy, Download, FileMusic, FolderOpen, Headphones, Loader2, Lock, Merge, Pencil, Plus,
  Printer, Redo2, Split, Trash2, Undo2, Unlock, X,
} from "lucide-react";
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
import { BarGrid } from "./ui/BarGrid";
import { DropZone } from "./ui/DropZone";
import { VOICE_COLOR, formatDuration, type NoticeTone } from "./ui/labels";
import { Notice } from "./ui/Notice";
import { PianoRoll } from "./ui/PianoRoll";
import { TabPanel, Tabs } from "./ui/Tabs";
import { TransportBar } from "./ui/TransportBar";
import { VoiceList } from "./ui/VoiceList";
import "./circular.css";

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
const FAMILY_GROUPS = ["Majeur", "Mineur", "Dominante", "Suspendu", "Diminué"] as const;
const SOURCE_PATTERN = /\.(mid|midi|xml|musicxml)$/i;
const WELCOME_KEY = "cso-ui-welcome-dismissed-v1";

type WorkshopTab = "project" | "import" | "corpus" | "export" | "report";
type SaveState = "pending" | "saved" | "error";
interface Feedback { tone: NoticeTone; lines: string[] }
interface ExportState { id: string; state: "busy" | "done" | "error"; detail: string }

function closestLength(bars: number): 8 | 16 | 32 { return bars <= 8 ? 8 : bars <= 16 ? 16 : 32; }
function cloneProject(project: ProjectDocument): ProjectDocument { return JSON.parse(JSON.stringify(project)) as ProjectDocument; }
function initialState(): { library: ProjectDocument[]; project: ProjectDocument } {
  const library = loadProjectLibrary();
  const active = activeProjectId();
  const project = library.find((item) => item.id === active) ?? library[0] ?? createProject();
  return { library: library.length ? library : [project], project };
}
function readWelcomeDismissed(): boolean {
  try { return localStorage.getItem(WELCOME_KEY) === "1"; } catch { return true; }
}
const clock = (time: number) => new Date(time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [importedProfile, setImportedProfile] = useState<StyleProfile | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportAnalysis | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("melody");
  const [melodyTrack, setMelodyTrack] = useState<number | null>(null);
  const [variantB, setVariantB] = useState<ProjectDocument | null>(null);
  const [showingB, setShowingB] = useState(false);
  // Interface-only state: none of it is persisted in projects or exports.
  const [tab, setTab] = useState<WorkshopTab>("project");
  const [saveState, setSaveState] = useState<SaveState>("pending");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [corpusLoaded, setCorpusLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [corpusBusy, setCorpusBusy] = useState(false);
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(readWelcomeDismissed);
  const history = useRef<ProjectDocument[]>([]);
  const future = useRef<ProjectDocument[]>([]);
  const player = useRef<PlayerHandle | null>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const notify = (lines: string[], tone: NoticeTone) => setFeedback(lines.length ? { lines, tone } : null);

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
  const currentBar = project.bars[activeBar];
  const hasSecond = (currentBar?.harmonies.length ?? 0) > 1;
  const livePlayingBar = transport !== "stopped" ? playingBar : null;
  const focusSection = arrangement.bars[livePlayingBar ?? activeBar]?.section;
  const sectionPlan = arrangement.sectionPlans.find((plan) => plan.section === focusSection);
  const activeReferences = corpus.filter((file) => file.valid && file.included).length;
  const corpusActive = project.influence > 0 && !!profile && (importedProfile !== null || activeReferences > 0);

  const commit = (change: (current: ProjectDocument) => ProjectDocument) => {
    history.current.push(cloneProject(project));
    if (history.current.length > 50) history.current.shift();
    future.current = [];
    setProject((current) => ({ ...change(current), updatedAt: Date.now() }));
  };

  useEffect(() => {
    setSaveState("pending");
    const timer = window.setTimeout(() => {
      try {
        const saved = saveProject(project);
        setLibrary((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt));
        setSaveState("saved"); setSavedAt(Date.now());
      } catch { setSaveState("error"); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    void listCorpus().then(setCorpus).catch(() => setCorpus([])).finally(() => setCorpusLoaded(true));
    let frame = 0;
    let mounted = true;
    void createPlayer(() => { if (mounted) { setTransport("stopped"); setBeat(0); } }).then((handle) => {
      if (!mounted) return handle.dispose();
      player.current = handle;
      setAudioReady(true);
    });
    const tick = () => {
      const position = player.current?.position();
      if (position?.playing || position?.paused) setBeat(position.beat);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(frame); player.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (feedback?.tone !== "success") return;
    const timer = window.setTimeout(() => setFeedback((current) => (current === feedback ? null : current)), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

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
    notify([`Nouveau projet « ${next.name} » créé.`], "success");
  };
  const openProject = (id: string) => {
    const next = library.find((item) => item.id === id); if (!next) return;
    stop(); setProject(cloneProject(next)); setActiveBar(0); history.current = []; future.current = [];
  };
  const copyProject = () => {
    const copy = duplicateProject(project); setProject(copy); setLibrary(loadProjectLibrary());
    notify([`Projet dupliqué : « ${copy.name} ».`], "success");
  };
  const removeProject = () => {
    if (library.length <= 1 || !window.confirm(`Supprimer « ${project.name} » de la bibliothèque locale ?`)) return;
    const remaining = deleteProject(project.id); setLibrary(remaining); setProject(remaining[0] ?? createProject());
    notify([`Projet « ${project.name} » supprimé.`], "info");
  };
  const importProject = async (file: File) => {
    try { const saved = saveProject(await projectFromFile(file)); setProject(saved); setLibrary(loadProjectLibrary()); notify([`Projet « ${saved.name} » importé.`], "success"); }
    catch { notify(["Projet JSON illisible ou incomplet."], "error"); }
  };
  const inspectSource = async (file: File) => {
    setImportError(null);
    if (!SOURCE_PATTERN.test(file.name)) {
      setPendingImport(null);
      setImportError(`Import refusé : « ${file.name} » n’est pas un fichier MIDI (.mid, .midi) ou MusicXML (.xml, .musicxml).`);
      return;
    }
    setImporting(true);
    try {
      const analysis = await analyzeSourceFile(file); setPendingImport(analysis); setMelodyTrack(analysis.melodyTrack);
      notify([`${analysis.sourceName} analysé${analysis.warnings.length ? ` avec ${analysis.warnings.length} avertissement(s)` : ""} : vérifiez le résumé avant d’appliquer.`], analysis.warnings.length ? "warning" : "info");
    } catch (error) {
      setPendingImport(null);
      setImportError(`Import refusé : ${error instanceof Error ? error.message : "ce fichier musical ne peut pas être lu."}`);
    } finally { setImporting(false); }
  };
  const applyImport = () => {
    if (!pendingImport) return;
    if (importMode === "corpus") { notify(["Utilisez « Ajouter au profil » dans l’onglet Corpus pour enregistrer ce fichier dans Axel Style Data."], "info"); return; }
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
    notify([`${pendingImport.sourceName} appliqué : ${bars.length} mesures, ${imported.length} notes conservées.`], "success");
  };
  const addCorpusFiles = async (files: FileList | File[]) => {
    setCorpusBusy(true);
    try {
      const known = await listCorpus(); const notes: string[] = [];
      for (const file of Array.from(files)) {
        if (!/\.(mid|midi|xml|musicxml|mscz)$/i.test(file.name)) { notes.push(`${file.name} : format non pris en charge`); continue; }
        const result = await ingestBuffer(file.name, await file.arrayBuffer(), known);
        if (result.duplicate) notes.push(`${file.name} : déjà présent`);
        else if (!result.file.valid) notes.push(`${file.name} : ${result.file.reason ?? "rejeté"}`);
        else known.push(result.file);
      }
      notify(notes.length ? notes : ["Les fichiers valides ont été ajoutés au profil local."], notes.length ? "warning" : "success"); setCorpus(await listCorpus());
    } finally { setCorpusBusy(false); }
  };
  const loadValidationLot = async () => {
    setCorpusBusy(true);
    try {
      const known = await listCorpus(); const notes: string[] = [];
      for (const filename of VALIDATION_LOT) {
        const served = filename.startsWith("Stay with us") ? "Stay-with-us-my-friend.mid" : filename;
        const response = await fetch(`/corpus/${encodeURIComponent(served)}`);
        if (!response.ok) { notes.push(`${filename} : introuvable`); continue; }
        const result = await ingestBuffer(filename, await response.arrayBuffer(), known);
        if (!result.duplicate && result.file.valid) known.push(result.file); else if (!result.duplicate) notes.push(`${filename} : ${result.file.reason ?? "rejeté"}`);
      }
      notify(notes.length ? notes : ["Lot de validation chargé."], notes.length ? "warning" : "success"); setCorpus(await listCorpus());
    } finally { setCorpusBusy(false); }
  };
  const applyCorpusAsStart = (file: CorpusFile) => {
    if (!file.importAnalysis) return; setPendingImport(file.importAnalysis); setMelodyTrack(file.importAnalysis.melodyTrack);
    setImportMode("melody"); setImportError(null); setTab("import");
    notify([`${file.name} est prêt dans l’onglet Import${file.importAnalysis.warnings.length ? ` (${file.importAnalysis.warnings.length} avertissement(s))` : ""}.`], file.importAnalysis.warnings.length ? "warning" : "info");
  };
  const importProfileFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as StyleProfile | LegacyStyleProfile;
      if (raw.version !== 1 && raw.version !== 2) throw new Error();
      const migrated = migrateProfile(raw); setImportedProfile(migrated);
      notify([`Profil chargé : ${migrated.sourceFiles} fichier(s), ${migrated.noteCount} notes.`], "success");
    } catch { notify(["Profil JSON illisible."], "error"); }
  };
  const audition = async () => {
    const previewBar = splitBarHarmony(project.bars[activeBar], chordSymbol, "4/4");
    const preview = arrange({ bars: [joinBarHarmony(previewBar, "4/4")], key: project.keyName, mode: project.mode,
      style: project.style, meter: "4/4", tempo: 72, seed: 11, influence: 0, title: chordSymbol, harmonicLanguage: "custom" });
    await player.current?.play(preview); setTransport("playing");
  };
  const refreshCorpus = (task: Promise<void>) => void task.then(() => listCorpus().then(setCorpus));
  const runExport = async (id: string, label: string, action: () => void) => {
    setExportState({ id, state: "busy", detail: `${label} en préparation…` });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    try { action(); setExportState({ id, state: "done", detail: `${label} prêt.` }); }
    catch (error) { setExportState({ id, state: "error", detail: `Export impossible : ${error instanceof Error ? error.message : label}.` }); }
  };
  const dismissWelcome = () => { setWelcomeDismissed(true); try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* préférence d’interface facultative */ } };

  const exportsList = [
    { id: "midi", label: "MIDI", detail: "Format 1, six pistes nommées", run: () => download(toMidi(arrangement), `${slug(arrangement)}.mid`) },
    { id: "musicxml", label: "MusicXML", detail: "Partition 4.0 pour l’éditeur de notation", run: () => download(toMusicXml(arrangement), `${slug(arrangement)}.musicxml`) },
    { id: "abc", label: "ABC", detail: "Notation texte", run: () => download(toAbc(arrangement), `${slug(arrangement)}.abc`) },
    { id: "chart", label: "Grille d’accords", detail: "Fichier texte des mesures", run: () => download(toChart(arrangement), `${slug(arrangement)}-grille.txt`) },
    { id: "report", label: "Rapport imprimable", detail: "S’ouvre pour l’impression ou l’enregistrement PDF du navigateur", run: () => printHtml(toHtmlReport(arrangement)) },
    { id: "json", label: "Projet JSON", detail: "Sauvegarde transférable du projet", run: () => download(toProjectJson(project), `${slug(arrangement)}-projet.json`) },
  ];
  const saveLabel = saveState === "error" ? "Sauvegarde locale impossible" : saveState === "pending" ? "Modifications en cours…" : `Enregistré localement${savedAt ? ` · ${clock(savedAt)}` : ""}`;
  const voiceLabel = (voice: VoiceName) => VOICE_LABELS[voice];

  return (
    <div className="cso">
      <a className="cso-skip" href="#cso-harmony">Aller à l’atelier</a>
      <header className="cso-appbar">
        <div className="cso-appbar__inner">
          <div className="cso-brand">
            <span className="cso-brand__mark" aria-hidden />
            <div>
              <p className="cso-kicker">AiXel · sextuor de chambre</p>
              <h1 className="cso-brand__title">Circular Strings Orchestrator</h1>
            </div>
          </div>
          <div className="cso-appbar__project">
            <span className="cso-caption">Projet ouvert</span>
            <strong className="cso-appbar__name">{project.name || "Sans titre"}</strong>
            <span className={`cso-save cso-save--${saveState}`} role="status">
              {saveState === "pending" ? <Loader2 aria-hidden size={14} className="cso-spin" /> : saveState === "error" ? <AlertTriangle aria-hidden size={14} /> : <Check aria-hidden size={14} />}
              {saveLabel}
            </span>
          </div>
          <div className="cso-appbar__actions">
            <button type="button" className="cso-btn cso-btn--ghost" onClick={undo} disabled={!history.current.length} aria-label="Annuler">
              <Undo2 aria-hidden size={18} /><span className="cso-hide-sm">Annuler</span></button>
            <button type="button" className="cso-btn cso-btn--ghost" onClick={redo} disabled={!future.current.length} aria-label="Rétablir">
              <Redo2 aria-hidden size={18} /><span className="cso-hide-sm">Rétablir</span></button>
          </div>
        </div>
      </header>

      {!welcomeDismissed ? (
        <section className="cso-welcome" aria-labelledby="cso-welcome-title">
          <div>
            <h2 id="cso-welcome-title" className="cso-welcome__title">Le parcours de l’atelier</h2>
            <ol className="cso-steps">
              <li><a href="#cso-harmony">Choisir les accords</a></li>
              <li><a href="#cso-grid">Construire la grille</a></li>
              <li><a href="#cso-arrangement">Générer l’arrangement</a></li>
              <li>Écouter avec le transport</li>
              <li><a href="#cso-arrangement">Ajuster voix et variantes</a></li>
              <li><a href="#cso-workshop" onClick={() => setTab("export")}>Exporter</a></li>
            </ol>
          </div>
          <button type="button" className="cso-icon-btn" onClick={dismissWelcome} aria-label="Masquer le parcours"><X aria-hidden size={18} /></button>
        </section>
      ) : null}

      <main className="cso-layout">
        {/* 1 · Construction harmonique */}
        <section id="cso-harmony" className="cso-col cso-col--harmony cso-panel" aria-labelledby="cso-harmony-title">
          <header className="cso-panel__head">
            <h2 id="cso-harmony-title"><span className="cso-step">1</span>Harmonie</h2>
            <span className="cso-muted">24 familles · 12 fondamentales</span>
          </header>
          <Circle root={root} family={family} onRoot={setRoot} onFamily={setFamily} symbol={chordSymbol} />
          <p className="cso-target" aria-live="polite">
            Cible : <strong>mesure {activeBar + 1}</strong> · {activeHarmony === 0 ? "1re harmonie" : "2e harmonie"}
            {currentBar?.locked ? <span className="cso-tag cso-tag--warning"><Lock aria-hidden size={12} />verrouillée</span> : null}
          </p>

          <fieldset className="cso-fieldset">
            <legend>Famille harmonique</legend>
            {FAMILY_GROUPS.map((group) => (
              <div key={group} className="cso-family-group">
                <span className="cso-caption">{group}</span>
                <div className="cso-chips" role="group" aria-label={`Familles ${group}`}>
                  {FAMILIES.filter((item) => item.group === group).map((item) => (
                    <button key={item.id} type="button" className={`cso-chip ${item.id === family ? "is-active" : ""}`} aria-pressed={item.id === family} onClick={() => setFamily(item.id)}>{item.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          <fieldset className="cso-fieldset">
            <legend>Basse <span className="cso-muted">· {bass ? `/${bass}` : "fondamentale"}</span></legend>
            <div className="cso-segmented" role="group" aria-label="Type de basse">
              <button type="button" className={`cso-seg ${foreignBass ? "is-active" : ""}`} aria-pressed={foreignBass} onClick={() => setForeignBass(true)}>Basse étrangère</button>
              <button type="button" className={`cso-seg ${!foreignBass ? "is-active" : ""}`} aria-pressed={!foreignBass} onClick={() => setForeignBass(false)}>Renversement</button>
              <button type="button" className={`cso-seg ${bass === null ? "is-active" : ""}`} aria-pressed={bass === null} onClick={() => setBass(null)}>Sans basse slash</button>
            </div>
            <div className="cso-chips cso-chips--dense">{(foreignBass ? ROOTS : INVERSIONS.map((item) => item.label)).map((label) => {
              const value = foreignBass ? label : ROOTS[(ROOTS.indexOf(root as typeof ROOTS[number]) + (INVERSIONS.find((item) => item.label === label)?.semi ?? 0)) % 12];
              return <button key={label} type="button" className={`cso-chip ${bass === value ? "is-active" : ""}`} aria-pressed={bass === value} onClick={() => setBass(value)}>{foreignBass ? label : `${label} → ${value}`}</button>;
            })}</div>
          </fieldset>

          <fieldset className="cso-fieldset">
            <legend>Placement dans la mesure {activeBar + 1}</legend>
            <div className="cso-segmented" role="group" aria-label="Harmonie ciblée">
              <button type="button" className={`cso-seg ${activeHarmony === 0 ? "is-active" : ""}`} aria-pressed={activeHarmony === 0} onClick={() => setActiveHarmony(0)}>1re harmonie</button>
              <button type="button" className={`cso-seg ${activeHarmony === 1 ? "is-active" : ""}`} aria-pressed={activeHarmony === 1} onClick={() => setActiveHarmony(1)} disabled={!hasSecond}>2e harmonie</button>
            </div>
            {!hasSecond ? <p className="cso-help">Une seule harmonie : utilisez « Deux harmonies » pour ouvrir la deuxième moitié.</p> : null}
            <div className="cso-actions">
              <button type="button" className="cso-btn cso-btn--primary" onClick={placeChord} disabled={currentBar?.locked}>Placer {chordSymbol} · mesure {activeBar + 1}</button>
              <button type="button" className="cso-btn" onClick={toggleSplit}>{hasSecond ? <><Merge aria-hidden size={16} />Une harmonie</> : <><Split aria-hidden size={16} />Deux harmonies</>}</button>
              <button type="button" className="cso-btn" onClick={() => void audition()} disabled={!audioReady}><Headphones aria-hidden size={16} />Écouter l’accord</button>
            </div>
            <div className="cso-inline-edit">{currentBar?.harmonies.map((harmony, index) => <label key={`${activeBar}-${index}`} className="cso-field">
              <span>{index === 0 ? "Accord 1 (1re harmonie)" : "Accord 2 (2e harmonie)"}</span>
              <input type="text" value={harmony.symbol} onChange={(event) => editHarmony(index as 0 | 1, event.target.value)} />
              {harmony.confidence !== undefined ? <small className="cso-help">Confiance de détection {Math.round(harmony.confidence * 100)} %</small> : null}</label>)}</div>
          </fieldset>
        </section>

        {/* 2 · Grille, arrangement, lecture */}
        <div className="cso-col cso-col--score">
          <section id="cso-grid" className="cso-panel" aria-labelledby="cso-grid-title">
            <header className="cso-panel__head">
              <h2 id="cso-grid-title"><span className="cso-step">2</span>Grille</h2>
              <span className="cso-muted">{project.length} mesures · {project.keyName} {project.mode === "minor" ? "mineur" : "majeur"} · {project.meter}</span>
            </header>
            <div className="cso-form-grid">
              <label className="cso-field"><span>Forme</span><select value={project.length} onChange={(event) => resize(Number(event.target.value) as 8 | 16 | 32)}>
                {LENGTHS.map((length) => <option key={length} value={length}>{length} mesures</option>)}</select></label>
              <label className="cso-field"><span>Métrique</span><select value={project.meter} onChange={(event) => commit((current) => ({ ...current, meter: event.target.value as Meter }))}>
                {METERS.map((meter) => <option key={meter}>{meter}</option>)}</select></label>
              <label className="cso-field"><span>Tonalité</span><select value={project.keyName} onChange={(event) => commit((current) => ({ ...current, keyName: event.target.value }))}>
                {ROOTS.map((note) => <option key={note}>{note}</option>)}</select></label>
              <label className="cso-field"><span>Mode</span><select value={project.mode} onChange={(event) => commit((current) => ({ ...current, mode: event.target.value as "major" | "minor" }))}>
                <option value="minor">Mineur</option><option value="major">Majeur</option></select></label>
              <label className="cso-field cso-field--long"><span>Style</span><select value={project.style} onChange={(event) => commit((current) => {
                const style = event.target.value as StyleName; return { ...current, style, meter: defaultMeter(style), tempo: defaultTempo(style) };
              })}>{STYLES.map((style) => <option key={style}>{style}</option>)}</select></label>
              <label className="cso-field cso-field--long"><span>Genre</span><select value={project.genre} onChange={(event) => commit((current) => ({ ...current, genre: event.target.value }))}>
                {GENRES.map((genre) => <option key={genre}>{genre}</option>)}</select></label>
              <label className="cso-field cso-field--wide cso-field--long"><span>Langage harmonique</span><select value={project.harmonicLanguage} onChange={(event) => commit((current) => ({ ...current, harmonicLanguage: event.target.value as HarmonyLanguage }))}>
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="cso-field"><span>Graine</span><input type="number" value={project.seed} onChange={(event) => setProject((current) => ({ ...current, seed: Number(event.target.value) || 1 }))} /></label>
            </div>
            <div className="cso-actions">
              <button type="button" className="cso-btn cso-btn--primary" onClick={regenerate}>Générer la grille</button>
              <button type="button" className="cso-btn" onClick={() => commit((current) => ({ ...current, seed: Math.floor(Math.random() * 999999) + 1 }))}>Nouvelle prise</button>
              <span className="cso-help">Les mesures verrouillées sont conservées.</span>
            </div>

            <div className="cso-legend" aria-hidden>
              <span><i className="cso-key cso-key--selected" />Sélection</span>
              <span><i className="cso-key cso-key--playing" />En lecture</span>
              <span><Lock size={12} />Verrouillée</span>
              <span><b className="cso-key-half">2</b>Deuxième harmonie</span>
            </div>
            <BarGrid bars={arrangement.bars} projectBars={project.bars} activeBar={activeBar} playingBar={livePlayingBar} onSelect={setActiveBar} />
            <div className="cso-actions cso-actions--bar">
              <span className="cso-caption">Mesure {activeBar + 1} · section {arrangement.bars[activeBar]?.section}</span>
              <button type="button" className={`cso-btn ${currentBar?.locked ? "is-on" : ""}`} aria-pressed={!!currentBar?.locked} onClick={toggleBarLock}>
                {currentBar?.locked ? <><Unlock aria-hidden size={16} />Déverrouiller la mesure</> : <><Lock aria-hidden size={16} />Verrouiller la mesure</>}</button>
              <button type="button" className="cso-btn" onClick={toggleSectionLock}>Verrouiller/déverrouiller la section</button>
            </div>
          </section>

          <section id="cso-arrangement" className="cso-panel" aria-labelledby="cso-arr-title">
            <header className="cso-panel__head">
              <h2 id="cso-arr-title"><span className="cso-step">3</span>Arrangement à six voix</h2>
              <span className="cso-variant-badge">Variante {showingB ? "B" : "A"} affichée</span>
            </header>
            <div className="cso-form-grid">
              <label className="cso-field cso-field--long"><span>Gamme Live Thinking</span><select value={project.scale} onChange={(event) => commit((current) => ({ ...current, scale: event.target.value as ScaleId }))}>
                {LIVE_THINKING_SCALES.map((scale) => <option key={scale.id} value={scale.id}>{scale.label}</option>)}</select></label>
              <label className="cso-field cso-field--long"><span>Passage de la mélodie</span><select value={project.melodyMode} onChange={(event) => commit((current) => ({ ...current, melodyMode: event.target.value as MelodyMode }))}>
                {Object.entries(MELODY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="cso-field cso-field--long"><span>Instrument mélodique</span><select value={project.manualMelodyVoice} disabled={project.melodyMode !== "manual" && project.melodyMode !== "preserve-import"}
                aria-describedby="cso-manual-help" onChange={(event) => commit((current) => ({ ...current, manualMelodyVoice: event.target.value as VoiceName }))}>
                {VOICES.map((voice) => <option key={voice} value={voice}>{VOICE_LABELS[voice]}</option>)}</select>
                <small id="cso-manual-help" className="cso-help">{project.melodyMode === "manual" || project.melodyMode === "preserve-import" ? "Voix qui porte la mélodie." : "Actif avec « Instrument choisi » ou une mélodie importée."}</small></label>
              <label className="cso-field"><span>Registre</span><select value={project.registerMode} onChange={(event) => commit((current) => ({ ...current, registerMode: event.target.value as RegisterMode }))}>
                <option value="low">Grave</option><option value="medium">Médium mesuré</option><option value="high">Aigu expressif</option></select></label>
            </div>

            <div className="cso-status-row">
              <span className="cso-stat">Mélodie {sectionPlan ? <>en {sectionPlan.section} : <strong>{voiceLabel(sectionPlan.melody)}</strong></> : "—"}</span>
              <span className="cso-stat">Voix verrouillées : <strong>{project.lockedVoices.length ? project.lockedVoices.map(voiceLabel).join(", ") : "aucune"}</strong></span>
              <button type="button" className={`cso-stat cso-stat--link ${corpusActive ? "is-on" : ""}`} onClick={() => setTab("corpus")}>
                Corpus : <strong>{corpusActive ? `influence ${project.influence} %${importedProfile ? " · profil importé" : ` · ${activeReferences} réf.`}` : "sans influence"}</strong></button>
            </div>

            <div className="cso-arrangement">
              <VoiceList plan={sectionPlan} lockedVoices={project.lockedVoices} onToggleLock={toggleVoice} />
              <PianoRoll arrangement={arrangement} totalBeats={totalBeats} quarters={quartersPerBar(project.meter)} activeBar={activeBar}
                playingBar={livePlayingBar} lockedVoices={project.lockedVoices} beat={beat} showPlayhead={transport !== "stopped"} />
            </div>
            <p className="cso-help">
              Anomalies techniques {100 - arrangement.report.quality}/100 · croisements {arrangement.report.crossings} · quintes/octaves parallèles {arrangement.report.parallels}. Mesure technique uniquement, pas un jugement esthétique.
            </p>

            <div className="cso-variants" role="group" aria-label="Variantes A/B">
              <span className="cso-caption">Variantes</span>
              <span className="cso-segmented cso-segmented--static" aria-hidden>
                <span className={`cso-seg ${!showingB ? "is-active" : ""}`}>A</span>
                <span className={`cso-seg ${showingB ? "is-active" : ""} ${!variantB && !showingB ? "is-empty" : ""}`}>B</span>
              </span>
              <span className="cso-help">{variantB ? (showingB ? "B est affichée ; A est gardée en réserve." : "B est gardée en réserve.") : "Aucune variante B gardée."}</span>
              <button type="button" className="cso-btn" onClick={() => { setVariantB(cloneProject(project)); setShowingB(false); notify(["État actuel gardé comme variante B."], "success"); }}><Copy aria-hidden size={16} />Garder comme variante B</button>
              <button type="button" className="cso-btn" disabled={!variantB} onClick={() => { if (!variantB) return; const current = cloneProject(project); setProject(variantB); setVariantB(current); setShowingB((value) => !value); }}>{showingB ? "Revenir à A" : "Comparer B"}</button>
            </div>
          </section>
        </div>

        {/* 3 · Atelier : projets, import, corpus, exports, rapport */}
        <section id="cso-workshop" className="cso-col cso-col--workshop cso-panel" aria-labelledby="cso-workshop-title">
          <header className="cso-panel__head">
            <h2 id="cso-workshop-title"><span className="cso-step">4</span>Atelier</h2>
          </header>
          <Tabs label="Outils de l’atelier" idPrefix="cso-ws" value={tab} onChange={setTab} items={[
            { id: "project", label: "Projet" },
            { id: "import", label: "Import", badge: pendingImport ? "1" : undefined },
            { id: "corpus", label: "Corpus", badge: activeReferences || undefined },
            { id: "export", label: "Export" },
            { id: "report", label: "Rapport" },
          ]} />

          {feedback ? <Notice tone={feedback.tone} lines={feedback.lines} onDismiss={() => setFeedback(null)} /> : null}

          <TabPanel idPrefix="cso-ws" id="project" active={tab === "project"}>
            <label className="cso-field"><span>Ouvrir un projet de la bibliothèque</span><select value={project.id} onChange={(event) => openProject(event.target.value)}>
              {library.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="cso-field"><span>Nom du projet</span><input type="text" value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} /></label>
            <div className="cso-actions">
              <button type="button" className="cso-btn cso-btn--primary" onClick={newProject}><Plus aria-hidden size={16} />Nouveau</button>
              <button type="button" className="cso-btn" onClick={copyProject}><Copy aria-hidden size={16} />Dupliquer</button>
              <button type="button" className="cso-btn cso-btn--danger" onClick={removeProject} disabled={library.length <= 1} aria-describedby="cso-delete-help"><Trash2 aria-hidden size={16} />Supprimer</button>
            </div>
            {library.length <= 1 ? <p id="cso-delete-help" className="cso-help">Le dernier projet de la bibliothèque ne peut pas être supprimé.</p> : null}
            <div className="cso-subsection">
              <h3>Transfert</h3>
              <div className="cso-actions">
                <button type="button" className="cso-btn" onClick={() => download(toProjectJson(project), `${slug(arrangement)}-projet.json`)}><Download aria-hidden size={16} />Exporter JSON</button>
                <button type="button" className="cso-btn" onClick={() => projectInput.current?.click()}><FolderOpen aria-hidden size={16} />Importer JSON</button>
                <input ref={projectInput} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importProject(file); }} />
              </div>
              <p className="cso-help">Sauvegarde locale automatique dans ce navigateur ({library.length} projet{library.length > 1 ? "s" : ""}). Le JSON transporte un projet vers un autre poste.</p>
            </div>
          </TabPanel>

          <TabPanel idPrefix="cso-ws" id="import" active={tab === "import"}>
            <DropZone title="Importer une pièce" hint="MIDI ou MusicXML, analysé avant toute application." accept=".mid,.midi,.xml,.musicxml,audio/midi"
              buttonLabel="Choisir un fichier" busy={importing} busyLabel="Import en cours…" onFiles={(files) => void inspectSource(files[0])} />
            {importError ? <Notice tone="error" lines={[importError]} onDismiss={() => setImportError(null)} compact /> : null}
            {pendingImport ? (
              <div className="cso-import">
                <div className="cso-import__head">
                  <FileMusic aria-hidden size={20} />
                  <div><strong>{pendingImport.sourceName}</strong><span className="cso-muted">{pendingImport.format === "midi" ? "MIDI" : "MusicXML"} · {pendingImport.tracks.length} piste(s)</span></div>
                </div>
                <dl className="cso-facts">
                  <div><dt>Mesures</dt><dd>{pendingImport.bars}</dd></div>
                  <div><dt>Durée</dt><dd>{formatDuration(pendingImport.durationBeats, pendingImport.tempo)}</dd></div>
                  <div><dt>Tempo</dt><dd>{pendingImport.tempo} BPM</dd></div>
                  <div><dt>Métrique</dt><dd>{pendingImport.meter}</dd></div>
                  <div><dt>Tonalité</dt><dd>{pendingImport.key ?? "non déclarée"}</dd></div>
                  <div><dt>Projet</dt><dd>{closestLength(pendingImport.bars)} mesures</dd></div>
                </dl>
                {pendingImport.warnings.length ? <Notice tone="warning" lines={pendingImport.warnings} compact /> : <p className="cso-help"><Check aria-hidden size={14} /> Aucun avertissement de lecture.</p>}
                <label className="cso-field"><span>Usage</span><select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
                  {Object.entries(IMPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="cso-field"><span>Piste mélodique</span><select value={melodyTrack ?? ""} onChange={(event) => setMelodyTrack(Number(event.target.value))}>
                  {pendingImport.tracks.filter((track) => track.noteCount && !track.percussion).map((track) => <option key={track.index} value={track.index}>{track.name} · {track.noteCount} notes · score {Math.round(track.melodyScore * 100)} %</option>)}</select></label>
                <details className="cso-details">
                  <summary>Accords détectés et confiance</summary>
                  <div className="cso-detected">{pendingImport.harmonies.slice(0, 32).map((events, index) => <small key={index}><b>M{index + 1}</b> {events.map((event) => `${event.symbol}${event.confidence !== undefined ? ` (${Math.round(event.confidence * 100)} %)` : ""}`).join(" · ")}</small>)}</div>
                </details>
                <div className="cso-actions">
                  <button type="button" className="cso-btn cso-btn--primary" onClick={applyImport}>Appliquer au projet</button>
                  <button type="button" className="cso-btn" onClick={() => setPendingImport(null)}>Annuler</button>
                </div>
                <p className="cso-help">L’application remplace la grille du projet ; elle peut être annulée avec « Annuler ».</p>
              </div>
            ) : !importing && !importError ? <p className="cso-empty">Aucune pièce en attente. Le résumé (mesures, durée, tempo, métrique, tonalité, avertissements) apparaîtra ici avant application.</p> : null}
          </TabPanel>

          <TabPanel idPrefix="cso-ws" id="corpus" active={tab === "corpus"}>
            <p className="cso-help">Axel Style Data : références musicales locales et déterministes. Les fichiers sont mesurés dans ce navigateur ; ils ne quittent pas le poste et ne forment aucun modèle neuronal.</p>
            <div className="cso-influence">
              <label className="cso-field" htmlFor="cso-influence"><span>Influence du profil sur la génération</span></label>
              <div className="cso-influence__row">
                <input id="cso-influence" className="cso-slider" type="range" min={0} max={100} value={project.influence} aria-valuetext={`${project.influence} %`}
                  onChange={(event) => setProject((current) => ({ ...current, influence: Number(event.target.value) }))} />
                <output htmlFor="cso-influence" className="num">{project.influence} %</output>
              </div>
              <p className="cso-help">{activeReferences} référence(s) active(s) · {profile?.noteCount ?? 0} notes mesurées · {importedProfile ? "profil importé" : "profil calculé localement"}{project.influence === 0 ? " · influence nulle" : ""}</p>
            </div>
            <DropZone title="Ajouter des références" hint="Déposez des MIDI ou MusicXML (plusieurs fichiers possibles)." accept=".mid,.midi,.xml,.musicxml,.mscz" multiple
              buttonLabel="Ajouter au profil" busy={corpusBusy} busyLabel="Analyse des références…" onFiles={(files) => void addCorpusFiles(files)}>
              <button type="button" className="cso-btn" disabled={corpusBusy} onClick={() => void loadValidationLot()}>Lot de validation</button>
            </DropZone>

            {!corpusLoaded ? <p className="cso-empty"><Loader2 aria-hidden size={14} className="cso-spin" /> Chargement du corpus…</p>
              : !corpus.length ? <p className="cso-empty">Corpus vide. Ajoutez vos arrangements de référence ou chargez le lot de validation de démonstration.</p> : (
              <ul className="cso-corpus">
                {corpus.map((file) => {
                  const status = !file.valid ? "error" : file.included ? "active" : "inactive";
                  return (
                    <li key={file.id} className={`cso-ref cso-ref--${status}`}>
                      <div className="cso-ref__head">
                        <span className={`cso-tag cso-tag--${status}`}>{status === "error" ? "Erreur de lecture" : status === "active" ? "Active" : "Inactive"}</span>
                        <strong className="cso-ref__name">{file.name}</strong>
                      </div>
                      <p className="cso-help">{file.valid ? `${file.analysis?.noteCount ?? 0} notes · ${file.analysis?.tracks.length ?? 0} pistes` : file.reason}</p>
                      <div className="cso-actions cso-actions--compact">
                        {file.valid ? <>
                          <button type="button" className={`cso-btn ${file.included ? "is-on" : ""}`} aria-pressed={file.included} onClick={() => refreshCorpus(setCorpusIncluded(file, !file.included))}>{file.included ? "Exclure" : "Inclure"}</button>
                          <button type="button" className="cso-btn" onClick={() => applyCorpusAsStart(file)}>Comme départ</button>
                          <button type="button" className="cso-btn" onClick={() => file.analysis && download(exportAnalysis(file), `${file.name.replace(/\.[^.]+$/, "")}-analyse.json`)}>Analyse</button>
                          <button type="button" className="cso-btn" aria-label={`Renommer ${file.name}`} onClick={() => { const name = window.prompt("Nouveau nom", file.name); if (name) refreshCorpus(renameCorpus(file, name)); }}><Pencil aria-hidden size={14} />Renommer</button>
                        </> : null}
                        <button type="button" className="cso-btn cso-btn--danger" aria-label={`Retirer ${file.name}`} onClick={() => refreshCorpus(deleteCorpus(file.id))}><Trash2 aria-hidden size={14} />Retirer</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="cso-subsection">
              <h3>Profil</h3>
              <div className="cso-actions">
                <button type="button" className="cso-btn" disabled={!profile} onClick={() => profile && download(exportProfile(profile), "axel-style-profile.json")}><Download aria-hidden size={16} />Exporter le profil</button>
                <label className="cso-btn cso-file-btn"><FolderOpen aria-hidden size={16} />Importer un profil<input className="cso-visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importProfileFile(file); }} /></label>
                <button type="button" className={`cso-btn ${!importedProfile ? "is-on" : ""}`} aria-pressed={!importedProfile} onClick={() => setImportedProfile(null)}>Profil calculé localement</button>
                <button type="button" className="cso-btn cso-btn--danger" disabled={!corpus.length} onClick={() => { if (window.confirm("Vider tout le corpus local ?")) void deleteCorpus().then(() => setCorpus([])); }}>Vider</button>
              </div>
            </div>
          </TabPanel>

          <TabPanel idPrefix="cso-ws" id="export" active={tab === "export"}>
            <ul className="cso-exports">
              {exportsList.map((item) => {
                const state = exportState?.id === item.id ? exportState : null;
                return (
                  <li key={item.id} className="cso-export">
                    <div><strong>{item.label}</strong><span className="cso-help">{item.detail}</span>
                      {state ? <span className={`cso-export__state is-${state.state}`} role={state.state === "error" ? "alert" : "status"}>
                        {state.state === "busy" ? <Loader2 aria-hidden size={14} className="cso-spin" /> : state.state === "done" ? <Check aria-hidden size={14} /> : <AlertTriangle aria-hidden size={14} />}{state.detail}</span> : null}
                    </div>
                    <button type="button" className="cso-btn" disabled={state?.state === "busy"} onClick={() => void runExport(item.id, item.label, item.run)} aria-label={`${item.id === "report" ? "Ouvrir" : "Exporter"} ${item.label}`}>
                      {item.id === "report" ? <><Printer aria-hidden size={16} />Imprimer</> : <><Download aria-hidden size={16} />Exporter</>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="cso-help">Tous les exports partagent les mêmes événements que la lecture : {arrangement.notes.length} notes, {arrangement.bars.length} mesures, variante {showingB ? "B" : "A"}.</p>
          </TabPanel>

          <TabPanel idPrefix="cso-ws" id="report" active={tab === "report"}>
            <ul className="cso-report">
              {arrangement.report.influences.map((line) => <li key={line}>{line}</li>)}
              <li>Mélodie : A1 {VOICE_LABELS[arrangement.report.melodyBySection.A1]}, A2 {VOICE_LABELS[arrangement.report.melodyBySection.A2]}, B {VOICE_LABELS[arrangement.report.melodyBySection.B]}, A3 {VOICE_LABELS[arrangement.report.melodyBySection.A3]}.</li>
              <li>Respiration : {Math.round(arrangement.report.restRatio * 100)} % · densité {arrangement.report.density.toFixed(2)} · espacement médian {arrangement.report.medianSpacing.toFixed(1)} demi-tons.</li>
            </ul>
            <div className="cso-table-wrap"><table><caption className="cso-visually-hidden">Registres mesurés par voix (MIDI)</caption><thead><tr><th scope="col">Voix</th><th scope="col">Min</th><th scope="col">Médiane</th><th scope="col">Max</th><th scope="col">Zone centrale</th></tr></thead><tbody>
              {VOICES.map((voice) => { const stat = arrangement.report.voices[voice]; return <tr key={voice}><th scope="row"><i className="cso-dot" style={{ background: VOICE_COLOR[voice] }} aria-hidden />{VOICE_LABELS[voice]}</th><td>{stat.min}</td><td>{stat.median}</td><td>{stat.max}</td><td>{Math.round(stat.centralRatio * 100)} %</td></tr>; })}
            </tbody></table></div>
          </TabPanel>
        </section>
      </main>

      <footer className="cso-foot">Violon I · Violon II · Alto I · Alto II · Violoncelle · Contrebasse. Crédit Axel Fisch. Le timbre de préécoute est synthétisé dans le navigateur.</footer>

      <TransportBar transport={transport} loop={loop} tempo={project.tempo} meter={project.meter} audioReady={audioReady}
        currentBar={transport === "stopped" ? activeBar + 1 : playingBar + 1} totalBars={arrangement.bars.length} atStart={beat === 0 && activeBar === 0}
        onPlay={() => void play()} onStop={stop} onRewind={() => { stop(); setActiveBar(0); }}
        onLoop={() => { const next = !loop; setLoop(next); player.current?.setLoop(next); }}
        onTempo={(tempo) => { setProject((current) => ({ ...current, tempo })); player.current?.setTempo(tempo); }} />
    </div>
  );
}
