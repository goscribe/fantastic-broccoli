"use client";

import { useId, useMemo } from "react";
import "./my-notes.css";
import type { SketchColor, SketchSpec } from "@/lib/api/my-notes";
import { LabelPlacer, around, regionBetween, sketchDrawable, sketchSamples, spread, textWidth, type Box, type Pt } from "@/lib/sketch";

/**
 * A `/diagram` sketch: a schematic graph as in a textbook (AD–AS, supply and
 * demand, a v–t graph, an energy profile) drawn from its spec. No numbers on
 * the axes: positions are named by marks and by dashed guides from points.
 * One font, two sizes, neutral ink; colour only tells curves apart (a pale
 * fill of the same hue shades a region). Labels are placed here, clear of the
 * curves and of each other.
 */

const W = 400;
const PLOT_H = 230;
const LABEL = 14;
const SMALL = 12;

const hue = (c: SketchColor) => `var(--sk-${c})`;
const fill = (c: SketchColor) => `var(--sk-${c}-fill)`;

interface Drawn {
  frame: { l: number; r: number; t: number; b: number };
  height: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  axisX: number;
  axisY: number;
  curves: { id: string; color: SketchColor; dashed: boolean; path: string; samples: Pt[] }[];
  regions: { color: SketchColor; path: string; centre: Pt; label: string | null }[];
  labels: { text: string; x: number; y: number; size: number; color: string; anchor: "start" | "middle" | "end" }[];
  /** Thin lines from a region's middle to its name, when the name sits outside it. */
  leaders: [number, number, number, number][];
}

const pathOf = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

function centroid(pts: Pt[]): Pt {
  // Area-weighted centroid of a polygon (falls back to the mean of its corners).
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-6) return [pts.reduce((n, p) => n + p[0], 0) / pts.length, pts.reduce((n, p) => n + p[1], 0) / pts.length];
  return [cx / (3 * a), cy / (3 * a)];
}

/** The point a fraction of the way along a polyline (by length), and the line's direction there. */
function alongPolyline(pts: Pt[], f: number): { x: number; y: number; angle: number } | null {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((n, l) => n + l, 0);
  if (!total) return null;
  let left = total * f;
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, left / lens[i]) : 0;
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, angle: Math.atan2(y1 - y0, x1 - x0) };
    }
    left -= lens[i];
  }
  return null;
}

function draw(s: SketchSpec): Drawn {
  const { left, right, bottom, top } = s.bounds;
  const yMarks = s.marks.filter((m) => m.axis === "y").map((m) => m.label).concat(s.points.map((p) => p.yGuide ?? ""));
  const xMarked = s.marks.some((m) => m.axis === "x") || s.points.some((p) => p.xGuide);
  const widest = Math.max(0, ...yMarks.map((t) => (t ? textWidth(t, SMALL) : 0)));
  const frame = s.axes
    ? { l: Math.min(96, Math.max(22, widest + 14)), r: 18, t: 30, b: xMarked ? 46 : 30 }
    : { l: 14, r: 14, t: 12, b: 12 };
  const height = frame.t + PLOT_H + frame.b;
  const sx = (x: number) => frame.l + ((x - left) / (right - left)) * (W - frame.l - frame.r);
  const sy = (y: number) => frame.t + PLOT_H - ((y - bottom) / (top - bottom)) * PLOT_H;
  const axisX = sx(left <= 0 && right >= 0 ? 0 : left);
  const axisY = sy(bottom <= 0 && top >= 0 ? 0 : bottom);
  const baseY = bottom <= 0 && top >= 0 ? 0 : bottom;

  const samples = new Map(s.curves.map((c) => [c.id, sketchSamples(c.points, c.smooth)]));
  const toScreen = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [sx(x), sy(y)]);
  const curves = s.curves.map((c) => {
    const screen = toScreen(samples.get(c.id)!);
    return { id: c.id, color: c.color, dashed: c.dashed, path: pathOf(screen), samples: screen };
  });
  const regions = s.regions.flatMap((r) => {
    let pts: Pt[] = [];
    if (r.polygon) pts = r.polygon.map((p) => [p.x, p.y]);
    else if (r.between) {
      const upper = samples.get(r.between.upper);
      const lower = r.between.lower ? samples.get(r.between.lower) : null;
      if (upper && lower !== undefined) pts = regionBetween(upper, lower, r.between.from, r.between.to, baseY);
    }
    if (pts.length < 3) return [];
    const screen = toScreen(pts);
    return [{ color: r.color, path: `${pathOf(screen)} Z`, centre: centroid(screen), label: r.label }];
  });

  // Every drawn line, densely sampled, so a label can tell what it would cover.
  const ink: Pt[] = [];
  const trace = (pts: Pt[]) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let k = 0; k <= n; k++) ink.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
  };
  curves.forEach((c) => trace(c.samples));
  s.arrows.forEach((a) => trace([[sx(a.from.x), sy(a.from.y)], [sx(a.to.x), sy(a.to.y)]]));
  for (const p of s.points) {
    if (p.xGuide !== null) trace([[sx(p.x), sy(p.y)], [sx(p.x), axisY]]);
    if (p.yGuide !== null) trace([[sx(p.x), sy(p.y)], [axisX, sy(p.y)]]);
  }
  if (s.axes) {
    trace([[frame.l, axisY], [W - frame.r, axisY]]);
    trace([[axisX, frame.t], [axisX, frame.t + PLOT_H]]);
  }

  const placer = new LabelPlacer({ x: 2, y: 2, w: W - 4, h: height - 4 }, ink);
  const labels: Drawn["labels"] = [];
  const leaders: Drawn["leaders"] = [];
  const put = (b: Box, text: string, size: number, color: string) => labels.push({ text, x: b.x + b.w / 2, y: b.y + b.h / 2 + size * 0.36, size, color, anchor: "middle" });

  // Axis names and marks first: they have fixed places.
  if (s.axes) {
    labels.push({ text: s.yLabel, x: Math.max(4, axisX - 6), y: 16, size: SMALL, color: "var(--muted-foreground, #5c5c68)", anchor: "start" });
    placer.reserve({ x: Math.max(4, axisX - 6), y: 4, w: textWidth(s.yLabel, SMALL), h: 16 });
    const xName = { x: W - frame.r - textWidth(s.xLabel, SMALL), y: height - 18, w: textWidth(s.xLabel, SMALL), h: 16 };
    labels.push({ text: s.xLabel, x: W - frame.r, y: height - 6, size: SMALL, color: "var(--muted-foreground, #5c5c68)", anchor: "end" });
    placer.reserve(xName);
    // The same mark twice at one place (two points above Q₁) is written once.
    const once = (ms: { at: number; text: string }[]) => ms.filter((m, i) => !ms.slice(0, i).some((o) => o.text === m.text && Math.abs(o.at - m.at) < 3));
    const xm = once([...s.marks.filter((m) => m.axis === "x").map((m) => ({ at: sx(m.at), text: m.label })), ...s.points.filter((p) => p.xGuide).map((p) => ({ at: sx(p.x), text: p.xGuide! }))]);
    const xPos = spread(xm.map((m) => ({ at: m.at, size: textWidth(m.text, SMALL) })), 2, W - 2);
    xm.forEach((m, i) => {
      labels.push({ text: m.text, x: xPos[i], y: axisY + 17, size: SMALL, color: "var(--foreground, #16161a)", anchor: "middle" });
      placer.reserve({ x: xPos[i] - textWidth(m.text, SMALL) / 2, y: axisY + 5, w: textWidth(m.text, SMALL), h: 15 });
    });
    const ym = once([...s.marks.filter((m) => m.axis === "y").map((m) => ({ at: sy(m.at), text: m.label })), ...s.points.filter((p) => p.yGuide).map((p) => ({ at: sy(p.y), text: p.yGuide! }))]);
    const yPos = spread(ym.map((m) => ({ at: m.at, size: 15 })), frame.t - 6, height - 4);
    ym.forEach((m, i) => {
      labels.push({ text: m.text, x: axisX - 6, y: yPos[i] + 4, size: SMALL, color: "var(--foreground, #16161a)", anchor: "end" });
      placer.reserve({ x: axisX - 6 - textWidth(m.text, SMALL), y: yPos[i] - 8, w: textWidth(m.text, SMALL), h: 15 });
    });
  }
  for (const p of s.points) placer.reserve({ x: sx(p.x) - 5, y: sy(p.y) - 5, w: 10, h: 10 });
  const H_LABEL = LABEL + 6;
  const H_SMALL = SMALL + 5;
  const GAP = 6;
  for (const t of s.texts) {
    const w = textWidth(t.text, LABEL);
    const x = sx(t.x);
    const y = sy(t.y);
    // Where the model put it, unless that sits on a line: then just beside it.
    put(placer.place([{ x: x - w / 2, y: y - H_LABEL / 2, w, h: H_LABEL }, ...around(x, y, w, H_LABEL, 2, -Math.PI / 2)]), t.text, LABEL, "var(--foreground, #16161a)");
  }

  // Curve names at the end of each curve, in its colour; further along the curve when the end is crowded.
  s.curves.forEach((c, i) => {
    if (!c.label) return;
    const pts = curves[i].samples;
    const [ex, ey] = pts[pts.length - 1];
    const [px, py] = pts[Math.max(0, pts.length - 4)];
    const w = textWidth(c.label, LABEL);
    const candidates = around(ex, ey, w, H_LABEL, 4, Math.atan2(ey - py, ex - px));
    for (const f of [0.85, 0.7, 0.15]) {
      const at = alongPolyline(pts, f);
      if (!at) continue;
      const normal = at.angle - Math.PI / 2;
      candidates.push(...around(at.x, at.y, w, H_LABEL, GAP, normal).slice(0, 1), ...around(at.x, at.y, w, H_LABEL, GAP, normal + Math.PI).slice(0, 1));
    }
    put(placer.place(candidates), c.label, LABEL, hue(c.color));
  });
  for (const p of s.points) {
    if (!p.label) continue;
    const w = textWidth(p.label, LABEL);
    put(placer.place(around(sx(p.x), sy(p.y), w, H_LABEL, 5, -Math.PI / 4)), p.label, LABEL, "var(--foreground, #16161a)");
  }
  for (const a of s.arrows) {
    if (!a.label) continue;
    const x1 = sx(a.from.x);
    const y1 = sy(a.from.y);
    const x2 = sx(a.to.x);
    const y2 = sy(a.to.y);
    const w = textWidth(a.label, SMALL);
    const normal = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const side = Math.sin(normal) > 0.01 ? normal + Math.PI : normal; // above (or left) first
    put(placer.place([...around(mx, my, w, H_SMALL, GAP, side), ...around(x2, y2, w, H_SMALL, GAP, Math.atan2(y2 - y1, x2 - x1))]), a.label, SMALL, "var(--foreground, #16161a)");
  }
  // A region's name inside it when it fits, else beside it with a thin leader to its middle.
  for (const r of regions) {
    if (!r.label) continue;
    const w = textWidth(r.label, LABEL);
    const [cx, cy] = r.centre;
    const b = placer.place([{ x: cx - w / 2, y: cy - H_LABEL / 2, w, h: H_LABEL }, ...around(cx, cy, w, H_LABEL, 30, -Math.PI / 4), ...around(cx, cy, w, H_LABEL, 56, -Math.PI / 4)]);
    put(b, r.label, LABEL, "var(--foreground, #16161a)");
    const inside = cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
    if (!inside) {
      const ex = Math.max(b.x, Math.min(b.x + b.w, cx));
      const ey = Math.max(b.y + 3, Math.min(b.y + b.h - 3, cy));
      leaders.push([cx, cy, ex, ey]);
    }
  }
  return { frame, height, sx, sy, axisX, axisY, curves, regions, labels, leaders };
}

export function SketchFigure({ sketch, title, alt }: { sketch: SketchSpec; title: string; alt: string }) {
  const id = useId().replace(/:/g, "");
  const d = useMemo(() => (sketchDrawable(sketch) ? draw(sketch) : null), [sketch]);
  if (!d) return <p className="rounded-2xl bg-muted px-4 py-6 text-center text-ui text-muted-foreground">This sketch can&apos;t be drawn. Describe it again to redraw it.</p>;
  const { sx, sy, axisX, axisY, frame, height } = d;
  const line = "var(--sk-line)";
  const guide = "var(--sk-guide)";
  const head = `sk-head-${id}`;
  const axisHead = `sk-axis-${id}`;
  const clip = `sk-clip-${id}`;

  return (
    <div className="sk rounded-2xl border border-border bg-card px-3 pb-3 pt-3 sm:px-4">
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
          <circle key={`p${i}`} cx={sx(p.x)} cy={sy(p.y)} r="4" fill="var(--foreground, #16161a)" stroke="var(--card, #fff)" strokeWidth="1.5" />
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
