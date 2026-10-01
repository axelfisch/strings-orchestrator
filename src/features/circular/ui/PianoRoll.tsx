import { memo } from "react";
import { RANGES } from "../theory";
import { VOICES, VOICE_LABELS, type Arrangement, type VoiceName } from "../types";
import { VOICE_COLOR, pitchName } from "./labels";

const LOW = 28;
const SPAN = 68;
const GUIDES = [36, 48, 60, 72, 84];
const toBottom = (midi: number) => Math.max(0, Math.min(100, ((midi - LOW) / SPAN) * 100));

interface PianoRollProps {
  arrangement: Arrangement;
  totalBeats: number;
  quarters: number;
  activeBar: number;
  playingBar: number | null;
  lockedVoices: VoiceName[];
}

/** Notes only; the playhead is drawn by the parent so this layer re-renders per bar, not per frame. */
const RollNotes = memo(function RollNotes({ arrangement, totalBeats, quarters, activeBar, playingBar, lockedVoices }: PianoRollProps) {
  const barWidth = (quarters / totalBeats) * 100;
  return (
    <>
      {arrangement.bars.map((bar, index) => (
        <div key={bar.number} aria-hidden
          className={`cso-roll__bar ${index === activeBar ? "is-selected" : ""} ${index === playingBar ? "is-playing" : ""} ${index % 4 === 0 ? "is-phrase" : ""}`}
          style={{ left: `${index * barWidth}%`, width: `${barWidth}%` }} />
      ))}
      {GUIDES.map((midi) => (
        <div key={midi} className="cso-roll__guide" style={{ bottom: `${toBottom(midi)}%` }} aria-hidden><span>{pitchName(midi)}</span></div>
      ))}
      {arrangement.notes.map((note, index) => {
        const live = playingBar !== null && note.bar === playingBar + 1;
        return (
          <div key={`${note.voice}-${index}`}
            className={`cso-pip ${note.role === "melody" ? "is-melody" : ""} ${lockedVoices.includes(note.voice) ? "is-locked" : ""} ${live ? "is-live" : ""} ${playingBar !== null && !live ? "is-dim" : ""}`}
            title={`${VOICE_LABELS[note.voice]} · ${pitchName(note.midi)} · mesure ${note.bar}`}
            style={{
              left: `${(note.start / totalBeats) * 100}%`,
              width: `${Math.max((note.duration / totalBeats) * 100, 0.25)}%`,
              bottom: `${toBottom(note.midi)}%`,
              background: VOICE_COLOR[note.voice],
            }} />
        );
      })}
    </>
  );
});

export function PianoRoll(props: PianoRollProps & { beat: number; showPlayhead: boolean }) {
  const { beat, showPlayhead, ...rest } = props;
  const count = props.arrangement.notes.length;
  return (
    <div className="cso-roll-wrap">
      <div className="cso-roll__registers" aria-hidden>
        {VOICES.map((voice) => {
          const range = RANGES[voice];
          return (
            <span key={voice} className="cso-roll__register" title={`${VOICE_LABELS[voice]} · zone centrale ${pitchName(range.centralMin)}–${pitchName(range.centralMax)}`}
              style={{ bottom: `${toBottom(range.centralMin)}%`, height: `${toBottom(range.centralMax) - toBottom(range.centralMin)}%`, background: VOICE_COLOR[voice] }} />
          );
        })}
      </div>
      <div className="cso-roll" role="img"
        aria-label={`Piano-roll des six voix : ${count} notes sur ${props.arrangement.bars.length} mesures${props.playingBar !== null ? `, mesure ${props.playingBar + 1} en lecture` : ""}.`}>
        {count ? <RollNotes {...rest} /> : <p className="cso-empty cso-roll__empty">Aucune note pour l’instant : générez la grille pour obtenir l’arrangement.</p>}
        {showPlayhead ? <div className="cso-roll__playhead" style={{ left: `${(beat / props.totalBeats) * 100}%` }} aria-hidden /> : null}
      </div>
    </div>
  );
}
