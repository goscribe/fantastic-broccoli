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


/** Slim build status for when something else (the warm-up) owns the screen. */
export function BuildBar({ index, title }: { index: number; title: string }) {
  const pct = Math.min(index, BUILD_STEPS.length) / BUILD_STEPS.length;
  const done = index >= BUILD_STEPS.length;
  const step = BUILD_STEPS[Math.min(index, BUILD_STEPS.length - 1)];
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3">
      <Ring pct={Math.max(pct, 0.04)} size={44} stroke={4} color={done ? "#10b981" : undefined}>
        <Image src={done ? "/design/cat2-cheer.png" : "/design/cat2-pencil.png"} alt="" width={30} height={30} unoptimized className="size-[30px] object-contain" />
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{done ? "Your session is ready" : `Building “${title}”`}</div>
        <div className="truncate text-[12px] text-muted-foreground">{done ? "Seven activities · about 30 min" : `${step[0]}…`}</div>
      </div>
      {done ? (
        <span className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-semibold text-white">Start session</span>
      ) : (
        <div className="flex items-center gap-1">{BUILD_STEPS.map(([l], i) => <span key={l} className={cn("h-1.5 rounded-full", i < index ? "w-4 bg-accent" : i === index ? "w-4 bg-accent/40" : "w-1.5 bg-muted")} />)}</div>
      )}
    </div>
  );
}

/** One quick question from the uploaded notes to answer while waiting. */
export function WarmupCard({ hero = false }: { hero?: boolean }) {
  const opts = ["It swells and may burst", "It shrinks and crenates", "Nothing — the solution is isotonic", "It divides"];
  return (
    <div className={cn("w-full rounded-3xl border border-border bg-white text-left", hero ? "max-w-[640px] p-7" : "max-w-[400px] p-4")}>
      <div className="flex items-center justify-between text-[12px] font-semibold text-accent"><span>Warm-up · from your notes</span><span className="text-faint">1 of 3</span></div>
      <p className={cn("mt-2 font-semibold", hero ? "text-[22px] leading-snug" : "text-[14px]")}>A red blood cell is placed in pure water. What happens?</p>
      <div className={cn("flex flex-col", hero ? "mt-5 gap-2.5" : "mt-2.5 gap-1.5")}>{opts.map((o, i) => <span key={o} className={cn("flex items-center gap-3 rounded-xl border font-medium", hero ? "px-4 py-3.5 text-[15px]" : "px-3 py-2 text-[13px]", i === 0 ? "border-accent bg-accent-soft" : "border-border")}><span className={cn("grid shrink-0 place-items-center rounded-md text-[11px] font-bold", hero ? "size-6" : "size-5", i === 0 ? "bg-accent text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>{o}</span>)}</div>
      {hero && <div className="mt-5 flex items-center justify-between"><span className="text-[13px] text-faint">Answers count towards today’s review.</span><span className="inline-flex h-11 items-center rounded-xl bg-accent px-6 text-[14px] font-semibold text-white">Check</span></div>}
    </div>
  );
}
