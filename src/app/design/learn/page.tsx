import Image from "next/image";
import { ArrowUp, BookOpen, Camera, FileText, Layers, Plus, ClipboardList, ChevronDown, ChevronUp, Flame, Mic, Shuffle } from "lucide-react";
import { AppFrame } from "@/components/design/shell";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

const SESSIONS = [
  { kind: "pdf", title: "Osmosis & water potential", ws: "Bio notes · Topic 3", meta: "30 min · Moderate", done: 3, total: 7, next: "Worksheet · Osmosis calculations", status: "active", src: "/design/thumb-notes.jpg" },
  { kind: "img", title: "Potato lab write-up", ws: "Osmosis lab handout", meta: "20 min · Light", done: 1, total: 5, next: "Cloze · Method steps", status: "active", src: "/design/thumb-handout.jpg" },
  { kind: "img", title: "Active vs passive transport", ws: "Lecture slides 3.2", meta: "45 min · Deep", done: 0, total: 9, next: "Reading · Transport proteins", status: "new", src: "/design/thumb-slide.jpg" },
  { kind: "pp", title: "Paper 1 · May 2023 walkthrough", ws: "Past paper", meta: "60 min · Exam", done: 20, total: 40, next: "Quick 5 · Section B", status: "active", src: "/design/thumb-paper.jpg" },
  { kind: "pdf", title: "Cell structure recap", ws: "Bio notes · Topic 2", meta: "25 min · Moderate", done: 6, total: 6, next: "Debrief ready", status: "done", src: "/design/thumb-notes.jpg" },
  { kind: "img", title: "Enzymes · class worksheet", ws: "Enzymes worksheet", meta: "15 min · Light", done: 4, total: 4, next: "Debrief ready", status: "done", src: "/design/thumb-handout.jpg" },
  { kind: "img", title: "Lecture 2.4 · Organelles", ws: "Lecture slides 2.4", meta: "40 min · Deep", done: 2, total: 8, next: "Flashcards · Organelle functions", status: "active", src: "/design/thumb-slide.jpg" },
] as const;
const RECENT = [
  { Icon: ClipboardList, cls: "bg-accent-soft text-accent", title: "Worksheet · Osmosis calculations", sub: "Osmosis & water potential · 6 questions", result: "5/6", xp: "+40 XP", when: "Today 16:10" },
  { Icon: Layers, cls: "bg-sky-100 text-sky-600", title: "Flashcards · Membranes", sub: "Cell structure recap · 22 cards · 2 to fix", result: "91%", xp: "+22 XP", when: "Today 08:45" },
  { Icon: Mic, cls: "bg-rose-100 text-rose-600", title: "Explain aloud · Active transport", sub: "Active vs passive transport · 1 m 40 s", result: "3/4", xp: "+30 XP", when: "Yesterday" },
  { Icon: Shuffle, cls: "bg-emerald-100 text-emerald-600", title: "Quick 5 · Topic 3 mix", sub: "Osmosis & water potential · daily 5", result: "4/5", xp: "+25 XP", when: "Yesterday" },
  { Icon: Flame, cls: "bg-amber-100 text-amber-600", title: "Mock · Paper 1 section A", sub: "Paper 1 walkthrough · 20 Qs · 24 min", result: "15/20", xp: "+60 XP", when: "Mon" },
] as const;

function MatIcon({ kind }: { kind: "pdf" | "img" | "pp" }) {
  const map = { pdf: [FileText, "bg-accent text-white"], img: [Camera, "bg-sky-500 text-white"], pp: [BookOpen, "bg-emerald-500 text-white"] } as const;
  const [Icon, cls] = map[kind];
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-[7px] shadow-sm", cls)}><Icon className="size-3.5" /></span>;
}

/** Preview of the material itself: first PDF page, the photo, the paper's cover. */
function Thumb({ src, kind }: { src: string; kind: "pdf" | "img" | "pp" }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted">
      <Image src={src} alt="" fill priority unoptimized className="object-cover object-top" />
      <span className="absolute bottom-2 left-2"><MatIcon kind={kind} /></span>
    </div>
  );
}

export default async function LearnPreview({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const expanded = all === "1";
  const shown = expanded ? SESSIONS : SESSIONS.slice(0, 3);
  return (
    <AppFrame active="Learn">
      <div className="flex h-full gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <div className="flex items-end justify-between">
            <div><div className="text-[11px] font-semibold text-faint">IB Bio HL</div><h1 className="mt-0.5 text-[26px] font-bold">Good afternoon, Alan</h1></div>
            <span className="text-[13px] text-faint">Paper 1 in 23 days</span>
          </div>
          <div className="rounded-[18px] border border-border p-3.5">
            <div className="flex items-center gap-3">
              <Image src="/design/cat2-wave.png" alt="" width={40} height={40} className="cat-wiggle h-10 w-auto" />
              <span className="flex-1 text-[15px] text-faint">What do you want to practise?</span>
              <span className="grid size-9 place-items-center rounded-[10px] bg-accent text-white"><ArrowUp className="size-4" /></span>
            </div>
            <div className="mt-3 flex gap-2 overflow-hidden">{["Quiz me on osmosis", "Flashcards for 3.2", "Explain water potential", "Mock Paper 1 section A"].map((c) => <span key={c} className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[13px] font-medium">{c}</span>)}</div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Your study sessions <span className="font-medium text-faint">· {SESSIONS.length}</span></h2>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold"><Plus className="size-3.5" />New session</span>
              <a href={expanded ? "/design/learn" : "/design/learn?all=1"} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">{expanded ? <>Show less<ChevronUp className="size-4" /></> : <>Show all {SESSIONS.length}<ChevronDown className="size-4" /></>}</a>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {shown.map((s) => {
              const pct = s.done / s.total;
              return (
                <div key={s.title} className="flex flex-col rounded-2xl border border-border bg-white p-3">
                  <Thumb src={s.src} kind={s.kind} />
                  <div className="mt-3 flex items-center justify-between gap-2 px-0.5"><div className="truncate text-[14.5px] font-semibold">{s.title}</div>{s.status === "done" && <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Done</span>}{s.status === "new" && <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">New</span>}</div>
                  <div className="truncate px-0.5 text-[12px] text-faint">{s.ws} · {s.meta}</div>
                  <div className="mt-2.5 px-0.5">
                    <div className="flex items-center justify-between text-[11.5px]"><span className="font-semibold text-muted-foreground">{s.done} of {s.total} activities</span><span className="font-semibold text-accent">{Math.round(pct * 100)}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", s.status === "done" ? "bg-emerald-500" : "bg-accent")} style={{ width: `${pct * 100}%` }} /></div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 px-0.5 text-[12px]"><span className="text-faint">Next</span><span className="truncate font-semibold">{s.next}</span></div>
                  <span className={cn("mt-3 inline-flex h-8 items-center justify-center rounded-[9px] text-[12.5px] font-semibold", s.status === "active" ? "bg-accent text-white" : "bg-muted")}>{s.status === "active" ? "Continue" : s.status === "new" ? "Start" : "View debrief"}</span>
                </div>
              );
            })}
            {expanded && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-center">
                <Image src="/design/cat2-sleep.png" alt="" width={64} height={64} className="cat-bob h-16 w-auto" />
                <div><div className="text-[14.5px] font-semibold">New study session</div><div className="mt-0.5 text-[12px] text-faint">From a material · Upload · Paste a link</div></div>
              </div>
            )}
          </div>
          <div className="flex items-baseline justify-between"><h2 className="text-[16px] font-semibold">Recent activity</h2><span className="text-[13px] font-semibold text-accent">All activity</span></div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-white">
            {RECENT.map((r) => (
              <div key={r.title} className="flex items-center gap-3.5 px-4 py-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px]", r.cls)}><r.Icon className="size-4" /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{r.title}</div><div className="truncate text-[12px] text-faint">{r.sub}</div></div>
                <div className="w-14 text-right text-[14px] font-bold">{r.result}</div>
                <div className="w-16 text-right text-[12.5px] font-semibold text-accent">{r.xp}</div>
                <div className="w-24 text-right text-[12px] text-faint">{r.when}</div>
                <span className="ml-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold">Resume</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[300px] shrink-0 flex-col gap-3.5">
          <div className="relative overflow-hidden rounded-2xl p-[18px]" style={{ background: T.lavender }}>
            <Image src="/design/cat2-book.png" alt="" width={72} height={72} className="cat-peek absolute right-2.5 top-2 h-[72px] w-auto" />
            <div className="flex items-center gap-2"><Ring pct={0.6} size={28} stroke={12} /><span className="text-[11px] font-semibold text-accent-dim">Suggested next · 3 of 5 today</span></div>
            <div className="mt-2 pr-16 text-[16px] font-bold leading-tight">Worksheet · Osmosis calculations</div>
            <div className="mt-1 text-[12.5px] text-accent-dim">6 min · fits your 17:30 slot · from Bio notes pp. 13–16</div>
            <div className="mt-3.5 flex gap-2"><button className="h-9 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white">Start</button><button className="h-9 rounded-xl bg-white/70 px-4 text-[13.5px] font-semibold">See plan</button></div>
          </div>
          <div className="rounded-2xl border border-border p-[18px]">
            <div className="flex items-baseline justify-between"><span className="text-[16px] font-semibold">Due for review</span><span className="text-[13px] text-faint">~6 min</span></div>
            <div className="mt-3 flex items-center gap-4">
              <Donut parts={[[0.58, T.sky], [0.08, T.red]]}><span className="text-[20px] font-bold leading-none">16</span><br /><span className="text-[11px] font-semibold text-faint">due</span></Donut>
              <div className="flex flex-col gap-2 text-[13px]">{[["14", "cards due", T.sky], ["2", "mistakes to fix", T.red], ["22", "done today", T.border]].map(([n, l, c]) => <span key={l} className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: c }} /><b>{n}</b><span className="text-faint">{l}</span></span>)}</div>
            </div>
            <button className="mt-3.5 h-10 w-full rounded-xl bg-muted text-[14px] font-semibold">Review now</button>
          </div>
          <div className="rounded-2xl border border-border p-[18px]">
            <div className="flex items-baseline justify-between"><span className="text-[16px] font-semibold">This week</span><span className="text-[12px] text-faint">1 h 42 min · <b style={{ color: T.orange }}>4-day streak</b></span></div>
            <div className="mt-3.5"><WeekBars mins={[28, 31, 26, 25, 12, 0, 0]} /></div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
