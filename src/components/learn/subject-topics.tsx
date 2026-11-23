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
import { courseLookup, filesForCourseTopics } from "@/lib/subject-page";
import { emitTreeChanged, onTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import { dataSelector, linkTarget, revealTarget } from "@/lib/link-target";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Skeleton } from "@/components/ui/skeleton";
import { loadCourse, TickBox, TopicRow } from "@/components/courses/course-picker";
import { startPickedTopics, useStartCourseTopic } from "@/components/courses/use-start-topic";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import type { Material } from "@/types";
import { chooseStudyLength } from "@/lib/study-length-client";
import { MAX_SELECTED_TOPICS, groupState, selectedInOrder, toggleGroup, toggleTopic, type SelectChange } from "@/lib/topic-select";
import { buttonClass } from "@/components/ui/button";

export type SubjectCourse =
  | { state: "loading" }
  | { state: "none" }
  | { state: "ready"; course: Course; progress: CourseProgress; level: CourseLevel | undefined; withNotes: Set<string> };

const COURSE_LOADING: SubjectCourse = { state: "loading" };
const COURSE_NONE: SubjectCourse = { state: "none" };

/**
 * The subject's course (when it follows one), its progress, and which topics
 * Scribe has notes for. `subject` is the loaded subject (undefined while it
 * loads, null when it is not the student's): course progress is asked for
 * only when the subject follows a course, never for the student's own notes.
 */
export function useSubjectCourse(workspaceId: string, subject: { courseId?: string | null } | null | undefined): SubjectCourse {
  const lookup = courseLookup(subject);
  const [state, setState] = useState<SubjectCourse>(COURSE_LOADING);
  useEffect(() => {
    if (lookup !== "ask") return;
    let cancelled = false;
    const load = () =>
      coursesApi
        .progress(workspaceId)
        .then(async (progress) => {
          // No course after all (an older server could not say so up front).
          if (!progress) return void (!cancelled && setState(COURSE_NONE));
          const course = await loadCourse(progress.courseId);
          // Scribe notes are optional: a failure just leaves the links out.
          const withNotes = await notesApi
            .listForCourse(progress.courseId)
            .then((rows) => new Set(rows.map((r) => r.topicId)))
            .catch(() => new Set<string>());
          if (!cancelled) setState({ state: "ready", course, progress, level: (progress.level ?? undefined) as CourseLevel | undefined, withNotes });
        })
        // The course list is an extra on the page: without it the subject shows its own files and topics.
        .catch(() => !cancelled && setState(COURSE_NONE));
    void load();
    const off = onTreeChanged(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [workspaceId, lookup]);
  if (lookup === "wait") return COURSE_LOADING;
  if (lookup === "skip") return COURSE_NONE;
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
const NO_TOPICS: ReadonlySet<string> = new Set();

/**
 * One topic list for the subject. A course subject lists the course's topics
 * with progress, the student's matching files and Scribe's notes; any of the
 * student's own topics that match no course topic follow under "Also in your
 * notes". A subject without a course lists the topics Scribe organised from
 * its files. Every row starts 5 questions on that topic.
 *
 * Course topics can be picked together (a tick box in place of a row's code
 * on hover, a held touch, or "Select" above the list; a unit's box picks the
 * unit) and started as one session over all of them. The selection lives on
 * this page only and is cleared once the session starts.
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
  // Picking several course topics: `selectMode` is "Select" pressed; a ticked topic is enough by itself.
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(NO_TOPICS);
  const [startingPicked, setStartingPicked] = useState(false);
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

  // Ticks for topics that are no longer listed (the level changed) do not count.
  const pickedIds = useMemo(() => selectedInOrder(units, picked), [units, picked]);
  const selecting = selectMode || pickedIds.length > 0;
  const applyPick = (change: SelectChange) => {
    setPicked(change.next);
    if (change.capped) toast.message(t("course.selectMax").replace("{max}", String(MAX_SELECTED_TOPICS)), { id: "topic-select-max" });
  };
  const clearPicked = () => {
    setPicked(NO_TOPICS);
    setSelectMode(false);
  };

  /** One session over every picked topic; a single pick is that topic's usual 5 questions. */
  const startPicked = async () => {
    if (!ready || pickedIds.length === 0 || startingRef.current) return;
    startingRef.current = true;
    setStartingPicked(true);
    try {
      const topicNames = Object.fromEntries(units.flatMap((u) => u.topics.map((x) => [x.id, x.name])));
      const started = await startPickedTopics({ courseId: ready.course.id, topicIds: pickedIds, level: ready.level, topicNames });
      clearPicked();
      emitTreeChanged();
      router.push(`/workspace/${started.workspaceId}/session/${started.sessionId}`);
    } catch (e) {
      toastError(e, t("course.errorStart"));
      startingRef.current = false;
      setStartingPicked(false);
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
      <section onKeyDown={(e) => e.key === "Escape" && selecting && !startingPicked && clearPicked()}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Topics</h2>
          <div className="flex shrink-0 items-baseline gap-4">
            {reorganiseLink}
            <button
              type="button"
              onClick={() => (selecting ? clearPicked() : setSelectMode(true))}
              disabled={startingPicked}
              className="text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {t(selecting ? "course.selectCancel" : "course.select")}
            </button>
          </div>
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
            const unitIds = u.topics.map((x) => x.id);
            const unitState = groupState(unitIds, picked);
            return (
              <div key={u.id}>
                <div className="flex items-center rounded-lg hover:bg-muted/60">
                  {selecting && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={unitState === "all" ? true : unitState === "some" ? "mixed" : false}
                      aria-label={t("course.selectUnit").replace("{unit}", unitTitle(c, u))}
                      onClick={() => applyPick(toggleGroup(picked, unitIds))}
                      disabled={startingPicked}
                      className="group/tick grid size-11 shrink-0 place-items-center rounded-lg outline-none"
                    >
                      <TickBox state={unitState} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenUnit(open ? "" : u.id)}
                    aria-expanded={open}
                    className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg pr-1 text-left", !selecting && "pl-1")}
                  >
                    <span className="min-w-0 flex-1 truncate text-small font-semibold">{unitTitle(c, u)}</span>
                    <span className="shrink-0 text-caption tabular-nums text-faint">
                      {up.done}/{up.total}
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
                  </button>
                </div>
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
                          disabled={!!busyTopicId || startingPicked}
                          notesHref={ready.withNotes.has(topic.id) ? noteHref(c.id, topic.id) : undefined}
                          select={{ selecting, checked: picked.has(topic.id), onToggle: () => !startingPicked && applyPick(toggleTopic(picked, topic.id)) }}
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
        {pickedIds.length > 0 && (
          <div className="sticky bottom-3 z-20 mt-4 sm:bottom-4">
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card py-2 pl-4 pr-2 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
              <p aria-live="polite" className="min-w-0 flex-1 truncate text-ui font-semibold">
                {pickedIds.length === 1 ? t("course.selectedOne") : t("course.selectedMany").replace("{count}", String(pickedIds.length))}
              </p>
              <button type="button" onClick={clearPicked} disabled={startingPicked} className={buttonClass({ variant: "ghost", size: "sm" })}>
                {t("course.selectClear")}
              </button>
              <button type="button" onClick={() => void startPicked()} disabled={startingPicked || !!busyTopicId} className={buttonClass({ size: "sm", className: "min-w-[116px]" })}>
                {startingPicked ? <Loader2 className="size-4 animate-spin" /> : t("course.selectStart")}
              </button>
            </div>
          </div>
        )}
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
