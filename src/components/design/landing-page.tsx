import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { StatsBand } from "@/components/design/stats-band";
import { Cat, CopilotMock, FlashcardMock, QuestionMock, StreakMock, UploadMock, WorksheetMock } from "@/components/design/landing-mocks";
import { SubjectTile } from "@/components/learn/subject-tile";
import { LANDING_BOARDS, LANDING_COURSE_COUNT } from "@/app/landing/courses";
import { familyVars, type SubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";

/** The one purple thing on a screen: the app's chunky primary button, as a link. */
export const landingPrimary =
  "btn-chunky inline-flex h-14 items-center justify-center bg-accent px-8 text-[17px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2";
/** A quiet second action: underlined text, no box. */
export const landingTextLink =
  "inline-flex min-h-11 items-center text-[15.5px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

export const landingWrap = "mx-auto w-full max-w-[1160px] px-4 sm:px-6";

/** Section headings on the home: one display size, a step below the hero's. */
const display2 = "text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[46px] lg:text-[54px]";

/**
 * One idea per section: a big block in a subject family's colour (the same
 * hue pair and art the subject tiles wear), the words in white on its deep
 * end, and the app's own screens on it at full size.
 */
function ColourBlock({ family, id, title, sub, visual, flip = false }: { family: SubjectFamily; id: string; title: ReactNode; sub: string; visual: ReactNode; flip?: boolean }) {
  return (
    <section aria-labelledby={id} className={cn(landingWrap, "pt-16 sm:pt-24")}>
      <div
        className={cn("landing-block grid items-center gap-x-14 gap-y-10 px-5 pb-6 pt-10 sm:px-10 sm:pb-10 sm:pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-14 lg:py-16", flip && "landing-block--flip lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]")}
        style={familyVars(family) as CSSProperties}
      >
        <div className={cn("relative max-w-[520px]", flip && "lg:order-2")}>
          <h2 id={id} className={cn(display2, "text-white")}>{title}</h2>
          <p className="mt-5 text-read font-semibold text-white">{sub}</p>
        </div>
        <div className={cn("relative", flip && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}

/** Every course a student can pick, as the app's own tiles: two rows drifting slowly to their far end and back, in opposite directions. */
function CourseMarquee() {
  const rows = [
    [...LANDING_BOARDS[0].courses, ...LANDING_BOARDS[2].courses],
    [...LANDING_BOARDS[1].courses, ...LANDING_BOARDS[3].courses],
  ];
  return (
    <div className="landing-marquee mt-10 sm:mt-12">
      {rows.map((row, r) => (
        <div key={r} className={cn("landing-marquee__row", r === 1 && "landing-marquee__row--back")}>
          <ul className="landing-marquee__track">
            {row.map((course) => (
              <li key={course} className="landing-marquee__item">
                <SubjectTile row title={course} href="/signup" trailing={false} className="landing-course" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A small white card from the app, floating over the hero's scene. Decorative. */
function HeroCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("landing-float absolute rounded-[18px] border border-border bg-card p-3.5 shadow-[0_18px_36px_-22px_rgb(22_22_26/0.45)] sm:p-4", className)}>{children}</div>;
}

export function LandingBody() {
  return (
    <>
      {/* Hero: one line of promise, one button, then the big picture: the time-of-day scene with the cat bounding through it. */}
      <section className={cn(landingWrap, "landing-hero pt-8 sm:pt-12 lg:pt-12")}>
        <div className="mx-auto max-w-[940px] text-center">
          <h1 className="text-balance text-[clamp(34px,9.6vw,48px)] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[72px]">
            <span className="block text-balance">Study from your notes.</span>
            <span className="block text-balance">Actually remember it.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[600px] text-read text-muted-foreground sm:mt-6">
            Pick your course, or drop in a PDF, slides or a photo of your notes. Scribe builds study sessions from them and fits them into your week.
          </p>
          <div className="mt-7 flex flex-col items-center gap-x-6 gap-y-1.5 sm:mt-8 sm:flex-row sm:justify-center">
            <Link href="/signup" className={cn(landingPrimary, "w-full sm:w-auto sm:px-10")}>Get started</Link>
            <Link href="/login" className={landingTextLink}>I already have an account</Link>
          </div>
        </div>

        <div aria-hidden className="landing-stage relative mx-auto mt-12 sm:mt-14 lg:mt-12">
          <div className="hero-card absolute inset-0 overflow-hidden rounded-[28px] border border-border sm:rounded-[40px]">
            <div className="hero-field absolute inset-0" />
          </div>
          <div className="landing-stage__cat absolute">
            <span className="hero-field__ground" />
            <Cat pose="leap" eager className="cat-float relative h-full" />
          </div>
          <HeroCard className="landing-stage__card-a w-[208px] -rotate-[5deg] sm:w-[268px]">
            <div className="flex items-center justify-between text-[12px] font-bold text-muted-foreground">
              <span>Flashcards · Biology</span>
              <span>6 due</span>
            </div>
            <div className="mt-2 text-[15px] font-extrabold leading-snug sm:text-[17px]">What is osmosis?</div>
            <div className="mt-3 flex gap-2">
              <span className="flex h-9 flex-1 items-center justify-center rounded-[12px] bg-muted text-[12.5px] font-extrabold">Didn’t know</span>
              <span className="flex h-9 flex-1 items-center justify-center rounded-[12px] bg-muted text-[12.5px] font-extrabold">Knew it</span>
            </div>
          </HeroCard>
          <HeroCard className="landing-stage__card-b rotate-[4deg]">
            <div className="text-[12px] font-bold text-muted-foreground">This week</div>
            <div className="mt-2 flex gap-1.5">
              {[1, 1, 1, 1, 1, 0].map((done, i) => (
                <span key={i} className={cn("size-6 rounded-full sm:size-7", done ? "bg-[var(--flame)] shadow-[0_2px_0_var(--flame-edge)]" : "border-2 border-dashed border-[var(--flame)]")} />
              ))}
            </div>
            <div className="mt-2 text-[15px] font-extrabold sm:text-[16px]">5 day streak</div>
          </HeroCard>
        </div>
      </section>

      {/* Coverage: the whole catalog in the subjects' own colours, compact and moving. */}
      <section aria-labelledby="courses-title" className="landing-courses relative pt-20 sm:pt-28">
        <div className={cn(landingWrap, "relative text-center")}>
          <h2 id="courses-title" className={display2}>Your course, topic by topic.</h2>
          <p className="mx-auto mt-5 max-w-[640px] text-read text-muted-foreground">
            {LANDING_COURSE_COUNT} courses across IB, AP, A-level and GCSE, each one split into its topics. Studying something else? Upload your notes and Scribe works from those.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Courses by exam board">
            {LANDING_BOARDS.map(({ board, courses }) => (
              <li key={board} className="rounded-full bg-muted px-4 py-2 text-ui font-extrabold">
                {board} <span className="font-bold text-muted-foreground">· {courses.length}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <Cat pose="read" className="landing-courses__cat pointer-events-none absolute z-10 hidden xl:block" />
          <CourseMarquee />
        </div>
        <div className={cn(landingWrap, "mt-4 flex justify-center")}>
          <label className="landing-marquee__pause inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-small font-bold text-muted-foreground hover:text-foreground">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" />
            Pause the course list
          </label>
        </div>
      </section>

      <ColourBlock
        family="biology"
        id="practice-title"
        title="Practice that tells you why."
        sub="Short questions on every topic, and exam questions marked point by point against a mark scheme. Get one wrong and you see the reason straight away, and it goes on your list to fix."
        visual={
          <div className="landing-pair mx-auto max-w-[560px] lg:max-w-none">
            <Cat pose="peek" className="landing-peek absolute z-20" />
            <div className="relative z-10">
              <QuestionMock />
            </div>
            <div className="landing-pair__back relative">
              <WorksheetMock />
            </div>
          </div>
        }
      />

      {/* The daily habit, on white: the two screens a student sees every day. */}
      <section aria-labelledby="habit-title" className={cn(landingWrap, "pt-20 sm:pt-28")}>
        <div className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="max-w-[520px]">
            <h2 id="habit-title" className={display2}>Twenty minutes a day. That’s the whole trick.</h2>
            <p className="mt-5 text-read text-muted-foreground">
              Flashcards come back right before you forget them. The planner fits sessions around school, your streak counts when you hit the daily goal, and one evening reminder is all you get.
            </p>
          </div>
          <div className="landing-habit relative mx-auto w-full max-w-[600px]">
            <div className="sm:w-[84%]"><FlashcardMock /></div>
            <div className="relative z-10 ml-auto mt-4 w-[94%] sm:-mt-2 sm:w-[66%]"><StreakMock quiet /></div>
          </div>
        </div>
      </section>

      <ColourBlock
        family="maths"
        id="copilot-title"
        flip
        title="A copilot that has actually read your notes."
        sub="Drop in a PDF, slides or a photo of the board. Ask for a hint, a worked example or “explain it differently”, and the answer comes from what you uploaded."
        visual={
          <div className="mx-auto grid max-w-[560px] gap-4 lg:max-w-none">
            <UploadMock quiet />
            <div className="lg:ml-14"><CopilotMock /></div>
          </div>
        }
      />

      <StatsBand />

      <LandingCta
        pose="stack"
        title="Tonight’s revision, sorted in five minutes."
        note="Free to start · No card · First session in 5 minutes"
        secondary={{ href: "/landing/how-it-works", label: "See how it works" }}
        big
      />
    </>
  );
}

/** The closing banner: the hero's scene again in full, the cat on top of the books, the words on a solid card, the same one button. */
export function LandingCta({
  title,
  sub,
  note,
  cta = "Get started",
  pose = "cheer",
  secondary,
  heading: Heading = "h2",
  big = false,
}: {
  title: string;
  sub?: string;
  note?: string;
  cta?: string;
  pose?: "cheer" | "wave" | "trophy" | "book" | "stack";
  secondary?: { href: string; label: string };
  heading?: "h2" | "h3";
  /** The home's closing: taller, a bigger headline. */
  big?: boolean;
}) {
  const stack = pose === "stack";
  return (
    <section className={cn(landingWrap, "pb-14 pt-6 sm:pb-20 sm:pt-10")}>
      <div className={cn("landing-banner hero-card relative isolate overflow-hidden rounded-[28px] border border-border px-5 pb-7 sm:rounded-[40px] sm:px-10 lg:px-14", stack ? "pt-[236px] sm:py-16 lg:py-20" : "pt-[172px] sm:py-12 lg:py-16")}>
        <div aria-hidden className={cn("landing-cta-field hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden sm:inset-0 sm:h-auto", stack ? "h-[216px]" : "h-[152px]")}>
          <div className={cn("absolute", stack ? "bottom-[10px] right-[14%] h-[200px] sm:bottom-[6%] sm:right-[6%] sm:h-[300px] lg:right-[9%] lg:h-[360px]" : "bottom-[20px] right-[13%] h-[110px] sm:bottom-[13%] sm:right-[7%] sm:h-[180px] lg:right-[10%] lg:h-[220px]")}>
            <span className="hero-field__ground" />
            <Cat pose={pose} className="cat-bob relative h-full" />
          </div>
        </div>
        {/* The words on one solid card over the scene from sm up (landing.css), never on a wash. */}
        <div className={cn("landing-cta-copy relative", big ? "sm:max-w-[64%] lg:max-w-[68%]" : "sm:max-w-[60%] lg:max-w-[56%]")}>
          <Heading className={cn("text-balance font-extrabold", big ? "text-[34px] leading-[1.05] tracking-[-0.025em] sm:text-[46px] lg:text-[56px]" : "text-[28px] leading-[1.1] sm:text-[38px]")}>{title}</Heading>
          {sub && <p className="mt-3 text-read text-foreground/75">{sub}</p>}
          <div className={cn("flex flex-col gap-x-6 gap-y-1.5 sm:flex-row sm:items-center", big ? "mt-8" : "mt-6")}>
            <Link href="/signup" className={landingPrimary}>{cta}</Link>
            {secondary && <Link href={secondary.href} className={cn(landingTextLink, "justify-center sm:justify-start")}>{secondary.label}</Link>}
          </div>
          {note && <p className="mt-4 text-center text-ui font-bold text-foreground/80 sm:text-left">{note}</p>}
        </div>
      </div>
    </section>
  );
}
