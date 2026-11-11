import Image from "next/image";
import { ArrowUp, BookOpen, Camera, FileText, Layers, MessageCircle, Plus, Dumbbell, ClipboardList } from "lucide-react";
import { AppFrame } from "@/components/design/shell";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

const MATERIALS = [
  { kind: "pdf", title: "Bio notes · Topic 3", meta: "PDF · 14 pages · added Mon" },
  { kind: "img", title: "Osmosis lab handout", meta: "Photos · 3 pages · Tue" },
  { kind: "img", title: "Lecture slides 3.2", meta: "Photos · 8 · Wed" },
  { kind: "pp", title: "Paper 1 · May 2023", meta: "Past paper · 40 Qs · Thu" },
] as const;
const ACTIONS = [["Quiz me", Dumbbell], ["Flashcards", Layers], ["Worksheet", ClipboardList], ["Explain", MessageCircle]] as const;

function MatIcon({ kind }: { kind: "pdf" | "img" | "pp" }) {
  const map = { pdf: [FileText, "bg-accent text-white"], img: [Camera, "bg-sky-500 text-white"], pp: [BookOpen, "bg-emerald-500 text-white"] } as const;
  const [Icon, cls] = map[kind];
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-[7px] shadow-sm", cls)}><Icon className="size-3.5" /></span>;
}

const Lines = ({ y, n, w = 44, x = 10, gap = 5, color = "#c9c9d2" }: { y: number; n: number; w?: number; x?: number; gap?: number; color?: string }) => <>{Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.6 : w} height={1.6} rx={0.8} fill={color} />)}</>;

/** Thumbnail of the material itself: first PDF page, the photo, or the paper's cover. */
function Thumb({ kind, variant = 0 }: { kind: "pdf" | "img" | "pp"; variant?: number }) {
  return (
    <div className="relative h-[92px] w-[72px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-white shadow-[0_1px_2px_rgba(17,17,20,.06)]">
      <svg viewBox="0 0 64 82" className="h-full w-full">
        {kind === "pdf" && <>
          <rect x="10" y="8" width="30" height="3" rx="1.5" fill={T.violet} />
          <Lines y={16} n={4} />
          <rect x="10" y="39" width="44" height="22" rx="2" fill={T.lavenderLight} />
          <ellipse cx="32" cy="50" rx="11" ry="7" fill="none" stroke={T.violet} strokeWidth="1.3" />
          <circle cx="32" cy="50" r="2.5" fill={T.red} opacity=".8" />
          <path d="M15 50h5M44 50h5" stroke={T.blue} strokeWidth="1.2" />
          <Lines y={66} n={3} />
        </>}
        {kind === "img" && (variant === 0 ? <>
          <rect width="64" height="82" fill="#eef0f3" />
          <g transform="rotate(-4 32 41)">
            <rect x="8" y="6" width="50" height="70" rx="1.5" fill="#fffdf6" stroke="#e2dccb" />
            <Lines y={14} n={5} x={13} w={38} gap={6} color="#8a8a96" />
            <path d="M18 50c6-8 14-8 20 0s12 6 14 0" fill="none" stroke={T.violet} strokeWidth="1.4" />
            <Lines y={60} n={2} x={13} w={38} gap={6} color="#8a8a96" />
          </g>
        </> : <>
          <rect width="64" height="82" fill="#f4f4f6" />
          <rect x="4" y="18" width="56" height="46" rx="2" fill="#1f1b3a" />
          <rect x="9" y="24" width="30" height="3" rx="1.5" fill="#fff" />
          <Lines y={32} n={3} x={9} w={30} color="#9b93c9" />
          <rect x="42" y="30" width="13" height="18" rx="1.5" fill={T.violet} />
          <path d="M44 44l3-5 3 3 4-6" fill="none" stroke="#fff" strokeWidth="1.2" />
        </>)}
        {kind === "pp" && <>
          <rect x="6" y="6" width="52" height="7" rx="1" fill="none" stroke="#111114" strokeWidth=".9" />
          <rect x="8" y="8.5" width="14" height="2" fill="#111114" />
          <rect x="6" y="18" width="52" height="9" rx="1" fill="#f0f0f3" />
          <rect x="9" y="21" width="30" height="2.5" rx="1" fill="#111114" />
          <rect x="9" y="25" width="18" height="1.6" rx=".8" fill="#6b6b76" />
          <Lines y={34} n={6} x={8} w={48} gap={4.5} />
          <rect x="42" y="62" width="16" height="12" rx="1" fill="none" stroke={T.green} strokeWidth="1" />
          <text x="50" y="71" textAnchor="middle" fontSize="7" fontWeight="700" fill={T.green}>40</text>
        </>}
      </svg>
      <span className="absolute bottom-1 left-1"><MatIcon kind={kind} /></span>
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
          <div className="grid grid-cols-2 gap-3.5">
            {MATERIALS.map((m, i) => (
              <div key={m.title} className="flex gap-3.5 rounded-2xl border border-border bg-white p-3.5">
                <Thumb kind={m.kind} variant={i === 2 ? 1 : 0} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="truncate text-[14.5px] font-semibold">{m.title}</div><div className="text-[12px] text-faint">{m.meta}</div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">{ACTIONS.map(([l, Icon]) => <span key={l} className="inline-flex h-7 items-center gap-1.5 rounded-[8px] bg-muted px-2 text-[12px] font-semibold"><Icon className="size-3.5 text-muted-foreground" />{l}</span>)}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-border p-4">
              <Image src="/design/cat2-sleep.png" alt="" width={48} height={48} className="cat-bob h-12 w-auto" />
              <div><div className="text-[14.5px] font-semibold">Add material</div><div className="text-[12px] text-faint">Upload · Photos · Record · Paste a link</div></div>
              <Plus className="ml-auto size-4 text-faint" />
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
