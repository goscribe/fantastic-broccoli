import Image from "next/image";
import { Check, Eraser, Highlighter, Mic, PenLine, Redo2, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopilotPanel, type CopilotMsg } from "./copilot-panel";
import { MarkTip } from "./feedback";
import { FlameIcon, Ring } from "./charts";
import { T } from "./tokens";

export type QType = "mcq" | "text" | "sketch";

export function QuestionFrame({ tag, qi, qn, question, children, bottom, messages, panelOpen = true }: { tag: string; qi: number; qn: number; question: string; children: React.ReactNode; bottom: React.ReactNode; messages?: CopilotMsg[]; panelOpen?: boolean }) {
  return (
    <div className="flex h-dvh min-h-[800px] overflow-hidden">
      <div className="relative flex min-w-0 flex-1 flex-col px-10">
        <div className="flex items-center gap-5 pt-6">
          <X className="size-[22px] text-faint" />
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(qi / qn) * 100}%` }} /></div>
          <span className="text-[14px] font-semibold text-muted-foreground">Q{qi} of {qn}</span>
          <span className="flex h-[34px] items-center gap-1.5 rounded-xl border border-border px-2.5 text-[14px] font-semibold"><FlameIcon size={20} />12</span>
        </div>
        <div className="mt-7 min-h-0 flex-1">
          <span className="inline-flex items-center rounded-lg bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-dim">{tag}</span>
          <h1 className="mb-[18px] mt-3 text-[23px] font-bold leading-[1.3]">{question}</h1>
          {children}
        </div>
        {bottom}
      </div>
      <CopilotPanel messages={messages} defaultOpen={panelOpen} />
    </div>
  );
}

export { btnPrimary, btnOutline, FeedbackCard } from "./feedback";

export function BottomBar({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="-mx-10 flex items-center justify-between border-t border-border bg-white px-10 pb-6 pt-[18px]">{left}{right}</div>;
}

export function Option({ n, children, state }: { n: number; children: React.ReactNode; state?: "sel" | "ok" | "bad" }) {
  return (
    <div className={cn("flex items-center gap-3.5 rounded-[14px] border border-border bg-white px-4 py-3 text-[15px] font-medium", state === "sel" && "border-accent bg-accent-soft", state === "ok" && "border-emerald-300 bg-emerald-50", state === "bad" && "border-rose-300 bg-rose-50")}>
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-[13px] font-semibold text-muted-foreground", state === "sel" && "bg-accent text-white", state === "ok" && "bg-emerald-600 text-white", state === "bad" && "bg-red-600 text-white")}>{n}</span>
      {children}
    </div>
  );
}

export const MARKSCHEME = [
  { id: "M1", text: "Defines water potential as the tendency of water to move", ok: true, quote: "tendency of water to move" },
  { id: "M2", text: "Pure water Ψ = 0 kPa; solutes make Ψ more negative", ok: true, quote: "0 kPa and adding solute makes it more negative" },
  { id: "M3", text: "Direction: from higher to lower (more negative) Ψ", ok: true, quote: "from higher (less negative) to lower (more negative)" },
  { id: "M4", text: "Water leaves by osmosis; cell shrinks / crenates", ok: true, quote: "water moves out of the cell by osmosis and the cell shrinks" },
  { id: "M5", text: "Names the 0.3 M solution as hypertonic", ok: false, need: "'the 0.3 M solution is hypertonic to the cytoplasm'" },
  { id: "M6", text: "Quotes Ψ = Ψs + Ψp or equivalent", ok: false, need: "the equation or 'solute + pressure potential'" },
];
export const ANSWER = "Water potential is the tendency of water to move from one place to another. Pure water has a water potential of 0 kPa and adding solute makes it more negative. Water moves from higher (less negative) to lower (more negative) water potential, so in the 0.3 M solution water moves out of the cell by osmosis and the cell shrinks.";

function highlight(text: string, marks: { id: string; text: string; quote: string }[], openFirst: boolean): React.ReactNode[] {
  let nodes: React.ReactNode[] = [text];
  marks.forEach((m, qi) => {
    nodes = nodes.flatMap((n): React.ReactNode[] => {
      if (typeof n !== "string") return [n];
      const bits = n.split(m.quote);
      return bits.flatMap((s, i): React.ReactNode[] => i < bits.length - 1 ? [s, (
        <MarkTip key={`${qi}-${i}`} label={m.id} detail={m.text} defaultOpen={openFirst && qi === 0}>
          <mark className="cursor-help rounded-[3px] bg-emerald-100 text-inherit decoration-emerald-500 underline-offset-2 hover:underline">{m.quote}</mark>
        </MarkTip>
      )] : [s]);
    });
  });
  return nodes;
}

export function AnswerBox({ marked, showTip = false }: { marked: boolean; showTip?: boolean }) {
  const body = marked ? highlight(ANSWER, MARKSCHEME.flatMap((m) => (m.ok && m.quote ? [{ id: m.id, text: m.text, quote: m.quote }] : [])), showTip) : ANSWER;
  return (
    <div>
      <div className={cn("min-h-[150px] rounded-[14px] border bg-white p-4 text-[14px] leading-[1.55]", marked ? "border-border" : "border-accent")}>{body}{!marked && <span className="ml-0.5 inline-block h-[18px] w-0.5 -translate-y-[3px] bg-accent align-middle" />}</div>
      <div className="mt-2 flex justify-between text-[12px] text-faint"><span>68 words · aim for 60–100</span><span className="flex items-center gap-1"><Mic className="size-3.5" />Dictate</span></div>
    </div>
  );
}

export function Markscheme() {
  return (
    <div className="rounded-2xl bg-muted p-3.5">
      <div className="flex items-baseline justify-between"><span className="text-[11px] font-semibold text-faint">Markscheme · IB Bio HL Paper 2 style</span><span className="text-[11px] text-faint">6 marks</span></div>
      <div className="mt-2 flex flex-col gap-[7px]">
        {MARKSCHEME.map((m) => (
          <div key={m.id} className="flex items-start gap-2.5 text-[12.5px]">
            <span className={cn("grid h-5 w-[30px] shrink-0 place-items-center rounded-md text-[11px] font-bold text-white", m.ok ? "bg-emerald-600" : "bg-red-600")}>{m.id}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.text} <span className="font-semibold text-faint">[1]</span></div>
              {!m.ok && <div className="mt-0.5 text-[12px] text-muted-foreground"><span className="text-red-600">Needed: {m.need}</span> · <button className="font-semibold text-accent">Ask Copilot</button></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreCard({ num, den, title, sub, color = T.green }: { num: number; den: number; title: string; sub: string; color?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
      <Ring pct={num / den} size={64} stroke={10} color={color}><span className="text-[15px] font-bold">{num}/{den}</span></Ring>
      <div><div className="text-[16px] font-bold">{title}</div><div className="text-[13px] text-faint">{sub}</div></div>
    </div>
  );
}

export function Checklist({ items }: { items: [string, boolean][] }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted p-4">
      {items.map(([t, ok]) => (
        <div key={t} className={cn("flex items-start gap-2.5 text-[13px]", !ok && "text-muted-foreground")}>
          <span className={cn("mt-px grid size-[18px] shrink-0 place-items-center rounded-full text-white", ok ? "bg-emerald-600" : "bg-red-600")}>{ok ? <Check className="size-[11px]" /> : <X className="size-[11px]" />}</span>{t}
        </div>
      ))}
    </div>
  );
}

export function DrawToolbar() {
  const tool = (Icon: typeof PenLine, label: string, on = false) => <button key={label} title={label} className={cn("grid h-9 w-10 place-items-center rounded-[9px] text-muted-foreground", on && "bg-accent-soft text-accent")}><Icon className="size-[18px]" /></button>;
  return (
    <div className="mt-2.5 flex items-center justify-between">
      <div className="inline-flex items-center gap-0.5 rounded-xl bg-muted p-1">
        {tool(PenLine, "Pen", true)}{tool(Highlighter, "Highlighter")}{tool(Eraser, "Eraser")}
        <i className="mx-1 h-[22px] w-px bg-border" />
        {tool(Undo2, "Undo")}{tool(Redo2, "Redo")}{tool(Trash2, "Clear")}
      </div>
      <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
        {[T.text, T.violet, T.red, T.blue, T.green, T.orange].map((c, i) => <span key={c} className={cn("size-5 rounded-full ring-2 ring-white", i === 0 && "outline outline-[2.5px] outline-offset-1 outline-accent")} style={{ background: c }} />)}
        <i className="mx-0.5 h-[18px] w-px bg-border" />
        <span className="flex items-end gap-1.5"><i className="size-1 rounded-full bg-foreground" /><i className="size-[7px] rounded-full bg-foreground" /><i className="size-2.5 rounded-full bg-border" /></span>
      </div>
    </div>
  );
}

export function Sketch({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white [background-image:radial-gradient(#e8e8ec_1px,transparent_1px)] [background-size:18px_18px]">
      <svg viewBox="0 0 560 300" className="h-[250px] w-full">
        <path d="M160 150c0-60 60-100 130-100s130 40 130 100-60 100-130 100-130-40-130-100z" fill="none" stroke={T.text} strokeWidth={3} strokeLinecap="round" />
        <path d="M190 150c0-45 45-75 100-75s100 30 100 75-45 75-100 75-100-30-100-75z" fill="none" stroke={T.text} strokeWidth={2.5} strokeDasharray="7 6" />
        <path d="M60 110l60 20M60 190l60-20M500 110l-60 20M500 190l-60-20" stroke={T.blue} strokeWidth={3} strokeLinecap="round" />
        <text x={40} y={95} fontSize={14} fill={T.text}>H₂O</text>
        <text x={250} y={60} fontSize={13} fontStyle="italic" fill={T.text}>before</text>
        <text x={245} y={255} fontSize={13} fontStyle="italic" fill={T.text}>after</text>
        {overlay && <>
          <path d="M160 150c0-60 60-100 130-100s130 40 130 100-60 100-130 100-130-40-130-100z" fill="none" stroke={T.green} strokeWidth={3} opacity={0.7} />
          <path d="M205 150c0-40 38-65 85-65s85 25 85 65-38 65-85 65-85-25-85-65z" fill={T.green} fillOpacity={0.12} stroke={T.green} strokeWidth={3} opacity={0.9} />
          <rect x={400} y={262} width={148} height={24} rx={12} fill="#fff" stroke={T.green} strokeWidth={1.5} /><circle cx={414} cy={274} r={4} fill={T.green} /><text x={424} y={278} fontWeight={600} fontSize={11} fill={T.green}>Model answer overlay</text>
        </>}
      </svg>
    </div>
  );
}

export function Cat({ name, className }: { name: string; className?: string }) {
  return <Image src={`/design/cat-${name}.png`} alt="" width={96} height={96} className={cn("h-24 w-auto", className)} />;
}
