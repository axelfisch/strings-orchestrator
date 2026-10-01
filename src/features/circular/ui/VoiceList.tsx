import { Lock, Music, Unlock } from "lucide-react";
import { RANGES } from "../theory";
import { VOICES, VOICE_LABELS, type SectionPlan, type VoiceName } from "../types";
import { ROLE_LABELS, VOICE_COLOR, pitchName } from "./labels";

interface VoiceListProps {
  plan: SectionPlan | undefined;
  lockedVoices: VoiceName[];
  onToggleLock: (voice: VoiceName) => void;
}

export function VoiceList({ plan, lockedVoices, onToggleLock }: VoiceListProps) {
  return (
    <ul className="cso-voices" aria-label={`Six voix${plan ? `, section ${plan.section}` : ""}`}>
      {VOICES.map((voice) => {
        const locked = lockedVoices.includes(voice);
        const role = plan?.roles[voice];
        const melody = plan?.melody === voice;
        const range = RANGES[voice];
        return (
          <li key={voice} className={`cso-voice ${locked ? "is-locked" : ""} ${melody ? "is-melody" : ""}`} style={{ ["--voice" as string]: VOICE_COLOR[voice] }}>
            <span className="cso-voice__swatch" aria-hidden />
            <span className="cso-voice__body">
              <span className="cso-voice__name">{VOICE_LABELS[voice]}</span>
              <span className="cso-voice__meta">
                {melody ? <span className="cso-tag cso-tag--melody"><Music aria-hidden size={12} />Mélodie</span> : <span>{role ? ROLE_LABELS[role] : "—"}</span>}
                <span className="cso-muted num">{pitchName(range.centralMin)}–{pitchName(range.centralMax)}</span>
              </span>
            </span>
            <button type="button" className={`cso-lock ${locked ? "is-on" : ""}`} aria-pressed={locked}
              aria-label={`${locked ? "Déverrouiller" : "Verrouiller"} ${VOICE_LABELS[voice]}`} onClick={() => onToggleLock(voice)}>
              {locked ? <Lock aria-hidden size={16} /> : <Unlock aria-hidden size={16} />}
              <span>{locked ? "Verrouillée" : "Libre"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
