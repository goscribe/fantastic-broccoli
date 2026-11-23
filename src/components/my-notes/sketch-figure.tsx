"use client";

import { useId, useMemo } from "react";
import type { SketchSpec } from "@/lib/api/my-notes";
import { figVar, figureDarkVars } from "@/lib/figure-tokens";
import { INK, PLOT_H, W, fill, hue, sketchLayout } from "@/lib/sketch-layout";
import { sketchDrawable } from "@/lib/sketch";

/**
 * A `/diagram` sketch: a schematic graph as in a textbook (AD–AS, supply and
 * demand, a v–t graph, an energy profile) drawn from its spec. No numbers on
 * the axes: positions are named by marks and by dashed guides from points.
 * One font, two sizes, neutral ink; colour only tells curves apart (a pale
 * fill of the same hue shades a region). Labels are placed here, clear of the
 * curves and of each other.
 */

/** Dark theme: the same tokens' dark values (light ones are the fallbacks). */
const DARK_CSS = `.dark .sk{${figureDarkVars()}}`;

export function SketchFigure({ sketch, title, alt }: { sketch: SketchSpec; title: string; alt: string }) {
  const id = useId().replace(/:/g, "");
  const d = useMemo(() => (sketchDrawable(sketch) ? sketchLayout(sketch) : null), [sketch]);
  if (!d) return <p className="rounded-2xl bg-muted px-4 py-6 text-center text-ui text-muted-foreground">This sketch can&apos;t be drawn. Describe it again to redraw it.</p>;
  const { sx, sy, axisX, axisY, frame, height } = d;
  const line = figVar("line");
  const guide = figVar("guide");
  const head = `sk-head-${id}`;
  const axisHead = `sk-axis-${id}`;
  const clip = `sk-clip-${id}`;

  return (
    <div className="sk rounded-2xl border border-border bg-card px-3 pb-3 pt-3 sm:px-4">
      <style>{DARK_CSS}</style>
      <p className="px-1 text-[14px] font-semibold">{title}</p>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={alt || title} className="mx-auto mt-2 block max-w-[520px] font-sans" fontWeight={600}>
        <defs>
          <marker id={head} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={line} />
          </marker>
          <marker id={axisHead} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9" fill="none" stroke={line} strokeWidth="1.6" />
          </marker>
          <clipPath id={clip}>
            <rect x={frame.l - 2} y={frame.t - 8} width={W - frame.l - frame.r + 10} height={PLOT_H + 10} />
          </clipPath>
        </defs>
        {d.regions.map((r, i) => (
          <path key={`r${i}`} d={r.path} fill={fill(r.color)} stroke="none" />
        ))}
        {sketch.points.map((p, i) => (
          <g key={`g${i}`} stroke={guide} strokeWidth="1.4" strokeDasharray="4 4">
            {p.xGuide !== null && <line x1={sx(p.x)} y1={sy(p.y)} x2={sx(p.x)} y2={axisY} />}
            {p.yGuide !== null && <line x1={sx(p.x)} y1={sy(p.y)} x2={axisX} y2={sy(p.y)} />}
          </g>
        ))}
        {sketch.axes && (
          <g stroke={line} strokeWidth="1.6" fill="none">
            <line x1={frame.l - 2} y1={axisY} x2={W - frame.r + 6} y2={axisY} markerEnd={`url(#${axisHead})`} />
            <line x1={axisX} y1={frame.t + PLOT_H + 2} x2={axisX} y2={frame.t - 8} markerEnd={`url(#${axisHead})`} />
          </g>
        )}
        <g clipPath={`url(#${clip})`} fill="none" strokeLinejoin="round" strokeLinecap="round">
          {d.curves.map((c) => (
            <path key={c.id} d={c.path} stroke={hue(c.color)} strokeWidth="2.5" strokeDasharray={c.dashed ? "7 5" : undefined} />
          ))}
        </g>
        {sketch.arrows.map((a, i) => (
          <line
            key={`a${i}`}
            x1={sx(a.from.x)}
            y1={sy(a.from.y)}
            x2={sx(a.to.x)}
            y2={sy(a.to.y)}
            stroke={line}
            strokeWidth="1.8"
            markerEnd={`url(#${head})`}
            markerStart={a.double ? `url(#${head})` : undefined}
          />
        ))}
        {d.leaders.map(([x1, y1, x2, y2], i) => (
          <line key={`ld${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={line} strokeWidth="1" />
        ))}
        {sketch.points.map((p, i) => (
          <circle key={`p${i}`} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={INK} stroke="var(--card, #fff)" strokeWidth="1.5" />
        ))}
        {d.labels.map((l, i) => (
          <text
            key={`l${i}`}
            x={l.x}
            y={l.y}
            fontSize={l.size}
            textAnchor={l.anchor}
            fill={l.color}
            // A card-coloured edge keeps a label readable where it meets a line.
            stroke="var(--card, #fff)"
            strokeWidth="4"
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
