"use client";

import { useId, useMemo } from "react";
import { niceStep, parseExpression, sampleCurve, type ParsedExpression } from "@/lib/latex-eval";
import type { NoteFigure } from "@/lib/api/notes";
import { InlineMarkdown } from "@/components/ui/markdown-text";
import { tidyMath } from "@/lib/notes";

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6B7280"];
const W = 400;
const H = 260;
const M = { l: 44, r: 14, t: 26, b: 40 };

const fmt = (v: number, step: number) => {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return Number(v.toFixed(Math.min(d, 4))).toString();
};

/**
 * Static SVG plot for a note's graph figure: crisp at phone width, no
 * external script, legend under the plot so labels never collide. Returns
 * null when an expression is outside the supported LaTeX subset, so the
 * caller can fall back to the interactive Desmos graph.
 */
export function NoteGraph({ graph, title }: { graph: NonNullable<NoteFigure["graph"]>; title: string }) {
  const clipId = `plot-${useId().replace(/:/g, "")}`;
  const parsed = useMemo(() => graph.expressions.map((e) => ({ e, p: parseExpression(e.latex) })), [graph.expressions]);
  if (parsed.some((x) => !x.p)) return null;

  const items = parsed as { e: (typeof graph.expressions)[number]; p: ParsedExpression }[];
  const points = items.filter((i) => i.p.kind === "point");
  const win = graph.bounds ?? guessBounds(items.map((i) => i.p));
  const sx = (x: number) => M.l + ((x - win.left) / (win.right - win.left)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((y - win.bottom) / (win.top - win.bottom)) * (H - M.t - M.b);
  const xs = niceStep(win.right - win.left, 6);
  const ys = niceStep(win.top - win.bottom, 5);
  const ticks = (lo: number, hi: number, st: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st / 1e6 ? 0 : v);
    return out;
  };
  const x0 = win.left <= 0 && win.right >= 0 ? sx(0) : sx(win.left);
  const y0 = win.bottom <= 0 && win.top >= 0 ? sy(0) : sy(win.bottom);
  let ci = 0;
  const colored = items.map((i) => ({ ...i, color: i.p.kind === "point" ? "var(--foreground, #131118)" : COLORS[ci++ % COLORS.length] }));
  const legend = colored.filter((c) => c.p.kind !== "point" && c.e.label);

  return (
    <div className="rounded-2xl border border-border bg-card px-3 pb-3 pt-3 sm:px-4">
      <p className="px-1 text-[14px] font-semibold">
        <InlineMarkdown text={tidyMath(title)} />
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} className="mx-auto mt-1 block max-w-[560px] font-sans">
        <text x={M.l - 6} y={14} fontSize="13" fill="var(--muted-foreground, #605c6d)">{graph.yLabel}</text>
        {ticks(win.left, win.right, xs).map((v, i) => (
          <g key={`x${i}`}>
            <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={H - M.b} stroke="var(--border, #e8e5f0)" strokeWidth="1" />
            <text x={sx(v)} y={H - M.b + 16} fontSize="12" textAnchor="middle" fill="var(--muted-foreground, #605c6d)">
              {fmt(v, xs)}
            </text>
          </g>
        ))}
        {ticks(win.bottom, win.top, ys).map((v, i) => (
          <g key={`y${i}`}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--border, #e8e5f0)" strokeWidth="1" />
            <text x={M.l - 6} y={sy(v) + 4} fontSize="12" textAnchor="end" fill="var(--muted-foreground, #605c6d)">
              {fmt(v, ys)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y0} y2={y0} stroke="var(--muted-foreground, #605c6d)" strokeWidth="1.5" />
        <line x1={x0} x2={x0} y1={M.t} y2={H - M.b} stroke="var(--muted-foreground, #605c6d)" strokeWidth="1.5" />
        <text x={W - M.r} y={H - 6} fontSize="13" textAnchor="end" fill="var(--muted-foreground, #605c6d)">{graph.xLabel}</text>
        <clipPath id={clipId}>
          <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {colored.map((c, k) => {
            if (c.p.kind === "curve")
              return sampleCurve(c.p.f, c.p.domain, win).map((run, r) => (
                <polyline
                  key={`${k}-${r}`}
                  points={run.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={c.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              ));
            if (c.p.kind === "vertical") {
              const lo = Math.max(win.bottom, c.p.domain?.[0] ?? -Infinity);
              const hi = Math.min(win.top, c.p.domain?.[1] ?? Infinity);
              return <line key={k} x1={sx(c.p.x)} x2={sx(c.p.x)} y1={sy(lo)} y2={sy(hi)} stroke={c.color} strokeWidth="2" strokeDasharray="5 4" />;
            }
            return null;
          })}
          {points.map((pt, k) =>
            pt.p.kind === "point" ? <circle key={k} cx={sx(pt.p.x)} cy={sy(pt.p.y)} r="4" fill="var(--foreground, #131118)" /> : null,
          )}
        </g>
      </svg>
      {(legend.length > 0 || points.some((p) => p.e.label)) && (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] leading-snug text-muted-foreground">
          {legend.map((c, k) => (
            <li key={`c${k}`} className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: c.color }} />
              <span>
                <InlineMarkdown text={tidyMath(c.e.label ?? "")} />
              </span>
            </li>
          ))}
          {points
            .filter((p) => p.e.label)
            .map((p, k) => (
              <li key={`p${k}`} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full bg-foreground" />
                <span>
                  <InlineMarkdown text={tidyMath(p.e.label ?? "")} />
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function guessBounds(ps: ParsedExpression[]) {
  const xsAll = ps.flatMap((p) => (p.kind === "point" ? [p.x] : p.kind === "vertical" ? [p.x] : p.domain ? p.domain.filter(Number.isFinite) : []));
  const left = xsAll.length ? Math.min(0, ...xsAll) : -10;
  const right = xsAll.length ? Math.max(...xsAll) + 1 : 10;
  const ys: number[] = [];
  for (const p of ps) {
    if (p.kind === "point") ys.push(p.y);
    if (p.kind === "curve") for (let i = 0; i <= 50; i++) {
      const y = p.f(left + ((right - left) * i) / 50);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  const bottom = ys.length ? Math.min(0, ...ys) : -6;
  const top = ys.length ? Math.max(...ys) * 1.1 + 0.1 : 6;
  return { left, right, bottom, top };
}

/** Whether every expression is in the subset NoteGraph can draw. */
export const graphSupported = (graph: NonNullable<NoteFigure["graph"]>) =>
  graph.expressions.length > 0 && graph.expressions.every((e) => parseExpression(e.latex) !== null);
