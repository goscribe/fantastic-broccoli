"use client";

import "@/lib/i18n/exam-planner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, FileText, Loader2, MoreHorizontal, PenLine, Play, RotateCcw, Zap } from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import { addDays, movePlanTask, setPlanTaskStatus, startPlanTask, type PlanTask, type PlanTaskKind } from "@/lib/api/exam-planner";
import { dayLabel, fill, fmtDuration, taskTitle } from "@/lib/exam-planner-view";
import { useI18n } from "@/lib/i18n";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const KIND_ICON: Record<PlanTaskKind, typeof BookOpen> = {
  learn: BookOpen,
  practice: PenLine,
  review: RotateCcw,
  quick5: Zap,
  mock: FileText,
};

/** Every planner query; refreshed after any change. */
export const PLAN_KEY = ["exam-plan"] as const;

/** Opens a task's session in one tap (the server creates it on first tap). */
export function useStartTask() {
  const router = useRouter();
  const { t } = useI18n();
  const [startingId, setStartingId] = useState<string | null>(null);
  const start = async (id: string) => {
    setStartingId(id);
    try {
      const { path } = await startPlanTask(id);
      router.push(path);
    } catch (err) {
      toastError(err, t("ep.err.start"));
      setStartingId(null);
    }
  };
  return { start, startingId };
}

/** One plan item: tick it off, start it, or move it. `size="row"` is the compact week/month row. */
export function PlanTaskCard({
  task,
  today,
  primary = false,
  size = "card",
  startingId,
  onStart,
}: {
  task: PlanTask;
  today: string;
  primary?: boolean;
  size?: "card" | "row";
  startingId: string | null;
  onStart: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = accentForId(task.workspaceId);
  const Icon = KIND_ICON[task.kind] ?? BookOpen;
  const done = task.status === "done";
  const inactive = done || task.status === "skipped" || task.status === "missed";
  const past = task.date < today;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const refresh = () => qc.invalidateQueries({ queryKey: PLAN_KEY });
  const act = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setMenu(false);
    try {
      await fn();
      if (success) toast.success(success);
      await refresh();
    } catch (err) {
      toastError(err, t("ep.err.save"));
    } finally {
      setBusy(false);
    }
  };

  const meta = [task.subject, t(`ep.kind.${task.kind}`), fmtDuration(task.minutes, t)].join(" · ");
  const status =
    task.status === "skipped" ? t("ep.task.skipped") : task.status === "missed" ? t("ep.task.missed") : null;
  const starting = startingId === task.id;

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center gap-3 border-border bg-card",
        size === "card" ? "rounded-2xl border p-3 sm:p-3.5" : "rounded-xl border px-2.5 py-2",
        inactive && "bg-muted/40",
      )}
    >
      <button
        type="button"
        aria-label={done ? t("ep.task.markUndone") : t("ep.task.markDone")}
        title={done ? t("ep.task.markUndone") : t("ep.task.markDone")}
        disabled={busy || past}
        onClick={() => void act(() => setPlanTaskStatus(task.id, done ? "planned" : "done"))}
        className={cn(
          "grid shrink-0 place-items-center rounded-full border-2 transition-colors disabled:cursor-default",
          size === "card" ? "size-7" : "size-6",
          done ? "border-accent bg-accent text-white" : "border-border-strong text-transparent hover:border-accent hover:text-accent/50",
        )}
      >
        <Check className={size === "card" ? "size-4" : "size-3.5"} strokeWidth={3} />
      </button>
      <span
        className={cn("hidden shrink-0 place-items-center rounded-xl sm:grid", size === "card" ? "size-10" : "size-8")}
        style={{ background: `${color}1a`, color }}
        aria-hidden
      >
        <Icon className={size === "card" ? "size-[18px]" : "size-4"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("line-clamp-2 break-words font-semibold leading-snug", size === "card" ? "text-[15px]" : "text-[13.5px]", inactive && "text-muted-foreground", done && "line-through decoration-1")}>
          {taskTitle(task, t)}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-faint">
          <span className="min-w-0">{meta}</span>
          {task.movedFrom && !inactive && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-px text-[11px] font-semibold text-accent-dim">
              {fill(t("ep.task.movedFrom"), { day: dayLabel(task.movedFrom, locale, { weekday: "short" }) })}
            </span>
          )}
          {status && <span className="shrink-0 font-semibold">{status}</span>}
        </div>
      </div>
      {!inactive && !past && (
        <button
          type="button"
          disabled={!!startingId}
          onClick={() => onStart(task.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-60",
            size === "card" ? "h-10 px-3 text-[14px] sm:px-3.5" : "h-8 px-2.5 text-[12.5px]",
            primary ? "bg-accent text-white hover:bg-accent-dim" : "bg-accent-soft text-accent-dim hover:brightness-95",
          )}
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5" fill="currentColor" />}
          <span className={size === "row" ? "sr-only sm:not-sr-only" : undefined}>
            {starting ? t("ep.task.opening") : task.sessionId ? t("ep.task.continue") : t("ep.task.start")}
          </span>
        </button>
      )}
      {!done && !past && (
        <button
          type="button"
          aria-label={t("ep.task.more")}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className={cn("grid shrink-0 place-items-center rounded-lg text-faint hover:bg-muted", size === "card" ? "size-9" : "size-8")}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </button>
      )}
      {menu && (
        <div className="absolute right-2 top-full z-20 mt-1 w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.3)]">
          <div className="px-2 pb-1 pt-1.5 text-[11.5px] font-semibold text-faint">{t("ep.task.moveTo")}</div>
          <div className="grid grid-cols-2 gap-1">
            {Array.from({ length: 6 }, (_, i) => addDays(task.date < today ? today : task.date, i + 1)).map((d) => {
              const label = dayLabel(d, locale, { weekday: "short", day: "numeric" });
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => void act(() => movePlanTask(task.id, d), fill(t("ep.toast.moved"), { day: label }))}
                  className="h-8 rounded-lg px-2 text-left text-[13px] hover:bg-muted"
                >
                  {label}
                </button>
              );
            })}
          </div>
          {task.date === today && (
            <button
              type="button"
              onClick={() => void act(() => setPlanTaskStatus(task.id, "skipped"))}
              className="mt-1 h-8 w-full rounded-lg border-t border-border px-2 text-left text-[13px] text-muted-foreground hover:bg-muted"
            >
              {t("ep.task.skip")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
