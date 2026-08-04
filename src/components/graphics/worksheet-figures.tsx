import { WorksheetFigure } from "@/types";

function EnergyLevelsDiagram() {
  return (
    <svg viewBox="0 0 300 170" className="w-full" aria-hidden>
      <rect width="300" height="170" fill="#ffffff" />
      {/* axis */}
      <line x1="34" y1="14" x2="34" y2="150" stroke="#62655c" strokeWidth="1.4" />
      <path d="M34 14l-4 8h8z" fill="#62655c" />
      <text x="14" y="86" fontSize="9" fill="#62655c" transform="rotate(-90 14 86)">
        Energy
      </text>
      {/* levels */}
      {[
        { y: 132, label: "1s", w: 44 },
        { y: 104, label: "2s", w: 44 },
        { y: 88, label: "2p", w: 84 },
        { y: 58, label: "3s", w: 44 },
        { y: 42, label: "3p", w: 84 },
      ].map((l) => (
        <g key={l.label}>
          <line x1="58" y1={l.y} x2={58 + l.w} y2={l.y} stroke="#14170f" strokeWidth="2" />
          <text x={58 + l.w + 8} y={l.y + 3.5} fontSize="10" fontWeight="600" fill="#14170f">
            {l.label}
          </text>
        </g>
      ))}
      {/* electrons on 1s, 2s, partial 2p */}
      <path d="M70 128v-9M70 119l-3 4M70 119l3 4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
      <path d="M84 136v9M84 145l-3-4M84 145l3-4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
      <path d="M70 100v-9M70 91l-3 4M70 91l3 4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
      <path d="M84 108v9M84 117l-3-4M84 117l3-4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
      <path d="M70 84v-9M70 75l-3 4M70 75l3 4" stroke="var(--accent-bright)" strokeWidth="1.6" fill="none" />
      <path d="M98 84v-9M98 75l-3 4M98 75l3 4" stroke="var(--accent-bright)" strokeWidth="1.6" fill="none" />
      <path d="M126 84v-9M126 75l-3 4M126 75l3 4" stroke="var(--accent-bright)" strokeWidth="1.6" fill="none" />
      {/* aufbau arrow */}
      <path
        d="M226 140 C 258 120, 258 60, 230 34"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <path d="M230 34l8 1.5-4.5 6.5z" fill="var(--accent)" />
      <text x="238" y="146" fontSize="9" fill="var(--accent)" fontWeight="600">
        filling order
      </text>
    </svg>
  );
}

function IonizationTrendDiagram() {
  const pts = [
    [50, 118],
    [78, 96],
    [106, 108],
    [134, 84],
    [162, 92],
    [190, 68],
    [218, 46],
    [246, 30],
  ];
  return (
    <svg viewBox="0 0 300 170" className="w-full" aria-hidden>
      <rect width="300" height="170" fill="#ffffff" />
      <line x1="40" y1="16" x2="40" y2="140" stroke="#62655c" strokeWidth="1.4" />
      <line x1="40" y1="140" x2="280" y2="140" stroke="#62655c" strokeWidth="1.4" />
      <text x="16" y="86" fontSize="9" fill="#62655c" transform="rotate(-90 16 86)">
        IE₁ / kJ mol⁻¹
      </text>
      {["Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar"].map((el, i) => (
        <text key={el} x={pts[i][0] - 6} y="154" fontSize="9" fill="#62655c">
          {el}
        </text>
      ))}
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={i === 2 || i === 4 ? "#e05252" : "var(--accent)"} />
      ))}
      <text x="96" y="126" fontSize="9" fill="#e05252" fontWeight="600">
        dip
      </text>
      <text x="152" y="110" fontSize="9" fill="#e05252" fontWeight="600">
        dip
      </text>
    </svg>
  );
}

function AtomShellsDiagram() {
  return (
    <svg viewBox="0 0 300 170" className="w-full" aria-hidden>
      <rect width="300" height="170" fill="#ffffff" />
      <circle cx="150" cy="85" r="12" fill="#14170f" />
      <text x="150" y="89" fontSize="9" fill="#ffffff" textAnchor="middle" fontWeight="700">
        11p
      </text>
      {[30, 52, 74].map((r) => (
        <circle key={r} cx="150" cy="85" r={r} fill="none" stroke="#d7d7cd" strokeWidth="1.4" />
      ))}
      {/* electrons: 2, 8, 1 */}
      {[0, 180].map((a) => (
        <circle
          key={`s1-${a}`}
          cx={150 + 30 * Math.cos((a * Math.PI) / 180)}
          cy={85 + 30 * Math.sin((a * Math.PI) / 180)}
          r="4"
          fill="var(--accent)"
        />
      ))}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle
          key={`s2-${a}`}
          cx={150 + 52 * Math.cos((a * Math.PI) / 180)}
          cy={85 + 52 * Math.sin((a * Math.PI) / 180)}
          r="4"
          fill="var(--accent-bright)"
        />
      ))}
      <circle cx="150" cy="11" r="4.5" fill="#e0a852" />
      <text x="162" y="14" fontSize="9" fill="#62655c">
        outer 3s electron
      </text>
      <text x="216" y="150" fontSize="9" fill="#62655c">
        Na — 2, 8, 1
      </text>
    </svg>
  );
}

const figures: Record<string, React.ElementType> = {
  "energy-levels": EnergyLevelsDiagram,
  "ionization-trend": IonizationTrendDiagram,
  "atom-shells": AtomShellsDiagram,
};

export function WorksheetFigureCard({ data }: { data: WorksheetFigure }) {
  const Figure = figures[data.figure];
  if (!Figure) return null;
  return (
    <figure className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="border-b border-border bg-muted/40 px-3.5 py-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">{data.title}</span>
        {data.source && (
          <span className="text-[11px] text-faint shrink-0">
            from {data.source.file} · p. {data.source.page}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        <Figure />
      </div>
      {data.caption && (
        <figcaption className="px-4 pb-3 text-xs text-muted-foreground">
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}
