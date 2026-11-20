"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { notesApi, type LearnerNote } from "@/lib/api/notes";
import type { Course, CatalogTopic, CourseLevel } from "@/lib/api/courses";
import { loadCourse } from "@/components/courses/course-picker";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { NoteBody } from "@/components/notes/note-body";
import { NoteToc } from "@/components/notes/note-toc";
import { noteLabelKey } from "@/lib/notes";
import { unitTitle } from "@/lib/courses";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/notes";

/**
 * Scribe's own notes for one catalog topic, for signed-in learners (public
 * pages stay off in the pilot). Both buttons start a session on the topic
 * with the note as its material.
 */
export default function TopicNotePage() {
  const { t } = useI18n();
  const { courseId, topicId } = useParams<{ courseId: string; topicId: string }>();
  const [note, setNote] = useState<LearnerNote | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.all([notesApi.get(courseId, topicId), loadCourse(courseId).catch(() => null)])
      .then(([n, c]) => {
        if (cancelled) return;
        setNote(n);
        setCourse(c);
        setState(n ? "ready" : "missing");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [courseId, topicId]);

  const unit = course?.units.find((u) => u.topics.some((x) => x.id === topicId));
  const topic = unit?.topics.find((x) => x.id === topicId);

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[720px] lg:grid lg:max-w-[1000px] lg:grid-cols-[minmax(0,720px)_220px] lg:gap-10">
      <article className="min-w-0 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-0">
        <Link href="/courses" className="text-[13px] font-semibold text-faint hover:text-accent">
          ← {t("notes.back")}
        </Link>
        {state === "loading" && <div className="mt-6 h-[420px] animate-pulse rounded-2xl bg-muted" aria-busy="true" />}
        {(state === "missing" || state === "error") && (
          <p className="mt-8 text-[15px] text-muted-foreground">{t(state === "missing" ? "notes.notFound" : "notes.loadError")}</p>
        )}
        {state === "ready" && note && (
          <>
            <header className="mt-4">
              <p className="text-[13px] font-medium text-muted-foreground">
                {course ? course.title : note.content.courseId}
                {course && unit ? ` · ${unitTitle(course, unit)}` : ` · ${note.content.unitCode} ${note.content.unitName}`}
              </p>
              <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.015em] sm:text-[32px]">
                <span className="text-faint">{note.content.topicCode}</span> {note.content.topicName}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
                    note.label === "reviewed" ? "bg-accent-soft text-accent-dim" : "bg-muted text-muted-foreground",
                  )}
                >
                  {t(noteLabelKey(note.label))}
                </span>
                {note.content.hlOnly && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">
                    {t("notes.hlOnly")}
                  </span>
                )}
              </div>
              {course && topic && <StartButtons course={course} topic={topic} className="mt-5" />}
            </header>

            <div className="mt-6 lg:hidden">
              <NoteToc note={note.content} variant="bar" />
            </div>
            <div className="mt-5 lg:mt-6">
              <NoteBody note={note.content} />
            </div>

            {course && topic && (
              <div className="mt-12 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
                <p className="text-[15px] leading-snug text-muted-foreground">{t("notes.practiseHint")}</p>
                <StartButtons course={course} topic={topic} className="mt-3" />
              </div>
            )}

            <footer className="mt-8 flex flex-col gap-1 text-[12.5px] leading-snug text-faint">
              <p>{t(note.label === "reviewed" ? "notes.reviewedFoot" : "notes.draftFoot")}</p>
              <p>{t("notes.sourceFoot")}</p>
            </footer>
          </>
        )}
      </article>
      {state === "ready" && note && (
        <aside className="hidden pt-[150px] lg:block">
          <NoteToc note={note.content} variant="rail" />
        </aside>
      )}
      </div>
    </div>
  );
}

function StartButtons({ course, topic, className }: { course: Course; topic: CatalogTopic; className?: string }) {
  const { t } = useI18n();
  const { start, busyTopicId, busyMode } = useStartCourseTopic();
  const level: CourseLevel | undefined = topic.hlOnly ? "HL" : undefined;
  const busy = !!busyTopicId;
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <button
        type="button"
        onClick={() => void start(course, topic, level, "quick5")}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
      >
        {busy && busyMode === "quick5" ? <Loader2 className="size-4 animate-spin" /> : null}
        {busy && busyMode === "quick5" ? t("notes.starting") : t("notes.startQuick5")}
        {!busy && <ArrowRight className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => void start(course, topic, level, "session")}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-card px-5 text-[15px] font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy && busyMode === "session" ? <Loader2 className="size-4 animate-spin" /> : null}
        {busy && busyMode === "session" ? t("notes.starting") : t("notes.startSession")}
      </button>
    </div>
  );
}
