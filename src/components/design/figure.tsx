import { Ellipsis, ZoomIn } from "lucide-react";
import { T } from "./tokens";

export function Figure({ title, caption, legend, children, width = 320, height = 170 }: { title: string; caption: string; legend?: [string, string][]; children: React.ReactNode; width?: number; height?: number }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <figcaption className="text-[13px] font-semibold">{title}</figcaption>
        <span className="flex gap-1.5 text-faint"><ZoomIn className="size-4" /><Ellipsis className="size-4" /></span>
      </div>
      <div className="flex justify-center bg-accent-soft/40 p-4">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>{children}</svg>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-[12px] text-faint">{caption}</span>
        {legend && <span className="flex gap-3">{legend.map(([l, c]) => <span key={l} className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><i className="size-2.5 rounded-[3px]" style={{ background: c }} />{l}</span>)}</span>}
      </div>
    </figure>
  );
}

function Callout({ x, y, w, text, color, lx, ly }: { x: number; y: number; w: number; text: string; color: string; lx: number; ly: number }) {
  return (
    <g>
      <line x1={lx} y1={ly} x2={x + w / 2} y2={y + 10} stroke={T.text3} strokeWidth={1.2} />
      <rect x={x} y={y} width={w} height={20} rx={10} fill="#fff" stroke={T.border} strokeWidth={1.2} />
      <text x={x + w / 2} y={y + 13.5} textAnchor="middle" fontWeight={600} fontSize={10} fill={color}>{text}</text>
    </g>
  );
}

/** Red blood cell in a hypertonic beaker: liquid, membrane line, arrowed water flow, pill callouts. */
export function OsmosisFigure({ after = true, overlay = false }: { after?: boolean; overlay?: boolean }) {
  const rx = after ? 40 : 50, ry = after ? 26 : 32;
  return (
    <Figure title="Figure 3.4 · Red blood cell in 0.3 M NaCl" caption="Redrawn from your notes · p. 12" legend={[["Solution", T.violet], ["Cell", T.red], ["Water", T.blue]]}>
      <defs>
        <marker id="ah" markerWidth={7} markerHeight={7} refX={5.5} refY={3.5} orient="auto"><path d="M0 0L7 3.5 0 7z" fill={T.violet} /></marker>
        <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ede9fe" /><stop offset="1" stopColor="#ddd6fe" /></linearGradient>
      </defs>
      <path d="M70 14v108a14 14 0 0 0 14 14h152a14 14 0 0 0 14-14V14" fill="none" stroke={T.text2} strokeWidth={2} strokeLinecap="round" />
      <path d="M72 44h176v78a12 12 0 0 1-12 12H84a12 12 0 0 1-12-12z" fill="url(#liq)" />
      <path d="M72 44h176" stroke={T.violet} strokeWidth={2} strokeLinecap="round" />
      <path d="M62 14h16M242 14h16" stroke={T.text2} strokeWidth={2} strokeLinecap="round" />
      {overlay && <ellipse cx={160} cy={92} rx={50} ry={32} fill="none" stroke={T.green} strokeWidth={2} strokeDasharray="5 4" opacity={0.8} />}
      <ellipse cx={160} cy={92} rx={rx} ry={ry} fill="#fff" stroke={T.red} strokeWidth={2.5} />
      <ellipse cx={160} cy={92} rx={rx - 18} ry={ry - 16} fill="#fecdd3" />
      <path d={`M${160 - rx - 8} 72l-22-14M${160 + rx + 8} 72l22-14M${160 - rx - 8} 112l-22 14M${160 + rx + 8} 112l22 14`} stroke={T.violet} strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#ah)" />
      <g fill={T.blue}><path d="M110 60c2.5 3.5 2.5 7 0 7s-2.5-3.5 0-7z" /><path d="M210 60c2.5 3.5 2.5 7 0 7s-2.5-3.5 0-7z" /><path d="M110 118c2.5 3.5 2.5 7 0 7s-2.5-3.5 0-7z" /><path d="M210 118c2.5 3.5 2.5 7 0 7s-2.5-3.5 0-7z" /></g>
      <Callout x={262} y={24} w={56} text="0.3 M NaCl" color={T.violetDark} lx={250} ly={56} />
      <Callout x={236} y={142} w={80} text="cytoplasm 0.15 M" color={T.red} lx={160 + rx} ly={92 + ry - 4} />
      <Callout x={4} y={116} w={58} text="H₂O out" color={T.violet} lx={70} ly={100} />
    </Figure>
  );
}
