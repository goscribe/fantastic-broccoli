import Link from "next/link";
import type { ReactNode } from "react";
import { StatsBand } from "@/components/design/stats-band";
import { Cat, CopilotMock, FinishMock, FlashcardMock, HomeMock, QuestionMock, StreakMock, WorksheetMock } from "@/components/design/landing-mocks";
import { SubjectTile } from "@/components/learn/subject-tile";
import { LANDING_BOARDS, LANDING_COURSE_COUNT } from "@/app/landing/courses";
import { cn } from "@/lib/utils";

/** The one purple thing on a screen: the app's chunky primary button, as a link. */
export const landingPrimary =
  "btn-chunky inline-flex h-14 items-center justify-center bg-accent px-8 text-[17px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2";
/** A quiet second action: underlined text, no box. */
export const landingTextLink =
  "inline-flex min-h-11 items-center text-[15.5px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

export const landingWrap = "mx-auto w-full max-w-[1160px] px-4 sm:px-6";

/** A feature: words on one side, the app itself on the other. No card around either. */
function Band({ title, sub, children, flip = false }: { title: ReactNode; sub: string; children: ReactNode; flip?: boolean }) {
  return (
    <section className={cn(landingWrap, "grid items-center gap-7 py-10 sm:py-12 lg:grid-cols-2 lg:gap-16 lg:py-14")}>
      <div className={cn(flip && "lg:order-2")}>
        <h2 className="text-balance text-[30px] font-extrabold leading-[1.1] sm:text-[38px]">{title}</h2>
        <p className="mt-4 max-w-[460px] text-[17px] leading-relaxed text-muted-foreground">{sub}</p>
      </div>
      <div className={cn("mx-auto w-full max-w-[480px]", flip && "lg:order-1")}>{children}</div>
    </section>
  );
}

const STEPS: ["pencil" | "think" | "flame", string, string][] = [
  ["pencil", "Make a subject, drop in what you have", "One subject per course: PDFs, slides, a photo of your notes, a lecture link."],
  ["think", "Scribe builds the session", "A reading, a Quick 5, cloze and a marked worksheet, in one sitting."],
  ["flame", "Twenty minutes a day", "The planner picks the time, the streak keeps you honest, flashcards come back on time."],
];

const QUOTES: [string, string, string][] = [
  ["It marked my 6-marker exactly like my teacher did, then told me which point I’d skipped.", "Maya", "IB Bio HL · Year 13"],
  ["I just photograph the board after class. By the evening there’s a worksheet waiting.", "Tom", "A-level Chemistry"],
  ["The flashcards come back the day before I’d have forgotten them. It’s a bit creepy.", "Priya", "GCSE · Year 11"],
];

export function LandingBody() {
  return (
    <>
      {/* Hero: the app's own banner. A landscape lit for the visitor's time of day, the cat on the hill, one purple button. */}
      <section className={cn(landingWrap, "pt-3 sm:pt-5")}>
        <div className="landing-hero landing-banner hero-card relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-7 pt-[188px] sm:px-10 sm:py-14 lg:px-14 lg:py-[76px]">
          <div aria-hidden className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[168px] overflow-hidden sm:inset-0 sm:h-auto">
            <div className="absolute bottom-[24px] right-[13%] h-[118px] sm:bottom-[14%] sm:right-[4%] sm:h-[160px] md:right-[7%] md:h-[200px] lg:right-[10%] lg:h-[260px]">
              <span className="hero-field__ground" />
              <Cat pose="wave" eager className="cat-wiggle relative h-full" />
            </div>
          </div>
          <h1 className="relative text-balance text-[clamp(24px,7.2vw,34px)] font-extrabold leading-[1.06] sm:max-w-[66%] sm:text-[34px] md:text-[38px] lg:text-[46px] xl:text-[58px]">
            Study from your notes.
            <br />
            Actually remember it.
          </h1>
          <p className="relative mt-4 text-[16.5px] leading-relaxed text-foreground/75 sm:max-w-[50%] sm:text-[18px] lg:max-w-[46%]">
            Pick your course, or drop in a PDF, slides or a photo of your notes. Scribe builds study sessions from them and fits them into your week.
          </p>
          <div className="relative mt-6 flex flex-col gap-x-6 gap-y-1.5 sm:mt-8 sm:flex-row sm:items-center">
            <Link href="/signup" className={landingPrimary}>Get started</Link>
            <Link href="/login" className={cn(landingTextLink, "justify-center sm:justify-start")}>I already have an account</Link>
          </div>
        </div>
      </section>

      {/* The app's home, as it looks once you are in. */}
      <section className={cn(landingWrap, "pt-12 sm:pt-16")}>
        <h2 className="text-balance text-[30px] font-extrabold leading-[1.1] sm:text-[38px]">Every subject, one home.</h2>
        <p className="mt-3 max-w-[560px] text-[17px] leading-relaxed text-muted-foreground">Your subjects, today’s flashcards and your streak are the first thing you see.</p>
        <div className="mt-6 sm:mt-7 sm:rounded-[28px] sm:border sm:border-border sm:p-7">
          <HomeMock />
        </div>
      </section>

      {/* Coverage: the course catalog, in the subjects' own colours. */}
      <section className={cn(landingWrap, "pt-14 sm:pt-20")} aria-labelledby="courses-title">
        <h2 id="courses-title" className="text-balance text-[30px] font-extrabold leading-[1.1] sm:text-[38px]">Your course, topic by topic.</h2>
        <p className="mt-3 max-w-[600px] text-[17px] leading-relaxed text-muted-foreground">
          {LANDING_COURSE_COUNT} courses across IB, AP, A-level and GCSE, each one split into its topics. Studying something else? Upload your notes and Scribe works from those.
        </p>
        {LANDING_BOARDS.map(({ board, courses }) => (
          <div key={board} className="mt-7">
            <h3 className="text-[17px] font-extrabold">
              {board} <span className="font-bold text-muted-foreground">· {courses.length}</span>
            </h3>
            <ul className="landing-strip -mx-4 mt-3 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
              {courses.map((course) => (
                <li key={course} className="flex w-[264px] shrink-0 snap-start sm:w-auto">
                  <SubjectTile row title={course} href="/signup" className="landing-course" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <StatsBand />

      <Band title="Marked like the exam. Explained like a friend." sub="Every answer is checked against a mark scheme written from your material, point by point, so you see which marks you earned and what the missing one needed.">
        <WorksheetMock />
      </Band>

      <Band flip title="Practice that tells you why." sub="Short questions on each topic. Get one wrong and you see the reason straight away, and it goes on your mistakes list to fix later.">
        <QuestionMock />
      </Band>

      <Band title="Flashcards that come back right before you forget." sub="Spaced repetition decides what comes back today. Get one wrong and it’s back tomorrow; get it right and it waits.">
        <FlashcardMock />
      </Band>

      <Band flip title="Finish a session. See what stuck." sub="Your score, your streak and how far each topic moved, the moment you answer the last question.">
        <FinishMock />
      </Band>

      <Band title="Twenty minutes a day. That’s the whole trick." sub="Connect your calendar and the planner fits sessions around school. Your streak counts when you hit the daily goal, and one evening reminder is all you get.">
        <StreakMock />
      </Band>

      <Band flip title="A copilot that has actually read your notes." sub="Hints when you ask, a worked example when you’re stuck, and “explain it differently” — all from the notes you uploaded.">
        <CopilotMock />
      </Band>

      {/* How it works: three separate things, so three cards. */}
      <section className={cn(landingWrap, "py-12 sm:py-16")}>
        <h2 className="text-balance text-[30px] font-extrabold leading-[1.1] sm:text-center sm:text-[38px]">Three steps. You do one.</h2>
        <ol className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3 md:gap-4">
          {STEPS.map(([pose, title, body], i) => (
            <li key={title} className="life-card flex gap-4 p-5 md:block md:p-7">
              <Cat pose={pose} className="h-[72px] shrink-0 md:h-[96px]" />
              <div className="min-w-0 md:mt-5">
                <div className="text-[13.5px] font-extrabold text-muted-foreground">Step {i + 1}</div>
                <h3 className="mt-1 text-[20px] font-extrabold leading-tight md:text-[22px]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What students said. */}
      <section className={cn(landingWrap, "py-12 sm:py-16")}>
        <h2 className="text-balance text-[30px] font-extrabold leading-[1.1] sm:text-center sm:text-[38px]">From the night before.</h2>
        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3 md:gap-4">
          {QUOTES.map(([quote, name, who]) => (
            <figure key={name} className="life-card m-0 flex flex-col justify-between p-6 md:p-7">
              <blockquote className="m-0 text-[17px] font-semibold leading-snug">“{quote}”</blockquote>
              <figcaption className="mt-6">
                <div className="text-[14.5px] font-extrabold">{name}</div>
                <div className="text-[13.5px] text-muted-foreground">{who}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <LandingCta
        pose="cheer"
        title="Tonight’s revision, sorted in five minutes."
        note="Free to start · No card · First session in 5 minutes"
        secondary={{ href: "/landing/how-it-works", label: "See how it works" }}
      />
    </>
  );
}

/** The closing banner: the hero's scene again, the cat celebrating, the same one button. */
export function LandingCta({
  title,
  sub,
  note,
  cta = "Get started",
  pose = "cheer",
  secondary,
  heading: Heading = "h2",
}: {
  title: string;
  sub?: string;
  note?: string;
  cta?: string;
  pose?: "cheer" | "wave" | "trophy" | "book";
  secondary?: { href: string; label: string };
  heading?: "h2" | "h3";
}) {
  return (
    <section className={cn(landingWrap, "pb-14 pt-6 sm:pb-20 sm:pt-10")}>
      <div className="landing-banner hero-card relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-7 pt-[172px] sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <div aria-hidden className="landing-cta-field hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[152px] overflow-hidden sm:inset-0 sm:h-auto">
          <div className="absolute bottom-[20px] right-[13%] h-[110px] sm:bottom-[13%] sm:right-[7%] sm:h-[180px] lg:right-[10%] lg:h-[220px]">
            <span className="hero-field__ground" />
            <Cat pose={pose} className="cat-bob relative h-full" />
          </div>
        </div>
        <Heading className="relative text-balance text-[28px] font-extrabold leading-[1.1] sm:max-w-[56%] sm:text-[38px]">{title}</Heading>
        {sub && <p className="relative mt-3 text-[16.5px] leading-relaxed text-foreground/75 sm:max-w-[48%]">{sub}</p>}
        <div className="relative mt-6 flex flex-col gap-x-6 gap-y-1.5 sm:flex-row sm:items-center">
          <Link href="/signup" className={landingPrimary}>{cta}</Link>
          {secondary && <Link href={secondary.href} className={cn(landingTextLink, "justify-center sm:justify-start")}>{secondary.label}</Link>}
        </div>
        {note && <p className="relative mt-4 text-center text-[14px] font-bold text-foreground/80 sm:max-w-[56%] sm:text-left">{note}</p>}
      </div>
    </section>
  );
}
