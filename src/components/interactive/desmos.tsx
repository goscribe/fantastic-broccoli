"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetFrame, Slider, Readout } from "./controls";

/* ------------------------- Desmos API loader ------------------------ */

interface DesmosExpression {
  id?: string;
  latex?: string;
  color?: string;
  lines?: boolean;
  points?: boolean;
  hidden?: boolean;
  label?: string;
  showLabel?: boolean;
}

interface DesmosCalculator {
  setExpression(expr: DesmosExpression): void;
  setMathBounds(bounds: { left: number; right: number; bottom: number; top: number }): void;
  destroy(): void;
  resize(): void;
}

interface DesmosAPI {
  GraphingCalculator(
    element: HTMLElement,
    options?: Record<string, boolean | string>,
  ): DesmosCalculator;
}

declare global {
  interface Window {
    Desmos?: DesmosAPI;
  }
}

const DESMOS_SRC =
  "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";

let desmosPromise: Promise<DesmosAPI> | null = null;

function loadDesmos(): Promise<DesmosAPI> {
  if (typeof window !== "undefined" && window.Desmos) {
    return Promise.resolve(window.Desmos);
  }
  if (!desmosPromise) {
    desmosPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = DESMOS_SRC;
      script.async = true;
      script.onload = () => {
        if (window.Desmos) resolve(window.Desmos);
        else reject(new Error("Desmos failed to initialize"));
      };
      script.onerror = () => reject(new Error("Desmos script failed to load"));
      document.head.appendChild(script);
    });
  }
  return desmosPromise;
}

/**
 * Desmos renders label text verbatim unless math segments are wrapped in
 * backticks. Labels that contain LaTeX commands are wrapped so they render
 * as math instead of raw source.
 */
function formatLabel(label: string): string {
  if (label.includes("`") || !label.includes("\\")) return label;
  return `\`${label}\``;
}

const CALC_OPTIONS: Record<string, boolean | string> = {
  expressions: false,
  settingsMenu: false,
  zoomButtons: false,
  lockViewport: false,
  keypad: false,
  border: false,
};

function useDesmos(
  setup: (calc: DesmosCalculator) => void,
  deps: React.DependencyList,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const [failed, setFailed] = useState(false);
  const setupRef = useRef(setup);

  useEffect(() => {
    setupRef.current = setup;
  });

  useEffect(() => {
    let cancelled = false;
    loadDesmos()
      .then((Desmos) => {
        if (cancelled || !containerRef.current) return;
        calcRef.current = Desmos.GraphingCalculator(containerRef.current, CALC_OPTIONS);
        setupRef.current(calcRef.current);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      calcRef.current?.destroy();
      calcRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (calcRef.current) setupRef.current(calcRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, failed };
}

/* ------------------------- Function grapher ------------------------- */

export function FunctionGrapher({
  initialLatex = "a\\sin(bx)+c",
}: {
  initialLatex?: string;
}) {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [c, setC] = useState(0);

  const { containerRef, failed } = useDesmos(
    (calc) => {
      calc.setExpression({ id: "a", latex: `a=${a}`, hidden: true });
      calc.setExpression({ id: "b", latex: `b=${b}`, hidden: true });
      calc.setExpression({ id: "c", latex: `c=${c}`, hidden: true });
      calc.setExpression({ id: "f", latex: `y=${initialLatex}`, color: "#7c5cfc" });
      calc.setMathBounds({ left: -10, right: 10, bottom: -6, top: 6 });
    },
    [a, b, c, initialLatex],
  );

  return (
    <WidgetFrame
      title="Function grapher"
      hint="Powered by Desmos — drag the parameter sliders."
      formula={`y = ${initialLatex.replace(/\\\\/g, "\\")}`}
    >
      {failed ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Couldn&apos;t load Desmos — check your connection.
        </p>
      ) : (
        <div ref={containerRef} className="h-52 w-full rounded-xl overflow-hidden border border-border mb-3" />
      )}
      <div className="grid grid-cols-3 gap-3">
        <Slider label="a" value={a} min={-4} max={4} step={0.1} onChange={setA} />
        <Slider label="b" value={b} min={-4} max={4} step={0.1} onChange={setB} />
        <Slider label="c" value={c} min={-4} max={4} step={0.1} onChange={setC} />
      </div>
    </WidgetFrame>
  );
}

/* ---------------------- Data series (Desmos) ------------------------ */

export interface SeriesPoint {
  x: number;
  y: number;
  label?: string;
}

export function DataSeriesGraph({
  title,
  xLabel,
  yLabel,
  points,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  points: SeriesPoint[];
}) {
  const latexList = useMemo(
    () => `[${points.map((p) => `(${p.x},${p.y})`).join(",")}]`,
    [points],
  );

  const { containerRef, failed } = useDesmos(
    (calc) => {
      calc.setExpression({ id: "series", latex: latexList, color: "#7c5cfc", lines: true, points: true });
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const xPad = (Math.max(...xs) - Math.min(...xs)) * 0.12 || 1;
      const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.18 || 1;
      calc.setMathBounds({
        left: Math.min(...xs) - xPad,
        right: Math.max(...xs) + xPad,
        bottom: Math.min(...ys) - yPad,
        top: Math.max(...ys) + yPad,
      });
    },
    [latexList],
  );

  return (
    <WidgetFrame title={title} hint={`${yLabel} vs ${xLabel} — pan and zoom to explore.`}>
      {failed ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Couldn&apos;t load Desmos — check your connection.
        </p>
      ) : (
        <div ref={containerRef} className="h-52 w-full rounded-xl overflow-hidden border border-border" />
      )}
    </WidgetFrame>
  );
}

/* --------------------- Expression graph (Desmos) -------------------- */

const EXPRESSION_COLORS = ["#7c5cfc", "#12b981", "#f59e0b", "#ef4444", "#0ea5e9"];

export interface GraphExpression {
  latex: string;
  label?: string | null;
}

export function ExpressionGraph({
  title,
  xLabel,
  yLabel,
  expressions,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  expressions: GraphExpression[];
}) {
  const key = useMemo(() => JSON.stringify(expressions), [expressions]);

  const { containerRef, failed } = useDesmos(
    (calc) => {
      expressions.forEach((expr, i) => {
        calc.setExpression({
          id: `expr-${i}`,
          latex: expr.latex,
          color: EXPRESSION_COLORS[i % EXPRESSION_COLORS.length],
          ...(expr.label
            ? { label: formatLabel(expr.label), showLabel: true }
            : {}),
        });
      });
      calc.setMathBounds({ left: -10, right: 10, bottom: -6, top: 6 });
    },
    [key],
  );

  return (
    <WidgetFrame title={title} hint={`${yLabel} vs ${xLabel} — pan and zoom to explore.`}>
      {failed ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Couldn&apos;t load Desmos — check your connection.
        </p>
      ) : (
        <div ref={containerRef} className="h-56 w-full rounded-xl overflow-hidden border border-border" />
      )}
    </WidgetFrame>
  );
}

/* --------------------------- Unit circle ---------------------------- */

export function UnitCircleWidget() {
  const [deg, setDeg] = useState(45);
  const rad = (deg * Math.PI) / 180;
  const cx = 90;
  const cy = 90;
  const r = 70;
  const px = cx + r * Math.cos(rad);
  const py = cy - r * Math.sin(rad);

  return (
    <WidgetFrame title="Unit circle" hint="Drag the angle — watch sin and cos." formula="\sin^2\theta + \cos^2\theta = 1">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 180 180" className="w-36 shrink-0" aria-label="Unit circle">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-strong)" />
          <line x1={cx - r - 8} y1={cy} x2={cx + r + 8} y2={cy} stroke="var(--border)" />
          <line x1={cx} y1={cy - r - 8} x2={cx} y2={cy + r + 8} stroke="var(--border)" />
          <line x1={cx} y1={cy} x2={px} y2={py} stroke="var(--accent)" strokeWidth="2" />
          <line x1={px} y1={py} x2={px} y2={cy} stroke="var(--energy)" strokeWidth="2" strokeDasharray="4 3" />
          <line x1={cx} y1={cy} x2={px} y2={cy} stroke="var(--amber)" strokeWidth="2.5" />
          <circle cx={px} cy={py} r="5" fill="var(--accent)" />
        </svg>
        <div className="flex-1 space-y-3">
          <Slider label="Angle (θ)" value={deg} min={0} max={360} unit="°" onChange={setDeg} />
          <div className="grid grid-cols-2 gap-2">
            <Readout label="sin θ" value={Math.sin(rad).toFixed(3)} highlight />
            <Readout label="cos θ" value={Math.cos(rad).toFixed(3)} />
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ------------------------ Normal distribution ----------------------- */

export function NormalDistWidget() {
  const [mean, setMean] = useState(0);
  const [sd, setSd] = useState(1);

  const w = 260;
  const h = 110;
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let x = -5; x <= 5; x += 0.15) {
      const y = Math.exp(-((x - mean) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
      const sx = ((x + 5) / 10) * (w - 20) + 10;
      const sy = h - 10 - y * (h - 25) * 2.2;
      pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, [mean, sd]);

  return (
    <WidgetFrame title="Normal distribution" hint="Shift the mean, widen the spread." formula="X \sim \mathcal{N}(\mu, \sigma^2)">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full mb-3" aria-label="Bell curve">
        <line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="var(--border-strong)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Mean (μ)" value={mean} min={-3} max={3} step={0.1} onChange={setMean} />
        <Slider label="Std dev (σ)" value={sd} min={0.3} max={2.5} step={0.1} onChange={setSd} />
      </div>
    </WidgetFrame>
  );
}

/* ------------------------- Vector addition -------------------------- */

export function VectorAdditionWidget() {
  const [ax, setAx] = useState(3);
  const [ay, setAy] = useState(1);
  const [bx, setBx] = useState(1);
  const [by, setBy] = useState(2);
  const cx = 130;
  const cy = 105;
  const s = 18;
  const sumX = ax + bx;
  const sumY = ay + by;
  const mag = Math.hypot(sumX, sumY);

  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, dash?: string) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const hx = x2 - 8 * Math.cos(angle - 0.4);
    const hy = y2 - 8 * Math.sin(angle - 0.4);
    const hx2 = x2 - 8 * Math.cos(angle + 0.4);
    const hy2 = y2 - 8 * Math.sin(angle + 0.4);
    return (
      <g stroke={color} strokeWidth="2" strokeDasharray={dash}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={x2} y1={y2} x2={hx} y2={hy} />
        <line x1={x2} y1={y2} x2={hx2} y2={hy2} />
      </g>
    );
  };

  return (
    <WidgetFrame title="Vector addition" hint="Tip-to-tail: a + b = resultant." formula="\vec{c} = \vec{a} + \vec{b}">
      <svg viewBox="0 0 260 120" className="w-full mb-3" aria-label="Vectors">
        {arrow(cx, cy, cx + ax * s, cy - ay * s, "var(--accent)")}
        {arrow(cx + ax * s, cy - ay * s, cx + sumX * s, cy - sumY * s, "var(--amber)")}
        {arrow(cx, cy, cx + sumX * s, cy - sumY * s, "var(--energy)", "5 3")}
      </svg>
      <div className="grid grid-cols-2 gap-3">
        <Slider label="aₓ" value={ax} min={-4} max={4} step={0.5} onChange={setAx} />
        <Slider label="aᵧ" value={ay} min={-4} max={4} step={0.5} onChange={setAy} />
        <Slider label="bₓ" value={bx} min={-4} max={4} step={0.5} onChange={setBx} />
        <Slider label="bᵧ" value={by} min={-4} max={4} step={0.5} onChange={setBy} />
      </div>
      <div className="mt-3">
        <Readout label="Resultant |c|" value={mag.toFixed(2)} highlight />
      </div>
    </WidgetFrame>
  );
}
