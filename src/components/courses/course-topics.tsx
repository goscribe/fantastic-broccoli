"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { coursesApi, type Course, type CourseLevel, type CourseProgress, type TopicProgress } from "@/lib/api/courses";
import { masteryPercent, nextTopic, topicTitle, unitProgress, unitTitle, unitsForLevel } from "@/lib/courses";
import { loadCourse, TopicRow } from "@/components/courses/course-picker";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { notesApi } from "@/lib/api/notes";
import { noteHref } from "@/lib/notes";
import { ProgressLine } from "@/components/courses/course-shelf";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";

/**
 * A course subject's topics with what is done and mastery per topic, the
 * next topic to start, and a Quick 5 from any topic. Renders nothing for a
 * subject that wasn't started from a course.
 */
export function CourseTopics({ workspaceId, showTitle = false }: { workspaceId: string; showTitle?: boolean }) {
  const { t } = useI18n();
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [missing, setMissing] = useState(false);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [withNotes, setWithNotes] = useState<Set<string>>(new Set());
  const { start, busyTopicId } = useStartCourseTopic();

  useEffect(() => {
    let cancelled = false;
    coursesApi
      .progress(workspaceId)
      .then(async (p) => {
        const c = await loadCourse(p.courseId);
        if (cancelled) return;
        setProgress(p);
        setCourse(c);
        // Scribe notes are optional: a failure just hides the links.
        notesApi
          .listForCourse(p.courseId)
          .then((rows) => !cancelled && setWithNotes(new Set(rows.map((r) => r.topicId))))
          .catch(() => {});
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const byTopic = useMemo(() => new Map<string, TopicProgress>((progress?.topics ?? []).map((p) => [p.topicId, p])), [progress]);
  const units = useMemo(() => (course ? unitsForLevel(course, progress?.level) : []), [course, progress?.level]);
  const next = useMemo(() => nextTopic(units, byTopic), [units, byTopic]);
  const level = (progress?.level ?? undefined) as CourseLevel | undefined;

  // Until the learner opens one, show the unit holding the next topic.
  const shownUnit = openUnit ?? next?.unit.id ?? null;

  if (missing) return null;
  if (!progress || !course) return <div className="h-[140px] animate-pulse rounded-2xl bg-muted" aria-busy="true" />;

  const pct = masteryPercent(progress.mastery);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          {showTitle ? (
            <h1 className="text-[20px] font-bold leading-tight sm:text-[22px]">
              {course.title}
              {level ? <span className="font-semibold text-faint"> · {level}</span> : null}
            </h1>
          ) : (
            <h2 className="text-[16px] font-semibold">{t("course.topicsHeading")}</h2>
          )}
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("course.progressLine").replace("{done}", String(progress.topicsDone)).replace("{total}", String(progress.topicsTotal))}
            {pct !== null ? ` · ${t("course.masteryLine").replace("{pct}", String(pct))}` : ""}
          </p>
        </div>
      </div>
      <ProgressLine done={progress.topicsDone} total={progress.topicsTotal} className="mt-3" />

      {next ? (
        <button
          type="button"
          onClick={() => void start(course, next.topic, level)}
          disabled={!!busyTopicId}
          className="mt-4 flex w-full items-center gap-3 rounded-xl bg-accent-soft/60 px-3.5 py-3 text-left transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-accent">{t("course.continue")}</span>
            <span className="block truncate text-[14.5px] font-semibold">{topicTitle(next.topic)}</span>
          </span>
          {busyTopicId === next.topic.id ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
          ) : (
            <ArrowRight className="size-4 shrink-0 text-accent" />
          )}
        </button>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">{t("course.allDone")}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {units.map((u) => {
          const open = shownUnit === u.id;
          const up = unitProgress(u, byTopic);
          return (
            <div key={u.id}>
              <button
                type="button"
                onClick={() => setOpenUnit(open ? "" : u.id)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{unitTitle(course, u)}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-faint">
                  {up.done}/{up.total}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {u.topics.map((topic) => (
                    <li key={topic.id}>
                      <TopicRow
                        topic={topic}
                        progress={byTopic.get(topic.id)}
                        open={openTopic === topic.id}
                        onToggle={() => setOpenTopic((v) => (v === topic.id ? null : topic.id))}
                        onStart={() => void start(course, topic, level)}
                        busy={busyTopicId === topic.id}
                        disabled={!!busyTopicId}
                        notesHref={withNotes.has(topic.id) ? noteHref(course.id, topic.id) : undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11.5px] leading-snug text-faint">
          {t("course.sourceNote")}
          {course.numberingNote ? ` ${course.numberingNote}` : ""}
        </p>
    </section>
  );
}
