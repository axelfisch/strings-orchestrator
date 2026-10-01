import { useRef, type KeyboardEvent } from "react";
import { Lock, Play } from "lucide-react";
import type { ArrangementBar, ProjectBar, SectionId } from "../types";
import { ORIGIN_LABELS } from "./labels";

interface BarGridProps {
  bars: ArrangementBar[];
  projectBars: ProjectBar[];
  activeBar: number;
  playingBar: number | null;
  onSelect: (index: number) => void;
}

/** Harmonic grid grouped by section, with a roving focus so 32 bars cost one tab stop. */
export function BarGrid({ bars, projectBars, activeBar, playingBar, onSelect }: BarGridProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groups: { section: SectionId; texture: string; indexes: number[] }[] = [];
  bars.forEach((bar, index) => {
    const last = groups[groups.length - 1];
    if (last && last.section === bar.section) last.indexes.push(index);
    else groups.push({ section: bar.section, texture: bar.texture, indexes: [index] });
  });

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const columns = window.matchMedia("(max-width: 520px)").matches ? 2 : 4;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    let next: number | undefined;
    if (delta !== undefined) next = index + delta;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = bars.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const clamped = Math.max(0, Math.min(bars.length - 1, next));
    onSelect(clamped);
    refs.current[clamped]?.focus();
  };

  return (
    <div className="cso-grid" role="group" aria-label="Grille de mesures. Flèches pour naviguer.">
      {groups.map((group) => (
        <div className="cso-grid__section" key={`${group.section}-${group.indexes[0]}`}>
          <div className="cso-grid__head">
            <span className="cso-section-tag">{group.section}</span>
            <span className="cso-muted">Mesures {group.indexes[0] + 1}–{group.indexes[group.indexes.length - 1] + 1} · {group.texture}</span>
          </div>
          <div className="cso-grid__bars">
            {group.indexes.map((index) => {
              const bar = bars[index];
              const locked = projectBars[index]?.locked ?? false;
              const selected = index === activeBar;
              const playing = index === playingBar;
              const [first, second] = bar.harmonies;
              const description = [
                `Mesure ${bar.number}`,
                bar.harmonies.map((harmony) => harmony.symbol).join(" puis "),
                ORIGIN_LABELS[bar.origin],
                locked ? "verrouillée" : "",
                playing ? "en lecture" : "",
              ].filter(Boolean).join(", ");
              return (
                <button
                  key={bar.number}
                  ref={(node) => { refs.current[index] = node; }}
                  type="button"
                  className={`cso-bar ${selected ? "is-selected" : ""} ${playing ? "is-playing" : ""} ${locked ? "is-locked" : ""} origin-${bar.origin}`}
                  aria-pressed={selected}
                  aria-label={description}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSelect(index)}
                  onKeyDown={(event) => move(event, index)}
                >
                  <span className="cso-bar__top">
                    <span className="cso-bar__num num">{bar.number}</span>
                    <span className="cso-bar__flags" aria-hidden>
                      {playing ? <Play size={12} className="cso-bar__live" /> : null}
                      {locked ? <Lock size={12} /> : null}
                    </span>
                  </span>
                  <span className="cso-bar__chords">
                    <span className="cso-bar__chord">{first?.symbol ?? "—"}</span>
                    {second ? <span className="cso-bar__chord cso-bar__chord--second"><span className="cso-bar__half" aria-hidden>2</span>{second.symbol}</span> : null}
                  </span>
                  <span className="cso-bar__meta" aria-hidden>
                    {playing ? "En lecture" : locked ? "Verrouillée" : ORIGIN_LABELS[bar.origin]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
