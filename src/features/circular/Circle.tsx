import { FAMILIES, ROOTS } from "./types";

interface CircleProps {
  root: string;
  family: string;
  onRoot: (root: string) => void;
  onFamily: (family: string) => void;
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

export function Circle({ root, family, onRoot, onFamily }: CircleProps) {
  const group = FAMILIES.find((item) => item.id === family)?.group ?? "Majeur";
  return (
    <svg className="cso-circle" viewBox="0 0 360 360" role="img" aria-label="Sélecteur circulaire des fondamentales">
      {ROOTS.map((name, index) => {
        const start = -Math.PI / 2 + (index * Math.PI * 2) / 12;
        const end = start + (Math.PI * 2) / 12;
        const mid = (start + end) / 2;
        const selected = name === root;
        return (
          <g key={name}>
            <path
              d={wedge(180, 180, 118, 172, start, end - 0.015)}
              fill={selected ? "#e8a45a" : "#121a2b"}
              stroke="#243044"
              onClick={() => onRoot(name)}
              style={{ cursor: "pointer" }}
            >
              <title>{name}</title>
            </path>
            <text x={Math.round(180 + Math.cos(mid) * 146)} y={Math.round(180 + Math.sin(mid) * 146)} textAnchor="middle" dominantBaseline="middle" fill={selected ? "#2a1c0c" : "#ece5d8"} fontSize="13" fontFamily="Barlow, sans-serif" pointerEvents="none">
              {name}
            </text>
          </g>
        );
      })}
      {GROUPS.map((name, index) => {
        const start = -Math.PI / 2 + (index * Math.PI * 2) / GROUPS.length;
        const end = start + (Math.PI * 2) / GROUPS.length;
        const mid = (start + end) / 2;
        const selected = name === group;
        const first = FAMILIES.find((item) => item.group === name);
        return (
          <g key={name}>
            <path
              d={wedge(180, 180, 62, 112, start, end - 0.02)}
              fill={selected ? "#ece5d8" : "#0b1220"}
              stroke="#243044"
              onClick={() => first && onFamily(first.id)}
              style={{ cursor: "pointer" }}
            >
              <title>{name}</title>
            </path>
            <text x={Math.round(180 + Math.cos(mid) * 86)} y={Math.round(180 + Math.sin(mid) * 86)} textAnchor="middle" dominantBaseline="middle" fill={selected ? "#050b16" : "#94a3b8"} fontSize="9" fontFamily="Barlow, sans-serif" pointerEvents="none">
              {name.slice(0, 3)}
            </text>
          </g>
        );
      })}
      <circle cx="180" cy="180" r="54" fill="#050b16" stroke="#243044" />
    </svg>
  );
}
