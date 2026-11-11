import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Play, Star } from "lucide-react";
import { Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";


function Btn({ children, tone = "violet", className }: { children: React.ReactNode; tone?: "violet" | "white" | "ghost" | "navy"; className?: string }) {
  return (
    <span className={cn("inline-flex h-14 items-center gap-2 rounded-2xl px-7 text-[16px] font-bold shadow-[0_4px_0_0_rgba(0,0,0,.14)]", tone === "violet" && "bg-accent text-white", tone === "white" && "bg-white text-accent", tone === "navy" && "bg-[#1e1b4b] text-white", tone === "ghost" && "border-2 border-white/60 text-white shadow-none", className)}>{children}</span>
  );
}

/** Floating study props around the hero cat. */
function Prop({ src, className, delay = "0s" }: { src: string; className: string; delay?: string }) {
  return <Image src={src} alt="" width={96} height={96} unoptimized className={cn("cat-float absolute object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.18)]", className)} style={{ animationDelay: delay }} />;
}

/** A session card as a "phone" at the centre of the hero. */
function HeroCard() {
  return (
    <div className="design-root relative w-[300px] rounded-[28px] border-[6px] border-[#5b21b6] bg-white p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]">
      <div className="text-[11px] font-semibold text-faint">IB Bio HL · Topic 3</div>
      <div className="mt-0.5 text-[16px] font-bold">Osmosis & water potential</div>
      <div className="mt-3 flex items-center gap-3">
        <Ring pct={3 / 7} size={48} stroke={6}><span className="text-[11px] font-bold">3/7</span></Ring>
        <div className="text-[12px] text-muted-foreground"><b className="text-foreground">Next:</b> Worksheet · 6 marks<br />about 12 min left</div>
      </div>
      <div className="mt-3 rounded-xl bg-accent-soft p-3 text-[12.5px] font-semibold">Explain why the potato cylinder in 0.6 M sucrose lost mass.</div>
      <div className="mt-3 flex gap-1.5">{["Reading", "Quick 5", "Cloze", "Worksheet"].map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i < 3 ? "bg-accent" : "bg-muted")} />)}</div>
    </div>
  );
}

function Band({ bg, dark = false, children, className }: { bg: string; dark?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("w-full", dark && "text-white")} style={{ background: bg }}>
      <div className={cn("mx-auto grid w-full max-w-[1120px] items-center gap-12 px-6 py-24 lg:grid-cols-2", className)}>{children}</div>
    </section>
  );
}

function Headline({ children, sub, dark = false }: { children: React.ReactNode; sub: string; dark?: boolean }) {
  return (
    <div>
      <h2 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">{children}</h2>
      <p className={cn("mt-4 max-w-[440px] text-[17px] leading-relaxed", dark ? "text-white/75" : "text-muted-foreground")}>{sub}</p>
    </div>
  );
}

const LAV = "#f5f3ff";
const NAVY = "#1e1b4b";

const STATS: [string, string][] = [
  ["2,300+", "students revising with Scribe"],
  ["86%", "average markscheme score after a week"],
  ["23 min", "average study session"],
  ["1.2M", "flashcards reviewed on time"],
];

const QUOTES: [string, string, string][] = [
  ["It marked my 6-marker exactly like my teacher did, then told me which point I’d skipped.", "Maya", "IB Bio HL · Year 13"],
  ["I just photograph the board after class. By the evening there’s a worksheet waiting.", "Tom", "A-level Chemistry"],
  ["The flashcards come back the day before I’d have forgotten them. It’s a bit creepy.", "Priya", "GCSE · Year 11"],
];

export function LandingBody() {
  return (
    <>

      {/* hero: headline on white, desk scene + session card on a violet curve */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pt-12 text-center">
          <h1 className="text-[56px] font-extrabold leading-[1.02] tracking-[-0.02em] text-accent md:text-[68px]">study from your notes.<br />actually remember it.</h1>
          <p className="mt-5 max-w-[560px] text-[18px] text-muted-foreground">Drop in a PDF, slides or a photo of your notes. Scribe turns them into quizzes, worksheets and flashcards that know what you’re about to forget.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/signup"><Btn>Get started<ArrowRight className="size-5" /></Btn></Link><Link href="/landing/how-it-works" className="inline-flex h-14 items-center gap-2 rounded-2xl border-2 border-border px-6 text-[16px] font-bold text-accent"><Play className="size-4" />I already have an account</Link></div>
        </div>
        <div className="relative mt-10 h-[460px]">
          <svg viewBox="0 0 1440 460" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><path d="M0 140 C 360 40, 1080 40, 1440 140 L1440 460 L0 460 Z" fill="#7c3aed" /></svg>
          <div className="relative mx-auto h-full w-full max-w-[1120px]">
            <Image src="/design/cat2-cheer.png" alt="" width={300} height={300} unoptimized className="design-pop absolute bottom-6 left-[8%] z-10 size-[270px] object-contain" />
            <div className="absolute left-1/2 top-14 -translate-x-1/2 -rotate-3"><HeroCard /></div>
            <Image src="/design/cat2-book.png" alt="" width={220} height={220} unoptimized className="cat-bob absolute bottom-4 right-[8%] z-10 size-[200px] object-contain" />
            <Prop src="/design/props/star.png" className="left-[6%] top-6 size-14" />
            <Prop src="/design/props/pencil.png" className="left-[30%] top-[40px] size-16 -rotate-12" delay="0.6s" />
            <Prop src="/design/props/books.png" className="right-[26%] top-[320px] size-20" delay="1.1s" />
            <Prop src="/design/props/trophy.png" className="right-[32%] top-[-6px] size-16" delay="0.3s" />
            <Prop src="/design/props/cards.png" className="left-[27%] top-[330px] size-20 rotate-6" delay="1.6s" />
            <Prop src="/design/props/flag.png" className="right-[4%] top-6 size-12" delay="0.9s" />
          </div>
        </div>
      </section>

      {/* subjects strip */}
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-5 text-[13px] font-bold text-muted-foreground">{["IB", "A-level", "GCSE", "AP", "SAT", "University"].map((s) => <span key={s}>{s}</span>)}</div>
      </section>

      {/* stats */}
      <section className="w-full text-white" style={{ background: NAVY }}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-y-10 px-6 py-16 md:grid-cols-4">
          {STATS.map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="text-[56px] font-extrabold leading-none tracking-tight">{n}</div>
              <div className="mx-auto mt-3 max-w-[180px] text-[14px] font-semibold leading-snug text-white/65">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 1 lavender: marked like the exam */}
      <Band bg={LAV}>
        <Headline sub="Every answer is checked against a markscheme written from your material. Hover a highlight to see the exact point it earned.">marked like the exam. explained like a friend.</Headline>
        <div className="relative mx-auto w-full max-w-[460px] pt-10">
          <div className="absolute inset-x-6 top-0 h-24 rotate-[-3deg] rounded-3xl bg-white/70 px-5 py-4 text-[12px] font-semibold text-muted-foreground shadow-[0_20px_40px_-24px_rgba(76,29,149,.3)]">Q4 · Explain why the potato cylinder in 0.6 M sucrose lost mass. <span className="text-accent">[6]</span></div>
          <div className="design-root relative w-full rounded-3xl bg-white p-6 text-foreground shadow-[0_30px_60px_-20px_rgba(76,29,149,.25)]">
          <div className="text-[11px] font-semibold text-accent">Worksheet · Osmosis · Q4 · 6 marks</div>
          <div className="mt-2 rounded-xl border border-border p-3 text-[14px] leading-relaxed">The solution has a <mark className="rounded bg-emerald-100 px-0.5">lower water potential than the cells</mark>, so water moves <mark className="rounded bg-emerald-100 px-0.5">out by osmosis</mark> and the cells become flaccid.</div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3"><Ring pct={4 / 6} size={40} stroke={5} color={T.green}><span className="text-[11px] font-bold">4/6</span></Ring><div className="text-[13px]"><b>Good causal chain.</b> Missing M5 (membrane) and M6 (turgor).</div></div>
          <Image src="/design/cat2-think.png" alt="" width={120} height={120} unoptimized className="cat-bob absolute -bottom-8 -right-10 size-[120px] object-contain" />
          </div>
        </div>
      </Band>

      {/* 2 white: flashcards */}
      <Band bg="#ffffff" className="lg:[&>*:first-child]:order-2">
        <Headline sub="Spaced repetition decides what comes back today. Get one wrong and it’s back tomorrow; get it right and it waits.">flashcards that come back right before you forget.</Headline>
        <div className="relative mx-auto w-full max-w-[460px] py-8">
          <div className="relative mx-auto h-[300px] w-[360px]">
            <div className="design-root absolute inset-x-6 top-0 h-[250px] rotate-[4deg] rounded-[28px] border border-border bg-white shadow-[0_20px_40px_-28px_rgba(76,29,149,.3)]" />
            <div className="design-root absolute inset-x-3 top-3 h-[250px] rotate-[-2deg] rounded-[28px] border border-border bg-white shadow-[0_20px_40px_-28px_rgba(76,29,149,.3)]" />
            <div className="design-root absolute inset-x-0 top-7 flex h-[250px] flex-col justify-between rounded-[28px] border-2 border-accent/40 bg-white p-6 shadow-[0_30px_60px_-24px_rgba(76,29,149,.35)]">
              <div className="flex items-center justify-between text-[12px] font-semibold"><span className="text-accent">Bio · Topic 3</span><span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">16 due today</span></div>
              <div className="text-center"><div className="text-[13px] font-semibold text-faint">Define</div><div className="mt-1 text-[26px] font-extrabold leading-tight">water potential</div></div>
              <div className="flex gap-2">{[["Again", "border-border text-muted-foreground"], ["Good", "border-accent bg-accent text-white"]].map(([b, c]) => <span key={b} className={cn("inline-flex h-10 flex-1 items-center justify-center rounded-xl border text-[14px] font-bold", c)}>{b}</span>)}</div>
            </div>
            <Image src="/design/cat2-sleep.png" alt="" width={150} height={150} unoptimized className="cat-bob absolute -bottom-2 -right-20 size-[140px] object-contain" />
          </div>
        </div>
      </Band>

      {/* 3 lavender: twenty minutes a day */}
      <Band bg={LAV}>
        <Headline sub="A plan that fits around school, a streak that means something, and a reminder that doesn’t nag.">twenty minutes a day. that’s the whole trick.</Headline>
        <div className="design-root relative mx-auto w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-[0_30px_60px_-20px_rgba(76,29,149,.25)]">
          <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">This week</span><span className="text-[13px] font-bold text-accent">4-day streak</span></div>
          <div className="mt-3"><WeekBars mins={[28, 32, 25, 30, 12, 0, 0]} height={120} accent={T.violet} /></div>
          <Image src="/design/cat2-flame.png" alt="" width={150} height={150} unoptimized className="cat-wiggle absolute -bottom-12 -right-14 size-[140px] object-contain" />
        </div>
      </Band>

      {/* 4 white: copilot */}
      <Band bg="#ffffff" className="lg:[&>*:first-child]:order-2">
        <Headline sub="Hints when you ask, a worked example when you’re stuck, and “explain it differently” — all from the notes you uploaded.">a copilot that has actually read your notes.</Headline>
        <div className="design-root relative mx-auto flex w-full max-w-[460px] flex-col gap-3">
          <div className="self-end rounded-2xl rounded-br-md bg-accent px-4 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,.6)]">why did I lose M5?</div>
          <div className="flex items-end gap-3"><Image src="/design/cat2-think.png" alt="" width={64} height={64} unoptimized className="size-16 shrink-0 object-contain" /><div className="rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 text-[14px] leading-relaxed shadow-[0_10px_30px_-10px_rgba(0,0,0,.12)]">You described the direction of water movement but not <b>the membrane</b>. Say it’s <b>partially permeable</b> — that’s the one-liner M5 wants. Want to try Q5 with that in mind?</div></div>
          <div className="flex gap-2 self-start pl-[76px]">{["Try Q5", "Worked example", "Explain differently"].map((c) => <span key={c} className="whitespace-nowrap rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent">{c}</span>)}</div>
        </div>
      </Band>

      {/* 5 lavender: how it works */}
      <section className="w-full" style={{ background: LAV }}>
        <div className="mx-auto w-full max-w-[1120px] px-6 py-24">
          <h2 className="text-center text-[40px] font-extrabold tracking-tight">three steps. you do one.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[["/design/props/notes.png", "drop in what you have", "PDF, slides, a photo of your notes, a lecture link."], ["/design/props/bulb.png", "scribe writes the practice", "Readings, Quick 5s, cloze, worksheets with a markscheme."], ["/design/props/clock.png", "twenty minutes a day", "A plan, a streak, flashcards that come back on time."]].map(([img, t, d], i) => (
              <div key={t} className="rounded-[28px] border border-border bg-white p-7">
                <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-accent text-[15px] font-extrabold text-white">{i + 1}</span><Image src={img} alt="" width={120} height={120} unoptimized className="size-[96px] object-contain" /></div>
                <h3 className="mt-5 text-[22px] font-extrabold leading-tight">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 white: quotes */}
      <section className="relative w-full overflow-hidden bg-accent text-white">
        <div className="mx-auto w-full max-w-[1120px] px-6 py-24">
        <h2 className="text-center text-[40px] font-extrabold tracking-tight">from the night before.</h2>
        <div className="mt-3 flex justify-center gap-1 text-[#fbbf24]">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-5 fill-current" />)}</div>
        <Image src="/design/cat2-wave.png" alt="" width={140} height={140} unoptimized className="cat-wiggle absolute -top-4 right-[6%] size-[130px] object-contain" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {QUOTES.map(([q, name, who]) => (
            <figure key={name} className="design-root flex flex-col justify-between rounded-[28px] bg-white p-7 text-foreground shadow-[0_24px_50px_-24px_rgba(0,0,0,.4)]">
              <blockquote className="text-[17px] font-semibold leading-snug">“{q}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent-soft text-[14px] font-extrabold text-accent">{name[0]}</span><div><div className="text-[14px] font-bold">{name}</div><div className="text-[12.5px] text-muted-foreground">{who}</div></div></figcaption>
            </figure>
          ))}
        </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden" style={{ background: LAV }}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pb-28 pt-24 text-center">
          <Image src="/design/cat2-wave.png" alt="" width={200} height={200} unoptimized className="cat-wiggle size-[180px] object-contain" />
          <h2 className="mt-4 text-[44px] font-extrabold leading-[1.05] tracking-tight">tonight’s revision, sorted in five minutes.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/signup"><Btn>Get started</Btn></Link><Link href="/signup?sample=1" className="inline-flex h-14 items-center rounded-2xl border-2 border-border bg-white px-6 text-[16px] font-bold text-accent">Try the sample</Link></div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] font-semibold text-muted-foreground">{["Free to start", "No card", "First session in 5 minutes"].map((l) => <li key={l} className="flex items-center gap-1.5"><Check className="size-4" strokeWidth={3} />{l}</li>)}</ul>
        </div>
      </section>

    </>
  );
}
