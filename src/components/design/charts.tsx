import { T } from "./tokens";

/** Semicircular speedometer with a short needle; the value sits inside the dial. */
export function Gauge({ pct, value, label, color = T.green, size = 220 }: { pct: number; value: string; label: string; color?: string; size?: number }) {
  const r = 74, cx = 100, cy = 100;
  const pt = (deg: number, rad = r) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy - rad * Math.sin((deg * Math.PI) / 180)] as const;
  const a = 180 - 180 * pct;
  const [x0, y0] = pt(180), [x1, y1] = pt(0), [xa, ya] = pt(a), [xn, yn] = pt(a, r - 14), [xs, ys] = pt(a, r - 30);
  return (
    <svg width={size} height={size * 0.58} viewBox="0 0 200 116" aria-label={`${label} ${value}`}>
      <path d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={T.grey} strokeWidth={18} strokeLinecap="round" />
      <path d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${xa} ${ya}`} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" />
      {Array.from({ length: 9 }, (_, i) => i * 22.5).map((k) => { const [a1, b1] = pt(k, r - 15), [a2, b2] = pt(k, r - 11); return <line key={k} x1={a1} y1={b1} x2={a2} y2={b2} stroke="#fff" strokeWidth={2} strokeLinecap="round" />; })}
      <line x1={xs} y1={ys} x2={xn} y2={yn} stroke={T.text} strokeWidth={4} strokeLinecap="round" />
      <text x={100} y={94} textAnchor="middle" fontWeight={700} fontSize={28} fill={T.text}>{value}</text>
      <text x={100} y={110} textAnchor="middle" fontWeight={600} fontSize={10} fill={T.text3}>{label}</text>
    </svg>
  );
}

export function Ring({ pct, size = 48, stroke = 10, color = T.violet, children }: { pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = 50 - stroke / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx={50} cy={50} r={r} fill="none" stroke={T.grey} strokeWidth={stroke} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <span className="relative flex items-center justify-center">{children}</span>
    </span>
  );
}

export function Donut({ parts, size = 92, stroke = 14, children }: { parts: [number, string][]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = 50 - stroke / 2, c = 2 * Math.PI * r;
  const offsets = parts.map((_, i) => parts.slice(0, i).reduce((sum, [pct]) => sum + c * pct, 0));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx={50} cy={50} r={r} fill="none" stroke={T.grey} strokeWidth={stroke} />
        {parts.map(([pct, color], i) => <circle key={i} cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${c * pct} ${c}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 50 50)" />)}
      </svg>
      <span className="relative text-center leading-tight">{children}</span>
    </span>
  );
}

export function WeekBars({ mins, goal = 25, today = 4, height = 70, accent = T.orange }: { mins: number[]; goal?: number; today?: number; height?: number; accent?: string }) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const max = Math.max(...mins, goal) * 1.15;
  const goalY = (height * goal) / max;
  return (
    <div className="relative">
      <div className="absolute inset-x-0 border-t-2 border-dashed border-faint/50" style={{ bottom: goalY + 23 }} />
      <span className="absolute right-0 text-[10px] font-semibold text-faint" style={{ bottom: goalY + 26 }}>goal {goal}m</span>
      <div className="flex items-end gap-2">
        {mins.map((m, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-end" style={{ height }}>
              <div className="w-full rounded-t-md rounded-b-[3px]" style={{ height: Math.max(4, (height * m) / max), background: m >= goal ? accent : i === today ? T.violet : T.border, opacity: i > today ? 0.35 : 1 }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: i === today ? T.violet : T.text3 }}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlameIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0.5 24 24" className="block" aria-hidden>
      <path d="M12 1.5c.8 4.5 6 6 6 11.5a6 6 0 0 1-12 0c0-3 1.6-4.6 2.8-6 .3 2.4 1.4 3.6 2.6 3.6C10.6 7.6 10.4 4.2 12 1.5z" fill="#f97316" />
      <path d="M12 10c.5 2.4 3 3.2 3 5.6a3 3 0 0 1-6 0c0-1.5.8-2.3 1.4-3 .2 1.2.7 1.8 1.3 1.8-.3-1.5-.3-3 .3-4.4z" fill="#fde047" />
    </svg>
  );
}
