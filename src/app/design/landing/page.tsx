import Image from "next/image";
import { ArrowRight, Check, ClipboardList, Dumbbell, Layers, MessageCircle, Mic, Play, Upload } from "lucide-react";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

const NAV = ["Features", "How it works", "Pricing", "Blog"];
const STATS: [string, string][] = [["2,300+", "practice sets built from students’ own notes"], ["86%", "average worksheet score by week 3"], ["23", "countries studying with Scribe"]];
const STEPS: [string, string, string][] = [
  ["/design/cat2-book.png", "Drop in what you have", "PDFs, slides, photos of handwritten notes, a YouTube lecture. One file is enough."],
  ["/design/cat2-pencil.png", "Scribe writes the practice", "Readings, Quick 5s, cloze, worksheets with a markscheme — from your material, not a generic bank."],
  ["/design/cat2-flame.png", "Twenty minutes a day", "A plan that fits your calendar, flashcards that come back when you’re about to forget, a streak that means something."],
];
const FEATURES: [typeof Dumbbell, string, string][] = [
  [Dumbbell, "Quiz me on anything", "Ask for five questions on osmosis and get them from your Topic 3 notes."],
  [ClipboardList, "Worksheets marked like an examiner", "Each mark point shown against the phrase in your answer that earned it."],
  [Layers, "Flashcards that schedule themselves", "Spaced repetition decides what comes back today — you just answer."],
  [MessageCircle, "Copilot that has read your notes", "Hints, worked examples and “explain this differently” beside every question."],
  [Mic, "Explain it aloud", "Talk it through; Scribe checks the idea, not your wording."],
  [Play, "Figures, redrawn", "Diagrams from your PDF, cleaned up and labelled in the question."],
];

function Chip({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[11px] font-semibold", active ? "bg-accent text-white" : "bg-muted")}>{children}</span>;
}

/** The product, shrunk: materials row + a session + review donut. */
function HeroMock() {
  return (
    <div className="design-root relative w-full overflow-hidden rounded-3xl border border-border bg-[#fafafb] p-5 shadow-[0_24px_60px_-24px_rgba(124,58,237,.35)]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-faint">IB Bio HL</div>
          <div className="text-[20px] font-bold">Good afternoon, Alan</div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-[13px] text-faint"><Image src="/design/cat2-wave.png" alt="" width={28} height={28} unoptimized className="design-wiggle size-7 object-contain" />What do you want to practise?<span className="ml-auto grid size-6 place-items-center rounded-md bg-accent text-white"><ArrowRight className="size-3.5" /></span></div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {[["/design/thumb-notes.jpg", "Bio notes · Topic 3"], ["/design/thumb-handout.jpg", "Osmosis lab handout"], ["/design/thumb-slide.jpg", "Lecture slides 3.2"]].map(([src, t]) => (
              <div key={t} className="rounded-xl border border-border bg-white p-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"><Image src={src} alt="" fill unoptimized className="object-cover object-top" /></div>
                <div className="mt-1.5 truncate text-[11.5px] font-semibold">{t}</div>
                <div className="mt-1.5 flex flex-wrap gap-1"><Chip>Quiz me</Chip><Chip>Flashcards</Chip></div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5">
            <Ring pct={3 / 7} size={36} stroke={4}><span className="block size-4 rounded-[2px] border border-border bg-white" /></Ring>
            <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">Osmosis & water potential</div><div className="truncate text-[11px] text-faint">30 min · Moderate · next: Worksheet</div></div>
            <span className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-white">Continue</span>
          </div>
        </div>
        <div className="hidden w-[190px] shrink-0 flex-col gap-3 sm:flex">
          <div className="rounded-xl border border-border bg-white p-3"><div className="text-[12px] font-semibold">Due for review</div><div className="mt-2 flex items-center gap-3"><Donut parts={[[14, T.blue], [2, T.red], [22, T.grey]]} size={64} stroke={10}><span className="text-[13px] font-bold">16</span></Donut><div className="text-[10.5px] text-muted-foreground"><div><b className="text-foreground">14</b> cards</div><div><b className="text-foreground">2</b> mistakes</div><div><b className="text-foreground">22</b> done</div></div></div></div>
          <div className="rounded-xl border border-border bg-white p-3"><div className="flex items-baseline justify-between text-[12px] font-semibold">This week<span className="text-[10px] font-semibold text-orange-500">4-day streak</span></div><div className="mt-1"><WeekBars mins={[28, 32, 25, 30, 12, 0, 0]} height={48} /></div></div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPreview() {
  return (
    <div className="design-root min-h-dvh w-full bg-white text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6">
        <span className="text-[17px] font-bold">Scribe</span>
        <nav className="hidden gap-7 text-[14px] font-medium text-muted-foreground md:flex">{NAV.map((n) => <span key={n}>{n}</span>)}</nav>
        <div className="flex items-center gap-2"><span className="px-3 text-[14px] font-semibold">Sign in</span><span className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-white">Start free</span></div>
      </header>

      <section className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent"><Image src="/design/cat2-flame.png" alt="" width={18} height={18} unoptimized className="size-[18px] object-contain" />Built for IB, A-level, GCSE and AP</span>
          <h1 className="mt-5 text-[52px] font-bold leading-[1.02] tracking-[-0.02em]">Your notes.<br /><span className="text-accent">Actual practice.</span></h1>
          <p className="mt-5 max-w-[460px] text-[18px] leading-relaxed text-muted-foreground">Upload a PDF, slides or a photo of your notes. Scribe turns them into quizzes, worksheets and flashcards — marked, explained, and scheduled so you remember.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><span className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-white">Start studying free<ArrowRight className="size-4" /></span><span className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-5 text-[15px] font-semibold"><Play className="size-4" />Watch 60 seconds</span></div>
          <p className="mt-3 text-[12.5px] text-faint">Free to start · no card · first session in under 5 minutes</p>
        </div>
        <div className="relative">
          <Image src="/design/cat2-cheer.png" alt="" width={120} height={120} unoptimized className="design-pop absolute -left-8 -top-14 z-10 size-[112px] object-contain" />
          <HeroMock />
        </div>
      </section>

      <section className="border-y border-border bg-[#fafafb]">
        <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-6 py-10 sm:grid-cols-3">{STATS.map(([v, l]) => <div key={v} className="text-center sm:text-left"><div className="text-[34px] font-bold text-accent">{v}</div><div className="text-[14px] text-muted-foreground">{l}</div></div>)}</div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-6 py-20">
        <h2 className="text-center text-[34px] font-bold tracking-tight">How it works</h2>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-[16px] text-muted-foreground">Three steps. The first one is the only one you do.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">{STEPS.map(([img, t, d], i) => <div key={t} className="rounded-3xl border border-border p-7"><div className="flex items-center justify-between"><span className="grid size-8 place-items-center rounded-full bg-accent text-[13px] font-bold text-white">{i + 1}</span><Image src={img} alt="" width={72} height={72} unoptimized className="size-[72px] object-contain" /></div><h3 className="mt-4 text-[19px] font-bold">{t}</h3><p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{d}</p></div>)}</div>
      </section>

      <section className="bg-[#fafafb] py-20">
        <div className="mx-auto w-full max-w-[1120px] px-6">
          <h2 className="text-center text-[34px] font-bold tracking-tight">Everything a tutor would do, from your own material</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([I, t, d]) => <div key={t} className="rounded-2xl border border-border bg-white p-6"><span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><I className="size-5" /></span><h3 className="mt-4 text-[16px] font-bold">{t}</h3><p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{d}</p></div>)}</div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="design-root rounded-3xl border border-border bg-[#fafafb] p-6">
          <div className="text-[11px] font-semibold text-accent">Worksheet · Osmosis · Q4 · Text · 6 marks</div>
          <p className="mt-2 text-[15px] font-semibold">Explain why the potato cylinder in 0.6 M sucrose lost mass.</p>
          <div className="mt-3 rounded-xl border border-border bg-white p-3 text-[13.5px] leading-relaxed">The solution has a <mark className="rounded bg-emerald-100 px-0.5 text-emerald-900">lower water potential than the cells</mark>, so water moves <mark className="rounded bg-emerald-100 px-0.5 text-emerald-900">out by osmosis</mark> across the partially permeable membrane, and the cells become flaccid.</div>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5"><Ring pct={4 / 6} size={36} stroke={5} color={T.green}><span className="text-[11px] font-bold">4/6</span></Ring><div className="text-[13px]"><b>Good causal chain.</b> Missing: name the process at the membrane level (M5) and the effect on turgor (M6).</div></div>
          <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground"><Image src="/design/cat2-think.png" alt="" width={24} height={24} unoptimized className="size-6 object-contain" />Copilot: “Want a two-line version of M5 you can reuse in any osmosis question?”</div>
        </div>
        <div>
          <h2 className="text-[34px] font-bold tracking-tight">Marked like the exam. Explained like a friend.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">Every answer is checked against a markscheme written from your material. Hover a highlight to see the exact point it earned — and Copilot is right there for the ones you missed.</p>
          <ul className="mt-6 flex flex-col gap-2.5 text-[15px]">{["Per-mark feedback, not a green tick", "Hints only when you ask", "One Copilot chat across the whole session"].map((l) => <li key={l} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3" strokeWidth={3} /></span>{l}</li>)}</ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-12 text-white md:px-14">
          <div className="max-w-[560px]"><h2 className="text-[34px] font-bold tracking-tight">Tonight’s revision, sorted in five minutes.</h2><p className="mt-3 text-[16px] text-white/80">Drop in one file. Scribe builds the session, you press start.</p><div className="mt-7 flex flex-wrap gap-3"><span className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-accent"><Upload className="size-4" />Upload your first file</span><span className="inline-flex h-12 items-center rounded-xl border border-white/40 px-5 text-[15px] font-semibold">Try the sample</span></div></div>
          <Image src="/design/cat2-trophy.png" alt="" width={220} height={220} unoptimized className="absolute -bottom-4 right-10 hidden size-[220px] object-contain md:block" />
        </div>
      </section>

      <footer className="border-t border-border"><div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] text-muted-foreground"><span className="font-bold text-foreground">Scribe</span><div className="flex gap-6">{["Features", "Pricing", "Blog", "Privacy", "Terms"].map((l) => <span key={l}>{l}</span>)}</div><span>© 2026 Scribe</span></div></footer>
    </div>
  );
}
