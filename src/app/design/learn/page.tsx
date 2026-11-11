import Image from "next/image";
import { ArrowUp, BookOpen, Camera, FileText, Layers, MessageCircle, Plus, Dumbbell, ClipboardList } from "lucide-react";
import { AppFrame } from "@/components/design/shell";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

const MATERIALS = [
  { kind: "pdf", title: "Bio notes · Topic 3", meta: "PDF · 14 pages · added Mon", src: "/design/thumb-notes.jpg" },
  { kind: "img", title: "Osmosis lab handout", meta: "Photos · 3 pages · Tue", src: "/design/thumb-handout.jpg" },
  { kind: "img", title: "Lecture slides 3.2", meta: "Photos · 8 · Wed", src: "/design/thumb-slide.jpg" },
  { kind: "pp", title: "Paper 1 · May 2023", meta: "Past paper · 40 Qs · Thu", src: "/design/thumb-paper.jpg" },
] as const;
const ACTIONS = [["Quiz me", Dumbbell], ["Flashcards", Layers], ["Worksheet", ClipboardList], ["Explain", MessageCircle]] as const;

function MatIcon({ kind }: { kind: "pdf" | "img" | "pp" }) {
  const map = { pdf: [FileText, "bg-accent text-white"], img: [Camera, "bg-sky-500 text-white"], pp: [BookOpen, "bg-emerald-500 text-white"] } as const;
  const [Icon, cls] = map[kind];
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-[7px] shadow-sm", cls)}><Icon className="size-3.5" /></span>;
}

/** Preview of the material itself: first PDF page, the photo, the paper's cover. */
function Thumb({ src, kind }: { src: string; kind: "pdf" | "img" | "pp" }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted">
      <Image src={src} alt="" fill sizes="260px" className="object-cover object-top" />
      <span className="absolute bottom-2 left-2"><MatIcon kind={kind} /></span>
    </div>
  );
}

export default function LearnPreview() {
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
          <div className="flex items-baseline justify-between"><h2 className="text-[16px] font-semibold">Your materials</h2><span className="text-[13px] font-semibold text-accent">All 9</span></div>
          <div className="grid grid-cols-3 gap-3.5">
            {MATERIALS.map((m) => (
              <div key={m.title} className="flex flex-col rounded-2xl border border-border bg-white p-3">
                <Thumb src={m.src} kind={m.kind} />
                <div className="mt-3 truncate px-0.5 text-[14.5px] font-semibold">{m.title}</div><div className="px-0.5 text-[12px] text-faint">{m.meta}</div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">{ACTIONS.map(([l, Icon]) => <span key={l} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-muted px-2 text-[12px] font-semibold"><Icon className="size-3.5 text-muted-foreground" />{l}</span>)}</div>
              </div>
            ))}
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-center">
              <Image src="/design/cat2-sleep.png" alt="" width={64} height={64} className="cat-bob h-16 w-auto" />
              <div><div className="text-[14.5px] font-semibold">Add material</div><div className="mt-0.5 text-[12px] text-faint">Upload · Photos · Record · Paste a link</div></div>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent-soft px-3 text-[12.5px] font-semibold text-accent"><Plus className="size-3.5" />Add</span>
            </div>
          </div>
          <h2 className="text-[16px] font-semibold">Recent</h2>
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
