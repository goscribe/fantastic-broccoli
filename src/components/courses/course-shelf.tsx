"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SubjectTile } from "@/components/learn/subject-tile";
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

/** A course the learner is on, as a tile in its subject's colour: topics done on the card, one tap to carry on. */
export function CourseProgressRow({ c }: { c: CourseSubject }) {
  const { t } = useI18n();
  const pct = masteryPercent(c.progress.mastery);
  const started = c.progress.topicsDone > 0 || c.progress.topicsPractised > 0;
  return (
    <SubjectTile
      href={`/courses/${c.workspaceId}`}
      match={c.courseTitle}
      stored={c.subjectFamily}
      title={
        <>
          {c.courseTitle}
          {c.level ? <span className="font-bold opacity-90"> · {c.level}</span> : null}
        </>
      }
      sub={
        started
          ? `${t("course.progressLine").replace("{done}", String(c.progress.topicsDone)).replace("{total}", String(c.progress.topicsTotal))}${
              pct !== null ? ` · ${t("course.masteryLine").replace("{pct}", String(pct))}` : ""
            }`
          : t("course.notStarted")
      }
      progress={c.progress.topicsTotal > 0 ? c.progress.topicsDone / c.progress.topicsTotal : null}
      action={started ? t("course.continue") : t("course.open")}
    />
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
        <span className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">{t("course.homeEmpty")}</span>
        <span className="shrink-0 text-[13px] font-semibold text-accent">{t("course.browse")}</span>
      </Link>
    );
  }
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[20px] font-extrabold">{t("course.yourCourses")}</h2>
        <Link href="/courses" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
          {t("course.addCourse")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3">
        {mine.slice(0, 4).map((c) => (
          <CourseProgressRow key={c.workspaceId} c={c} />
        ))}
      </div>
    </section>
  );
}
