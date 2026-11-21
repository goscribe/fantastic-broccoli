"use client";

import { PageShell } from "@/components/ui/page-header";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { CourseUnits } from "@/components/notes-public/course-units";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { coursesApi, type CourseSubject } from "@/lib/api/courses";
import type { PublicCourse } from "@/lib/api/public-notes";
import { LIBRARY_PATH, noteHref } from "@/lib/notes";
import { lockedCountLabel } from "@/lib/notes-public/gate";
import { topicSlug } from "@/lib/notes-public/slug";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { loadNoteCourse, openFor, useLoaded, useNotesEntitled } from "./data";
import "@/app/notes/notes-look.css";

/** In-app link to a topic's note, with the same readable slug the public page uses. */
export const appTopicHref = (courseId: string, topic: { id: string; code: string; name: string }) => noteHref(courseId, topicSlug(topic));

/**
 * One course in the in-app notes library: its band, then units and topics
 * showing which have a note and questions, what the student has read, and a
 * lock only where the paid gate applies to them.
 */
export function CourseView({ courseId }: { courseId: string }) {
  const loaded = useLoaded(`course:${courseId}`, () => loadNoteCourse(courseId));
  const entitled = useNotesEntitled();
  const [subject, setSubject] = useState<CourseSubject | null>(null);

  useEffect(() => {
    let cancelled = false;
    coursesApi
      .mine()
      .then((rows) => !cancelled && setSubject(rows.find((r) => r.courseId === courseId) ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="notes-look flex-1">
      <PageShell as="div" max="max-w-[900px]">
        <Link href={LIBRARY_PATH} className="text-caption font-semibold text-faint hover:text-accent">
          ← Notes
        </Link>
        {loaded.state === "loading" && <div className="mt-2 h-[220px] animate-pulse rounded-[var(--r-panel)] bg-muted" aria-busy="true" />}
        {(loaded.state === "error" || (loaded.state === "ready" && !loaded.data)) && (
          <div className="mt-6 flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-10 text-center">
            <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-[72px] w-auto" />
            <p className="mt-3 text-[17px] font-extrabold">{loaded.state === "error" ? "We couldn't load this course" : "We couldn't find that course"}</p>
            {loaded.state === "error" ? (
              <button type="button" onClick={loaded.retry} className="mt-2 text-[14.5px] font-bold text-accent hover:underline">
                Try again
              </button>
            ) : (
              <Link href={LIBRARY_PATH} className="mt-2 text-ui font-bold text-accent hover:underline">
                See every course
              </Link>
            )}
          </div>
        )}
        {loaded.state === "ready" && loaded.data && <Outline course={openFor(loaded.data, entitled)} subject={subject} />}
      </PageShell>
    </div>
  );
}

function Outline({ course, subject }: { course: PublicCourse; subject: CourseSubject | null }) {
  const topics = course.units.flatMap((u) => u.topics);
  const notes = topics.filter((t) => t.note).length;
  const questions = topics.reduce((a, t) => a + t.questionCount, 0);
  const locked = topics.filter((t) => t.locked).length;
  const first = topics.find((t) => t.note && !t.locked) ?? topics.find((t) => t.note) ?? topics[0];
  // Nothing published for this course yet: the page is its outline and says so (no counts of nothing, no meter).
  const empty = notes === 0 && questions === 0;
  // The student's own subject for this course keeps the cover it has everywhere else.
  const family = resolveSubjectFamily(subject?.subjectFamily, `${course.subject} ${course.title}`);
  return (
    <>
      <header className="subject-band nl-band mt-2 px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-7 sm:pr-[250px]" style={familyVars(family) as React.CSSProperties} data-nl-course={course.id} data-total={topics.length}>
        <SubjectArt family={family} eager />
        <p className="flex min-h-[84px] items-center pr-[96px] text-ui font-bold text-white/90 sm:min-h-0 sm:pr-0">
          <span>
            <span className="font-extrabold text-white">{course.boardName}</span> · {course.qualification}
            {subject?.level ? ` · ${subject.level}` : course.levels?.length ? ` · ${course.levels.join(" and ")}` : ""}
          </span>
        </p>
        <h1 className="mt-2 text-[30px] font-black leading-[1.05] sm:text-[40px]">{course.title}</h1>
        <p className="mt-2.5 max-w-[560px] text-read font-semibold text-white/90">
          {empty
            ? `${topics.length} topics in ${course.units.length} units. Scribe's notes for this course are on their way; for now, see what each topic covers.`
            : [`${topics.length} topics`, notes ? `${notes.toLocaleString("en-GB")} notes` : null, questions ? `${questions.toLocaleString("en-GB")} practice questions` : null].filter(Boolean).join(" · ")}
        </p>
        {locked > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-small font-bold text-white/90">
            <Lock className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
            {lockedCountLabel(locked, course.board === "IB" ? "HL" : course.board === "A_LEVEL" ? "A_LEVEL" : "PLAN")}
          </p>
        )}
        {!empty && (
          <div className="mt-4 max-w-[420px]">
            <div className="nl-meter" aria-hidden="true">
              <span />
            </div>
            <p data-nl-count className="mt-1.5 text-small font-bold text-white/90">
              Not started yet
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {first && (
            <Link href={appTopicHref(course.id, first)} className="nl-btn w-full sm:w-auto">
              <span className="truncate">
                {empty ? "See" : "Read"} {first.code} {first.name}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {subject && (
            <Link href={`/workspace/${subject.workspaceId}`} className="nl-btn-ghost w-full sm:w-auto">
              Open your subject
            </Link>
          )}
        </div>
      </header>
      <CourseUnits course={course} topicHref={(t) => appTopicHref(course.id, t)} unitHref={null} />
      <p className="mt-10 text-caption leading-snug text-faint">{course.sourceNote}</p>
      <NotesProgress key={course.id} />
    </>
  );
}
