"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, GraduationCap, Plus } from "lucide-react";
import { coursesApi, type CourseSubject } from "@/lib/api/courses";
import { masteryPercent } from "@/lib/courses";
import { onTreeChanged } from "@/lib/tree-events";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";

/** Thin topics-done bar. */
export function ProgressLine({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CourseProgressRow({ c }: { c: CourseSubject }) {
  const { t } = useI18n();
  const pct = masteryPercent(c.progress.mastery);
  const started = c.progress.topicsDone > 0 || c.progress.topicsPractised > 0;
  return (
    <Link
      href={`/courses/${c.workspaceId}`}
      className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-border-strong"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">
          {c.courseTitle}
          {c.level ? <span className="font-medium text-faint"> · {c.level}</span> : null}
        </span>
        <span className="block text-[12.5px] text-muted-foreground">
          {started
            ? `${t("course.progressLine").replace("{done}", String(c.progress.topicsDone)).replace("{total}", String(c.progress.topicsTotal))}${
                pct !== null ? ` · ${t("course.masteryLine").replace("{pct}", String(pct))}` : ""
              }`
            : t("course.notStarted")}
        </span>
        <ProgressLine done={c.progress.topicsDone} total={c.progress.topicsTotal} className="mt-2" />
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

/**
 * Home: the learner's courses with topics done and mastery, or one calm
 * line into the course picker for those who have none.
 */
export function CourseShelf() {
  const { t } = useI18n();
  const [mine, setMine] = useState<CourseSubject[] | null>(null);

  useEffect(() => {
    const load = () =>
      coursesApi
        .mine()
        .then(setMine)
        .catch(() => setMine([]));
    void load();
    return onTreeChanged(() => void load());
  }, []);

  if (mine === null) return null;
  if (mine.length === 0) {
    return (
      <Link
        href="/courses"
        className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-border-strong"
      >
        <GraduationCap className="size-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">{t("course.homeEmpty")}</span>
        <span className="shrink-0 text-[13px] font-semibold text-accent">{t("course.browse")}</span>
      </Link>
    );
  }
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">{t("course.yourCourses")}</h2>
        <Link href="/courses" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
          <Plus className="size-3.5" />
          {t("course.addCourse")}
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {mine.slice(0, 4).map((c) => (
          <CourseProgressRow key={c.workspaceId} c={c} />
        ))}
      </div>
    </section>
  );
}
