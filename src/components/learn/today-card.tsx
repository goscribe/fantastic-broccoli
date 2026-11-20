"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/mistakes";
import "@/lib/i18n/exam-planner";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Loader2, Play, RotateCcw, Upload, Zap } from "lucide-react";
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
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70";

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
}: {
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
    workspaces: workspaces.map((w) => ({ id: w.id, materialCount: w.materials.length })),
    sessions,
  });

  const tapped = (kind: TodayActionKind, workspaceId?: string) => track("home.today_tapped", { action: kind }, workspaceId);

  if (action.kind === "loading") {
    return (
      <div className="rounded-2xl border border-border p-5" aria-busy="true">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (action.kind === "upload") {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 pb-4 pt-6 sm:px-8 sm:pb-6 sm:pt-8" aria-labelledby="today-title">
        <Image src="/design/cat2-book.png" alt="" width={96} height={96} unoptimized className="cat-peek mx-auto h-[88px] w-auto sm:absolute sm:right-8 sm:top-6 sm:h-[112px]" />
        <div className="mt-3 text-center sm:mt-0 sm:max-w-[460px] sm:text-left">
          <h2 id="today-title" className="text-[22px] font-bold leading-tight sm:text-[26px]">
            {t("today.uploadTitle")}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{t("today.uploadSub")}</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            tapped("upload");
            onUpload();
          }}
          className={cn(primaryBtn, "mt-5 h-14 text-[16px] sm:max-w-[320px]")}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          {uploading ? t("today.uploading") : t("today.uploadCta")}
        </button>
        <Link
          href="/new-subject"
          className="mt-1 flex min-h-11 items-center justify-center text-[13.5px] font-semibold text-accent-dim hover:underline sm:justify-start"
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
  } else {
    const { workspaceId, resumeSessionId } = action;
    eyebrow = t("today.eyebrow");
    title = resumeSessionId ? t("today.quick5Resume") : t("today.quick5Title").replace("{subject}", wsTitle(workspaceId));
    sub = t("today.quick5Sub");
    cta = t("today.quick5Cta");
    resumeExclude = resumeSessionId;
    onPrimary = async () => {
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
    };
  }

  const pending = busy || !!starter.startingId;
  const resume = pickResumable(sessions, resumeExclude);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="today-title">
      <Image src="/design/cat2-book.png" alt="" width={72} height={72} unoptimized className="cat-peek pointer-events-none absolute right-3 top-3 h-14 w-auto sm:right-5 sm:top-5 sm:h-[72px]" />
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-[18px]" />
        </span>
        <span className="text-[13px] font-bold text-accent">{eyebrow}</span>
      </div>
      <h2 id="today-title" className="mt-3 pr-16 text-[20px] font-extrabold leading-tight sm:text-[22px]">
        {title}
      </h2>
      <p className="mt-1 pr-12 text-[14px] leading-snug text-muted-foreground">{sub}</p>
      <button type="button" disabled={pending} onClick={() => void onPrimary()} className={cn(primaryBtn, "mt-4 sm:max-w-[320px]")}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
        {cta}
      </button>
      {resume && (
        <Link
          href={`/workspace/${resume.workspaceId}/session/${resume.id}`}
          onClick={() => tapped("continue", resume.workspaceId)}
          className="mt-1 flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-accent-dim hover:underline"
        >
          <span className="min-w-0 truncate">{t("today.orContinue").replace("{title}", resume.title)}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
      )}
    </section>
  );
}
