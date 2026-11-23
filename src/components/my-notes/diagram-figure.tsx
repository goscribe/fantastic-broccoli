"use client";

import { useId, useMemo } from "react";
import { NoteGraph, graphSupported } from "@/components/notes/note-graph";
import type { DiagramFigure, DiagramSpec } from "@/lib/api/my-notes";
import { treeLevels, wrapLabel } from "@/lib/my-notes";

/**
 * A `/diagram` figure drawn from its spec: a plot through the note reader's
 * own NoteGraph (which evaluates the equations, so curves and points are
 * exact), or a labelled diagram laid out here from its nodes and arrows.
 * Nothing in a spec is markup: the app decides where every box and label
 * goes, so labels never overlap or leave the frame.
 */
export function DiagramFigureView({ figure }: { figure: DiagramFigure }) {
  if (figure.kind === "graph") {
    if (!graphSupported(figure.graph)) return <p className="rounded-2xl bg-muted px-4 py-6 text-center text-ui text-muted-foreground">This graph can&apos;t be drawn. Describe it again to redraw it.</p>;
    return <NoteGraph graph={figure.graph} title={figure.title} />;
  }
  return <LabelledDiagram diagram={figure.diagram} title={figure.title} alt={figure.alt} />;
}

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string[];
  detail: string[];
}

const W = 400;
const LINE = 18;
const DETAIL_LINE = 15;
const PAD = 11;

function sized(node: DiagramSpec["nodes"][number], w: number): Omit<Box, "x" | "y"> {
  // About 7.4 units per character at 14 (bold), 6.3 at 12.
  const label = wrapLabel(node.label, Math.max(6, Math.floor((w - 20) / 7.6)), 3);
  const detail = node.detail ? wrapLabel(node.detail, Math.max(8, Math.floor((w - 20) / 6.3)), 3) : [];
  return { id: node.id, w, h: PAD * 2 + label.length * LINE + (detail.length ? 3 + detail.length * DETAIL_LINE : 0), label, detail };
}

/** Where every box goes, and how tall the drawing is. */
function layout(d: DiagramSpec): { boxes: Box[]; height: number; mode: "flow" | "cycle" | "tree" } {
  const n = d.nodes.length;
  // A ring of more than six boxes does not fit a phone: draw it as a column whose last arrow returns to the top.
  if (d.layout === "cycle" && n >= 3 && n <= 6) {
    const w = n <= 4 ? 124 : 108;
    const parts = d.nodes.map((node) => sized(node, w));
    const tallest = Math.max(...parts.map((p) => p.h));
    const rx = (W - w) / 2 - 6;
    const ry = n <= 4 ? 96 + tallest / 2 : 128 + tallest / 2;
    const cy = ry + tallest / 2 + 8;
    const boxes = parts.map((p, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { ...p, x: W / 2 + rx * Math.cos(a) - p.w / 2, y: cy + ry * Math.sin(a) - p.h / 2 };
    });
    return { boxes, height: cy + ry + tallest / 2 + 8, mode: "cycle" };
  }
  if (d.layout === "tree") {
    const levels = treeLevels(d);
    const byId = new Map(d.nodes.map((node) => [node.id, node]));
    const boxes: Box[] = [];
    let y = 8;
    for (const row of levels) {
      const gap = 10;
      const w = Math.min(150, (W - 16 - gap * (row.length - 1)) / row.length);
      const parts = row.map((id) => sized(byId.get(id)!, w));
      const total = parts.length * w + gap * (parts.length - 1);
      const h = Math.max(...parts.map((p) => p.h));
      parts.forEach((p, i) => boxes.push({ ...p, x: (W - total) / 2 + i * (w + gap), y }));
      y += h + 46;
    }
    return { boxes, height: y - 46 + 8, mode: "tree" };
  }
  const w = 236;
  const boxes: Box[] = [];
  let y = 8;
  for (const node of d.nodes) {
    const p = sized(node, w);
    boxes.push({ ...p, x: (W - w) / 2 - 28, y });
    y += p.h + 44;
  }
  return { boxes, height: y - 44 + 8, mode: "flow" };
}

/** The point where the line from a box's centre towards (tx, ty) leaves the box. */
function edgeOf(b: Box, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const k = Math.min(dx === 0 ? Infinity : b.w / 2 / Math.abs(dx), dy === 0 ? Infinity : b.h / 2 / Math.abs(dy));
  return [cx + dx * k, cy + dy * k];
}

function LabelledDiagram({ diagram, title, alt }: { diagram: DiagramSpec; title: string; alt: string }) {
  const marker = `arrow-${useId().replace(/:/g, "")}`;
  const { boxes, height, mode } = useMemo(() => layout(diagram), [diagram]);
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const order = new Map(diagram.nodes.map((node, i) => [node.id, i]));
  const stroke = "var(--muted-foreground, #5c5c68)";

  return (
    <div className="rounded-2xl border border-border bg-card px-3 pb-3 pt-3 sm:px-4">
      <p className="px-1 text-[14px] font-semibold">{title}</p>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={alt || title} className="mx-auto mt-2 block max-w-[520px] font-sans">
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={stroke} />
          </marker>
        </defs>
        {diagram.edges.map((e, k) => {
          const from = byId.get(e.from);
          const to = byId.get(e.to);
          if (!from || !to) return null;
          const i = order.get(e.from) ?? 0;
          const j = order.get(e.to) ?? 0;
          let path: string;
          let lx: number;
          let ly: number;
          let anchor: "start" | "middle" = "middle";
          if (mode === "flow" && Math.abs(i - j) !== 1) {
            // A jump or a return goes round the right-hand side of the column.
            const x1 = from.x + from.w;
            const y1 = from.y + from.h / 2;
            const x2 = to.x + to.w;
            const y2 = to.y + to.h / 2;
            const bulge = Math.min(64, W - 6 - Math.max(x1, x2));
            path = `M${x1} ${y1} C${x1 + bulge} ${y1} ${x2 + bulge} ${y2} ${x2 + 3} ${y2}`;
            lx = Math.max(x1, x2) + bulge * 0.75 - 2;
            ly = (y1 + y2) / 2;
          } else {
            const [x1, y1] = edgeOf(from, to.x + to.w / 2, to.y + to.h / 2);
            const [x2, y2] = edgeOf(to, from.x + from.w / 2, from.y + from.h / 2);
            path = `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
            lx = (x1 + x2) / 2;
            ly = (y1 + y2) / 2;
            if (mode === "flow") {
              lx += 10;
              anchor = "start";
            }
          }
          const words = e.label ? wrapLabel(e.label, mode === "flow" ? 22 : 16, 2) : [];
          return (
            <g key={k}>
              <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" markerEnd={`url(#${marker})`} />
              {words.map((line, r) => (
                <text
                  key={r}
                  x={lx}
                  y={ly + 4 + (r - (words.length - 1) / 2) * 14}
                  fontSize="12"
                  textAnchor={anchor}
                  fill="var(--foreground, #16161a)"
                  // A white edge keeps the words readable where they sit on the arrow.
                  stroke="var(--card, #fff)"
                  strokeWidth="5"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
        {boxes.map((b) => (
          <g key={b.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" fill="var(--card, #fff)" stroke="var(--border-strong, #d5d5dc)" strokeWidth="1.5" />
            {b.label.map((line, r) => (
              <text key={`l${r}`} x={b.x + b.w / 2} y={b.y + PAD + 13 + r * LINE} fontSize="14" fontWeight="700" textAnchor="middle" fill="var(--foreground, #16161a)">
                {line}
              </text>
            ))}
            {b.detail.map((line, r) => (
              <text key={`d${r}`} x={b.x + b.w / 2} y={b.y + PAD + b.label.length * LINE + 3 + 11 + r * DETAIL_LINE} fontSize="12" textAnchor="middle" fill="var(--muted-foreground, #5c5c68)">
                {line}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
