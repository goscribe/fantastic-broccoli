"use client";

import "@/lib/i18n/exam-planner";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mascot } from "@/components/rewards/mascot";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import {
  addDays,
  deleteExam,
  fetchPlanRange,
  fetchPlanToday,
  mondayOf,
  startPlanTask,
  type ExamSummary,
  type PlanTask,
  type PlanToday,
} from "@/lib/api/exam-planner";
import {
  coverageBar,
  dayLabel,
  fill,
  fmtDuration,
  MONDAY_FIRST,
  monthGrid,
  taskTitle,
  weeklyMinutes,
  weekdayNames,
} from "@/lib/exam-planner-view";
import { useI18n } from "@/lib/i18n";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamSetup, type SetupMode } from "@/components/planner/exam-setup";
import { PLAN_KEY, PlanTaskCard, useStartTask } from "@/components/planner/plan-task";
import { WeekTimetable } from "@/components/planner/week-timetable";

type Tab = "today" | "plan" | "exams" | "timetable";
const TABS: Tab[] = ["today", "plan", "exams", "timetable"];

/** /planner: exams → a day-by-day plan. Today (1–3 one-tap tasks), Plan (week / month), Exams (countdown, coverage), Timetable (hours + calendar). */
export function ExamPlanner() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    if (params.get("calendar")) return "timetable";
    const p = params.get("tab") as Tab | null;
    return p && TABS.includes(p) ? p : "today";
  });
  const [setup, setSetup] = useState<SetupMode | null>(null);
  const { data, isLoading } = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday });
  const starter = useStartTask();

  // One tap from the email / notification: ?start=<taskId> opens that task's session.
  const startParam = params.get("start");
  const started = useRef(false);
  useEffect(() => {
    if (!startParam || started.current) return;
    started.current = true;
    startPlanTask(startParam)
      .then(({ path }) => router.replace(path))
      .catch((err) => {
        toastError(err, t("ep.err.start"));
        router.replace("/planner");
      });
  }, [startParam, router, t]);

  const hasExams = (data?.exams.some((e) => e.daysLeft >= 0) ?? false);
  const title =
    tab === "today" && data ? dayLabel(data.today, locale, { weekday: "long", day: "numeric", month: "long" }) : t(`ep.tab.${tab}`);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <Mascot pose="pencil" className="cat-peek h-[60px] shrink-0 self-end sm:h-[68px]" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-muted-foreground">{t("ep.title")}</div>
            <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
          </div>
        </div>
        {hasExams && tab !== "timetable" && (
          <button
            type="button"
            onClick={() => setSetup({ kind: "new" })}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[13.5px] font-semibold text-foreground hover:border-border-strong"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("ep.exams.add")}</span>
          </button>
        )}
      </div>

      <div role="tablist" className="mb-5 flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto sm:max-w-max">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold transition-colors sm:flex-none sm:px-4",
              tab === k ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`ep.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "timetable" ? (
        <WeekTimetable />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : !data.exams.length ? (
        <EmptyPlan onAdd={() => setSetup({ kind: "new", withTime: true })} />
      ) : tab === "today" ? (
        <TodayView data={data} starter={starter} onOpenExams={() => setTab("exams")} />
      ) : tab === "plan" ? (
        <PlanView today={data.today} starter={starter} />
      ) : (
        <ExamsView data={data} onEdit={(exam) => setSetup({ kind: "edit", exam })} onTime={() => setSetup({ kind: "time" })} />
      )}

      {setup && data && (
        <ExamSetup
          mode={setup}
          today={data.today}
          weekdayMinutes={data.weekdayMinutes}
          firstExam={!data.exams.length}
          onClose={() => setSetup(null)}
        />
      )}
    </div>
  );
}

function EmptyPlan({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center sm:py-14">
      <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized className="cat-bob h-28 w-auto" />
      <h2 className="mt-4 text-[20px] font-bold tracking-tight">{t("ep.empty.title")}</h2>
      <p className="mt-2 max-w-[460px] text-[14px] leading-relaxed text-muted-foreground">{t("ep.empty.body")}</p>
      <button type="button" onClick={onAdd} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-white hover:bg-accent-dim">
        <Plus className="size-4" />
        {t("ep.empty.cta")}
      </button>
    </div>
  );
}

function TodayView({ data, starter, onOpenExams }: { data: PlanToday; starter: ReturnType<typeof useStartTask>; onOpenExams: () => void }) {
  const { t, locale } = useI18n();
  const open = data.tasks.filter((x) => x.status === "planned");
  const allDone = data.tasks.length > 0 && open.length === 0;
  const rest = data.tasks.length === 0;
  const firstOpen = open[0]?.id;
  const upcoming = data.exams.filter((e) => e.daysLeft >= 0);

  const bubble = rest
    ? data.next
      ? `${t("ep.today.rest")} ${fill(t("ep.today.restNext"), { task: taskTitle(data.next, t), day: dayLabel(data.next.date, locale, { weekday: "long" }) })}`
      : t("ep.today.rest")
    : allDone
      ? t("ep.today.allDone")
      : t("ep.today.cat");
  const cat = rest ? "cat3-sleep" : allDone ? "cat3-cheer" : "cat3-book";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-end gap-3">
          <Image src={`/design/${cat}.webp`} alt="" width={72} height={72} unoptimized className={cn("h-16 w-auto shrink-0", allDone ? "cat-cheer" : "cat-bob")} />
          <div className="relative mb-2 min-w-0 flex-1 rounded-2xl rounded-bl-md bg-accent-soft/70 px-4 py-3">
            {!rest && (
              <div className="text-[12px] font-semibold text-accent-dim">
                {fill(t(data.tasks.length === 1 ? "ep.today.summaryOne" : "ep.today.summary"), { n: data.tasks.length, m: fmtDuration(data.minutesToday, t) })}
              </div>
            )}
            <div className="text-[14px] leading-snug">{bubble}</div>
            {allDone && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{t("ep.today.allDoneSub")}</div>}
          </div>
        </div>

        {data.movedForward > 0 && !allDone && (
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted-foreground">
            <CalendarClock className="size-4 shrink-0 text-accent" />
            {data.movedForward === 1 ? t("ep.today.movedOne") : fill(t("ep.today.moved"), { n: data.movedForward })}
          </div>
        )}

        {data.tasks.map((task) => (
          <PlanTaskCard key={task.id} task={task} today={data.today} primary={task.id === firstOpen} startingId={starter.startingId} onStart={starter.start} />
        ))}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">{t("ep.exams.heading")}</h2>
          <button type="button" onClick={onOpenExams} className="text-[12.5px] font-semibold text-accent hover:underline">
            {t("ep.tab.exams")}
          </button>
        </div>
        {upcoming.map((e) => (
          <CountdownRow key={e.id} exam={e} />
        ))}
      </aside>
    </div>
  );
}

function Countdown({ days, big = false }: { days: number; big?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 flex-col items-center leading-none">
      <span className={cn("font-bold tabular-nums tracking-tight", big ? "text-[34px]" : "text-[24px]")}>{days === 0 ? "★" : days}</span>
      <span className="mt-1 text-[11px] font-semibold text-faint">{days === 0 ? t("ep.exams.isToday") : t(days === 1 ? "ep.exams.dayLeft" : "ep.exams.daysLeft")}</span>
    </div>
  );
}

function CoverageBar({ exam }: { exam: ExamSummary }) {
  const color = accentForId(exam.workspaceId);
  const bar = coverageBar(exam);
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${bar.covered}%`, background: `${color}55` }} />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${bar.secure}%`, background: color }} />
    </div>
  );
}

function CountdownRow({ exam }: { exam: ExamSummary }) {
  const { t, locale } = useI18n();
  return (
    <div className="life-card flex items-center gap-3.5 p-3.5">
      <Countdown days={exam.daysLeft} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{exam.title}</div>
        <div className="mb-2 truncate text-[12px] text-faint">
          {exam.subject} · {dayLabel(exam.date, locale, { weekday: "short", day: "numeric", month: "short" })}
        </div>
        <CoverageBar exam={exam} />
        <div className="mt-1.5 text-[11.5px] text-faint">{fill(t("ep.exams.coverage"), { c: exam.covered, t: exam.topics, s: exam.secure })}</div>
      </div>
    </div>
  );
}

function PlanView({ today, starter }: { today: string; starter: ReturnType<typeof useStartTask> }) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const from = view === "week" ? mondayOf(anchor) : grid[0];
  const days = view === "week" ? 7 : 42;
  const { data } = useQuery({ queryKey: [...PLAN_KEY, "range", from, days], queryFn: () => fetchPlanRange(from, days) });
  const names = weekdayNames(locale);
  const shift = (dir: number) => {
    setPicked(null);
    setAnchor(view === "week" ? addDays(anchor, 7 * dir) : `${addDays(`${anchor.slice(0, 8)}15`, 30 * dir).slice(0, 8)}01`);
  };
  const rangeLabel =
    view === "week"
      ? `${dayLabel(from, locale, { day: "numeric", month: "short" })} – ${dayLabel(addDays(from, 6), locale, { day: "numeric", month: "short" })}`
      : dayLabel(`${anchor.slice(0, 8)}15`, locale, { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                setPicked(null);
              }}
              className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold", view === v ? "bg-accent-soft text-accent-dim" : "text-muted-foreground hover:bg-muted")}
            >
              {t(`ep.plan.${v}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[13.5px] font-semibold">{rangeLabel}</span>
          <button type="button" aria-label={t("ep.plan.prev")} onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => { setAnchor(today); setPicked(null); }} className="h-8 rounded-lg border border-border px-2.5 text-[12.5px] font-semibold hover:bg-muted">
            {t("ep.plan.thisWeek")}
          </button>
          <button type="button" aria-label={t("ep.plan.next")} onClick={() => shift(1)} className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {!data ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : view === "week" ? (
        <div className="flex flex-col gap-3">
          {data.days.map((d) => (
            <DayBlock key={d.date} day={d} today={today} starter={starter} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {names.map((n) => (
              <div key={n} className="pb-1 text-center text-[11.5px] font-semibold text-faint">{n}</div>
            ))}
            {data.days.map((d) => {
              const inMonth = d.date.slice(0, 7) === anchor.slice(0, 7);
              const isToday = d.date === today;
              const sel = picked === d.date;
              const minutes = d.tasks.reduce((n, x) => n + x.minutes, 0);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setPicked(sel ? null : d.date)}
                  className={cn(
                    "flex min-h-[58px] flex-col items-center gap-1 rounded-xl border p-1 text-[12.5px] sm:min-h-[76px] sm:items-start sm:p-2",
                    sel ? "border-accent bg-accent-soft/50" : "border-transparent hover:bg-muted",
                    !inMonth && "opacity-40",
                  )}
                >
                  <span className={cn("grid size-6 place-items-center rounded-full font-semibold", isToday && "bg-accent text-white")}>{Number(d.date.slice(8))}</span>
                  {d.exams.length > 0 ? (
                    <span className="w-full truncate rounded-md px-1 text-center text-[10.5px] font-bold text-white sm:text-left" style={{ background: accentForId(d.exams[0].workspaceId) }}>
                      <span className="hidden sm:inline">{d.exams[0].title}</span>
                      <span className="sm:hidden">!</span>
                    </span>
                  ) : (
                    <span className="flex flex-wrap justify-center gap-0.5 sm:justify-start">
                      {d.tasks.slice(0, 3).map((x) => (
                        <span key={x.id} className={cn("size-1.5 rounded-full", x.status === "done" && "opacity-40")} style={{ background: accentForId(x.workspaceId) }} />
                      ))}
                    </span>
                  )}
                  {minutes > 0 && <span className="hidden text-[10.5px] text-faint sm:block">{fmtDuration(minutes, t)}</span>}
                </button>
              );
            })}
          </div>
          {picked ? (
            <DayBlock day={data.days.find((d) => d.date === picked)!} today={today} starter={starter} />
          ) : (
            <p className="text-center text-[12.5px] text-faint">{t("ep.plan.pickDay")}</p>
          )}
        </>
      )}
    </div>
  );
}

function DayBlock({
  day,
  today,
  starter,
}: {
  day: { date: string; minutes: number; tasks: PlanTask[]; exams: { id: string; title: string; workspaceId: string }[] };
  today: string;
  starter: ReturnType<typeof useStartTask>;
}) {
  const { t, locale } = useI18n();
  const isToday = day.date === today;
  const total = day.tasks.reduce((n, x) => n + x.minutes, 0);
  return (
    <section className={cn("rounded-2xl border p-3 sm:p-4", isToday ? "border-accent/50" : "border-border", day.date < today && "opacity-75")}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold">
          {isToday ? `${t("ep.tab.today")} · ` : ""}
          {dayLabel(day.date, locale, { weekday: "long", day: "numeric", month: "short" })}
        </h3>
        <span className="shrink-0 text-[12px] text-faint">{total > 0 ? fmtDuration(total, t) : day.minutes === 0 ? t("ep.plan.rest") : ""}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {day.exams.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-white" style={{ background: accentForId(e.workspaceId) }}>
            <span className="rounded-md bg-white/25 px-1.5 py-px text-[11px]">{t("ep.plan.examDay")}</span>
            <span className="truncate">{e.title}</span>
          </div>
        ))}
        {day.tasks.map((x) => (
          <PlanTaskCard key={x.id} task={x} today={today} size="row" startingId={starter.startingId} onStart={starter.start} />
        ))}
        {!day.tasks.length && !day.exams.length && <div className="text-[12.5px] text-faint">{day.minutes === 0 ? t("ep.plan.rest") : t("ep.plan.nothing")}</div>}
      </div>
    </section>
  );
}

function ExamsView({ data, onEdit, onTime }: { data: PlanToday; onEdit: (e: ExamSummary) => void; onTime: () => void }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const upcoming = data.exams.filter((e) => e.daysLeft >= 0);
  const past = data.exams.filter((e) => e.daysLeft < 0);
  const names = weekdayNames(locale, "narrow");
  const remove = async (e: ExamSummary) => {
    if (!window.confirm(t("ep.exams.deleteConfirm"))) return;
    try {
      await deleteExam(e.id);
      await qc.invalidateQueries({ queryKey: PLAN_KEY });
    } catch (err) {
      toastError(err, t("ep.err.save"));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-3">
        {upcoming.map((e) => {
          const color = accentForId(e.workspaceId);
          return (
            <article key={e.id} className="rounded-2xl border border-border p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="grid size-[72px] shrink-0 place-items-center rounded-2xl" style={{ background: `${color}14`, color }}>
                  <Countdown days={e.daysLeft} big />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-bold tracking-tight">{e.title}</div>
                  <div className="truncate text-[12.5px] text-faint">
                    {e.subject} · {t(`ep.setup.kind.${e.kind}`)} · {dayLabel(e.date, locale, { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={() => onEdit(e)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted">
                      <Pencil className="size-3.5" /> {t("ep.exams.edit")}
                    </button>
                    <button type="button" onClick={() => void remove(e)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted">
                      <Trash2 className="size-3.5" /> {t("ep.exams.delete")}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <CoverageBar exam={e} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                  <span>{fill(t("ep.exams.coverage"), { c: e.covered, t: e.topics, s: e.secure })}</span>
                  <span className="text-faint">{fill(t("ep.exams.tasks"), { d: e.tasksDone, t: e.tasksTotal })}</span>
                </div>
                <div className="mt-1.5 flex gap-3 text-[11.5px] text-faint">
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: color }} />{t("ep.exams.legendSecure")}</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: `${color}55` }} />{t("ep.exams.legendCovered")}</span>
                </div>
              </div>
              {e.unplanned > 0 && (
                <div className="mt-3 flex flex-col gap-2 rounded-xl bg-[#fff8ec] px-3 py-2.5 text-[12.5px] text-[#8a4a12] sm:flex-row sm:items-center sm:justify-between">
                  <span>{fill(t("ep.exams.unplanned"), { n: e.unplanned })}</span>
                  <button type="button" onClick={onTime} className="shrink-0 self-start font-semibold underline sm:self-auto">{t("ep.exams.changeTime")}</button>
                </div>
              )}
            </article>
          );
        })}
        {past.length > 0 && (
          <div className="mt-2">
            <h3 className="mb-2 text-[13px] font-semibold text-faint">{t("ep.exams.past")}</h3>
            {past.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-t border-border py-2 text-[13px] text-muted-foreground">
                <span className="truncate">{e.title} · {e.subject}</span>
                <span className="shrink-0">{dayLabel(e.date, locale, { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Clock className="size-4 text-accent" />{t("ep.time.heading")}</h2>
            <button type="button" onClick={onTime} className="text-[12.5px] font-semibold text-accent hover:underline">{t("ep.exams.edit")}</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {MONDAY_FIRST.map((wd, i) => {
              const m = data.weekdayMinutes[wd] ?? 0;
              return (
                <div key={wd} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold text-faint">{names[i]}</span>
                  <span className={cn("grid h-9 w-full place-items-center rounded-lg text-[12px] font-semibold", m ? "bg-accent-soft text-accent-dim" : "bg-muted text-faint")}>{m || "–"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 text-[12.5px] text-muted-foreground">{fill(t("ep.time.perWeek"), { h: fmtDuration(weeklyMinutes(data.weekdayMinutes), t) })}</div>
        </div>
      </aside>
    </div>
  );
}
