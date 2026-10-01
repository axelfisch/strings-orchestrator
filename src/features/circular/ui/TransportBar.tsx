import { Loader2, Pause, Play, Repeat, SkipBack, Square } from "lucide-react";
import type { Meter } from "../types";

export type TransportState = "stopped" | "playing" | "paused";

interface TransportBarProps {
  transport: TransportState;
  loop: boolean;
  tempo: number;
  meter: Meter;
  audioReady: boolean;
  currentBar: number;
  totalBars: number;
  atStart: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onLoop: () => void;
  onTempo: (tempo: number) => void;
}

const STATE_LABEL: Record<TransportState, string> = { stopped: "Prêt", playing: "Lecture", paused: "En pause" };

export function TransportBar(props: TransportBarProps) {
  const { transport, loop, tempo, meter, audioReady, currentBar, totalBars, atStart } = props;
  const playLabel = transport === "playing" ? "Pause" : transport === "paused" ? "Reprendre" : "Lecture";
  const stateLabel = !audioReady ? "Chargement audio…" : transport === "stopped" && atStart ? "Prêt · début" : STATE_LABEL[transport];
  return (
    <div className={`cso-transport is-${transport}`} role="region" aria-label="Transport">
      <div className="cso-transport__inner">
        <div className="cso-transport__buttons">
          <button type="button" className="cso-tbtn" onClick={props.onRewind} aria-label="Retour au début">
            <SkipBack aria-hidden size={18} /><span className="cso-tbtn__text">Début</span>
          </button>
          <button type="button" className="cso-tbtn cso-tbtn--play" onClick={props.onPlay} disabled={!audioReady}
            aria-label={playLabel} aria-pressed={transport === "playing"}>
            {!audioReady ? <Loader2 aria-hidden size={20} className="cso-spin" /> : transport === "playing" ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}
            <span className="cso-tbtn__text">{playLabel}</span>
          </button>
          <button type="button" className="cso-tbtn" onClick={props.onStop} aria-label="Arrêt" disabled={transport === "stopped"}>
            <Square aria-hidden size={16} /><span className="cso-tbtn__text">Arrêt</span>
          </button>
          <button type="button" className={`cso-tbtn ${loop ? "is-on" : ""}`} onClick={props.onLoop} aria-pressed={loop} aria-label="Boucle">
            <Repeat aria-hidden size={18} /><span className="cso-tbtn__text">Boucle{loop ? " active" : ""}</span>
          </button>
        </div>
        <div className="cso-transport__status">
          <span className={`cso-state cso-state--${transport}`} role="status"><i aria-hidden className="cso-state__dot" />{stateLabel}</span>
          <span className="cso-transport__bar">
            <span className="cso-transport__caption">{transport === "stopped" ? "Sélection" : "Mesure jouée"}</span>
            <strong className="num">{currentBar}</strong><span className="cso-muted num">/ {totalBars}</span>
          </span>
          {loop ? <span className="cso-tag cso-tag--accent">Boucle</span> : null}
        </div>
        <div className="cso-transport__tempo">
          <label htmlFor="cso-tempo">Tempo</label>
          <span className="cso-tempo-field">
            <input id="cso-tempo" type="number" inputMode="numeric" min={40} max={200} value={tempo} aria-label="Tempo en BPM"
              onChange={(event) => props.onTempo(Number(event.target.value) || 72)} />
            <span aria-hidden>BPM</span>
          </span>
          <span className="cso-muted cso-transport__meter" aria-label={`Métrique ${meter}`}>{meter}</span>
        </div>
      </div>
    </div>
  );
}
