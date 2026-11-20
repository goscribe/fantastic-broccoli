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
  "btn-chunky rounded-[var(--r-button)] inline-flex h-[52px] w-full items-center justify-center gap-2 bg-accent px-5 text-[16px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70";

/** The cat's pose follows what today asks for; the card itself stays white. */
const POSE: Record<"mistakes" | "plan" | "quick5" | "done", MascotPose> = {
  mistakes: "think",
  plan: "pencil",
  quick5: "book",
  done: "trophy",
};
/** The hero's card: white, hairline, the illustrated scene inside it. */
const shell = "life-rise relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border bg-white";

/**
 * The hero's illustrated scene. The cat is NOT part of this image: it is the
 * <Mascot> placed over it (see HeroScene), so a redesigned mascot swaps in
 * without touching the background.
 */
const HERO_SCENE = { src: "/design/hero/scene.webp", width: 1440, height: 960 };

/**
 * Scene + mascot. Phones: a strip across the top that fades into the white
 * card, text below. From sm up: full-bleed behind the text, which sits on the
 * scene's pale left half (a white wash keeps it readable).
 */
function HeroScene({ pose, motion }: { pose: MascotPose; motion: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[168px] sm:inset-0 sm:h-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_SCENE.src}
        alt=""
        width={HERO_SCENE.width}
        height={HERO_SCENE.height}
        fetchPriority="high"
        decoding="async"
        className="size-full select-none object-cover object-[82%_46%] sm:object-[100%_62%]"
      />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent sm:hidden" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.6)_38%,rgba(255,255,255,0)_66%)] sm:block" />
      <Mascot
        pose={pose}
        className={cn(motion, "absolute bottom-[14px] right-[17%] h-[104px] sm:bottom-[12%] sm:right-[11%] sm:h-[176px] lg:right-[13%]")}
        priority
      />
    </div>
  );
}

/** The greeting, in the hero. It is the page's h1 on home. */
function Greeting({ greeting, sub }: { greeting?: string; sub?: string }) {
  if (!greeting) return null;
  return (
    <div className="relative sm:max-w-[60%]">
      <h1 className="text-balance text-[28px] font-extrabold leading-[1.1] sm:text-[36px]">{greeting}</h1>
      {sub && <p className="mt-1 text-[15.5px] font-semibold text-foreground/70 sm:text-[16.5px]">{sub}</p>}
    </div>
  );
}

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
  greeting,
  greetingSub,
}: {
  /** "Good evening, Maya": the hero carries the page's greeting. */
  greeting?: string;
  greetingSub?: string;
  /** Today already counts for the streak (daily goal met). */
  doneToday?: boolean;
  workspaces: Workspace[];
  sessions: StudySession[];
  loading: boolean;
  uploading: boolean;
  onUpload: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date());
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
      <div className={cn(shell, "px-5 pb-6 pt-[176px] sm:p-9")} aria-busy="true">
        <HeroScene pose="wave" motion="cat-bob" />
        <Greeting greeting={greeting} sub={greetingSub} />
        <Skeleton className="mt-6 h-3.5 w-16" />
        <Skeleton className="mt-3 h-6 w-3/4 sm:max-w-[320px]" />
        <Skeleton className="mt-2 h-4 w-1/2 sm:max-w-[220px]" />
        <Skeleton className="mt-5 h-14 w-full rounded-[var(--r-button)] sm:max-w-[340px]" />
      </div>
    );
  }

  if (action.kind === "upload") {
    return (
      <section className={cn(shell, "px-5 pb-4 pt-[176px] sm:px-9 sm:pb-8 sm:pt-9")} aria-labelledby="today-title">
        <HeroScene pose="wave" motion="cat-wiggle" />
        <Greeting greeting={greeting} sub={greetingSub} />
        <div className={cn("relative sm:max-w-[460px]", greeting && "mt-5 sm:mt-7")}>
          <h2 id="today-title" className="text-balance text-[24px] font-extrabold leading-[1.15] sm:text-[28px]">
            {t("today.uploadTitle")}
          </h2>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-foreground/75">{t("today.uploadSub")}</p>
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
          className="relative mt-2.5 flex min-h-11 items-center justify-center text-[14px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground sm:justify-start"
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
    <section className={cn(shell, "px-5 pb-6 pt-[176px] sm:p-9", resume && "pb-3 sm:pb-5")} aria-labelledby="today-title">
      <HeroScene pose={pose} motion="cat-peek" />
      <Greeting greeting={greeting} sub={greetingSub} />
      {/* One thing to do today: what it is, how long, one button. */}
      <p className={cn("relative flex items-center gap-1.5 text-[13.5px] font-extrabold text-foreground", greeting && "mt-5 sm:mt-8")}>
        <Icon className="size-4 shrink-0 text-accent" strokeWidth={2.5} />
        <span>{eyebrow}</span>
        {action.kind !== "done" && <span className="whitespace-nowrap font-bold text-foreground/60">· {dateLabel}</span>}
      </p>
      <h2 id="today-title" className="relative mt-1.5 text-[24px] font-extrabold leading-[1.15] sm:max-w-[440px] sm:text-[28px]">
        {title}
      </h2>
      <p className="relative mt-1 text-[15.5px] leading-snug text-foreground/75 sm:max-w-[420px]">
        {sub}
        {action.kind !== "done" && !doneToday && (
          <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-foreground/80">
            <Flame className="size-4 text-[var(--flame)]" fill="currentColor" strokeWidth={1.5} />
            {t("today.countsForStreak")}
          </span>
        )}
      </p>
      <button type="button" disabled={pending} onClick={() => void onPrimary()} className={cn(primaryBtn, "relative mt-4 h-14 text-[17px] sm:max-w-[340px]")}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
        {cta}
      </button>
      {resume && (
        <Link
          href={`/workspace/${resume.workspaceId}/session/${resume.id}`}
          onClick={() => tapped("continue", resume.workspaceId)}
          className="relative mt-2.5 flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-bold text-foreground hover:underline sm:justify-start"
        >
          <span className="min-w-0 truncate">{t("today.orContinue").replace("{title}", resume.title)}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
      )}
    </section>
  );
}
