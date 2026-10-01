import type { KeyboardEvent } from "react";
import { FAMILIES, ROOTS } from "./types";

interface CircleProps {
  root: string;
  family: string;
  onRoot: (root: string) => void;
  onFamily: (family: string) => void;
  /** Optional readout drawn in the centre of the circle. */
  symbol?: string;
}

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const point = (radius: number, angle: number) =>
    [Math.round(cx + radius * Math.cos(angle)), Math.round(cy + radius * Math.sin(angle))];
  const [x0, y0] = point(r1, a0);
  const [x1, y1] = point(r1, a1);
  const [x2, y2] = point(r0, a1);
  const [x3, y3] = point(r0, a0);
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

const GROUPS = ["Majeur", "Mineur", "Dominante", "Suspendu", "Diminué"] as const;

function activate(event: KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
}

export function Circle({ root, family, onRoot, onFamily, symbol }: CircleProps) {
  const group = FAMILIES.find((item) => item.id === family)?.group ?? "Majeur";
  const rootIndex = Math.max(0, ROOTS.indexOf(root as (typeof ROOTS)[number]));
  const stepRoot = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return activate(event, () => onRoot(ROOTS[index]));
    event.preventDefault();
    const next = (index + delta + 12) % 12;
    onRoot(ROOTS[next]);
    (event.currentTarget.parentNode?.querySelectorAll<SVGGElement>("[data-root]")[next])?.focus();
  };
  return (
    <svg className="cso-circle" viewBox="0 0 360 360" role="group" aria-label="Cercle harmonique : fondamentale et famille">
      <g role="radiogroup" aria-label="Fondamentale">
        {ROOTS.map((name, index) => {
          const start = -Math.PI / 2 + (index * Math.PI * 2) / 12;
          const end = start + (Math.PI * 2) / 12;
          const mid = (start + end) / 2;
          const selected = name === root;
          return (
            <g key={name} data-root={name} className={`cso-wedge cso-wedge--root ${selected ? "is-selected" : ""}`}
              role="radio" aria-checked={selected} aria-label={`Fondamentale ${name}`} tabIndex={index === rootIndex ? 0 : -1}
              onClick={() => onRoot(name)} onKeyDown={(event) => stepRoot(event, index)}>
              <path d={wedge(180, 180, 118, 174, start + 0.008, end - 0.008)} />
              <text x={Math.round(180 + Math.cos(mid) * 146)} y={Math.round(180 + Math.sin(mid) * 146)} textAnchor="middle" dominantBaseline="central">
                {name}
              </text>
            </g>
          );
        })}
      </g>
      <g role="radiogroup" aria-label="Groupe de familles">
        {GROUPS.map((name, index) => {
          const start = -Math.PI / 2 + (index * Math.PI * 2) / GROUPS.length;
          const end = start + (Math.PI * 2) / GROUPS.length;
          const mid = (start + end) / 2;
          const selected = name === group;
          const first = FAMILIES.find((item) => item.group === name);
          return (
            <g key={name} className={`cso-wedge cso-wedge--group ${selected ? "is-selected" : ""}`}
              role="radio" aria-checked={selected} aria-label={`Groupe ${name}`} tabIndex={0}
              onClick={() => first && onFamily(first.id)} onKeyDown={(event) => activate(event, () => first && onFamily(first.id))}>
              <path d={wedge(180, 180, 66, 112, start + 0.012, end - 0.012)} />
              <text x={Math.round(180 + Math.cos(mid) * 89)} y={Math.round(180 + Math.sin(mid) * 89)} textAnchor="middle" dominantBaseline="central">
                {name}
              </text>
            </g>
          );
        })}
      </g>
      <circle className="cso-circle__core" cx="180" cy="180" r="60" />
      {symbol ? (
        <text className="cso-circle__symbol" x="180" y="180" textAnchor="middle" dominantBaseline="central" aria-live="polite"
          style={{ fontSize: symbol.length > 9 ? 17 : symbol.length > 6 ? 21 : 26 }}>
          {symbol}
        </text>
      ) : null}
    </svg>
  );
}
