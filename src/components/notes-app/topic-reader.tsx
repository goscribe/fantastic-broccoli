"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { StartQuick5 } from "@/components/notes-public/practice";
import { TopicView, type NotePaths } from "@/components/notes-public/topic-view";
import { attachedNotesApi, notesApi } from "@/lib/api/notes";
import type { PublicTopic } from "@/lib/api/public-notes";
import type { FlashcardSet } from "@/lib/notes-public/flashcard-deck";
import { isLocked } from "@/lib/notes-public/gate";
import { resolveSegment, topicSlug } from "@/lib/notes-public/slug";
import { LIBRARY_PATH, libraryCourseHref, noteHref } from "@/lib/notes";
import { track } from "@/lib/funnel";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast } from "@/lib/toast";
import { AddToSubjectDialog } from "./add-to-subject";
import { loadNoteCourse, useLoaded } from "./data";
import { useNoteHighlights } from "@/components/my-notes/note-highlighter";
import "@/app/notes/notes-look.css";

const APP_PATHS: NotePaths = {
  course: libraryCourseHref,
  // The in-app course view holds every unit: a unit link lands on its section there.
  unit: (courseId, unit) => `${libraryCourseHref(courseId)}#u-${unit.id}`,
  topic: (courseId, topic) => noteHref(courseId, topicSlug(topic)),
};

/**
 * A topic's note inside the app shell: the same page the public site renders
 * (TopicView), read with the learner's session, so a topic they are entitled
 * to comes whole. Adds what a signed-in reader can do: start a full session
 * on the topic, add the note to a subject as material, and have missed
 * practice questions go to their Mistakes list.
 */
export function TopicReader({ courseId, segment }: { courseId: string; segment: string }) {
  const router = useRouter();
  const course = useLoaded(`course:${courseId}`, () => loadNoteCourse(courseId));
  const match = useMemo(() => (course.state === "ready" && course.data ? resolveSegment(course.data.units, segment) : null), [course, segment]);
  const topicId = match?.kind === "topic" ? match.topic.id : null;
  const page = useLoaded<PublicTopic | null>(`topic:${courseId}/${topicId ?? ""}`, () => (topicId ? notesApi.page(courseId, topicId) : Promise.resolve(null)));

  // A unit address has no page of its own in the app: show the unit in the course view.
  useEffect(() => {
    if (match?.kind === "unit") router.replace(`${libraryCourseHref(courseId)}#u-${match.unit.id}`);
  }, [match, courseId, router]);

  const missing = course.state === "ready" && (!course.data || !match);
  const failed = course.state === "error" || (topicId !== null && page.state === "error");
  const data = topicId !== null && page.state === "ready" ? page.data : null;

  return (
    <div className="notes-look flex-1">
      {(course.state === "loading" || (topicId !== null && page.state === "loading")) && (
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 sm:px-6" aria-busy="true">
          <div className="h-[260px] animate-pulse rounded-[var(--r-panel)] bg-muted" />
          <div className="mt-8 h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      )}
      {(missing || failed || (topicId !== null && page.state === "ready" && !page.data)) && (
        <div className="mx-auto w-full max-w-[640px] px-4 pt-10 sm:px-6">
          <div className="flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-10 text-center">
            <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-[72px] w-auto" />
            <p className="mt-3 text-read font-extrabold">{failed ? "We couldn't load this note" : "We couldn't find that topic"}</p>
            {failed ? (
              <button type="button" onClick={() => (course.state === "error" ? course.retry() : page.retry())} className="mt-2 text-[14.5px] font-bold text-accent hover:underline">
                Try again
              </button>
            ) : (
              <Link href={course.state === "ready" && course.data ? libraryCourseHref(courseId) : LIBRARY_PATH} className="mt-2 text-ui font-bold text-accent hover:underline">
                {course.state === "ready" && course.data ? `See every ${course.data.title} topic` : "See every course"}
              </Link>
            )}
          </div>
        </div>
      )}
      {data && <Reader key={`${courseId}/${data.topic.id}`} data={data} />}
    </div>
  );
}

function Reader({ data }: { data: PublicTopic }) {
  const { course, topic, note } = data;
  /** Opened from a subject's materials (?ws=<subject>): that subject already holds this note. Read once; the reader only renders in the browser. */
  const [fromSubject] = useState(() => new URLSearchParams(window.location.search).get("ws"));
  const unit = course.units.find((u) => u.id === data.unitId) ?? course.units[0];
  const locked = isLocked(data.access);
  const [adding, setAdding] = useState(false);
  /** Subjects that hold this note; null until known (or when this server has no attached notes). */
  const [inSubjects, setInSubjects] = useState<string[] | null>(null);
  const [canAttach, setCanAttach] = useState(false);
  /** The student's subject for this course: the default place for the note, one tap, no dialog. */
  const [courseSubject, setCourseSubject] = useState<string | null>(null);
  const [addingNow, setAddingNow] = useState(false);
  const [missed, setMissed] = useState<{ logged: number; unlogged: number }>({ logged: 0, unlogged: 0 });
  const level = topic.hlOnly ? ("HL" as const) : undefined;
  /** The topic's deck (free cards and the total), so the contents rail lists "Flashcards" as the public page does; the deck itself loads its cards. */
  const [flashcards, setFlashcards] = useState<FlashcardSet | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes-flashcards/${encodeURIComponent(course.id)}/${encodeURIComponent(topic.id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FlashcardSet>) : null))
      .then((set) => {
        if (!cancelled) setFlashcards(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [course.id, topic.id]);

  useEffect(() => {
    track("notes.opened_in_app", { from: fromSubject ? "subject" : "library", courseId: course.id }, fromSubject ?? undefined);
  }, [course.id, topic.id, fromSubject]);

  useEffect(() => {
    let cancelled = false;
    attachedNotesApi
      .subjectsFor(course.id, topic.id)
      .then((w) => {
        if (cancelled) return;
        setInSubjects(w.attachedWorkspaceIds);
        setCanAttach(w.attachable);
        setCourseSubject(w.courseWorkspaceId);
      })
      // An older server: no "Add to a subject".
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [course.id, topic.id]);

  // Each answer is marked by the server too, which keeps the Mistakes list: wrong answers go in, a later right one corrects them.
  const answered = useRef(new Set<string>());
  const onAnswer = useCallback(
    (questionId: string, choice: number, correct: boolean) => {
      if (answered.current.has(questionId)) return;
      answered.current.add(questionId);
      attachedNotesApi
        .practiceAnswer({ courseId: course.id, topicId: topic.id, questionId, choice })
        .then((r) => {
          if (!correct) setMissed((m) => (r.logged ? { ...m, logged: m.logged + 1 } : { ...m, unlogged: m.unlogged + 1 }));
        })
        .catch(() => undefined);
    },
    [course.id, topic.id],
  );

  const onStarted = (workspaceId: string) => {
    // The session's subject holds this note as material (the server attaches it on start).
    if (note) track("notes.attached_session_started", { from: "note", courseId: course.id }, workspaceId);
  };
  /** The reader's own highlights in this note (nothing on a server without them). */
  const highlights = useNoteHighlights({ note: { kind: "topic", courseId: course.id, topicId: topic.id }, rootId: "nl-article", enabled: !!note, partial: locked });
  const added = (inSubjects?.length ?? 0) > 0;
  const addToSubject = async () => {
    // Not in any subject yet and they have one for this course: put it there. Anything else is a choice, so ask.
    if (added || !courseSubject) return setAdding(true);
    if (addingNow) return;
    setAddingNow(true);
    try {
      const out = await attachedNotesApi.attach(courseSubject, course.id, [topic.id]);
      setInSubjects([courseSubject]);
      if (out.attached.length) {
        track("notes.attached", { from: "note", noteCount: 1, courseId: course.id }, courseSubject);
        emitTreeChanged();
        toast.success(`Added to your ${course.title} subject`);
      }
    } catch {
      setAdding(true);
    } finally {
      setAddingNow(false);
    }
  };

  return (
    <>
      <TopicView
        course={course}
        unit={unit}
        data={data}
        flashcards={flashcards}
        app={{
          paths: APP_PATHS,
          onAnswer,
          top: (
            <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-1.5 text-caption font-semibold text-faint">
              <Link href={LIBRARY_PATH} className="hover:text-accent">
                Notes
              </Link>
              <span aria-hidden="true">/</span>
              <Link href={libraryCourseHref(course.id)} className="hover:text-accent">
                {course.title}
              </Link>
            </nav>
          ),
          headerActions: (
            <>
              <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="header" mode="session" onStarted={onStarted} />
              {highlights.available && highlights.count > 0 && (
                <button type="button" onClick={highlights.open} className="nl-btn-ghost">
                  Highlights <span className="tabular-nums opacity-70">{highlights.count}</span>
                </button>
              )}
              {note && !locked && inSubjects !== null && canAttach && (
                <button type="button" onClick={() => void addToSubject()} className="nl-btn-ghost" aria-busy={addingNow}>
                  {added && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                  {added ? (inSubjects!.length === 1 ? "In a subject" : `In ${inSubjects!.length} subjects`) : "Add to a subject"}
                </button>
              )}
            </>
          ),
          emptyNote: (
            // The band already offers the session; the one thing left to say is the other way to get material.
            <Link href="/new-subject" className="mt-4 inline-flex min-h-10 items-center text-[14.5px] font-bold text-accent hover:underline">
              Have your own notes? Add them to a subject
            </Link>
          ),
          finish:
            missed.logged + missed.unlogged > 0 ? (
              <p className="mt-6 rounded-2xl bg-muted px-4 py-3.5 text-ui font-semibold text-foreground" role="status">
                {missed.logged > 0 ? (
                  <>
                    {missed.logged === 1 ? "The question you missed is" : `The ${missed.logged} questions you missed are`} in your{" "}
                    <Link href="/mistakes" className="font-extrabold text-accent hover:underline">
                      Mistakes
                    </Link>
                    , ready to practise again.
                  </>
                ) : canAttach ? (
                  <>
                    Want the questions you miss kept in Mistakes?{" "}
                    <button type="button" onClick={() => void addToSubject()} className="font-extrabold text-accent hover:underline">
                      Add this note to a subject
                    </button>
                    .
                  </>
                ) : (
                  "Start a session on this topic and the questions you miss are kept in Mistakes."
                )}
              </p>
            ) : null,
        }}
      />
      {highlights.ui}
      {adding && (
        <AddToSubjectDialog
          courseId={course.id}
          courseTitle={course.title}
          topicId={topic.id}
          topicLabel={`${topic.code} ${topic.name}`}
          onClose={() => setAdding(false)}
          onChanged={setInSubjects}
        />
      )}
    </>
  );
}
