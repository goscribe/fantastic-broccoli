import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
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

/** Generation progress: ring around the pencil cat, step list, one tip. */
export function Generating({ index, title, compact = false }: { index: number; title: string; compact?: boolean }) {
  const pct = Math.min(index, BUILD_STEPS.length) / BUILD_STEPS.length;
  const done = index >= BUILD_STEPS.length;
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-3" : "gap-4")}>
      <div className="relative">
        <Ring pct={Math.max(pct, 0.04)} size={compact ? 96 : 128} stroke={compact ? 7 : 9}>
          <Image src={done ? "/design/cat2-cheer.png" : "/design/cat2-pencil.png"} alt="" width={84} height={84} unoptimized className={cn("object-contain", compact ? "size-[62px]" : "size-[84px]", !done && "design-float")} />
        </Ring>
        <span className="absolute -right-1 -top-1 grid size-8 place-items-center rounded-full bg-white text-[12px] font-bold text-accent shadow-[0_1px_4px_rgba(17,17,20,.12)]">{Math.round(pct * 100)}%</span>
      </div>
      <div>
        <h2 className={cn("font-bold", compact ? "text-[18px]" : "text-[22px]")}>{done ? "Your session is ready" : `Building “${title}”`}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{done ? "Seven activities, about 30 minutes. Let’s go." : index >= 2 ? "Nearly there — a minute or so." : "Usually takes a couple of minutes. The hard part — showing up — is done."}</p>
      </div>
      <ol className="w-full max-w-[400px] text-left">
        {BUILD_STEPS.map(([label, detail], i) => {
          const state = i < index ? "done" : i === index ? "now" : "todo";
          return (
            <li key={label} className="flex items-start gap-3 py-2">
              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", state === "done" ? "bg-emerald-500 text-white" : state === "now" ? "border-2 border-accent border-t-transparent animate-spin" : "border-2 border-border")}>{state === "done" && <Check className="size-3" strokeWidth={3} />}</span>
              <span className="min-w-0">
                <span className={cn("block text-[14px] font-semibold", state === "todo" && "text-faint")}>{label}</span>
                {state !== "todo" && <span className="block truncate text-[12px] text-muted-foreground">{state === "done" ? detail : "…"}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {!done && (
        <p className="flex max-w-[400px] items-start gap-2 text-left text-[13px] text-muted-foreground"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />{TIPS[index % TIPS.length]}</p>
      )}
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
