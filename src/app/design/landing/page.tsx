import Image from "next/image";
import { ArrowRight, Check, Play } from "lucide-react";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import { T } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

const NAV = ["Features", "How it works", "Pricing", "Blog"];

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

export default function LandingPreview() {
  return (
    <div className="design-root min-h-dvh w-full bg-white text-foreground">
      <header className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center justify-between px-6">
        <span className="text-[22px] font-extrabold tracking-tight text-accent">scribe</span>
        <nav className="hidden gap-8 text-[14px] font-bold uppercase tracking-wide text-muted-foreground md:flex">{NAV.map((n) => <span key={n}>{n}</span>)}</nav>
        <span className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[13px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_0_rgba(0,0,0,.14)]">Get started</span>
      </header>

      {/* hero: headline on white, cat + props on a violet curve */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pt-12 text-center">
          <h1 className="text-[56px] font-extrabold leading-[1.02] tracking-[-0.02em] text-accent md:text-[68px]">study from your notes.<br />actually remember it.</h1>
          <p className="mt-5 max-w-[560px] text-[18px] text-muted-foreground">Drop in a PDF, slides or a photo of your notes. Scribe turns them into quizzes, worksheets and flashcards that know what you’re about to forget.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Btn>Get started<ArrowRight className="size-5" /></Btn><span className="inline-flex h-14 items-center gap-2 rounded-2xl border-2 border-border px-6 text-[16px] font-bold text-accent"><Play className="size-4" />I already have an account</span></div>
        </div>
        <div className="relative mt-10 h-[520px]">
          <svg viewBox="0 0 1440 520" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><path d="M0 140 C 360 40, 1080 40, 1440 140 L1440 520 L0 520 Z" fill="#7c3aed" /></svg>
          <div className="relative mx-auto h-full w-full max-w-[1120px]">
            <div className="absolute left-1/2 top-16 -translate-x-1/2"><HeroCard /></div>
            <Image src="/design/cat2-cheer.png" alt="" width={260} height={260} unoptimized className="design-pop absolute left-1/2 top-[-36px] z-10 size-[230px] -translate-x-[150%] object-contain" />
            <Image src="/design/cat2-book.png" alt="" width={200} height={200} unoptimized className="cat-bob absolute right-[14%] top-40 z-10 size-[180px] object-contain" />
            <Prop src="/illustrations/props/star-gold.png" className="left-[8%] top-6 size-16" />
            <Prop src="/illustrations/props/pencil.png" className="left-[20%] top-56 size-24 -rotate-12" delay="0.6s" />
            <Prop src="/illustrations/props/book-blue.png" className="right-[6%] top-10 size-20 rotate-12" delay="1.1s" />
            <Prop src="/illustrations/props/trophy.png" className="right-[26%] top-[-10px] size-20" delay="0.3s" />
            <Prop src="/illustrations/props/book-pink.png" className="left-[30%] top-[-8px] size-16 rotate-6" delay="1.6s" />
            <Prop src="/illustrations/props/flag-mini.png" className="right-[22%] bottom-14 size-14" delay="0.9s" />
          </div>
        </div>
      </section>

      {/* subjects strip */}
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{["IB", "A-level", "GCSE", "AP", "SAT", "University"].map((s) => <span key={s}>{s}</span>)}</div>
      </section>

      {/* 1 navy: marked like the exam */}
      <Band bg="#1e1b4b" dark>
        <Headline dark sub="Every answer is checked against a markscheme written from your material. Hover a highlight to see the exact point it earned.">marked like the exam. explained like a friend.</Headline>
        <div className="design-root relative mx-auto w-full max-w-[460px] rounded-3xl bg-white p-6 text-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]">
          <div className="text-[11px] font-semibold text-accent">Worksheet · Osmosis · Q4 · 6 marks</div>
          <div className="mt-2 rounded-xl border border-border p-3 text-[14px] leading-relaxed">The solution has a <mark className="rounded bg-emerald-100 px-0.5">lower water potential than the cells</mark>, so water moves <mark className="rounded bg-emerald-100 px-0.5">out by osmosis</mark> and the cells become flaccid.</div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3"><Ring pct={4 / 6} size={40} stroke={5} color={T.green}><span className="text-[11px] font-bold">4/6</span></Ring><div className="text-[13px]"><b>Good causal chain.</b> Missing M5 (membrane) and M6 (turgor).</div></div>
          <Image src="/design/cat2-think.png" alt="" width={120} height={120} unoptimized className="cat-bob absolute -bottom-8 -right-10 size-[120px] object-contain" />
        </div>
      </Band>

      {/* 2 mint: flashcards */}
      <Band bg="#d9f5e7" className="lg:[&>*:first-child]:order-2">
        <Headline sub="Spaced repetition decides what comes back today. Get one wrong and it’s back tomorrow; get it right and it waits.">flashcards that come back right before you forget.</Headline>
        <div className="relative mx-auto flex w-full max-w-[460px] items-center justify-center">
          <Donut parts={[[14, T.violet], [2, T.red], [22, "#ffffff"]]} size={260} stroke={34}><div className="text-center"><div className="text-[48px] font-extrabold leading-none">16</div><div className="text-[13px] font-semibold text-muted-foreground">due today</div></div></Donut>
          <Image src="/design/cat2-sleep.png" alt="" width={160} height={160} unoptimized className="cat-bob absolute -bottom-6 -left-4 size-[150px] object-contain" />
        </div>
      </Band>

      {/* 3 sky: twenty minutes a day */}
      <Band bg="#dbeafe">
        <Headline sub="A plan that fits around school, a streak that means something, and a reminder that doesn’t nag.">twenty minutes a day. that’s the whole trick.</Headline>
        <div className="design-root relative mx-auto w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-[0_30px_60px_-20px_rgba(30,64,175,.35)]">
          <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">This week</span><span className="text-[13px] font-bold text-orange-500">4-day streak</span></div>
          <div className="mt-3"><WeekBars mins={[28, 32, 25, 30, 12, 0, 0]} height={120} /></div>
          <Image src="/design/cat2-flame.png" alt="" width={150} height={150} unoptimized className="cat-wiggle absolute -right-12 -top-16 size-[140px] object-contain" />
        </div>
      </Band>

      {/* 4 orange: copilot */}
      <Band bg="#ffe4cc" className="lg:[&>*:first-child]:order-2">
        <Headline sub="Hints when you ask, a worked example when you’re stuck, and “explain it differently” — all from the notes you uploaded.">a copilot that has actually read your notes.</Headline>
        <div className="design-root relative mx-auto flex w-full max-w-[460px] flex-col gap-3">
          <div className="self-end rounded-2xl rounded-br-md bg-accent px-4 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,.6)]">why did I lose M5?</div>
          <div className="flex items-end gap-3"><Image src="/design/cat2-think.png" alt="" width={56} height={56} unoptimized className="size-14 object-contain" /><div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[14px] leading-relaxed shadow-[0_10px_30px_-10px_rgba(0,0,0,.2)]">You described the direction of water movement but not <b>the membrane</b>. Say it’s <b>partially permeable</b> — that’s the one-liner M5 wants. Want to try Q5 with that in mind?</div></div>
          <div className="flex gap-2 self-start pl-[68px]">{["Try Q5", "Worked example", "Explain differently"].map((c) => <span key={c} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-accent">{c}</span>)}</div>
        </div>
      </Band>

      {/* 5 white: how it works, three colour tiles */}
      <section className="mx-auto w-full max-w-[1120px] px-6 py-24">
        <h2 className="text-center text-[40px] font-extrabold tracking-tight">three steps. you do one.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[["#ede9fe", "/design/cat2-book.png", "drop in what you have", "PDF, slides, a photo of your notes, a lecture link."], ["#d9f5e7", "/design/cat2-pencil.png", "scribe writes the practice", "Readings, Quick 5s, cloze, worksheets with a markscheme."], ["#ffe4cc", "/design/cat2-trophy.png", "twenty minutes a day", "A plan, a streak, flashcards that come back on time."]].map(([bg, img, t, d], i) => (
            <div key={t} className="rounded-[28px] p-7" style={{ background: bg }}>
              <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-white text-[15px] font-extrabold text-accent">{i + 1}</span><Image src={img} alt="" width={120} height={120} unoptimized className="size-[110px] object-contain" /></div>
              <h3 className="mt-5 text-[22px] font-extrabold leading-tight">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-accent">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pb-28 pt-24 text-center text-white">
          <Image src="/design/cat2-wave.png" alt="" width={200} height={200} unoptimized className="cat-wiggle size-[180px] object-contain" />
          <h2 className="mt-4 text-[44px] font-extrabold leading-[1.05] tracking-tight">tonight’s revision, sorted in five minutes.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Btn tone="white">Get started</Btn><Btn tone="ghost">Try the sample</Btn></div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] font-semibold text-white/85">{["Free to start", "No card", "First session in 5 minutes"].map((l) => <li key={l} className="flex items-center gap-1.5"><Check className="size-4" strokeWidth={3} />{l}</li>)}</ul>
        </div>
      </section>

      <footer className="bg-[#1e1b4b] text-white/70"><div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px]"><span className="text-[18px] font-extrabold text-white">scribe</span><div className="flex gap-6 font-semibold">{["Features", "Pricing", "Blog", "Privacy", "Terms"].map((l) => <span key={l}>{l}</span>)}</div><span>© 2026 Scribe</span></div></footer>
    </div>
  );
}
