import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { NoticeTone } from "./labels";

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle } as const;
const TITLES: Record<NoticeTone, string> = { info: "Information", success: "Succès", warning: "Avertissement", error: "Erreur" };

interface NoticeProps {
  tone: NoticeTone;
  lines: string[];
  onDismiss?: () => void;
  compact?: boolean;
}

/** Feedback block: icon, written tone and text, so state never depends on colour alone. */
export function Notice({ tone, lines, onDismiss, compact }: NoticeProps) {
  const Icon = ICONS[tone];
  if (!lines.length) return null;
  return (
    <div className={`cso-notice cso-notice--${tone} ${compact ? "is-compact" : ""}`} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden size={18} className="cso-notice__icon" />
      <div className="cso-notice__body">
        <strong className="cso-notice__title">{TITLES[tone]}</strong>
        {lines.length === 1 ? <p>{lines[0]}</p> : <ul>{lines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>}
      </div>
      {onDismiss ? <button type="button" className="cso-icon-btn" onClick={onDismiss} aria-label="Fermer le message"><X aria-hidden size={16} /></button> : null}
    </div>
  );
}
