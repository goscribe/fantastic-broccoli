"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/mistakes";
import "@/lib/i18n/exam-planner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Clock, Flame, Loader2, PartyPopper, Play, RotateCcw, Upload, Zap } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { mistakesApi } from "@/lib/api/mistakes";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { createStudySession } from "@/lib/api/study";
import { PLAN_KEY, useStartTask } from "@/components/planner/plan-task";
import { fill, fmtDuration, taskTitle } from "@/lib/exam-planner-view";
import { practiceHref } from "@/lib/mistakes";
import { pickResumable, pickTodayAction, type TodayAction } from "@/lib/home-today";
import { track, type TodayActionKind } from "@/lib/funnel";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StudySession, Workspace } from "@/types";

/** Big enough for a thumb on a phone (≥ 44px), full width so it is the obvious tap. */
const primaryBtn =
  "btn-chunky inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[16px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70";

/** The card's tint and the cat's pose follow what today asks for. */
const LOOK: Record<"mistakes" | "plan" | "quick5" | "done", { pose: MascotPose; bg: string }> = {
  mistakes: { pose: "think", bg: "bg-[linear-gradient(140deg,#ece6ff_0%,#f6f2ff_48%,#ffffff_100%)]" },
  plan: { pose: "pencil", bg: "bg-[linear-gradient(140deg,#e7f0ff_0%,#f3f0ff_48%,#ffffff_100%)]" },
  quick5: { pose: "book", bg: "bg-[linear-gradient(140deg,#ece6ff_0%,#fbf3ff_48%,#ffffff_100%)]" },
  done: { pose: "trophy", bg: "bg-[linear-gradient(140deg,#dcf7e8_0%,#f1fbf5_48%,#ffffff_100%)]" },
};
const shell = "relative overflow-hidden rounded-[24px] border border-accent/15 shadow-[var(--card-shadow)]";

/**
 * Home's one "Today" card: the smallest useful thing to do next (fix
 * mistakes → today's planner task → Quick 5 → upload notes), one big button,
 * and at most one quiet "or continue …" line under it.
 */
export function TodayCard({
  workspaces,
  sessions,
  loading,
  uploading,
  onUpload,
  doneToday = false,
}: {
  /** Today already counts for the streak (daily goal met). */
  doneToday?: boolean;
  workspaces: Workspace[];
  sessions: StudySession[];
  loading: boolean;
  uploading: boolean;
  onUpload: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const starter = useStartTask();
  const [busy, setBusy] = useState(false);
  const mistakes = useQuery({ queryKey: ["mistakes-summary", null], queryFn: () => mistakesApi.summary(), retry: 1 });
  const plan = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday, retry: 1 });
  const openTasks = plan.data?.tasks.filter((x) => x.status === "planned") ?? [];

  const action: TodayAction = pickTodayAction({
    loading: loading || mistakes.isPending || plan.isPending,
    openMistakes: mistakes.data?.open ?? 0,
    practiceMinutes: mistakes.data?.practiceMinutes ?? 0,
    planTasks: openTasks,
    doneToday,
    workspaces: workspaces.map((w) => ({ id: w.id, materialCount: w.materials.length })),
    sessions,
  });

  const tapped = (kind: TodayActionKind, workspaceId?: string) => track("home.today_tapped", { action: kind }, workspaceId);

  if (action.kind === "loading") {
    return (
      <div className={cn(shell, "bg-card p-5")} aria-busy="true">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (action.kind === "upload") {
    return (
      <section className={cn(shell, "bg-[linear-gradient(160deg,#ece6ff_0%,#f8f4ff_55%,#ffffff_100%)] px-5 pb-4 pt-6 sm:px-8 sm:pb-6 sm:pt-8")} aria-labelledby="today-title">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/10 blur-2xl" />
        <Mascot pose="wave" className="cat-wiggle mx-auto block h-[104px] sm:absolute sm:right-10 sm:top-8 sm:h-[132px]" priority />
        <div className="relative mt-3 text-center sm:mt-0 sm:max-w-[480px] sm:text-left">
          <h2 id="today-title" className="text-[26px] font-extrabold leading-[1.15] sm:text-[30px]">
            {t("today.uploadTitle")}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("today.uploadSub")}</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            tapped("upload");
            onUpload();
          }}
          className={cn(primaryBtn, "relative mt-5 h-14 text-[17px] sm:max-w-[340px]")}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" strokeWidth={2.5} />}
          {uploading ? t("today.uploading") : t("today.uploadCta")}
        </button>
        <Link
          href="/new-subject"
          className="relative mt-1 flex min-h-11 items-center justify-center text-[14px] font-bold text-accent-dim hover:underline sm:justify-start"
        >
          {t("today.uploadAlt")}
        </Link>
      </section>
    );
  }

  const wsTitle = (id: string) => workspaces.find((w) => w.id === id)?.title ?? "";
  let eyebrow: string;
  let Icon = Zap;
  let title: string;
  let sub: string;
  let cta: string;
  let onPrimary: () => void;
  let resumeExclude: string | null = null;

  if (action.kind === "mistakes") {
    Icon = RotateCcw;
    eyebrow = t("today.eyebrow");
    title = (action.count === 1 ? t("habit.fixTitleOne") : t("habit.fixTitle")).replace("{n}", String(action.count));
    sub = t("today.fixSub").replace("{m}", String(action.minutes));
    cta = t("today.fixCta");
    onPrimary = () => {
      tapped("mistakes");
      setBusy(true);
      router.push(practiceHref());
    };
  } else if (action.kind === "plan") {
    const task = openTasks.find((x) => x.id === action.taskId)!;
    Icon = CalendarCheck;
    eyebrow = t("today.planEyebrow");
    title = taskTitle(task, t);
    sub = fill(t("today.planSub"), { subject: task.subject, m: fmtDuration(task.minutes, t) });
    cta = t("today.planCta");
    resumeExclude = task.sessionId;
    onPrimary = () => {
      tapped("plan", task.workspaceId);
      void starter.start(task.id);
    };
  } else if (action.kind === "done") {
    const { workspaceId } = action;
    Icon = PartyPopper;
    eyebrow = t("today.streakSafe");
    title = t("today.doneTitle");
    sub = t("today.doneSub");
    cta = t("today.doneCta");
    onPrimary = () => startQuick5(workspaceId, null);
  } else {
    const { workspaceId, resumeSessionId } = action;
    eyebrow = t("today.eyebrow");
    title = resumeSessionId ? t("today.quick5Resume") : t("today.quick5Title").replace("{subject}", wsTitle(workspaceId));
    sub = t("today.quick5Sub");
    cta = t("today.quick5Cta");
    resumeExclude = resumeSessionId;
    onPrimary = () => startQuick5(workspaceId, resumeSessionId);
  }

  async function startQuick5(workspaceId: string, resumeSessionId: string | null) {
    tapped("quick5", workspaceId);
    if (resumeSessionId) {
      setBusy(true);
      router.push(`/workspace/${workspaceId}/session/${resumeSessionId}`);
      return;
    }
    setBusy(true);
    try {
      const ws = workspaces.find((w) => w.id === workspaceId);
      const created = await createStudySession({
        workspaceId,
        title: ws?.title || t("today.quick5Cta"),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        // No notes yet (a topic-only subject): the subject name is the topic.
        topics: ws && ws.materials.length === 0 ? ws.title : undefined,
      });
      router.push(created ? `/workspace/${workspaceId}/session/${created.id}` : `/workspace/${workspaceId}`);
    } catch (e) {
      toastError(e, t("today.startFailed"));
      setBusy(false);
    }
  }

  const pending = busy || !!starter.startingId;
  const resume = pickResumable(sessions, resumeExclude);

  const look = LOOK[action.kind];
  const minutes = action.kind === "mistakes" ? action.minutes : action.kind === "plan" ? openTasks.find((x) => x.id === action.taskId)?.minutes ?? 0 : 2;

  return (
    <section className={cn(shell, look.bg, "p-5 sm:p-7")} aria-labelledby="today-title">
      <span aria-hidden className="pointer-events-none absolute -right-14 -top-20 size-56 rounded-full bg-accent/10 blur-2xl" />
      <Mascot pose={look.pose} className="cat-peek pointer-events-none absolute right-3 top-4 h-[84px] sm:right-7 sm:top-6 sm:h-[112px]" priority />
      <div className="relative flex items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-sm", action.kind === "done" ? "bg-emerald-500" : "bg-accent")}>
          <Icon className="size-4" strokeWidth={2.5} />
        </span>
        <span className={cn("text-[13px] font-extrabold uppercase tracking-wide", action.kind === "done" ? "text-emerald-700" : "text-accent-dim")}>{eyebrow}</span>
      </div>
      <h2 id="today-title" className="relative mt-3 pr-[88px] text-[24px] font-extrabold leading-[1.15] sm:pr-36 sm:text-[28px]">
        {title}
      </h2>
      <p className="relative mt-1.5 pr-14 text-[14.5px] leading-snug text-muted-foreground sm:pr-36">{sub}</p>
      {action.kind !== "done" && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {minutes > 0 && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/80 px-2.5 text-[12.5px] font-bold text-foreground/80 shadow-[0_1px_2px_rgba(0,0,0,.05)]">
              <Clock className="size-3.5 text-accent" />
              {t("today.approxMin").replace("{m}", String(minutes))}
            </span>
          )}
          {!doneToday && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#fff1e6] px-2.5 text-[12.5px] font-bold text-[#c2410c]">
              <Flame className="size-3.5" fill="currentColor" strokeWidth={1.5} />
              {t("today.countsForStreak")}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => void onPrimary()}
        className={cn(primaryBtn, "relative mt-4 sm:max-w-[340px]", action.kind === "done" && "bg-emerald-600 shadow-[0_4px_0_0_#047857] hover:bg-emerald-700")}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
        {cta}
      </button>
      {resume && (
        <Link
          href={`/workspace/${resume.workspaceId}/session/${resume.id}`}
          onClick={() => tapped("continue", resume.workspaceId)}
          className="relative mt-1.5 flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-accent-dim hover:underline"
        >
          <span className="min-w-0 truncate">{t("today.orContinue").replace("{title}", resume.title)}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
      )}
    </section>
  );
}
