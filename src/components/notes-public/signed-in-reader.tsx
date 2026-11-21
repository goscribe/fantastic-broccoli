"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { trackNoteEvent, type LockedSummary } from "@/lib/api/public-notes";
import { isPlanLimitError } from "@/lib/api/plan-limit";
import { isLocked, paywallHref } from "@/lib/notes-public/gate";
import { InlineMarkdown } from "@/components/ui/markdown-text";
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
 * Scribe's own notes for one catalog topic, for signed-in learners: the
 * fallback the public page (app/notes/[courseId]/[topicId]) shows when a
 * note is not public (e.g. PUBLIC_NOTES=off on the server, or a note with
 * changes requested). Moved here unchanged from that route's old page. Both buttons start a session on the topic
 * with the note as its material.
 */
export function SignedInNoteReader({ courseId, topicId }: { courseId: string; topicId: string }) {
  const { t } = useI18n();
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
  // Paid gate: the server sent only the preview (first section, the other headings).
  const locked = note && isLocked(note.access) ? note.access : null;
  const shownNote = note && locked ? { ...note.content, sections: note.content.sections.slice(0, locked.shownSections) } : note?.content;
  const hidden = note && locked ? note.content.sections.slice(locked.shownSections) : [];
  useEffect(() => {
    if (locked) trackNoteEvent("notes.locked_viewed", courseId, topicId, { lockedKind: locked.kind, signedIn: true });
  }, [locked, courseId, topicId]);

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
                {locked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">
                    <Lock className="size-3" aria-hidden="true" />
                    {t("notes.lockedBadge")}
                  </span>
                )}
              </div>
              {course && topic && <StartButtons course={course} topic={topic} className="mt-5" />}
            </header>

            {!locked && (
              <div className="mt-6 lg:hidden">
                <NoteToc note={note.content} variant="bar" />
              </div>
            )}
            <div className="mt-5 lg:mt-6">
              <NoteBody note={shownNote!} />
            </div>
            {locked && <ReaderUnlock courseId={courseId} topicId={topicId} summary={locked} headings={hidden.map((h) => h.heading)} />}

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
      {state === "ready" && note && !locked && (
        <aside className="hidden pt-[150px] lg:block">
          <NoteToc note={note.content} variant="rail" />
        </aside>
      )}
      </div>
    </div>
  );
}

/** The reader's unlock panel for a locked topic (translated; the public page has its own, English-only). */
function ReaderUnlock({ courseId, topicId, summary, headings }: { courseId: string; topicId: string; summary: LockedSummary; headings: string[] }) {
  const { t } = useI18n();
  const lead = summary.kind === "HL" ? "notes.unlockLeadHL" : summary.kind === "A_LEVEL" ? "notes.unlockLeadALevel" : "notes.unlockLeadPlan";
  return (
    <section className="mt-9" aria-labelledby="h-reader-unlock">
      {headings.length > 0 && (
        <>
          <p className="text-[13px] font-semibold text-muted-foreground">{t("notes.unlockStillToCome")}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {headings.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-dashed border-border-strong px-4 py-3 text-[16px] font-semibold leading-snug text-muted-foreground">
                <Lock className="mt-1 size-3.5 shrink-0 text-faint" aria-hidden="true" />
                <span className="min-w-0">
                  <InlineMarkdown text={h} />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="mt-5 rounded-2xl border border-border bg-card px-5 py-5 sm:px-6">
        <h2 id="h-reader-unlock" className="text-[20px] font-bold leading-snug">
          {t("notes.unlockTitle")}
        </h2>
        <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">{t(lead)}</p>
        <p className="mt-2 text-[15px] leading-snug">{t("notes.unlockExtras")}</p>
        <a
          href={paywallHref(courseId, topicId)}
          onClick={() => trackNoteEvent("notes.unlock_clicked", courseId, topicId, { placement: "unlock_panel", lockedKind: summary.kind, signedIn: true })}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim"
        >
          {t("notes.tryFree")}
        </a>
        <p className="mt-3 text-[13px] leading-snug text-faint">{t("notes.trialHint")}</p>
      </div>
    </section>
  );
}

function StartButtons({ course, topic, className }: { course: Course; topic: CatalogTopic; className?: string }) {
  const { t } = useI18n();
  // A locked topic without a plan: the server refuses with a plan-limit error; send the learner to the paywall.
  const { start, busyTopicId, busyMode } = useStartCourseTopic({
    onError: (message) => {
      if (!isPlanLimitError(new Error(message))) return;
      trackNoteEvent("notes.unlock_clicked", course.id, topic.id, { placement: "header", signedIn: true });
      window.location.href = paywallHref(course.id, topic.id);
    },
  });
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

