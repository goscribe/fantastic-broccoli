"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/exam-planner";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Play, Settings2 } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { createStudySession } from "@/lib/api/study";
import { fetchPlannerWeek } from "@/lib/api/planner";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { mistakesApi } from "@/lib/api/mistakes";
import { PLAN_KEY, useStartTask } from "@/components/planner/plan-task";
import { PlanSetupWizard } from "@/components/learn/plan-setup-wizard";
import { actionCopy, funnelKind, type HomeAction, type HomeSummary } from "@/lib/home-action";
import { isEmptyWeek, localYmd, plannedLabel, weekCells, type WeekCell } from "@/lib/home-week";
import { mixedRoundSubjects } from "@/lib/mistakes";
import { weekdayNames } from "@/lib/exam-planner-view";
import { track } from "@/lib/funnel";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { useDaypart } from "@/lib/use-daypart";
import { cn } from "@/lib/utils";

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
 * The banner: the colour of its scene's light (white by day, dark after
 * dark), a hairline, the scene inside it. A container, so the week strip
 * lays itself out from the banner's own width (it shares the row with the
 * rail on desktop).
 */
const shell = "hero-card life-rise @container relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border";

/**
 * The banner's backdrop: the illustrated landscape lit for the student's own
 * time of day (tokens.css picks the file from <html data-daypart>), with the
 * cat on the knoll at the right in whatever outfit is equipped and the
 * "Dress up" pill (the shop's outfits) at its feet. Narrow: a band behind
 * the greeting. Wide: behind the whole banner, washed out on the left.
 */
function HeroScene({ pose, motion }: { pose: MascotPose; motion: string }) {
  const { t } = useI18n();
  return (
    <>
      <div aria-hidden className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[112px] overflow-hidden @2xl:inset-0 @2xl:h-auto" />
      {/* Phones: the scene's own wash starts at sm, so the greeting on the band gets one here. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[112px] sm:hidden"
        style={{ background: "linear-gradient(90deg, var(--hero-wash) 0%, color-mix(in srgb, var(--hero-wash) 85%, transparent) 40%, transparent 68%)" }}
      />
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
    <div className="flex min-h-[112px] items-end px-4 pb-3 @2xl:block @2xl:min-h-0 @2xl:px-6 @2xl:pb-0 @2xl:pt-5">
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
      <div className="px-4 pb-5 @2xl:px-6 @2xl:pb-6 @2xl:pt-3">
        <h2 id="today-title" className="text-[21px] font-extrabold leading-[1.2] @2xl:max-w-[440px] @2xl:text-[24px]">
          {t("today.loadError")}
        </h2>
        <p className="mt-1.5 text-[15px] leading-snug text-foreground/75 @2xl:max-w-[420px]">{t("today.loadErrorBody")}</p>
        <button type="button" disabled={retrying} onClick={onRetry} className={cn(primaryBtn, "mt-4 h-[52px] text-[16px] @2xl:w-auto @2xl:min-w-[220px]")}>
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
        <div className="px-4 pb-4 @2xl:px-6 @2xl:pb-6 @2xl:pt-3">
          <div className="@2xl:max-w-[460px]">
            <h2 id="today-title" className="text-balance text-[22px] font-extrabold leading-[1.15] @2xl:text-[26px]">
              {t("today.uploadTitle")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">{t("today.uploadSub")}</p>
          </div>
          <div className="mt-4 flex flex-col gap-1 @2xl:flex-row @2xl:items-center @2xl:gap-4">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                tapped();
                onUpload();
              }}
              className={cn(primaryBtn, "h-[52px] text-[16px] @2xl:w-auto @2xl:min-w-[240px]")}
            >
              {uploading && <Loader2 className="size-5 animate-spin" />}
              {uploading ? t("today.uploading") : t("today.uploadCta")}
            </button>
            <Link
              href="/new-subject"
              className="flex min-h-11 items-center justify-center text-[14px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
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
      <WeekPlan action={action} />
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
      const created = await createStudySession({
        workspaceId: action.workspaceId,
        title: action.subject || t("today.quick5Cta"),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        // No notes yet (a topic-only subject): the subject name is the topic.
        topics: action.topics ?? undefined,
      });
      router.push(created ? `/workspace/${action.workspaceId}/session/${created.id}` : `/workspace/${action.workspaceId}`);
    } catch (e) {
      toastError(e, t("today.startFailed"));
      setBusy(false);
    }
  };
  const pending = busy || !!starter.startingId;

  return (
    <div className="flex min-w-0 flex-col">
      <p className="hero-eyebrow text-[12.5px] font-extrabold">
        {t("today.eyebrow")}
        <span className="font-bold text-foreground/60"> · {dateLabel}</span>
      </p>
      <h2
        id="today-title"
        title={copy.title}
        className="mt-1 text-balance text-[19px] font-extrabold leading-[1.2] @2xl:line-clamp-3 @2xl:text-[17px]"
      >
        {copy.title}
      </h2>
      {/* Narrow: how long, then a full-width button. Wide: both on one line, so today's cell stays short. */}
      <div className="flex flex-col @2xl:mt-2 @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:justify-between @2xl:gap-x-3 @2xl:gap-y-1.5">
        <p className="mt-0.5 min-w-0 text-[13.5px] font-semibold text-foreground/65 @2xl:mt-0">
          {names ? `${t("home.mixedIn").replace("{list}", names)} · ` : ""}
          {copy.meta}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void go()}
          className={cn(primaryBtn, "mt-3 h-[52px] text-[16px] @2xl:mt-0 @2xl:h-10 @2xl:w-auto @2xl:px-4 @2xl:text-[14.5px]")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
          {copy.cta}
        </button>
      </div>
    </div>
  );
}

/**
 * The week's study plan inside the banner: a line saying how much is planned
 * (and the next exam), then seven days. Wide: seven cells in a row, today's
 * the widest with the action on it, each other day listing its study times
 * (tap one to open it). Narrow: seven day pills, today's action under them,
 * and the day you tap listed below. No plan yet: one calm line to set the
 * week up instead of an empty grid.
 */
function WeekPlan({ action }: { action: Exclude<HomeAction, { kind: "upload" }> }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  const week = useQuery({ queryKey: ["planner", undefined], queryFn: () => fetchPlannerWeek(), retry: 1 });
  const plan = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday, retry: 1 });
  // `?setup=1` (back from connecting Google Calendar) opens the week's setup, as the timetable on home always did.
  const [setupOpen, setSetupOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1");
  const [picked, setPicked] = useState<string | null>(null);
  const today = localYmd(new Date());
  const cells = weekCells(today, week.data?.days);
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
    <div className="flex shrink-0 items-center gap-1">
      {/* The calendar's own icon; an empty week offers it in words in its card instead. */}
      {week.data && !week.data.calendar.connected && !empty && (
        <Link
          href="/planner?connect=1"
          title={t("week.connect")}
          aria-label={t("week.connect")}
          className="grid size-9 place-items-center rounded-[9px] hover:bg-foreground/5"
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
          className="grid size-9 place-items-center rounded-[9px] text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
        >
          <Settings2 className="size-4" />
        </button>
      )}
      <Link href="/planner" className="flex h-9 items-center px-1.5 text-[12.5px] font-bold text-accent hover:underline">
        {t("week.open")}
      </Link>
    </div>
  );

  const pickedCell = picked ? cells.find((c) => c.date === picked && !c.isToday) : undefined;

  return (
    <div className="px-4 pb-4 @2xl:px-6 @2xl:pb-5">
      <div className="flex items-center justify-between gap-2 @2xl:mt-0.5 @2xl:max-w-[calc(96%-200px)] @2xl:justify-start @2xl:gap-3">
        <p className="min-w-0 truncate text-[13.5px] font-bold text-foreground/70 @2xl:text-[14.5px]">
          {/* Narrow: the strip right under it says "this week" already. */}
          <span className={cn(summaryRest && "hidden @2xl:inline")}>{t("week.title")}{summaryRest ? " · " : ""}</span>
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
              <CalendarDays className="size-6 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-extrabold">{t("week.emptyTitle")}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-foreground/70">{t("week.emptyBody")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button type="button" onClick={() => setSetupOpen(true)} className="min-h-8 text-[13px] font-extrabold text-accent hover:underline">
                    {t("week.setup")} →
                  </button>
                  {week.data && !week.data.calendar.connected && (
                    <Link href="/planner?connect=1" className="inline-flex min-h-8 items-center gap-1.5 text-[13px] font-bold text-foreground/80 hover:underline">
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
          style={{ ["--cols" as string]: cells.map((c) => (c.isToday ? "minmax(0,3.4fr)" : "minmax(0,1fr)")).join(" ") }}
          aria-label={summaryLine}
        >
          {cells.map((c) => (
            <DayCell
              key={c.date}
              cell={c}
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
              <DayItems cell={pickedCell} heading={`${names[pickedCell.dow]} ${pickedCell.day}`} />
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

/** One day's study times as links (a session opens it, review opens the flashcards, the rest the planner). */
function DayItems({ cell, heading, max = 6, stacked = false }: { cell: WeekCell; heading?: string; max?: number; stacked?: boolean }) {
  const { t } = useI18n();
  const shown = cell.items.slice(0, max);
  return (
    <div className={cn(heading && "hero-cell rounded-[var(--r-card)] px-3.5 py-2.5")}>
      {heading && (
        <div className="flex items-baseline justify-between text-[13px] font-extrabold">
          {heading}
          {cell.minutes > 0 && <span className="text-[12px] font-bold text-foreground/60">{plannedLabel(cell.minutes)}</span>}
        </div>
      )}
      {cell.items.length === 0 ? (
        <p className="mt-0.5 text-[12px] font-semibold text-foreground/50">{t("week.free")}</p>
      ) : (
        <ul className="mt-0.5 flex flex-col">
          {shown.map((s) => (
            <li key={s.id}>
              <Link href={s.href} title={`${s.time} ${s.title}`} className="-mx-1 block rounded-md px-1 py-0.5 text-[12px] leading-snug hover:bg-foreground/5">
                <span className={cn("font-bold tabular-nums text-foreground/60", stacked && "block text-[11px] leading-tight")}>{s.time}</span>
                {stacked ? null : " "}
                <span className={cn("font-semibold", stacked && "line-clamp-2", s.kind === "review" ? "hero-review" : "text-foreground")}>{s.title}</span>
              </Link>
            </li>
          ))}
          {cell.items.length > shown.length && (
            <li>
              <Link href="/planner" className="-mx-1 block rounded-md px-1 py-0.5 text-[12px] font-bold text-accent hover:underline">
                {t("week.more").replace("{n}", String(cell.items.length - shown.length))}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Today's other study times, one quiet line under the action ("Also today: 17:00 Cell transport · 18:00 Flashcards"). */
function AlsoToday({ cell }: { cell: WeekCell }) {
  const { t } = useI18n();
  if (cell.items.length === 0) return null;
  return (
    <p className="mt-2 truncate px-1 text-[12px] font-semibold text-foreground/70 @2xl:mt-2.5 @2xl:border-t @2xl:border-foreground/10 @2xl:px-0 @2xl:pt-2">
      {t("week.alsoToday")}{" "}
      {cell.items.map((s, i) => (
        <span key={s.id}>
          {i > 0 && " · "}
          <Link href={s.href} className="hover:underline">
            <span className="tabular-nums text-foreground/55">{s.time}</span> {s.title}
          </Link>
        </span>
      ))}
    </p>
  );
}

/**
 * A day of the strip. Narrow: a pill (letter, date, a dot when something is
 * planned) that shows the day's times below the strip; today's action sits
 * under the pills. Wide: a cell with the day's times, today's holding the action.
 */
function DayCell({
  cell,
  name,
  letter,
  loading,
  picked,
  onPick,
  action,
}: {
  cell: WeekCell;
  name: string;
  letter: string;
  loading: boolean;
  picked: boolean;
  onPick: () => void;
  action: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        // Narrow: the li dissolves so today's action can span the row under the pills.
        "contents @2xl:flex @2xl:min-w-0 @2xl:flex-col @2xl:rounded-[var(--r-card)] @2xl:p-2.5",
        // display: contents draws no box, so the cell surface shows only when wide.
        "hero-cell",
        cell.isToday && "hero-cell--today @2xl:p-3",
        cell.past && "@2xl:opacity-60",
      )}
    >
      {/* Narrow pill. */}
      <button
        type="button"
        onClick={onPick}
        aria-pressed={cell.isToday ? undefined : picked}
        aria-label={`${name} ${cell.day}${cell.minutes ? ` · ${plannedLabel(cell.minutes)}` : ""}`}
        className={cn(
          "hero-cell flex h-[58px] flex-col items-center justify-center rounded-xl text-[11px] font-bold @2xl:hidden",
          cell.isToday && "hero-cell--today",
          picked && "!border-foreground/50",
          cell.past && "opacity-60",
        )}
      >
        <span className={cn(cell.isToday ? "text-accent" : "text-foreground/60")}>{letter}</span>
        <span className="text-[15px] font-extrabold leading-tight">{cell.day}</span>
        <span className={cn("mt-0.5 size-1.5 rounded-full", cell.items.length ? "bg-accent" : "bg-transparent")} />
      </button>
      {/* Wide cell header (today's is the action's own "Today · date" line). */}
      {!cell.isToday && (
      <div className="hidden items-baseline justify-between gap-1 @2xl:flex">
        <span className="truncate text-[12.5px] font-extrabold">
          {name} {cell.day}
        </span>
      </div>
      )}
      {cell.isToday ? (
        <div className="col-span-full row-start-2 mt-2 @2xl:mt-1">
          <div className="hero-cell hero-cell--today rounded-[var(--r-card)] p-3.5 @2xl:contents">{action}</div>
          <AlsoToday cell={cell} />
        </div>
      ) : (
        <div className="hidden min-w-0 @2xl:mt-1 @2xl:block">
          {loading ? <span className="mt-1.5 block h-3 w-4/5 animate-pulse rounded bg-foreground/10" /> : <DayItems cell={cell} max={2} stacked />}
        </div>
      )}
    </li>
  );
}
