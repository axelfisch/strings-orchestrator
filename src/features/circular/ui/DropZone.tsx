import { useId, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";

interface DropZoneProps {
  title: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  busyLabel?: string;
  buttonLabel: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}

/** Drag-and-drop target plus a standard file picker. */
export function DropZone({ title, hint, accept, multiple, busy, busyLabel, buttonLabel, onFiles, children }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const inputId = useId();
  const hintId = useId();
  return (
    <div className={`cso-drop ${over ? "is-over" : ""} ${busy ? "is-busy" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); if (event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files)); }}>
      <div className="cso-drop__icon" aria-hidden>{busy ? <Loader2 className="cso-spin" size={22} /> : <Upload size={22} />}</div>
      <div className="cso-drop__text">
        <strong>{busy ? busyLabel ?? "Analyse en cours…" : title}</strong>
        <span id={hintId} className="cso-muted">{hint}</span>
      </div>
      <div className="cso-drop__actions">
        <input id={inputId} className="cso-visually-hidden" type="file" accept={accept} multiple={multiple} disabled={busy} aria-describedby={hintId}
          onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files); }} />
        <label htmlFor={inputId} className={`cso-btn ${busy ? "is-disabled" : ""}`}>{buttonLabel}</label>
        {children}
      </div>
    </div>
  );
}
