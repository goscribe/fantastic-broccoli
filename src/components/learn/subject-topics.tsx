"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { coursesApi, type Course, type CourseLevel, type CourseProgress, type TopicProgress } from "@/lib/api/courses";
import { fetchNotesOutline, organizeNotes, type NotesOutline, type NotesTopic } from "@/lib/api/notes-outline";
import { notesApi } from "@/lib/api/notes";
import { createStudySession } from "@/lib/api/study";
import { masteryPercent, nextTopic, topicTitle, unitProgress, unitTitle, unitsForLevel } from "@/lib/courses";
import { libraryCourseHref, noteHref } from "@/lib/notes";
import { filesForCourseTopics } from "@/lib/subject-page";
import { emitTreeChanged, onTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import { dataSelector, linkTarget, revealTarget } from "@/lib/link-target";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Skeleton } from "@/components/ui/skeleton";
import { loadCourse, TopicRow } from "@/components/courses/course-picker";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import type { Material } from "@/types";
import { chooseStudyLength } from "@/lib/study-length-client";

export type SubjectCourse =
  | { state: "loading" }
  | { state: "none" }
  | { state: "ready"; course: Course; progress: CourseProgress; level: CourseLevel | undefined; withNotes: Set<string> };

/** The subject's course (when it follows one), its progress, and which topics Scribe has notes for. */
export function useSubjectCourse(workspaceId: string): SubjectCourse {
  const [state, setState] = useState<SubjectCourse>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      coursesApi
        .progress(workspaceId)
        .then(async (progress) => {
          const course = await loadCourse(progress.courseId);
          // Scribe notes are optional: a failure just leaves the links out.
          const withNotes = await notesApi
            .listForCourse(progress.courseId)
            .then((rows) => new Set(rows.map((r) => r.topicId)))
            .catch(() => new Set<string>());
          if (!cancelled) setState({ state: "ready", course, progress, level: (progress.level ?? undefined) as CourseLevel | undefined, withNotes });
        })
        .catch(() => !cancelled && setState({ state: "none" }));
    void load();
    const off = onTreeChanged(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [workspaceId]);
  return state;
}

/** The next course topic not done yet: what the band offers when nothing else is waiting. */
export function courseNextOf(c: SubjectCourse): { topicId: string; title: string; course: string } | null {
  if (c.state !== "ready") return null;
  const byTopic = new Map<string, TopicProgress>(c.progress.topics.map((p) => [p.topicId, p]));
  const next = nextTopic(unitsForLevel(c.course, c.level), byTopic);
  return next ? { topicId: next.topic.id, title: topicTitle(next.topic), course: `${c.course.title}${c.level ? ` ${c.level}` : ""}` } : null;
}

/**
 * The outline Scribe makes of the student's files (the server rebuilds it by
 * itself after uploads are read), and a manual re-run.
 */
export function useNotesOutline(workspaceId: string) {
  const [outline, setOutline] = useState<NotesOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const refetch = useCallback(
    () =>
      fetchNotesOutline(workspaceId)
        .then((o) => setOutline(o))
        .catch(() => setOutline(null))
        .finally(() => setLoading(false)),
    [workspaceId],
  );
  useEffect(() => {
    void refetch();
    return onTreeChanged(() => void refetch());
  }, [refetch]);

  const reorganise = async () => {
    setWorking(true);
    // The server saves each topic as it finishes writing it, so show them as they arrive.
    let done = false;
    const poll = setInterval(() => {
      fetchNotesOutline(workspaceId)
        .then((o) => !done && o?.partial && setOutline(o))
        .catch(() => undefined);
    }, 1200);
    try {
      const { outline: next, renamed } = await organizeNotes(workspaceId);
      done = true;
      setOutline(next);
      if (renamed > 0) emitTreeChanged();
      toast.success(`Organised into ${next.topics.length} topic${next.topics.length === 1 ? "" : "s"}` + (renamed > 0 ? ` · renamed ${renamed} file${renamed === 1 ? "" : "s"}` : ""));
    } catch (e) {
      toastError(e, "Couldn't organise your notes");
      // A failed run puts the previous outline back on the server.
      fetchNotesOutline(workspaceId)
        .then((o) => setOutline(o?.partial ? null : o))
        .catch(() => undefined);
    } finally {
      done = true;
      clearInterval(poll);
      setWorking(false);
    }
  };

  return { outline, loading, working, reorganise };
}

const linkBtn = "text-[13px] font-semibold text-accent hover:underline disabled:opacity-60";

/**
 * One topic list for the subject. A course subject lists the course's topics
 * with progress, the student's matching files and Scribe's notes; any of the
 * student's own topics that match no course topic follow under "Also in your
 * notes". A subject without a course lists the topics Scribe organised from
 * its files. Every row starts 5 questions on that topic.
 */
export function SubjectTopics({
  workspaceId,
  course,
  notes,
  materials,
}: {
  workspaceId: string;
  course: SubjectCourse;
  notes: ReturnType<typeof useNotesOutline>;
  materials: Material[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { start, busyTopicId } = useStartCourseTopic();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const startingRef = useRef(false);
  const { outline, loading, working, reorganise } = notes;
  const titleOf = useMemo(() => new Map(materials.map((m) => [m.id, m.title])), [materials]);

  const ready = course.state === "ready" ? course : null;
  // `?topic=<id>` (search, mistakes, end screen): open that topic's unit, scrolled to and outlined.
  const [topicTarget] = useState(() => linkTarget("topic"));
  const byTopic = useMemo(() => new Map<string, TopicProgress>((ready?.progress.topics ?? []).map((p) => [p.topicId, p])), [ready]);
  const units = useMemo(() => (ready ? unitsForLevel(ready.course, ready.level) : []), [ready]);
  const next = useMemo(() => nextTopic(units, byTopic), [units, byTopic]);
  const linkedUnit = useMemo(() => (topicTarget ? units.find((u) => u.topics.some((tp) => tp.id === topicTarget)) : undefined), [units, topicTarget]);
  const revealed = useRef(false);
  useEffect(() => {
    if (!topicTarget || !linkedUnit || revealed.current) return;
    revealed.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => revealTarget(dataSelector("topic-id", topicTarget))));
  }, [topicTarget, linkedUnit]);
  const matched = useMemo(
    () =>
      filesForCourseTopics(
        units.flatMap((u) => u.topics.map((x) => ({ id: x.id, name: x.name }))),
        outline?.topics ?? [],
        materials.map((m) => ({ id: m.id, title: m.title })),
      ),
    [units, outline, materials],
  );

  /** 5 questions on one of the student's own topics, grounded in the files it came from. */
  const startOutlineTopic = async (topic: NotesTopic) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(topic.title);
    try {
      const files = topic.fileIds.map((id) => titleOf.get(id)).filter(Boolean);
      const session = await createStudySession(
        await chooseStudyLength({
          workspaceId,
          title: topic.title,
          description: topic.summary || undefined,
          depth: "light" as const,
          durationMinutes: 5,
          quickStart: true,
          topics: [topic.title, ...topic.points, ...files].join("\n").slice(0, 2000),
        }),
      );
      if (!session) throw new Error("Could not start a session");
      router.push(`/workspace/${workspaceId}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Could not start a session");
      startingRef.current = false;
      setStarting(null);
    }
  };

  if (course.state === "loading" || (course.state === "none" && loading)) {
    return materials.length > 0 || course.state === "loading" ? <Skeleton className="h-[140px] rounded-2xl" /> : null;
  }
  if (!ready && materials.length === 0) return null;

  const stale = outline ? materials.length > outline.fileCount : false;
  const reorganiseLink =
    materials.length > 0 ? (
      <button type="button" onClick={() => void reorganise()} disabled={working} className={cn(linkBtn, "inline-flex shrink-0 items-center gap-1.5")}>
        {working && <Loader2 className="size-3.5 animate-spin" />}
        {working ? "Organising…" : outline ? (stale ? "Re-organise with new files" : "Re-organise") : "Organise now"}
      </button>
    ) : null;

  const outlineRows = (topics: NotesTopic[]) => (
    <ul className="flex flex-col gap-1.5">
      {topics.map((x) => (
        <li key={x.title}>
          <OutlineRow topic={x} files={x.fileIds.map((id) => titleOf.get(id)).filter((n): n is string => !!n)} busy={starting === x.title} disabled={starting !== null} onStart={() => void startOutlineTopic(x)} />
        </li>
      ))}
    </ul>
  );

  if (ready) {
    const { course: c, progress } = ready;
    const pct = masteryPercent(progress.mastery);
    const shownUnit = openUnit ?? linkedUnit?.id ?? next?.unit.id ?? null;
    return (
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Topics</h2>
          {reorganiseLink}
        </div>
        <p className="mt-0.5 text-small text-muted-foreground">
          {t("course.progressLine").replace("{done}", String(progress.topicsDone)).replace("{total}", String(progress.topicsTotal))}
          {pct !== null ? ` · ${t("course.masteryLine").replace("{pct}", String(pct))}` : ""}
          {ready.withNotes.size > 0 && (
            <>
              {` · Scribe has notes for ${ready.withNotes.size}. `}
              <Link href={libraryCourseHref(c.id)} className="font-semibold text-accent hover:underline">
                Read the notes
              </Link>
            </>
          )}
        </p>
        <div className="mt-3 flex flex-col gap-1">
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
                  <span className="min-w-0 flex-1 truncate text-small font-semibold">{unitTitle(c, u)}</span>
                  <span className="shrink-0 text-caption tabular-nums text-faint">
                    {up.done}/{up.total}
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <ul className="mb-2 mt-1 flex flex-col gap-1.5">
                    {u.topics.map((topic) => (
                      <li key={topic.id} data-topic-id={topic.id} className="rounded-2xl">
                        <TopicRow
                          topic={topic}
                          progress={byTopic.get(topic.id)}
                          files={(matched.byTopic.get(topic.id) ?? []).map((id) => titleOf.get(id)).filter((n): n is string => !!n)}
                          onStart={() => void start(c, topic, ready.level)}
                          busy={busyTopicId === topic.id}
                          disabled={!!busyTopicId}
                          notesHref={ready.withNotes.has(topic.id) ? noteHref(c.id, topic.id) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {matched.unmatched.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 px-1 text-[13.5px] font-semibold">Also in your notes</h3>
            {outlineRows(matched.unmatched)}
          </div>
        )}
        <p className="mt-4 text-caption leading-snug text-faint">
          {t("course.sourceNote")}
          {c.numberingNote ? ` ${c.numberingNote}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">
          Topics{outline ? <span className="font-medium text-faint"> · {outline.topics.length}</span> : null}
        </h2>
        {reorganiseLink}
      </div>
      {!outline ? (
        <p className="mt-1.5 text-small text-muted-foreground">
          {working ? "Reading your notes…" : "Scribe sorts your files into topics by itself once it has read them."}
        </p>
      ) : (
        <>
          <div className="mt-3">{outlineRows(outline.topics)}</div>
          <p className="mt-2 text-caption text-faint">
            {working && outline.partial ? (
              "Still reading your notes…"
            ) : (
              <>
                Organised {formatRelativeDate(outline.generatedAt).toLowerCase()} from {outline.fileCount} file{outline.fileCount === 1 ? "" : "s"}
                {stale ? " · you’ve added files since" : ""}
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

/** One of the student's own topics: the row starts 5 questions; the chevron shows its key points. */
function OutlineRow({ topic, files, busy, disabled, onStart }: { topic: NotesTopic; files: string[]; busy: boolean; disabled: boolean; onStart: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card transition-colors hover:border-border-strong">
      <div className="flex items-stretch">
        <button type="button" onClick={onStart} disabled={disabled} aria-label={`Start: ${topic.title}`} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left disabled:opacity-70">
          <span className="min-w-0 flex-1">
            <span className="block text-ui font-semibold">{topic.title}</span>
            {topic.summary && <span className="block truncate text-caption text-faint">{topic.summary}</span>}
            {files.length > 0 && <span className="block truncate text-caption text-muted-foreground">Your files: {files.join(", ")}</span>}
          </span>
          <span className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-border px-3 text-[13px] font-bold text-foreground">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Start"}
          </span>
        </button>
        {topic.points.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Hide key points: ${topic.title}` : `Key points: ${topic.title}`}
            className="grid w-10 shrink-0 place-items-center text-faint hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <ul className="list-disc space-y-1.5 px-4 pb-4 pl-8 text-small marker:text-faint">
          {topic.points.map((p, j) => (
            <li key={j}>
              <MarkdownText text={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
