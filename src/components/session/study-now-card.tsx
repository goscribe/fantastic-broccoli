"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import "@/lib/i18n/session";
import { ACTIVITY_TYPE_LABELS } from "@/components/session/activity-item";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudySession } from "@/types";
import {
  ArrowRight,
  Loader2,
  Play,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";

/** Which single session the learner should be pointed at right now. */
export function pickStudyNowSession(
  sessions: StudySession[],
): StudySession | undefined {
  const active = sessions.filter(
    (s) => s.status === "active" || s.status === "paused",
  );
  const ready = active.filter((s) => !s.generating && s.activities.length > 0);
  return (
    ready.find((s) => s.progress > 0) ??
    ready[0] ??
    active.find((s) => s.generating)
  );
}

interface StudyNowCardProps {
  sessions: StudySession[];
  hasMaterials: boolean;
  /** Materials still analyzing (uploading is done, content not yet usable). */
  analyzing?: boolean;
  onOpenSession: (sessionId: string) => void;
  /** One-click Quick 5 from the uploaded material (no wizard). */
  onStartQuick5: () => void;
  onUpload: () => void;
  starting?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * The one dominant "what do I do next" card for a workspace: a ready session
 * opens straight into its first question; while a plan is generating it says
 * so; with material but no session it starts a Quick 5; with nothing it
 * points at upload. Studying is always the default next click.
 */
export function StudyNowCard({
  sessions,
  hasMaterials,
  analyzing = false,
  onOpenSession,
  onStartQuick5,
  onUpload,
  starting = false,
  compact = false,
  className,
}: StudyNowCardProps) {
  const { t } = useI18n();
  const session = pickStudyNowSession(sessions);

  const shell = cn(
    "group relative w-full overflow-hidden rounded-2xl border text-left transition-all animate-fade-up sm:rounded-3xl",
    compact ? "p-4" : "p-5 sm:p-7",
    className,
  );

  if (session?.generating) {
    return (
      <div className={cn(shell, "border-accent/30 bg-accent-soft/50")}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {session.quickStart
            ? t("ws.studyNow.buildingQuick5")
            : t("ws.studyNow.building")}
        </p>
        <h2 className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">
          {session.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ws.studyNow.buildingHint")}
        </p>
        <Button
          size={compact ? "sm" : "md"}
          variant="outline"
          className="mt-4"
          onClick={() => onOpenSession(session.id)}
        >
          {t("ws.studyNow.warmUp")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (session) {
    const started = session.progress > 0;
    const next =
      session.activities.find((a) => a.status === "in_progress") ??
      session.activities.find((a) => a.status === "pending") ??
      session.activities[0];
    const remaining = session.activities.filter(
      (a) => a.status === "pending" || a.status === "in_progress",
    ).length;
    return (
      <button
        type="button"
        onClick={() => onOpenSession(session.id)}
        className={cn(
          shell,
          "border-border bg-card hover:border-accent hover:shadow-md",
        )}
      >
        {!compact && (
          <div
            className="pointer-events-none absolute inset-y-0 right-28 hidden w-40 select-none sm:block"
            aria-hidden
          >
            <Image
              src="/illustrations/flag.png"
              alt=""
              width={200}
              height={200}
              unoptimized
              className="absolute -bottom-4 right-0 w-32"
            />
            <ConfettiDots />
          </div>
        )}
        <div className="relative">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            {session.quickStart ? (
              <>
                <Zap className="h-3.5 w-3.5" />
                {t("ws.studyNow.quick5")}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {started ? t("ws.studyNow.pickUp") : t("ws.studyNow.ready")}
              </>
            )}
          </p>
          <h2 className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">
            {session.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {next && (
              <>
                {t(ACTIVITY_TYPE_LABELS[next.type] ?? "session.typeActivity")}
                {" · "}
              </>
            )}
            {started
              ? t("ws.studyNow.remaining").replace(
                  "{count}",
                  String(remaining),
                )
              : session.quickStart
                ? t("ws.studyNow.quick5Hint")
                : t("ws.studyNow.readyHint").replace(
                    "{minutes}",
                    String(session.durationMinutes),
                  )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-accent font-semibold text-accent-foreground transition-all group-hover:gap-3",
                compact ? "px-4 py-2 text-sm" : "px-6 py-3 text-base",
              )}
            >
              <Play className="h-4 w-4 fill-current" />
              {started ? t("ws.studyNow.continue") : t("ws.studyNow.cta")}
            </span>
            {started && (
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {session.progress}% {t("ws.complete")}
              </span>
            )}
          </div>
          {started && (
            <ProgressBar
              value={session.progress}
              className="mt-3.5 sm:max-w-md"
            />
          )}
        </div>
      </button>
    );
  }

  if (hasMaterials) {
    return (
      <div className={cn(shell, "border-accent/30 bg-accent-soft/50")}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          <Zap className="h-3.5 w-3.5" />
          {t("ws.studyNow.quick5")}
        </p>
        <h2 className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">
          {t("ws.studyNow.fromNotesTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {analyzing
            ? t("ws.studyNow.fromNotesAnalyzing")
            : t("ws.studyNow.fromNotesHint")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size={compact ? "sm" : "lg"}
            disabled={starting}
            onClick={onStartQuick5}
          >
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4 fill-current" />
            )}
            {t("ws.studyNow.startQuick5")}
          </Button>
          <Button
            size={compact ? "sm" : "lg"}
            variant="ghost"
            onClick={onUpload}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {t("ws.studyNow.addMore")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(shell, "border-dashed border-border-strong bg-card")}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
        <Upload className="h-3.5 w-3.5" />
        {t("ws.studyNow.step1")}
      </p>
      <h2 className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">
        {t("ws.studyNow.emptyTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("ws.studyNow.emptyHint")}
      </p>
      <Button size={compact ? "sm" : "lg"} className="mt-4" onClick={onUpload}>
        <Upload className="mr-2 h-4 w-4" />
        {t("ws.studyNow.uploadCta")}
      </Button>
    </div>
  );
}
