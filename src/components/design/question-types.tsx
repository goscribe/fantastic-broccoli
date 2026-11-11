import { Check, Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Ring } from "./charts";
import { T } from "./tokens";

const field = "rounded-[14px] border bg-white text-[15px]";
const SideHint = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="w-[300px] shrink-0 rounded-2xl bg-muted p-4"><div className="text-[11px] font-semibold text-faint">{title}</div><div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</div></div>;
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex items-start gap-5">{children}</div>;

export function NumericBody({ marked }: { marked: boolean }) {
  return (
    <Row>
      <div className="min-w-0 flex-1">
        <div className={cn(field, "p-4", marked ? "border-emerald-300 bg-emerald-50/40" : "border-accent")}>
          <div className="text-[11px] font-semibold text-faint">Working (optional)</div>
          <div className="mt-1 font-mono text-[14px] leading-relaxed">(2.13 − 2.40) / 2.40 × 100<br />= −0.27 / 2.40 × 100</div>
          <div className="mt-3 flex items-center gap-3"><span className="text-[13px] font-semibold text-muted-foreground">Answer</span><span className={cn("flex h-11 w-40 items-center rounded-xl border px-3.5 text-[17px] font-semibold", marked ? "border-emerald-500" : "border-accent")}>−11.25{!marked && <span className="ml-0.5 inline-block h-5 w-0.5 bg-accent" />}</span><span className="flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-[14px] font-medium text-muted-foreground">%</span>{marked && <Check className="size-5 text-emerald-600" />}</div>
        </div>
        <div className="mt-2 text-[12px] text-faint">Give your answer to 1 decimal place · units are filled in for you</div>
      </div>
      <SideHint title="Markscheme · 2 marks"><div className="flex flex-col gap-1.5">{[["M1", "Change ÷ original mass × 100 (working)", marked], ["M2", "−11.3% (accept −11.2 to −11.4)", marked]].map(([m, t, ok]) => <div key={m as string} className="flex gap-2"><span className={cn("grid h-5 w-[30px] shrink-0 place-items-center rounded-md text-[11px] font-bold", ok ? "bg-emerald-600 text-white" : "bg-white text-muted-foreground")}>{m}</span>{t}</div>)}</div></SideHint>
    </Row>
  );
}

export function TrueFalseBody({ marked }: { marked: boolean }) {
  const tile = (label: string, picked: boolean, right: boolean) => (
    <button className={cn("flex h-[88px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border text-[17px] font-semibold", !marked && picked && "border-accent bg-accent-soft", marked && right && "border-emerald-300 bg-emerald-50", marked && picked && !right && "border-rose-300 bg-rose-50", !picked && !right && "border-border bg-white")}>
      {label}
      {marked && (right ? <span className="text-[11px] font-semibold text-emerald-700">Correct answer</span> : picked ? <span className="text-[11px] font-semibold text-rose-700">Your answer</span> : null)}
    </button>
  );
  return (
    <Row>
      <div className="flex-1"><div className="flex gap-3">{tile("True", true, false)}{tile("False", false, true)}</div><div className="mt-2 text-[12px] text-faint">Press T or F · Enter to check</div></div>
      <SideHint title="From your notes · p. 14">&ldquo;Facilitated diffusion: passive movement through channel or carrier proteins, down the concentration gradient, <b>no energy required</b>.&rdquo;</SideHint>
    </Row>
  );
}

export function MatchingBody({ marked }: { marked: boolean }) {
  const pairs: [string, string, boolean][] = [["Hypertonic", "Cell shrinks (crenates)", true], ["Hypotonic", "No net change", false], ["Isotonic", "Cell swells and bursts", false], ["Pure water", "Bursts fastest", true]];
  const colors = [T.violet, T.sky, T.orange, T.green];
  return (
    <Row>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {pairs.map(([l, r, ok], i) => (
          <div key={l} className="flex items-center gap-3">
            <span className="flex h-12 w-[200px] items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 text-[14.5px] font-medium"><i className="size-2.5 rounded-full" style={{ background: colors[i] }} />{l}</span>
            <span className="h-0.5 w-10 rounded" style={{ background: marked && !ok ? T.red : colors[i] }} />
            <span className={cn("flex h-12 flex-1 items-center gap-2.5 rounded-xl border px-3.5 text-[14.5px] font-medium", marked ? (ok ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50") : "border-border bg-white")}>{r}{marked && (ok ? <Check className="ml-auto size-4 text-emerald-600" /> : <X className="ml-auto size-4 text-red-600" />)}</span>
          </div>
        ))}
        <div className="mt-1 text-[12px] text-faint">Drag a card on the right, or press 1–4 then A–D</div>
      </div>
      <SideHint title="Tip">Think about where the <b>water</b> goes, not the solute — it always moves toward the side with more dissolved stuff.</SideHint>
    </Row>
  );
}

export function ClozeBody({ marked }: { marked: boolean }) {
  const blank = (v: string, ok = true, w = 110) => <span className={cn("mx-0.5 inline-flex h-8 items-center justify-center rounded-lg border px-2 align-middle text-[14px] font-semibold", marked ? (ok ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-rose-400 bg-rose-50 text-rose-800 line-through") : "border-accent bg-accent-soft/60 text-accent-dim")} style={{ minWidth: w }}>{v}</span>;
  return (
    <Row>
      <div className="min-w-0 flex-1">
        <div className={cn(field, "border-border p-5 text-[16px] leading-[2.2]")}>
          The cell membrane is {blank(marked ? "permeable" : "permeable", false, 150)}{marked && <span className="ml-1 text-[13px] font-semibold text-emerald-700">selectively permeable</span>}, so small non-polar molecules such as {blank("O₂", true, 60)} cross by {blank("simple diffusion", true, 150)}. Ions and large polar molecules need {blank("channel", true, 100)} or carrier proteins. Moving a substance {blank("against", true, 90)} its gradient requires {blank("ATP", true, 70)}.
        </div>
        <div className="mt-2 text-[12px] text-faint">Type in each blank · Tab to move on</div>
      </div>
      <SideHint title="Word bank"><div className="flex flex-wrap gap-1.5">{["ATP", "O₂", "against", "channel", "selectively permeable", "simple diffusion", "osmosis", "with"].map((w) => <span key={w} className="rounded-lg border border-border bg-white px-2 py-1 text-[12.5px] font-medium">{w}</span>)}</div></SideHint>
    </Row>
  );
}

export function SummaryBody({ marked }: { marked: boolean }) {
  const ideas: [string, boolean][] = [["Names the routes (diffusion, facilitated, active, osmosis)", true], ["Size / polarity decides whether a protein is needed", true], ["Direction relative to the gradient", true], ["Energy: passive vs active (ATP)", false]];
  return (
    <Row>
      <div className="min-w-0 flex-1">
        <div className={cn(field, "min-h-[140px] p-4 text-[14px] leading-[1.6]", marked ? "border-border" : "border-accent")}>Small non-polar molecules slip straight through the bilayer, while ions and big polar molecules have to use channel or carrier proteins. Water moves by osmosis toward the side with more solute. Which route a substance takes depends on its size and whether it is charged.{!marked && <span className="ml-0.5 inline-block h-[18px] w-0.5 -translate-y-[3px] bg-accent align-middle" />}</div>
        <div className="mt-2 flex justify-between text-[12px] text-faint"><span>52 words · aim for 40–80</span><span>Reading: Transport across membranes · 3 min</span></div>
      </div>
      <div className="w-[320px] shrink-0">
        {marked ? <div className="flex flex-col gap-3"><div className="flex items-center gap-4 rounded-2xl border border-border p-4"><Ring pct={0.75} size={64} stroke={10} color={T.green}><span className="text-[15px] font-bold">3/4</span></Ring><div><div className="text-[16px] font-bold">Nearly complete</div><div className="text-[13px] text-faint">One idea missing</div></div></div><div className="flex flex-col gap-2 rounded-2xl bg-muted p-4">{ideas.map(([t, ok]) => <div key={t} className={cn("flex items-start gap-2.5 text-[13px]", !ok && "text-muted-foreground")}><span className={cn("mt-px grid size-[18px] shrink-0 place-items-center rounded-full text-white", ok ? "bg-emerald-600" : "bg-red-600")}>{ok ? <Check className="size-[11px]" /> : <X className="size-[11px]" />}</span>{t}</div>)}</div></div>
          : <SideHint title="Key ideas · 4">We check for the ideas, not the wording.<div className="mt-2 flex flex-wrap gap-1.5">{["Routes", "Size / polarity", "Direction", "Energy"].map((c) => <span key={c} className="rounded-[7px] border border-border bg-white px-2 py-1 text-[12px] font-semibold text-muted-foreground">{c}</span>)}</div></SideHint>}
      </div>
    </Row>
  );
}

export function ExplainBody({ marked }: { marked: boolean }) {
  const bars = Array.from({ length: 48 }, (_, i) => 8 + Math.abs(Math.sin(i * 0.9) * 26 + Math.cos(i * 0.37) * 10));
  return (
    <Row>
      <div className="min-w-0 flex-1">
        <div className={cn(field, "flex flex-col items-center gap-4 border-border p-6")}>
          <div className="flex h-16 items-center gap-[3px]">{bars.map((h, i) => <span key={i} className="w-[5px] rounded-full" style={{ height: h, background: i < (marked ? 48 : 30) ? T.violet : T.border }} />)}</div>
          <div className="text-[28px] font-bold tabular-nums">{marked ? "0:47" : "0:29"}<span className="text-[14px] font-medium text-faint"> / 0:45</span></div>
          <button className={cn("grid size-16 place-items-center rounded-full text-white shadow-lg", marked ? "bg-foreground" : "bg-red-500")}>{marked ? <Mic className="size-6" /> : <Square className="size-6" fill="currentColor" />}</button>
          <div className="text-[12.5px] text-faint">{marked ? "Tap to record again" : "Recording… tap to stop"}</div>
        </div>
        {marked && <div className="mt-3 rounded-2xl border border-border p-4 text-[13.5px] leading-relaxed text-muted-foreground"><span className="text-[11px] font-semibold text-faint">Transcript</span><br />&ldquo;Imagine the cell is a balloon full of salty water. Pure water outside has way more water molecules, so by osmosis they rush in — the balloon fills until it pops. <mark className="rounded-[3px] bg-rose-100 text-rose-800">Water goes to where there is less water</mark>…&rdquo;</div>}
      </div>
      <SideHint title="We listen for">{["Uses the word osmosis", "Gives the direction of water movement", "Explains why the cell bursts (no cell wall)", "Pitched for a Year 9 — an analogy helps"].map((c, i) => <div key={c} className="flex gap-2"><span className="font-bold text-accent">{i + 1}</span>{c}</div>)}</SideHint>
    </Row>
  );
}
