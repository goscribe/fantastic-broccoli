"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetFrame, Slider, Readout } from "./controls";

/* ----------------------------- Density ----------------------------- */

function seededPositions(count: number, w: number, h: number) {
  const positions: { x: number; y: number }[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    positions.push({ x: 22 + rand() * (w - 44), y: h - 12 - rand() * (h - 46) });
  }
  return positions;
}

export function DensityWidget() {
  const [particles, setParticles] = useState(40);
  const [volume, setVolume] = useState(0.5);
  const particleMass = 0.4;
  const mass = particles * particleMass;
  const density = mass / volume;
  const positions = useMemo(() => seededPositions(particles, 100, 132), [particles]);

  return (
    <WidgetFrame
      title="Density explorer"
      hint="Drag either slider — density updates live."
      formula="\rho = \dfrac{m}{V}"
    >
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 120 150" className="w-24 shrink-0" aria-label="Bottle">
          <path
            d="M48 6 h24 v14 c14 8 22 20 22 36 v72 a12 12 0 0 1 -12 12 H38 a12 12 0 0 1 -12 -12 V56 c0 -16 8 -28 22 -36 z"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          {positions.map((p, i) => (
            <circle key={i} cx={p.x + 8} cy={p.y} r="3.2" fill="var(--accent)" opacity="0.75" />
          ))}
        </svg>
        <div className="flex-1 space-y-3">
          <Slider label="Particles" value={particles} min={5} max={90} onChange={setParticles} />
          <Slider label="Volume" value={volume} min={0.1} max={2} step={0.1} unit="L" onChange={setVolume} />
          <div className="grid grid-cols-3 gap-2">
            <Readout label="Mass" value={`${mass.toFixed(1)} g`} />
            <Readout label="Volume" value={`${volume.toFixed(1)} L`} />
            <Readout label="Density" value={`${density.toFixed(1)} g/L`} highlight />
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}

/* --------------------------- Ideal gas law -------------------------- */

export function IdealGasWidget() {
  const [n, setN] = useState(1);
  const [temp, setTemp] = useState(300);
  const [volume, setVolume] = useState(10);
  const R = 8.314;
  const pressure = (n * R * temp) / volume; // kPa-ish
  const pistonY = 12 + (1 - Math.min(volume, 20) / 20) * 90;

  return (
    <WidgetFrame
      title="Ideal gas law"
      hint="Move the piston (volume), heat it, or add moles."
      formula="PV = nRT"
    >
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 90 130" className="w-20 shrink-0" aria-label="Piston">
          <rect x="18" y="10" width="54" height="110" rx="4" fill="var(--muted)" stroke="var(--border-strong)" />
          <rect
            x="20"
            y={pistonY + 14}
            width="50"
            height={116 - pistonY - 14}
            rx="2"
            fill="var(--accent-soft)"
          />
          {Array.from({ length: Math.round(n * 6) }).map((_, i) => (
            <circle
              key={i}
              cx={26 + ((i * 13) % 40)}
              cy={pistonY + 24 + ((i * 17) % Math.max(10, 100 - pistonY))}
              r="2.4"
              fill="var(--accent)"
              opacity="0.7"
            />
          ))}
          <rect x="14" y={pistonY} width="62" height="14" rx="3" fill="var(--foreground)" />
        </svg>
        <div className="flex-1 space-y-3">
          <Slider label="Volume (V)" value={volume} min={2} max={20} step={0.5} unit="L" onChange={setVolume} />
          <Slider label="Temperature (T)" value={temp} min={100} max={600} step={10} unit="K" onChange={setTemp} />
          <Slider label="Moles (n)" value={n} min={0.5} max={3} step={0.5} unit="mol" onChange={setN} />
          <Readout label="Pressure (P)" value={`${pressure.toFixed(0)} kPa`} highlight />
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ----------------------------- Ohm's law ---------------------------- */

export function OhmsLawWidget() {
  const [voltage, setVoltage] = useState(9);
  const [resistance, setResistance] = useState(3);
  const current = voltage / resistance;
  const speed = Math.max(0.4, 3 / current);

  return (
    <WidgetFrame title="Ohm's law" hint="More volts or less resistance → faster current." formula="V = IR">
      <svg viewBox="0 0 260 90" className="w-full mb-3" aria-label="Circuit">
        <rect x="10" y="10" width="240" height="70" rx="8" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="6" y="34" width="8" height="22" fill="var(--accent)" />
        <text x="30" y="30" fontSize="9" fill="var(--muted-foreground)">{voltage} V</text>
        <rect x="150" y="4" width="46" height="12" rx="2" fill="var(--amber)" />
        <text x="150" y="30" fontSize="9" fill="var(--muted-foreground)">{resistance} Ω</text>
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} r="3" fill="var(--energy)">
            <animateMotion
              dur={`${speed}s`}
              repeatCount="indefinite"
              begin={`${(i * speed) / 6}s`}
              path="M14,45 H250 V80 H14 V45"
            />
          </circle>
        ))}
      </svg>
      <div className="space-y-3">
        <Slider label="Voltage (V)" value={voltage} min={1} max={24} unit="V" onChange={setVoltage} />
        <Slider label="Resistance (R)" value={resistance} min={1} max={20} unit="Ω" onChange={setResistance} />
        <Readout label="Current (I)" value={`${current.toFixed(2)} A`} highlight />
      </div>
    </WidgetFrame>
  );
}

/* -------------------------- Projectile motion ----------------------- */

export function ProjectileWidget() {
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(20);
  const g = 9.8;
  const rad = (angle * Math.PI) / 180;
  const range = (speed * speed * Math.sin(2 * rad)) / g;
  const maxH = (speed * speed * Math.sin(rad) ** 2) / (2 * g);
  const flight = (2 * speed * Math.sin(rad)) / g;

  const w = 260;
  const h = 120;
  const scale = (w - 20) / Math.max(range, 20);
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let t = 0; t <= flight; t += flight / 40) {
      const x = 10 + speed * Math.cos(rad) * t * scale;
      const y = h - 10 - (speed * Math.sin(rad) * t - 0.5 * g * t * t) * scale;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, [speed, flight, rad, scale]);

  return (
    <WidgetFrame title="Projectile motion" hint="Set launch angle and speed." formula="R = \dfrac{v^2 \sin 2\theta}{g}">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full mb-3" aria-label="Trajectory">
        <line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="var(--border-strong)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="10" cy={h - 10} r="4" fill="var(--energy)" />
      </svg>
      <div className="space-y-3">
        <Slider label="Angle (θ)" value={angle} min={5} max={85} unit="°" onChange={setAngle} />
        <Slider label="Speed (v)" value={speed} min={5} max={40} unit="m/s" onChange={setSpeed} />
        <div className="grid grid-cols-3 gap-2">
          <Readout label="Range" value={`${range.toFixed(1)} m`} highlight />
          <Readout label="Max height" value={`${maxH.toFixed(1)} m`} />
          <Readout label="Time" value={`${flight.toFixed(1)} s`} />
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ----------------------------- Pendulum ----------------------------- */

export function PendulumWidget() {
  const [length, setLength] = useState(1);
  const [gravity, setGravity] = useState(9.8);
  const period = 2 * Math.PI * Math.sqrt(length / gravity);
  const [angle, setAngle] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const loop = (t: number) => {
      if (start === null) start = t;
      const elapsed = (t - start) / 1000;
      setAngle(0.5 * Math.cos((2 * Math.PI * elapsed) / period));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [period]);

  const pivotX = 130;
  const pivotY = 12;
  const len = 40 + length * 45;
  const bobX = pivotX + Math.sin(angle) * len;
  const bobY = pivotY + Math.cos(angle) * len;

  return (
    <WidgetFrame title="Simple pendulum" hint="Length and gravity set the period." formula="T = 2\pi\sqrt{\dfrac{L}{g}}">
      <svg viewBox="0 0 260 130" className="w-full mb-3" aria-label="Pendulum">
        <line x1={pivotX} y1={pivotY} x2={bobX} y2={bobY} stroke="var(--border-strong)" strokeWidth="2" />
        <circle cx={pivotX} cy={pivotY} r="3" fill="var(--muted-foreground)" />
        <circle cx={bobX} cy={bobY} r="10" fill="var(--accent)" />
      </svg>
      <div className="space-y-3">
        <Slider label="Length (L)" value={length} min={0.2} max={2} step={0.1} unit="m" onChange={setLength} />
        <Slider label="Gravity (g)" value={gravity} min={1.6} max={24.8} step={0.1} unit="m/s²" onChange={setGravity} />
        <Readout label="Period (T)" value={`${period.toFixed(2)} s`} highlight />
      </div>
    </WidgetFrame>
  );
}

/* ------------------------------- Wave ------------------------------- */

export function WaveWidget() {
  const [amplitude, setAmplitude] = useState(20);
  const [wavelength, setWavelength] = useState(80);
  const [phase, setPhase] = useState(0);
  const [t, setT] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const loop = () => {
      setT((prev) => prev + 0.05);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const w = 260;
  const mid = 55;
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let x = 0; x <= w; x += 4) {
      const y = mid - amplitude * Math.sin((2 * Math.PI * x) / wavelength + phase + t);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, [amplitude, wavelength, phase, t]);

  return (
    <WidgetFrame title="Travelling wave" hint="Shape the wave; it animates in real time." formula="y = A\sin(kx + \phi)">
      <svg viewBox={`0 0 ${w} 110`} className="w-full mb-3" aria-label="Wave">
        <line x1="0" y1={mid} x2={w} y2={mid} stroke="var(--border)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      <div className="space-y-3">
        <Slider label="Amplitude (A)" value={amplitude} min={4} max={45} onChange={setAmplitude} />
        <Slider label="Wavelength (λ)" value={wavelength} min={30} max={200} onChange={setWavelength} />
        <Slider label="Phase (φ)" value={phase} min={0} max={6.28} step={0.1} onChange={setPhase} />
      </div>
    </WidgetFrame>
  );
}

/* --------------------------- Half-life decay ------------------------ */

export function HalfLifeWidget() {
  const [n0, setN0] = useState(1000);
  const [halfLife, setHalfLife] = useState(5);
  const [time, setTime] = useState(10);
  const remaining = n0 * Math.pow(0.5, time / halfLife);

  const w = 260;
  const h = 110;
  const maxT = halfLife * 6;
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let tt = 0; tt <= maxT; tt += maxT / 60) {
      const n = n0 * Math.pow(0.5, tt / halfLife);
      const x = 10 + (tt / maxT) * (w - 20);
      const y = h - 10 - (n / n0) * (h - 20);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, [n0, halfLife, maxT]);
  const markX = 10 + Math.min(time / maxT, 1) * (w - 20);

  return (
    <WidgetFrame title="Radioactive decay" hint="Set the half-life and read remaining nuclei." formula="N = N_0\left(\tfrac12\right)^{t/t_{1/2}}">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full mb-3" aria-label="Decay curve">
        <line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="var(--border-strong)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <line x1={markX} y1="6" x2={markX} y2={h - 10} stroke="var(--energy)" strokeDasharray="3 3" />
      </svg>
      <div className="space-y-3">
        <Slider label="Initial N₀" value={n0} min={100} max={2000} step={100} onChange={setN0} />
        <Slider label="Half-life (t½)" value={halfLife} min={1} max={20} unit="yr" onChange={setHalfLife} />
        <Slider label="Elapsed time (t)" value={time} min={0} max={60} unit="yr" onChange={setTime} />
        <Readout label="Remaining" value={`${remaining.toFixed(0)} nuclei`} highlight />
      </div>
    </WidgetFrame>
  );
}

/* ---------------------------- Hooke's law --------------------------- */

export function HookeWidget() {
  const [k, setK] = useState(50);
  const [x, setX] = useState(0.2);
  const force = k * x;
  const coils = 8;
  const restY = 20;
  const stretch = x * 120;
  const totalLen = 50 + stretch;

  const springPath = useMemo(() => {
    const pts = [`M40,${restY}`];
    const seg = totalLen / (coils * 2);
    for (let i = 0; i < coils * 2; i++) {
      const y = restY + seg * (i + 1);
      const x2 = i % 2 === 0 ? 55 : 25;
      pts.push(`L${x2},${y.toFixed(1)}`);
    }
    pts.push(`L40,${(restY + totalLen).toFixed(1)}`);
    return pts.join(" ");
  }, [totalLen]);

  return (
    <WidgetFrame title="Hooke's law" hint="Stretch the spring; force scales with displacement." formula="F = kx">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 80 200" className="w-16 shrink-0" aria-label="Spring">
          <rect x="20" y="6" width="40" height="6" rx="2" fill="var(--foreground)" />
          <path d={springPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
          <rect x="22" y={restY + totalLen} width="36" height="24" rx="4" fill="var(--accent)" />
        </svg>
        <div className="flex-1 space-y-3">
          <Slider label="Spring constant (k)" value={k} min={10} max={200} step={5} unit="N/m" onChange={setK} />
          <Slider label="Displacement (x)" value={x} min={0} max={0.8} step={0.02} unit="m" onChange={setX} />
          <Readout label="Force (F)" value={`${force.toFixed(1)} N`} highlight />
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ---------------------- Matrix multiplication ----------------------- */

const randMatrix = (rows: number, cols: number, seedBase: number) =>
  Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => ((seedBase + i * 7 + j * 3) % 9) - 4),
  );

function MatrixView({
  m,
  hlRow,
  hlCol,
}: {
  m: number[][];
  hlRow?: number;
  hlCol?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-border p-1.5 bg-card"
      style={{ gridTemplateColumns: `repeat(${m[0].length}, minmax(0, 1fr))` }}
    >
      {m.map((r, i) =>
        r.map((v, j) => (
          <div
            key={`${i}-${j}`}
            className={`w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded text-sm sm:text-base font-mono ${
              i === hlRow || j === hlCol
                ? "bg-accent text-accent-foreground"
                : "bg-muted"
            }`}
          >
            {v}
          </div>
        )),
      )}
    </div>
  );
}

export function MatrixMultiplicationWidget() {
  const [size, setSize] = useState(2);
  const [step, setStep] = useState(0);
  const a = useMemo(() => randMatrix(size, size, 5), [size]);
  const b = useMemo(() => randMatrix(size, size, 8), [size]);

  const cells = size * size;
  const row = Math.floor(step / size);
  const col = step % size;
  const terms = a[row].map((v, k) => `${v}×${b[k][col]}`);
  const value = a[row].reduce((acc, v, k) => acc + v * b[k][col], 0);

  const result = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) =>
      i * size + j <= step
        ? a[i].reduce((acc, v, k) => acc + v * b[k][j], 0)
        : NaN,
    ),
  );

  return (
    <WidgetFrame
      title="Matrix multiplication"
      hint="Step through: each result cell is a row·column dot product."
      formula="C_{ij} = \sum_k A_{ik} B_{kj}"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 py-2">
          <MatrixView m={a} hlRow={row} />
          <span className="text-lg text-muted-foreground">×</span>
          <MatrixView m={b} hlCol={col} />
          <span className="text-lg text-muted-foreground">=</span>
          <div
            className="grid gap-1 rounded-lg border border-border p-1.5 bg-card"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {result.map((r, i) =>
              r.map((v, j) => (
                <div
                  key={`${i}-${j}`}
                  className={`w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded text-sm sm:text-base font-mono ${
                    i === row && j === col
                      ? "bg-energy/30 font-semibold"
                      : "bg-muted"
                  }`}
                >
                  {Number.isNaN(v) ? "·" : v}
                </div>
              )),
            )}
          </div>
        </div>
        <div className="text-sm font-mono text-muted-foreground text-center">
          C[{row + 1},{col + 1}] = {terms.join(" + ")} ={" "}
          <span className="text-foreground font-semibold">{value}</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Slider
            label="Step"
            value={step + 1}
            min={1}
            max={cells}
            onChange={(v) => setStep(v - 1)}
          />
          <Slider
            label="Size"
            value={size}
            min={2}
            max={3}
            onChange={(v) => {
              setSize(v);
              setStep(0);
            }}
          />
        </div>
      </div>
    </WidgetFrame>
  );
}
