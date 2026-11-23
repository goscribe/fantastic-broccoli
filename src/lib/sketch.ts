import type { SketchSpec } from "@/lib/api/my-notes";

/**
 * Geometry for `/diagram` sketches (components/my-notes/sketch-figure.tsx):
 * how a curve is sampled (the same as the server's lib/notes/sketch.ts, which
 * snaps points onto the crossings of these very polylines) and where each
 * label goes so it clears the curves, the dots and the other labels.
 */

export type Pt = [number, number];

/** The polyline a curve is drawn as, in data coordinates (mirrors the server). */
export function sketchSamples(points: { x: number; y: number }[], smooth: boolean): Pt[] {
  const p = points.map((q) => [q.x, q.y] as Pt);
  if (!smooth || p.length < 3) return p;
  const increasing = p.every((q, i) => i === 0 || q[0] > p[i - 1][0]);
  const out: Pt[] = [];
  if (increasing) {
    // Monotone cubic (Fritsch–Carlson): no overshoot, flat at a turning point.
    const n = p.length;
    const d = p.slice(1).map((q, i) => (q[1] - p[i][1]) / (q[0] - p[i][0]));
    const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[i + 1];
      const h = x1 - x0;
      const steps = 20;
      for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
        const t = k / steps;
        const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
        const h10 = t ** 3 - 2 * t ** 2 + t;
        const h01 = -2 * t ** 3 + 3 * t ** 2;
        const h11 = t ** 3 - t ** 2;
        out.push([x0 + h * t, h00 * y0 + h10 * h * m[i] + h01 * y1 + h11 * h * m[i + 1]]);
      }
    }
    return out;
  }
  // Catmull–Rom through the points, for a curve that turns back on itself.
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const steps = 16;
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, e: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** The curve's height at x (first crossing), or null outside its x-range. */
export function sketchYAt(samples: Pt[], x: number): number | null {
  for (let i = 1; i < samples.length; i++) {
    const [x0, y0] = samples[i - 1];
    const [x1, y1] = samples[i];
    if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && x1 !== x0) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return null;
}

/** The outline of a region "between" two curves (lower null: the x-axis line at `base`), in data coordinates. */
export function regionBetween(upper: Pt[], lower: Pt[] | null, from: number, to: number, base: number): Pt[] {
  const steps = 40;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const yu = sketchYAt(upper, x);
    const yl = lower ? sketchYAt(lower, x) : base;
    if (yu === null || yl === null) continue;
    top.push([x, yu]);
    bottom.push([x, yl]);
  }
  return [...top, ...bottom.reverse()];
}

/* ---------- Labels ---------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** About how wide a label is at a font size (Nunito, 600). */
export const textWidth = (text: string, size: number) => Math.ceil([...text].length * size * 0.56) + 2;

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Picks, from candidate boxes in order of preference, the one that leaves the
 * frame least, covers the fewest other labels and dots, and crosses the
 * fewest drawn lines. Ties go to the earlier candidate.
 */
export class LabelPlacer {
  private boxes: Box[] = [];
  private readonly frame: Box;
  /** Screen points along every drawn line (curves, guides, axes, arrows). */
  private readonly ink: Pt[];
  constructor(frame: Box, ink: Pt[]) {
    this.frame = frame;
    this.ink = ink;
  }

  /** Keeps a fixed box (a dot, a free text) clear of later labels. */
  reserve(b: Box) {
    this.boxes.push(b);
  }

  private score(c: Box) {
    const out =
      Math.max(0, this.frame.x - c.x) + Math.max(0, c.x + c.w - (this.frame.x + this.frame.w)) + Math.max(0, this.frame.y - c.y) + Math.max(0, c.y + c.h - (this.frame.y + this.frame.h));
    const covered = this.boxes.reduce((n, b) => n + overlap(c, b), 0);
    const crossed = this.ink.reduce((n, [x, y]) => n + (x > c.x + 1 && x < c.x + c.w - 1 && y > c.y + 1 && y < c.y + c.h - 1 ? 1 : 0), 0);
    // A line through a label is the worst outcome short of leaving the frame.
    return { score: out * 400 + covered * 20 + crossed * 1000, clear: out === 0 && covered === 0 && crossed === 0 };
  }

  /**
   * The best of the candidates. When every one of them has a line through it
   * (a crowded corner), the nearest clear spot around `anchor` instead, and
   * `far` says so (the caller draws a leader back to the anchor).
   */
  place(candidates: Box[], anchor?: Pt): Box & { far: boolean } {
    let best = candidates[0];
    let bestScore = Infinity;
    let bestClear = false;
    candidates.forEach((c, i) => {
      const { score, clear } = this.score(c);
      if (score + i * 3 < bestScore) {
        bestScore = score + i * 3;
        best = c;
        bestClear = clear;
      }
    });
    let far = false;
    if (!bestClear && anchor) {
      const { w, h } = best;
      const spots: Box[] = [];
      for (let dy = -160; dy <= 160; dy += 6) for (let dx = -240; dx <= 240; dx += 6) spots.push({ x: anchor[0] + dx - w / 2, y: anchor[1] + dy - h / 2, w, h });
      spots.sort((a, b) => Math.hypot(a.x + w / 2 - anchor[0], a.y + h / 2 - anchor[1]) - Math.hypot(b.x + w / 2 - anchor[0], b.y + h / 2 - anchor[1]));
      // Clear, and its leader back to the anchor passes through no other label.
      const leaderClear = (c: Box) => {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        for (let t = 0; t <= 1; t += 0.05) {
          const x = anchor[0] + (cx - anchor[0]) * t;
          const y = anchor[1] + (cy - anchor[1]) * t;
          const inside = (b: Box, px: number, py: number) => px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h;
          // (The dot the label names is not in the way of its own leader.)
          if (this.boxes.some((b) => inside(b, x, y) && !inside(b, anchor[0], anchor[1]))) return false;
        }
        return true;
      };
      const clear = spots.find((c) => this.score(c).clear && leaderClear(c));
      if (clear) {
        best = clear;
        far = true;
      }
    }
    this.boxes.push(best);
    return { ...best, far };
  }
}

/** Boxes of size w×h around (x, y), `gap` clear of it, starting in direction `angle` (radians, screen y down) and fanning out. */
export function around(x: number, y: number, w: number, h: number, gap: number, angle: number): Box[] {
  const out: Box[] = [];
  for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const a = angle + (turn * Math.PI) / 4;
    const cx = x + Math.cos(a) * (w / 2 + gap);
    const cy = y + Math.sin(a) * (h / 2 + gap);
    out.push({ x: cx - w / 2, y: cy - h / 2, w, h });
  }
  return out;
}

/** Spreads marks along an axis so none overlaps the next (positions are centres, widths their extent). */
export function spread(items: { at: number; size: number }[], lo: number, hi: number): number[] {
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.at - b.at);
  const pos = order.map((o) => o.at);
  for (let pass = 0; pass < 4; pass++) {
    for (let k = 1; k < order.length; k++) {
      const need = (order[k - 1].size + order[k].size) / 2 + 4;
      if (pos[k] - pos[k - 1] < need) {
        const push = (need - (pos[k] - pos[k - 1])) / 2;
        pos[k - 1] -= push;
        pos[k] += push;
      }
    }
    for (let k = 0; k < order.length; k++) pos[k] = Math.max(lo + order[k].size / 2, Math.min(hi - order[k].size / 2, pos[k]));
  }
  const out = new Array<number>(items.length);
  order.forEach((o, k) => (out[o.i] = pos[k]));
  return out;
}

/** Whether a sketch has anything to draw. */
export const sketchDrawable = (s: SketchSpec) => s.bounds.left < s.bounds.right && s.bounds.bottom < s.bounds.top && s.curves.length + s.arrows.length + s.regions.length > 0;
