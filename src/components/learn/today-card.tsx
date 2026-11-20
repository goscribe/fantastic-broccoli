"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/mistakes";
import "@/lib/i18n/exam-planner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Check, Flame, Loader2, Play, RotateCcw, Upload, Zap } from "lucide-react";
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
  "btn-chunky inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-[16px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70";

/** The cat's pose follows what today asks for; the card itself stays white. */
const POSE: Record<"mistakes" | "plan" | "quick5" | "done", MascotPose> = {
  mistakes: "think",
  plan: "pencil",
  quick5: "book",
  done: "trophy",
};
/** Home's one flat lavender panel; the cat stands on a white disc inside it. */
const shell = "life-panel life-rise relative overflow-hidden";
const disc = "pointer-events-none absolute rounded-full bg-white/70";

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
      <div className={cn(shell, "p-6")} aria-busy="true">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (action.kind === "upload") {
    return (
      <section className={cn(shell, "px-6 pb-4 pt-8 sm:px-10 sm:pb-8 sm:pt-10")} aria-labelledby="today-title">
        <span aria-hidden className={cn(disc, "left-1/2 top-6 size-[148px] -translate-x-1/2 sm:left-auto sm:right-10 sm:top-9 sm:size-[184px] sm:translate-x-0")} />
        <Mascot pose="wave" className="cat-wiggle relative mx-auto block h-[136px] sm:absolute sm:right-[52px] sm:top-11 sm:h-[168px]" priority />
        <div className="relative mt-5 text-center sm:mt-0 sm:max-w-[460px] sm:text-left">
          <h2 id="today-title" className="text-balance text-[28px] font-extrabold leading-[1.12] sm:text-[34px]">
            {t("today.uploadTitle")}
          </h2>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-foreground/70">{t("today.uploadSub")}</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            tapped("upload");
            onUpload();
          }}
          className={cn(primaryBtn, "relative mt-6 h-14 text-[17px] sm:max-w-[340px]")}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" strokeWidth={2.5} />}
          {uploading ? t("today.uploading") : t("today.uploadCta")}
        </button>
        <Link
          href="/new-subject"
          className="relative mt-2.5 flex min-h-11 items-center justify-center text-[14px] font-bold text-accent-dim hover:underline sm:justify-start"
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
    Icon = Check;
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

  const pose = POSE[action.kind];

  return (
    <section className={cn(shell, "p-6 sm:p-9", resume && "pb-3 sm:pb-5")} aria-labelledby="today-title">
      <span aria-hidden className={cn(disc, "-right-6 -top-8 size-[160px] sm:right-8 sm:top-8 sm:size-[200px]")} />
      <Mascot pose={pose} className={cn("cat-peek pointer-events-none absolute top-4 h-[112px] sm:top-12 sm:h-[168px]", pose === "trophy" ? "right-2 sm:right-12" : "right-3 sm:right-[60px]")} priority />
      <div className="relative flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white">
          <Icon className="size-4" strokeWidth={2.5} />
        </span>
        <span className="text-[13px] font-extrabold uppercase tracking-wide text-accent-dim">{eyebrow}</span>
      </div>
      <h2 id="today-title" className="relative mt-4 pr-[104px] text-[28px] font-extrabold leading-[1.1] sm:max-w-[480px] sm:pr-0 sm:text-[36px]">
        {title}
      </h2>
      <p className="relative mt-2 pr-[96px] text-[15.5px] leading-snug text-foreground/70 sm:max-w-[440px] sm:pr-0 sm:text-[16px]">{sub}</p>
      {action.kind !== "done" && !doneToday && (
        <div className="relative mt-3.5 flex">
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/80 px-2.5 text-[12.5px] font-bold text-foreground/80">
            <Flame className="size-3.5 text-[var(--flame)]" fill="currentColor" strokeWidth={1.5} />
            {t("today.countsForStreak")}
          </span>
        </div>
      )}
      <button type="button" disabled={pending} onClick={() => void onPrimary()} className={cn(primaryBtn, "relative mt-5 h-14 text-[17px] sm:max-w-[340px]")}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
        {cta}
      </button>
      {resume && (
        <Link
          href={`/workspace/${resume.workspaceId}/session/${resume.id}`}
          onClick={() => tapped("continue", resume.workspaceId)}
          className="relative mt-2.5 flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-bold text-accent-dim hover:underline sm:justify-start"
        >
          <span className="min-w-0 truncate">{t("today.orContinue").replace("{title}", resume.title)}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
      )}
    </section>
  );
}
