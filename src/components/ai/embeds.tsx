"use client";

import { useMemo, useState } from "react";
import katex from "katex";
import { FileText, ExternalLink } from "lucide-react";

/* ---------- Equation (LaTeX via KaTeX) ---------- */

export function EquationEmbed({ latex, caption }: { latex: string; caption?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      }),
    [latex],
  );

  return (
    <div className="my-2 rounded-xl border border-border bg-card p-4 shadow-soft animate-fade-up">
      <div
        className="text-[15px] overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption && (
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {caption}
        </p>
      )}
    </div>
  );
}

/* ---------- Graph (inline SVG line chart) ---------- */

export interface GraphData {
  title: string;
  xLabel: string;
  yLabel: string;
  points: { x: number; y: number; label?: string }[];
}

export function GraphEmbed({ data }: { data: GraphData }) {
  const w = 320;
  const h = 170;
  const pad = { top: 14, right: 12, bottom: 28, left: 34 };

  const xs = data.points.map((p) => p.x);
  const ys = data.points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = Math.max(...ys) * 1.1;

  const sx = (x: number) =>
    pad.left + ((x - xMin) / (xMax - xMin || 1)) * (w - pad.left - pad.right);
  const sy = (y: number) =>
    h - pad.bottom - ((y - yMin) / (yMax - yMin || 1)) * (h - pad.top - pad.bottom);

  const path = data.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <div className="my-2 rounded-xl border border-border bg-card p-4 shadow-soft animate-fade-up">
      <p className="text-xs font-semibold mb-2">{data.title}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        role="img"
        aria-label={data.title}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={w - pad.right}
            y1={sy(yMax * f)}
            y2={sy(yMax * f)}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={h - pad.bottom}
          y2={h - pad.bottom}
          stroke="var(--border-strong)"
        />
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={h - pad.bottom}
          stroke="var(--border-strong)"
        />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {data.points.map((p) => (
          <g key={`${p.x}-${p.y}`}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="3" fill="var(--accent)" />
            {p.label && (
              <text
                x={sx(p.x)}
                y={h - pad.bottom + 14}
                textAnchor="middle"
                fontSize="8"
                fill="var(--muted-foreground)"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
        <text
          x={(w + pad.left - pad.right) / 2}
          y={h - 2}
          textAnchor="middle"
          fontSize="8"
          fill="var(--faint)"
        >
          {data.xLabel}
        </text>
        <text
          x={10}
          y={(h + pad.top - pad.bottom) / 2}
          textAnchor="middle"
          fontSize="8"
          fill="var(--faint)"
          transform={`rotate(-90 10 ${(h + pad.top - pad.bottom) / 2})`}
        >
          {data.yLabel}
        </text>
      </svg>
    </div>
  );
}

/* ---------- Interactive density bottle ---------- */

function seededPositions(count: number) {
  const positions: { x: number; y: number }[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    positions.push({ x: 22 + rand() * 76, y: 34 + rand() * 96 });
  }
  return positions;
}

export function DensityWidget() {
  const [particles, setParticles] = useState(40);
  const volume = 0.5; // L
  const particleMass = 0.4; // g each
  const mass = particles * particleMass;
  const density = mass / volume;

  const positions = useMemo(() => seededPositions(particles), [particles]);

  return (
    <div className="my-2 rounded-xl border border-border bg-card p-4 shadow-soft animate-fade-up">
      <p className="text-xs font-semibold">Density explorer</p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Drag the slider to add particles to the bottle and watch the density
        change.
      </p>

      <div className="flex items-center gap-5">
        <svg viewBox="0 0 120 150" className="w-24 shrink-0" aria-label="Bottle of particles">
          <path
            d="M48 6 h24 v14 c14 8 22 20 22 36 v72 a12 12 0 0 1 -12 12 H38 a12 12 0 0 1 -12 -12 V56 c0 -16 8 -28 22 -36 z"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          {positions.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.2"
              fill="var(--accent)"
              opacity="0.75"
            />
          ))}
        </svg>

        <div className="flex-1 space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Particles</span>
              <span className="font-semibold text-foreground">{particles}</span>
            </div>
            <input
              type="range"
              min={5}
              max={90}
              value={particles}
              onChange={(e) => setParticles(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">Mass</p>
              <p className="text-xs font-bold tabular-nums">{mass.toFixed(1)} g</p>
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">Volume</p>
              <p className="text-xs font-bold tabular-nums">{volume.toFixed(1)} L</p>
            </div>
            <div className="rounded-lg bg-energy-soft px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">Density</p>
              <p className="text-xs font-bold tabular-nums text-energy">
                {density.toFixed(1)} g/L
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- PDF citation ---------- */

export interface CitationData {
  source: string;
  page: number;
  quote: string;
}

export function CitationEmbed({ data }: { data: CitationData }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card shadow-soft overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/60 border-b border-border">
        <FileText className="h-3.5 w-3.5 text-rose shrink-0" />
        <span className="text-[11px] font-semibold truncate">{data.source}</span>
        <span className="text-[11px] text-faint shrink-0">p. {data.page}</span>
        <ExternalLink className="h-3 w-3 text-faint ml-auto shrink-0" />
      </div>
      <blockquote className="px-3.5 py-2.5 text-xs text-muted-foreground border-l-2 border-accent/40 m-2 bg-accent-soft/40 rounded-r-lg">
        “{data.quote}”
      </blockquote>
    </div>
  );
}
