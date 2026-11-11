import Image from "next/image";
import { Ring } from "@/components/design/charts";
import { cn } from "@/lib/utils";

export const BUILD_STEPS = [
  ["Reading your material", "14 pages · found 3 figures"],
  ["Finding key concepts", "osmosis · water potential · active transport"],
  ["Writing practice questions", "12 questions · 2 worksheets"],
  ["Building your study plan", "7 activities · about 30 min"],
] as const;

const TIPS = [
  "Students who finish their first session come back 3× more often.",
  "Short daily sessions beat one long cram — Scribe plans for 20 minutes.",
  "Flashcards you get wrong come back sooner; ones you know wait longer.",
];

/** Generation progress: ring around the cat, one line, the current step. */
export function Generating({ index, title, compact = false }: { index: number; title: string; compact?: boolean }) {
  const pct = Math.min(index, BUILD_STEPS.length) / BUILD_STEPS.length;
  const done = index >= BUILD_STEPS.length;
  const step = BUILD_STEPS[Math.min(index, BUILD_STEPS.length - 1)];
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-4" : "gap-6")}>
      <Ring pct={Math.max(pct, 0.04)} size={compact ? 120 : 168} stroke={compact ? 8 : 11}>
        <Image src={done ? "/design/cat2-cheer.png" : "/design/cat2-pencil.png"} alt="" width={120} height={120} unoptimized className={cn("object-contain", done ? "design-pop size-[108px]" : "design-float size-[104px]")} />
      </Ring>
      <div>
        <h2 className={cn("font-bold tracking-tight", compact ? "text-[20px]" : "text-[26px]")}>{done ? "Your session is ready" : `Building “${title}”`}</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">{done ? "Seven activities, about 30 minutes. Let’s go." : `${step[0]}…`}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {BUILD_STEPS.map(([label], i) => (
          <span key={label} className={cn("h-1.5 rounded-full transition-all", i < index || done ? "w-6 bg-accent" : i === index ? "w-6 bg-accent/40" : "w-1.5 bg-muted")} />
        ))}
      </div>
      {!done && <p className="text-[13px] text-faint">{TIPS[index % TIPS.length]}</p>}
    </div>
  );
}

/** One quick question from the uploaded notes to answer while waiting. */
export function WarmupCard() {
  const opts = ["It swells and may burst", "It shrinks and crenates", "Nothing — the solution is isotonic", "It divides"];
  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-border bg-white p-4 text-left">
      <div className="text-[11px] font-semibold text-accent">Warm-up while you wait</div>
      <p className="mt-1 text-[14px] font-semibold">A red blood cell is placed in pure water. What happens?</p>
      <div className="mt-2.5 flex flex-col gap-1.5">{opts.map((o, i) => <span key={o} className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px]", i === 0 ? "border-accent bg-accent-soft/40 font-semibold" : "border-border")}><span className={cn("grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold", i === 0 ? "bg-accent text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>{o}</span>)}</div>
    </div>
  );
}
