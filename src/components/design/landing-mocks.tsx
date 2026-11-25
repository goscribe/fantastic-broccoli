import Image from "next/image";
import type { ReactNode } from "react";
import { Check, Flame, X } from "lucide-react";
import { SubjectTile } from "@/components/learn/subject-tile";
import { cn } from "@/lib/utils";

/**
 * Product visuals for the public pages: the signed-in app's own surfaces
 * (same tokens, classes and components) with fixed example data. They are
 * pictures, not controls: each one is `inert` and hidden from assistive
 * tech, with a one-line description beside it for screen readers.
 */
export function Mock({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <div inert aria-hidden className="pointer-events-none select-none">
        {children}
      </div>
    </figure>
  );
}

/** The white "screen" a mock sits on. */
export function MockScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--r-panel)] border border-border bg-card p-5 shadow-[0_18px_40px_-28px_rgb(22_22_26/0.35)] sm:p-6", className)}>
      {children}
    </div>
  );
}

/** Each pose's width at 400px tall. leap, peek, read and stack are the landing's own (drawn for the home page). */
const CAT = { wave: 352, cheer: 363, flame: 344, pencil: 360, book: 363, think: 383, trophy: 413, sleep: 401, leap: 412, peek: 389, read: 608, stack: 216 } as const;
export type CatPose = keyof typeof CAT;

/** The mascot. Decorative; lazy unless it is in the first screen (never preloaded: it is small and not what the first paint waits for). */
export function Cat({ pose, className, eager = false }: { pose: CatPose; className?: string; eager?: boolean }) {
  return (
    <Image
      src={`/design/cat3-${pose}.webp`}
      alt=""
      width={CAT[pose]}
      height={400}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      className={cn("w-auto select-none object-contain", className)}
    />
  );
}

function StepBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-full", i < done ? "bg-accent" : i === done ? "bg-accent/35" : "bg-muted")} />
      ))}
    </div>
  );
}

const OPTIONS: [string, string, boolean][] = [
  ["A", "Nothing happens, because the cell wall stops water moving", false],
  ["B", "Water leaves the cell by osmosis", true],
  ["C", "Sugar enters the cell, then water follows it in", false],
];

/** A practice question, just answered: the green option, the cat, the reason. */
export function QuestionMock() {
  return (
    <Mock label="A practice question in Scribe, answered correctly: the right option turns green and a short explanation appears under it.">
      <MockScreen>
        <StepBar done={1} total={4} />
        <div className="mt-4 text-[13px] font-bold text-muted-foreground">Question 1 of 5</div>
        <div className="mt-2 text-[18px] font-extrabold leading-snug sm:text-[19px]">A plant cell is placed in a concentrated sugar solution. What happens to the water in the cell?</div>
        <ul className="mt-4 space-y-2.5">
          {OPTIONS.map(([letter, text, ok]) => (
            <li
              key={letter}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border-2 px-3.5 py-3 text-[14.5px] font-semibold leading-snug",
                ok ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-transparent bg-muted text-muted-foreground",
              )}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold", ok ? "bg-emerald-600 text-white" : "bg-card text-muted-foreground")}>{letter}</span>
              <span className="min-w-0 flex-1">{text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <Check className="size-5" strokeWidth={3.5} />
          </span>
          <span className="text-[20px] font-extrabold text-emerald-800">Correct!</span>
          <span className="text-[13.5px] font-extrabold text-emerald-700">+10 XP</span>
          <Cat pose="cheer" className="ml-auto h-[58px]" />
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">The solution outside has a lower water potential, so water moves out of the cell down the water potential gradient.</p>
        <span className="btn-chunky mt-4 flex h-12 items-center justify-center bg-accent text-[15.5px] font-extrabold text-white">Next question</span>
      </MockScreen>
    </Mock>
  );
}

/** A marked exam question: the answer, then the mark scheme point by point. */
export function WorksheetMock() {
  return (
    <Mock label="An exam-style question in Scribe after marking: one mark-scheme point is ticked, the other is crossed with a hint on what was missing.">
      <MockScreen>
        <div className="text-[13px] font-bold text-muted-foreground">Worksheet · Practice</div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-extrabold leading-snug">Explain why the cylinder in 1.0 mol/dm³ sucrose lost mass.</span>
          <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-muted-foreground">1/2</span>
        </div>
        <div className="mt-3 rounded-[var(--r-control)] border border-border-strong px-3.5 py-3 text-[14.5px] leading-relaxed">Water left the potato cells by osmosis.</div>
        <div className="mt-4 text-[13px] font-extrabold">Mark scheme <span className="font-bold text-muted-foreground">1/2 marks</span></div>
        <ul className="mt-2 space-y-2.5 text-[14px] leading-snug">
          <li className="flex gap-2.5">
            <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-3" strokeWidth={4} /></span>
            <span className="font-semibold">States that water leaves the cell</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-rose-600 text-white"><X className="size-3" strokeWidth={4} /></span>
            <span>
              <span className="font-semibold">Refers to the water potential gradient</span>
              <span className="mt-0.5 block text-[13.5px] text-muted-foreground">Say which side has the lower water potential.</span>
            </span>
          </li>
        </ul>
      </MockScreen>
    </Mock>
  );
}

/** A flashcard turned over, with the two answers under it. */
export function FlashcardMock() {
  return (
    <Mock label="A flashcard in Scribe, turned to its answer, with two buttons: Didn’t know and Knew it.">
      <MockScreen>
        <div className="flex items-center justify-between text-[13px] font-bold text-muted-foreground">
          <span>Flashcards · Recall</span>
          <span>6 due today</span>
        </div>
        <div className="mt-3 rounded-[var(--r-card)] border-2 border-border px-5 py-9 text-center">
          <div className="text-[12.5px] font-bold text-muted-foreground">Answer</div>
          <div className="mt-2 text-[16.5px] font-bold leading-snug">The net movement of water across a partially permeable membrane, from higher to lower water potential.</div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <span className="flex h-12 flex-1 items-center justify-center rounded-[var(--r-button)] bg-muted text-[15px] font-extrabold">Didn’t know</span>
          <span className="btn-chunky flex h-12 flex-1 items-center justify-center bg-accent text-[15px] font-extrabold text-white">Knew it</span>
        </div>
      </MockScreen>
    </Mock>
  );
}

const WEEK: [string, "done" | "today" | "off"][] = [["S", "off"], ["M", "off"], ["T", "done"], ["W", "done"], ["T", "done"], ["F", "done"], ["S", "today"]];

/** Home's streak row: the flame, the daily goal, the week's ticks. */
export function StreakRow({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <Flame className="size-8 shrink-0 text-[var(--flame)]" fill="currentColor" strokeWidth={1.5} />
        <span className="text-[26px] font-extrabold leading-none tabular-nums">5</span>
        <span className="text-[14px] font-bold text-muted-foreground">day streak</span>
        <span className="ml-auto text-right text-[12px] font-bold leading-tight text-muted-foreground">
          Daily goal
          <span className="block text-[13px] font-extrabold tabular-nums text-foreground">12/20</span>
        </span>
        <svg viewBox="0 0 40 40" className="size-10 shrink-0 -rotate-90">
          <circle cx="20" cy="20" r="15" fill="none" stroke="var(--muted)" strokeWidth="7" />
          <circle cx="20" cy="20" r="15" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray="56.5 94.2" />
        </svg>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1">
        {WEEK.map(([day, state], i) => (
          <li key={i} className="flex flex-col items-center gap-1.5">
            <span className={cn("text-[11.5px] font-bold", state === "today" ? "text-foreground" : "text-muted-foreground")}>{day}</span>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full",
                state === "done" && "bg-[var(--flame)] text-[var(--flame-ink)] shadow-[0_2px_0_var(--flame-edge)]",
                state === "today" && "border-2 border-dashed border-[var(--flame)] bg-card",
                state === "off" && "bg-muted",
              )}
            >
              {state === "done" && <Check className="size-4" strokeWidth={3.5} />}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** `quiet`: without the small cat (the home page keeps the mascot for its big moments). */
export function StreakMock({ quiet = false }: { quiet?: boolean }) {
  return (
    <Mock label="The streak in Scribe: a five-day streak, today’s goal of 20 minutes partly done, and a tick for each day studied this week.">
      <MockScreen>
        <StreakRow />
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          {!quiet && <Cat pose="flame" className="h-[54px]" />}
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold">8 minutes to go today</div>
            <div className="text-[13.5px] text-muted-foreground">Osmosis · Biology · counts for your streak</div>
          </div>
        </div>
      </MockScreen>
    </Mock>
  );
}

/** The copilot answering a question about a lost mark. */
export function CopilotMock() {
  return (
    <Mock label="The Scribe copilot explaining which mark-scheme point an answer missed, with follow-up suggestions.">
      <MockScreen className="flex flex-col gap-3">
        <div className="self-end rounded-[18px] rounded-br-[6px] bg-accent px-4 py-2.5 text-[14.5px] font-semibold text-white">Why did I lose the second mark?</div>
        <div className="flex items-end gap-2.5">
          <Cat pose="think" className="h-12 shrink-0" />
          <div className="rounded-[18px] rounded-bl-[6px] bg-muted px-4 py-3 text-[14.5px] leading-relaxed">
            You said water moves out, but not <b>why</b>. Name the side with the lower water potential: that is the point the mark scheme wants.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-[58px]">
          {["Try another one", "Worked example", "Explain differently"].map((c) => (
            <span key={c} className="whitespace-nowrap rounded-full border border-border-strong px-3 py-1.5 text-[12.5px] font-bold">{c}</span>
          ))}
        </div>
      </MockScreen>
    </Mock>
  );
}

const BARS: [string, number, number, string][] = [
  ["Osmosis", 48, 61, "+13%"],
  ["Active transport", 0, 57, "new"],
  ["Water potential", 66, 71, "+5%"],
];

/** The end of a session: the scene, the cat with the trophy, the score, what moved. */
export function FinishMock() {
  return (
    <Mock label="The end of a Scribe session: a score of 100%, 12 of 12 right, points earned, a four-day streak, and how far each topic’s mastery moved.">
      <div className="hero-card relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border pt-[var(--banner-band)] sm:flex sm:min-h-[var(--banner-min)] sm:items-center sm:p-4">
        <div className="hero-field absolute inset-x-0 top-0 -z-10 h-[var(--banner-band)] sm:inset-0 sm:h-auto">
          <div className="absolute bottom-[10px] left-1/2 h-[92px] -translate-x-1/2 sm:bottom-[7%] sm:left-auto sm:right-[5%] sm:h-[70%] sm:max-h-[150px] sm:translate-x-0">
            <span className="hero-field__ground" />
            <Cat pose="trophy" className="relative h-full" />
          </div>
        </div>
        <div className="hero-copy relative px-5 pb-5 pt-4 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:w-[60%] sm:py-5">
          <div className="hero-eyebrow text-small font-extrabold">Biology · Session complete!</div>
          <div className="mt-1 text-[28px] font-extrabold leading-[1.08] tracking-tight sm:text-[30px]">Flawless!</div>
          <div className="mt-1 text-ui font-semibold text-foreground/75">Osmosis is locked in</div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[52px] font-extrabold leading-[0.9] tracking-tight tabular-nums sm:text-[56px]">100<span className="text-[0.55em]">%</span></span>
            <span className="text-ui font-bold text-foreground/75">12 of 12 right</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
        <span className="flex items-baseline gap-1.5"><span className="text-[22px] font-extrabold leading-none tabular-nums">+85</span><span className="text-[13.5px] font-bold text-muted-foreground">points</span></span>
        <span className="flex items-center gap-1.5"><Flame className="size-5 text-[var(--flame)]" fill="currentColor" strokeWidth={1.5} /><span className="text-[13.5px] font-bold">4-day streak</span></span>
        <span className="flex items-baseline gap-1.5"><span className="text-[22px] font-extrabold leading-none tabular-nums">14</span><span className="text-[13.5px] font-bold text-muted-foreground">min</span></span>
      </div>
      <div className="mt-3 flex gap-1.5 px-1">
        {Array.from({ length: 12 }, (_, i) => <span key={i} className="size-3 rounded-full bg-emerald-500" />)}
      </div>
      <ul className="mt-4 space-y-3 px-1">
        {BARS.map(([name, from, to, delta]) => (
          <li key={name}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-bold">{name}</span>
              <span className="tabular-nums text-muted-foreground">{to}% <span className="font-extrabold text-accent-dim">{delta}</span></span>
            </div>
            <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${to}%` }} />
              {from > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-border-strong" style={{ width: `${from}%` }} />}
            </div>
          </li>
        ))}
      </ul>
    </Mock>
  );
}

const HOME_TILES: { title: string; sub: string; action: string; progress?: number }[] = [
  { title: "Biology", sub: "Next: Cell transport", action: "Continue", progress: 0.4 },
  { title: "Chemistry", sub: "3 materials", action: "Open" },
  { title: "Maths AA HL", sub: "2 materials", action: "Open" },
  { title: "Economics", sub: "1 material", action: "Open" },
  { title: "English Lang & Lit", sub: "4 materials", action: "Open" },
  { title: "History", sub: "2 materials", action: "Open" },
];

/** Home: the subjects as colour tiles, with the streak and what is due beside them. */
export function HomeMock() {
  return (
    <Mock label="Scribe’s home screen: six subjects as coloured tiles (Biology, Chemistry, Maths, Economics, English and History), a five-day streak, and six flashcards due for review.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[19px] font-extrabold">Your subjects</span>
            <span className="text-[15px] font-bold text-muted-foreground">· 6</span>
          </div>
          <div className="landing-home-tiles mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
            {HOME_TILES.map((tile) => (
              <SubjectTile key={tile.title} {...tile} className="min-w-0" />
            ))}
          </div>
        </div>
        <div className="grid gap-x-10 divide-y divide-border md:grid-cols-2 md:divide-y-0 xl:block xl:divide-y">
          <div className="pb-5">
            <div className="text-[16px] font-extrabold">Due for review</div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="text-[34px] font-extrabold leading-none tabular-nums">6</span>
              <span className="text-[13.5px] text-muted-foreground">flashcards due today, about 2 min</span>
            </div>
            <span className="mt-3 flex h-11 items-center justify-center rounded-full bg-muted text-[14.5px] font-extrabold">Review now</span>
          </div>
          <StreakRow className="pt-5 md:pt-0 xl:pt-5" />
        </div>
      </div>
    </Mock>
  );
}

const FILES: [string, string][] = [
  ["Osmosis notes.pdf", "Read · 12 pages"],
  ["Transport slides.pptx", "Read · 42 slides"],
  ["Board photo.jpg", "Read · 1 page"],
];

/** A subject's materials after upload. */
export function UploadMock({ quiet = false }: { quiet?: boolean }) {
  return (
    <Mock label="A subject in Scribe with three uploaded materials, each read and ready: a PDF of notes, a slide deck and a photo of a whiteboard.">
      <MockScreen>
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-extrabold">Your materials</span>
          <span className="text-[14px] font-bold text-muted-foreground">· 3</span>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {FILES.map(([name, state]) => (
            <li key={name} className="flex items-center justify-between gap-3 py-3 text-[14.5px]">
              <span className="min-w-0 truncate font-bold">{name}</span>
              <span className="shrink-0 text-[13px] font-bold text-muted-foreground">{state}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-3 rounded-[var(--r-card)] border-2 border-dashed border-border-strong px-4 py-3.5">
          {!quiet && <Cat pose="sleep" className="h-10" />}
          <div>
            <div className="text-[14.5px] font-extrabold">Add material</div>
            <div className="text-[13px] text-muted-foreground">PDF · slides · photos of notes</div>
          </div>
        </div>
      </MockScreen>
    </Mock>
  );
}
