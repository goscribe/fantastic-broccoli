"use client";

import "@/lib/i18n/exam-planner";
import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { Loader2, Play } from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import { fill, fmtDuration, taskTitle } from "@/lib/exam-planner-view";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PLAN_KEY, useStartTask } from "@/components/planner/plan-task";

/** Home: today's exam-plan tasks (one tap each) and the nearest exam's countdown; `fallback` when there's no exam plan. */
export function PlanTodayCard({ fallback }: { fallback: ReactNode }) {
  const { t } = useI18n();
  const { data, isError } = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday });
  const starter = useStartTask();
  const next = data?.exams.find((e) => e.daysLeft > 0);
  if (isError || (data && !next)) return <>{fallback}</>;
  if (!data) return <div className="h-[132px] animate-pulse rounded-2xl bg-muted" />;
  const open = data.tasks.filter((x) => x.status === "planned");
  return (
    <div className="rail-box rounded-2xl border border-border p-[18px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-semibold">{t("ep.home.title")}</span>
        <Link href="/planner" className="shrink-0 text-caption font-semibold text-accent hover:underline">{t("ep.home.open")}</Link>
      </div>
      {next && (
        <div className="mt-0.5 truncate text-caption text-faint">
          {next.daysLeft === 1 ? fill(t("ep.home.countdownTomorrow"), { exam: next.title }) : fill(t("ep.home.countdown"), { exam: next.title, n: next.daysLeft })}
        </div>
      )}
      <div className="mt-2 flex flex-col gap-0.5">
        {data.tasks.length === 0 ? (
          <p className="text-small text-faint">{t("ep.today.rest")}</p>
        ) : open.length === 0 ? (
          <p className="text-small text-faint">{t("ep.today.allDone")}</p>
        ) : (
          open.map((task, i) => (
            <button
              key={task.id}
              type="button"
              disabled={!!starter.startingId}
              onClick={() => void starter.start(task.id)}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-muted disabled:opacity-70"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: accentForId(task.workspaceId) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold">{taskTitle(task, t)}</span>
                <span className="block truncate text-caption text-faint">
                  {t(`ep.kind.${task.kind}`)} · {fmtDuration(task.minutes, t)}
                </span>
              </span>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", i === 0 ? "bg-accent text-white" : "bg-accent-soft text-accent-dim")}>
                {starter.startingId === task.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5" fill="currentColor" />}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
