"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/exam-planner";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, Play, Settings2 } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { createStudySession } from "@/lib/api/study";
import { fetchPlannerWeek } from "@/lib/api/planner";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { mistakesApi } from "@/lib/api/mistakes";
import { PLAN_KEY, useStartTask } from "@/components/planner/plan-task";
import { PlanSetupWizard } from "@/components/learn/plan-setup-wizard";
import { actionCopy, funnelKind, type HomeAction, type HomeSubject, type HomeSummary } from "@/lib/home-action";
import { dayState, isEmptyWeek, localYmd, plannedLabel, streakDoneDates, weekCells, type DayState, type WeekCell, type WeekItem } from "@/lib/home-week";
import { FAMILY, hueFamilyFor, resolveSubjectFamily } from "@/lib/subject-family";
import { useStreak } from "@/lib/rewards";
import { mixedRoundSubjects } from "@/lib/mistakes";
import { weekdayNames } from "@/lib/exam-planner-view";
import { track } from "@/lib/funnel";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { useDaypart } from "@/lib/use-daypart";
import { cn } from "@/lib/utils";
import { chooseStudyLength } from "@/lib/study-length-client";

/** Big enough for a thumb on a phone (≥ 44px); the page's one purple button. */
const primaryBtn =
  "btn-chunky rounded-[var(--r-button)] relative inline-flex w-full items-center justify-center gap-2 bg-accent px-5 font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70";

/** The cat's pose follows what the action asks for. */
const POSE: Record<Exclude<HomeAction["kind"], "upload">, MascotPose> = {
  mistakes: "think",
  plan: "pencil",
  continue: "book",
  next: "book",
  quick5: "book",
};

/**
 * The banner: the scene inside a hairline. A container, so the week strip
 * lays itself out from the banner's own width (it shares the row with the
 * rail on desktop). It is painted in full from the first frame: no fade-in.
 */
const shell = "hero-card home-hero @container relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border";

/** The solid card the words sit on when the banner has no week (first upload, load error). */
const copyCard = "hero-copy mx-2.5 mb-2.5 p-3.5 @2xl:mx-5 @2xl:mb-5 @2xl:max-w-[540px] @2xl:px-5";

/**
 * The banner's backdrop: the illustrated landscape lit for the student's own
 * time of day (tokens.css picks the file from <html data-daypart>), filling
 * the whole banner with nothing faded over it, with the cat on the knoll at
 * the right in whatever outfit is equipped and the "Dress up" pill (the
 * shop's outfits) at its feet. Words sit on solid cards over it.
 */
function HeroScene({ pose, motion }: { pose: MascotPose; motion: string }) {
  const { t } = useI18n();
  return (
    <>
      <div aria-hidden className="hero-field pointer-events-none absolute inset-0 -z-10 overflow-hidden" />
      <div className="pointer-events-none absolute right-[5%] top-[18px] -z-10 h-[86px] @2xl:right-[4%] @2xl:top-[12px] @2xl:h-[108px]">
        <span className="hero-field__ground" />
        <Mascot pose={pose} className={cn(motion, "h-full")} priority />
      </div>
      <Link
        href="/shop#outfits"
        className="absolute left-1.5 top-1.5 z-10 flex min-h-11 items-center px-1.5 focus-visible:outline-none @2xl:left-auto @2xl:right-[calc(4%+92px)] @2xl:top-[58px] [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-accent/50"
      >
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-extrabold leading-none text-[#16161a] shadow-[0_1px_0_rgb(0_0_0/0.08)] transition-colors hover:bg-white">
          {t("today.dressUp")}
        </span>
      </Link>
    </>
  );
}

/** The greeting: on the band (narrow) or at the banner's top left (wide). It is the page's h1. */
function Greeting({ greeting }: { greeting: string }) {
  return (
    <div className="flex min-h-[var(--banner-band)] items-end px-4 pb-3 @2xl:block @2xl:min-h-0 @2xl:px-6 @2xl:pb-0 @2xl:pt-5">
      <h1 className="max-w-[58%] text-balance text-[25px] font-extrabold leading-[1.1] @2xl:max-w-[62%] @2xl:text-[28px]">{greeting}</h1>
    </div>
  );
}

/** The summary failed: say so in the banner, with Retry as its one button. */
export function HomeBannerError({ greeting, onRetry, retrying }: { greeting: string; onRetry: () => void; retrying: boolean }) {
  const { t } = useI18n();
  return (
    <section className={shell} role="alert" aria-labelledby="today-title">
      <HeroScene pose="think" motion="cat-bob" />
      <Greeting greeting={greeting} />
      <div className={cn(copyCard, "@2xl:mt-3")}>
        <h2 id="today-title" className="text-[20px] font-extrabold leading-[1.2] @2xl:max-w-[440px]">
          {t("today.loadError")}
        </h2>
        <p className="mt-1 text-ui text-foreground/75 @2xl:max-w-[420px]">{t("today.loadErrorBody")}</p>
        <button type="button" disabled={retrying} onClick={onRetry} className={cn(primaryBtn, "mt-3 h-12 text-[16px] @2xl:h-11 @2xl:w-auto @2xl:min-w-[220px] @2xl:text-[15px]")}>
          {retrying && <Loader2 className="size-5 animate-spin" />}
          {t("today.retry")}
        </button>
      </div>
    </section>
  );
}

/**
 * Home's banner: the greeting, the week's study plan as seven days, and
 * today's one action (what to do, where, how long, one button) sitting on
 * today's day. The action comes from `home.summary` and renders at once;
 * the week (`planner.getWeek`) fills the other days when it arrives and
 * never holds the action back. Due counts, the streak and points live in
 * the rail, not here.
 */
export function HomeBanner({
  greeting,
  summary,
  uploading,
  onUpload,
}: {
  greeting: string;
  summary: HomeSummary;
  uploading: boolean;
  onUpload: () => void;
}) {
  const { t } = useI18n();
  const daypart = useDaypart();
  const { action } = summary;

  if (action.kind === "upload") {
    const tapped = () => track("home.today_tapped", { action: "upload" });
    return (
      <section className={shell} aria-labelledby="today-title">
        <HeroScene pose="wave" motion="cat-wiggle" />
        <Greeting greeting={greeting} />
        <div className={cn(copyCard, "@2xl:mt-3")}>
          <div className="@2xl:max-w-[460px]">
            <h2 id="today-title" className="text-balance text-[20px] font-extrabold leading-[1.2]">
              {t("today.uploadTitle")}
            </h2>
            <p className="mt-1 text-ui text-foreground/75">{t("today.uploadSub")}</p>
          </div>
          <div className="mt-3 flex flex-col gap-1 @2xl:flex-row @2xl:items-center @2xl:gap-4">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                tapped();
                onUpload();
              }}
              className={cn(primaryBtn, "h-12 text-[16px] @2xl:h-11 @2xl:w-auto @2xl:min-w-[220px] @2xl:text-[15px]")}
            >
              {uploading && <Loader2 className="size-5 animate-spin" />}
              {uploading ? t("today.uploading") : t("today.uploadCta")}
            </button>
            <Link
              href="/new-subject"
              className="flex min-h-11 items-center justify-center text-ui font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
            >
              {t("today.uploadAlt")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // In the small hours the cat is asleep on its feet.
  const pose = daypart === "late" ? "sleep" : POSE[action.kind];
  return (
    <section className={shell} aria-labelledby="today-title">
      <HeroScene pose={pose} motion="cat-peek" />
      <Greeting greeting={greeting} />
      <WeekPlan action={action} subjects={summary.subjects} />
    </section>
  );
}

/** Today's one action: the sentence, how long, one button. */
function TodayAction({ action }: { action: Exclude<HomeAction, { kind: "upload" }> }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const starter = useStartTask();
  const [busy, setBusy] = useState(false);
  const copy = actionCopy(action, t);
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  // A mixed mistakes round names its subjects (its own small request; the sentence and button never wait for it).
  const mixed = action.kind === "mistakes" && !action.subject;
  const { data: mistakes } = useQuery({
    queryKey: ["mistakes-summary", null],
    queryFn: () => mistakesApi.summary(),
    enabled: mixed,
    retry: 1,
    staleTime: 30_000,
  });
  const names = mixed && mistakes ? mixedRoundSubjects(mistakes.subjects) : "";

  const go = async () => {
    track("home.today_tapped", { action: funnelKind(action) }, ("workspaceId" in action && action.workspaceId) || undefined);
    if (action.kind === "plan") return void starter.start(action.taskId);
    setBusy(true);
    if (action.kind !== "quick5") return router.push(action.href);
    try {
      const created = await createStudySession(
        await chooseStudyLength({
          workspaceId: action.workspaceId,
          title: action.subject || t("today.quick5Cta"),
          depth: "light" as const,
          durationMinutes: 5,
          quickStart: true,
          // No notes yet (a topic-only subject): the subject name is the topic.
          topics: action.topics ?? undefined,
        }),
      );
      router.push(created ? `/workspace/${action.workspaceId}/session/${created.id}` : `/workspace/${action.workspaceId}`);
    } catch (e) {
      toastError(e, t("today.startFailed"));
      setBusy(false);
    }
  };
  const pending = busy || !!starter.startingId;

  return (
    <div className="flex min-w-0 flex-col">
      <p className="text-caption font-extrabold">
        {t("today.eyebrow")}
        <span className="font-bold text-foreground/60"> · {dateLabel}</span>
      </p>
      <h2
        id="today-title"
        title={copy.title}
        className="mt-1 text-balance text-[19px] font-extrabold leading-[1.2] @2xl:line-clamp-3 @2xl:text-[18px]"
      >
        {copy.title}
      </h2>
      {/* Narrow: how long, then a full-width button. Wide: both on one line, so today's cell stays short. */}
      <div className="flex flex-col @2xl:mt-2 @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:justify-between @2xl:gap-x-3 @2xl:gap-y-1.5">
        <p className="mt-0.5 min-w-0 text-small font-semibold text-foreground/65 @2xl:mt-0">
          {names ? `${t("home.mixedIn").replace("{list}", names)} · ` : ""}
          {copy.meta}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void go()}
          className={cn(primaryBtn, "mt-3 h-[52px] text-[16px] @2xl:mt-0 @2xl:h-11 @2xl:w-auto @2xl:px-5 @2xl:text-[15px]")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
          {copy.cta}
        </button>
      </div>
    </div>
  );
}

/** A subject's deep colour (the family's `a`, as on its tile), by workspace id. */
function useSubjectColours(subjects: HomeSubject[]): Map<string, string> {
  return useMemo(
    () => new Map(subjects.map((s) => [s.id, FAMILY[hueFamilyFor(resolveSubjectFamily(s.subjectFamily, s.title), s.id)].a])),
    [subjects],
  );
}

/**
 * The week's study plan inside the banner: a solid chip saying how much is
 * planned (and the next exam), then seven days as solid cards on the scene.
 * Every study time is a chip in its subject's colour. Wide: seven cards in a
 * row, today's the widest, white and lifted, with the action on it; a day the
 * streak counted gets the streak's tick, a day that passed with its plan
 * undone goes grey and dashed, a free day shows the cat asleep. Narrow: seven
 * day pills (a dot per subject, the tick, today dark), today's action under
 * them, and the day you tap listed below. No plan yet: one calm card to set
 * the week up instead of an empty grid.
 */
function WeekPlan({ action, subjects }: { action: Exclude<HomeAction, { kind: "upload" }>; subjects: HomeSubject[] }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  const week = useQuery({ queryKey: ["planner", undefined], queryFn: () => fetchPlannerWeek(), retry: 1 });
  const plan = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday, retry: 1 });
  // The rail's own streak request (same key): which days counted. The strip never waits for it.
  const { data: streak } = useStreak();
  const colours = useSubjectColours(subjects);
  // `?setup=1` (back from connecting Google Calendar) opens the week's setup, as the timetable on home always did.
  const [setupOpen, setSetupOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1");
  const [picked, setPicked] = useState<string | null>(null);
  const today = localYmd(new Date());
  const cells = weekCells(today, week.data?.days);
  const done = streakDoneDates(streak?.week);
  const empty = isEmptyWeek(week.data?.days);
  const names = weekdayNames(locale, "short");
  const narrow = weekdayNames(locale, "narrow");
  const exam = plan.data?.exams.find((e) => e.daysLeft > 0);
  const closeSetup = () => {
    setSetupOpen(false);
    if (new URLSearchParams(window.location.search).get("setup")) router.replace("/");
  };

  const summaryRest = [
    // An empty week says so in its own card below, not here as well.
    week.data && week.data.plannedMinutes > 0 ? t("week.planned").replace("{h}", plannedLabel(week.data.plannedMinutes)) : null,
    exam ? (exam.daysLeft === 1 ? t("ep.home.countdownTomorrow").replace("{exam}", exam.title) : t("ep.home.countdown").replace("{exam}", exam.title).replace("{n}", String(exam.daysLeft))) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const summaryLine = [t("week.title"), summaryRest].filter(Boolean).join(" · ");

  const controls = (
    <div className="flex shrink-0 items-center">
      {/* The calendar's own icon; an empty week offers it in words in its card instead. */}
      {week.data && !week.data.calendar.connected && !empty && (
        <Link
          href="/planner?connect=1"
          title={t("week.connect")}
          aria-label={t("week.connect")}
          className="grid size-9 place-items-center rounded-full hover:bg-foreground/5"
        >
          <Image src="/design/gcal.svg" alt="" width={18} height={18} className="size-[18px]" />
        </Link>
      )}
      {week.data && (
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          aria-label={t("week.settings")}
          title={t("week.settings")}
          className="grid size-9 place-items-center rounded-full text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
        >
          <Settings2 className="size-4" />
        </button>
      )}
      <Link href="/planner" onClick={() => track("home.today_tapped", { action: "planner" })} className="flex h-9 items-center rounded-full px-2.5 text-[12.5px] font-extrabold text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:bg-foreground/5 hover:decoration-foreground">
        {t("week.open")}
      </Link>
    </div>
  );

  const pickedCell = picked ? cells.find((c) => c.date === picked && !c.isToday) : undefined;

  return (
    <div className="px-4 pb-4 @2xl:px-6 @2xl:pb-6">
      {/* The week line sits on its own solid chip, never on the bare scene. */}
      <div className="hero-chip flex items-center justify-between gap-2 rounded-[14px] py-0.5 pl-3 pr-0.5 @2xl:mt-1 @2xl:w-fit @2xl:max-w-[calc(96%-200px)] @2xl:justify-start @2xl:gap-2 @2xl:rounded-full @2xl:pl-4">
        <p className="min-w-0 truncate text-small font-bold text-foreground/75">
          {/* Narrow: the strip right under it says "this week" already. */}
          <span className={cn("text-foreground", summaryRest && "hidden @2xl:inline")}>{t("week.title")}{summaryRest ? " · " : ""}</span>
          {summaryRest}
        </p>
        {controls}
      </div>

      {empty || week.isError ? (
        // No plan yet (or the planner could not answer): the action on its own, and one calm way to set the week up.
        <div className="mt-3 flex flex-col gap-3 @2xl:mt-4 @2xl:flex-row @2xl:items-stretch">
          <div className="hero-cell hero-cell--today rounded-[var(--r-card)] p-3.5 @2xl:w-[300px] @2xl:shrink-0 @2xl:p-4">
            <TodayAction action={action} />
          </div>
          {empty && (
            <div className="hero-cell flex flex-1 items-center gap-3 rounded-[var(--r-card)] px-4 py-3.5">
              <CalendarDays className="size-6 shrink-0 text-foreground/70" />
              <div className="min-w-0 flex-1">
                <div className="text-ui font-extrabold">{t("week.emptyTitle")}</div>
                <p className="mt-0.5 text-caption leading-snug text-foreground/70">{t("week.emptyBody")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button type="button" onClick={() => setSetupOpen(true)} className="min-h-8 text-[13px] font-extrabold text-foreground underline decoration-foreground/30 underline-offset-[3px] hover:decoration-foreground">
                    {t("week.setup")} →
                  </button>
                  {week.data && !week.data.calendar.connected && (
                    <Link href="/planner?connect=1" className="inline-flex min-h-8 items-center gap-1.5 text-small font-bold text-foreground/80 hover:underline">
                      <Image src="/design/gcal.svg" alt="" width={16} height={16} className="size-4" />
                      {t("week.connect")}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ol
          className="mt-3 grid grid-cols-7 gap-1 @2xl:mt-4 @2xl:gap-1.5 @2xl:[grid-template-columns:var(--cols)]"
          style={{ ["--cols" as string]: cells.map((c) => (c.isToday ? "minmax(0,3.1fr)" : "minmax(0,1fr)")).join(" ") }}
          aria-label={summaryLine}
        >
          {cells.map((c) => (
            <DayCell
              key={c.date}
              cell={c}
              state={dayState(c, done)}
              colours={colours}
              name={names[c.dow]}
              letter={narrow[c.dow]}
              loading={!week.data}
              picked={picked === c.date}
              onPick={() => setPicked(c.isToday || picked === c.date ? null : c.date)}
              action={c.isToday ? <TodayAction action={action} /> : null}
            />
          ))}
          {pickedCell && (
            <li className="col-span-full mt-1 @2xl:hidden">
              <PickedDay cell={pickedCell} state={dayState(pickedCell, done)} colours={colours} heading={`${names[pickedCell.dow]} ${pickedCell.day}`} />
            </li>
          )}
        </ol>
      )}

      {setupOpen && week.data && (
        <PlanSetupWizard
          plan={week.data.plan}
          onClose={closeSetup}
          onSaved={() => {
            closeSetup();
            void qc.invalidateQueries({ queryKey: ["planner"] });
          }}
        />
      )}
    </div>
  );
}

/**
 * One study time as a chip in its subject's colour (a session opens itself,
 * review the flashcards, the rest the planner). Review blocks and times with
 * no subject are neutral; on a missed day every chip is. `inline`: the time
 * and title on one line (today's other times, a picked day on phones).
 *
 * In a day card the chip is narrow, so a word is never split: the title
 * wraps only between words, a word too wide for the chip ends in an
 * ellipsis instead of breaking, and the title stops at two lines. A review block says "Cards" there. The full title is in the
 * tooltip and the accessible name.
 */
function ItemChip({ item, colour, muted = false, inline = false }: { item: WeekItem; colour?: string; muted?: boolean; inline?: boolean }) {
  const { t, locale } = useI18n();
  const plain = muted || !colour;
  const label = !inline && item.kind === "review" ? t("week.cardsShort") : item.title;
  const full = `${item.time} ${item.title}`;
  return (
    <Link
      href={item.href}
      // A study time on the week is a way into today's work too (funnel: which way in gets taken).
      onClick={() => track("home.today_tapped", { action: "week_item" }, item.workspaceId)}
      title={full}
      aria-label={full}
      className={cn("week-chip min-w-0 text-left", plain && "week-chip--plain", inline ? "inline-flex max-w-full items-baseline gap-1 px-2 py-1" : "block px-1.5 py-1.5", muted && "text-foreground/70")}
      style={plain ? undefined : ({ ["--chip" as string]: colour } as React.CSSProperties)}
    >
      <span className={cn("shrink-0 font-bold tabular-nums", inline ? "text-caption" : "block text-[10px] leading-tight")}>{item.time}</span>
      {inline ? (
        <span className="truncate text-caption font-extrabold">{label}</span>
      ) : (
        <span lang={locale} className="week-chip__title line-clamp-2 text-caption font-extrabold leading-[1.2]">
          {label.split(/\s+/).filter(Boolean).map((w, i) => (
            <span key={i}>
              {i > 0 && " "}
              <span className="week-chip__word">{w}</span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

const colourOf = (item: WeekItem, colours: Map<string, string>) => (item.kind === "review" || !item.workspaceId ? undefined : colours.get(item.workspaceId));

/** The streak's tick on a day that counted. */
function DoneTick({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t("week.dayDone")} className={cn("week-tick grid shrink-0 place-items-center rounded-full", className)}>
      <Check className="size-[65%]" strokeWidth={3.5} />
    </span>
  );
}

/** A free day: the word, and on a free day still to come the cat asleep (one nap, not a row of them on a past week). */
function FreeDay({ nap, className }: { nap: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="self-start pl-1 text-caption font-bold text-foreground/65">{t("week.free")}</span>
      {nap && <Image src="/design/cat3-sleep.webp" alt="" width={401} height={400} unoptimized className="mt-auto h-10 w-auto pt-1" />}
    </div>
  );
}

/** Phones: the day you tapped, its times as chips. */
function PickedDay({ cell, state, colours, heading }: { cell: WeekCell; state: DayState; colours: Map<string, string>; heading: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("hero-cell rounded-[var(--r-card)] px-3.5 py-2.5", state === "missed" && "hero-cell--missed")}>
      <div className="flex items-center justify-between gap-2 text-small font-extrabold">
        <span className="flex items-center gap-1.5">
          {heading}
          {state === "done" && <DoneTick className="size-4" />}
          {state === "missed" && <span className="text-caption font-bold text-foreground/65">· {t("week.dayMissed")}</span>}
        </span>
        {cell.minutes > 0 && <span className="text-caption font-bold text-foreground/65">{plannedLabel(cell.minutes)}</span>}
      </div>
      {cell.items.length === 0 ? (
        <p className="mt-0.5 text-caption font-bold text-foreground/65">{t("week.free")}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {cell.items.map((s) => (
            <li key={s.id} className="min-w-0 max-w-full">
              <ItemChip item={s} colour={colourOf(s, colours)} muted={state === "missed"} inline />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Today's other study times under the action, as chips ("Also today: 17:00 Cell transport, 18:00 Flashcards"). */
function AlsoToday({ cell, colours }: { cell: WeekCell; colours: Map<string, string> }) {
  const { t } = useI18n();
  if (cell.items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-foreground/10 pt-2.5">
      <p className="mr-0.5 text-caption font-bold text-foreground/65">{t("week.alsoToday")}</p>
      <ul className="contents">
        {cell.items.map((s) => (
          <li key={s.id} className="min-w-0 max-w-full">
            <ItemChip item={s} colour={colourOf(s, colours)} inline />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A day of the strip. Narrow: a pill (letter, date, a dot per subject, the
 * streak's tick on a day that counted) that shows the day's times below the
 * strip; today's pill is the dark one and its action sits under the pills.
 * Wide: a solid card with the day's times as chips, today's holding the action.
 */
function DayCell({
  cell,
  state,
  colours,
  name,
  letter,
  loading,
  picked,
  onPick,
  action,
}: {
  cell: WeekCell;
  state: DayState;
  colours: Map<string, string>;
  name: string;
  letter: string;
  loading: boolean;
  picked: boolean;
  onPick: () => void;
  action: React.ReactNode;
}) {
  const { t } = useI18n();
  const missed = state === "missed";
  // One dot per subject that day (review blocks share one neutral dot), at most three.
  const dots = [...new Set(cell.items.map((s) => (missed ? "" : colourOf(s, colours) ?? "")))].slice(0, 3);
  const shown = cell.items.slice(0, 2);
  return (
    <li
      className={cn(
        // Narrow: the li dissolves so today's action can span the row under the pills.
        "hero-day contents @2xl:relative @2xl:flex @2xl:min-w-0 @2xl:flex-col @2xl:rounded-[var(--r-card)] @2xl:p-1.5 @2xl:pt-2",
        missed && "hero-day--missed",
        cell.isToday && "hero-day--today @2xl:z-10 @2xl:-my-1.5 @2xl:p-3.5",
      )}
    >
      {/* Narrow pill. */}
      <button
        type="button"
        onClick={onPick}
        aria-pressed={cell.isToday ? undefined : picked}
        aria-label={`${name} ${cell.day}${cell.minutes ? ` · ${plannedLabel(cell.minutes)}` : ""}${state === "done" ? ` · ${t("week.dayDone")}` : missed ? ` · ${t("week.dayMissed")}` : ""}`}
        className={cn(
          "week-pill relative flex h-[58px] flex-col items-center justify-center rounded-xl text-[11px] font-bold @2xl:hidden",
          cell.isToday ? "hero-pill--today -my-[3px] h-[64px] rounded-[14px]" : "hero-cell",
          missed && "hero-cell--missed",
          picked && "outline outline-2 outline-offset-1 outline-foreground",
        )}
      >
        <span className={cn(!cell.isToday && "text-foreground/75")}>{letter}</span>
        <span className={cn("text-ui font-extrabold leading-tight", missed && "text-foreground/65")}>{cell.day}</span>
        <span className="mt-1 flex h-1.5 items-center gap-[3px]">
          {dots.map((c) => (
            <span
              key={c || "plain"}
              className={cn("size-1.5 rounded-full", !c && "bg-current opacity-45", cell.isToday && c && "ring-[1.5px] ring-current")}
              style={c ? { background: c } : undefined}
            />
          ))}
        </span>
        {state === "done" && <DoneTick className="absolute -right-1 -top-1 size-[17px]" />}
      </button>
      {/* Wide card header (today's is the action's own "Today · date" line). */}
      {!cell.isToday && (
        <div className="hidden pl-1 @2xl:block">
          <span className={cn("block truncate text-caption font-extrabold", missed && "text-foreground/65")}>
            {name} {cell.day}
          </span>
          {/* A sticker on the card's corner, so the day's name keeps its room. */}
          {state === "done" && <DoneTick className="absolute -right-1.5 -top-1.5 size-5" />}
        </div>
      )}
      {cell.isToday ? (
        <div className="col-span-full row-start-2 mt-2 @2xl:mt-0">
          <div className="hero-cell hero-cell--today rounded-[var(--r-card)] p-3.5 @2xl:contents">
            {action}
            <AlsoToday cell={cell} colours={colours} />
          </div>
        </div>
      ) : (
        <div className="hidden min-w-0 flex-1 flex-col @2xl:mt-1.5 @2xl:flex">
          {loading ? (
            <>
              <span className="block h-9 rounded-[10px] bg-foreground/10" />
              <span className="mt-1.5 block h-9 w-4/5 rounded-[10px] bg-foreground/[0.06]" />
            </>
          ) : cell.items.length === 0 ? (
            <FreeDay nap={!cell.past} className="flex-1" />
          ) : (
            <>
              {missed && <span className="-mt-1 mb-1 pl-1 text-caption font-bold text-foreground/65">{t("week.dayMissed")}</span>}
              <ul className="flex flex-col gap-1.5">
                {shown.map((s) => (
                  <li key={s.id}>
                    <ItemChip item={s} colour={colourOf(s, colours)} muted={missed} />
                  </li>
                ))}
              </ul>
              {cell.items.length > shown.length && (
                <Link href="/planner" onClick={() => track("home.today_tapped", { action: "planner" })} className="mt-1 block rounded-md px-0.5 text-caption font-extrabold text-foreground/70 hover:text-foreground hover:underline">
                  {t("week.more").replace("{n}", String(cell.items.length - shown.length))}
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
