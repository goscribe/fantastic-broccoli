"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CourseTile } from "@/components/notes-public/course-tile";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { coursesApi, type CourseSubject } from "@/lib/api/courses";
import type { PublicCourseSummary } from "@/lib/api/public-notes";
import { BOARD_LABEL, BOARD_ORDER } from "@/lib/courses";
import { libraryCourseHref } from "@/lib/notes";
import { onTreeChanged } from "@/lib/tree-events";
import { loadNoteCourses, useLoaded, useNotesEntitled } from "./data";
import "@/app/notes/notes-look.css";

/**
 * The notes library inside the app: the student's own courses first (the
 * subjects they started from a course), then every course by exam board.
 * Same tiles as the public index; everything stays in the app shell.
 */
export function NotesLibrary() {
  const courses = useLoaded("courses", loadNoteCourses);
  const entitled = useNotesEntitled();
  const [mine, setMine] = useState<CourseSubject[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = () =>
      coursesApi
        .mine()
        .then(setMine)
        .catch(() => setMine([]));
    void load();
    return onTreeChanged(() => void load());
  }, []);

  const all = useMemo(() => {
    const list = courses.state === "ready" ? courses.data : [];
    // Someone with a plan has nothing locked: no lock line on their tiles.
    return entitled ? list.map((c) => ({ ...c, lockedCount: 0 })) : list;
  }, [courses, entitled]);
  const q = query.trim().toLowerCase();
  const match = (c: PublicCourseSummary) => !q || `${c.title} ${c.boardName} ${c.subject} ${c.qualification}`.toLowerCase().includes(q);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  // One tile per course the student is on, in the order they last used them.
  const own = useMemo(() => {
    const seen = new Set<string>();
    return mine.flatMap((m) => {
      const c = byId.get(m.courseId);
      if (!c || seen.has(c.id)) return [];
      seen.add(c.id);
      return [{ course: c, level: m.level }];
    });
  }, [mine, byId]);
  const groups = BOARD_ORDER.map((board) => ({ board, courses: all.filter((c) => c.board === board && match(c)) })).filter((g) => g.courses.length);
  const notes = all.reduce((a, c) => a + c.noteCount, 0);
  const questions = all.reduce((a, c) => a + c.questionCount, 0);
  // Nothing imported yet: say what there is (topic outlines) instead of promising notes.
  const empty = courses.state === "ready" && notes === 0 && questions === 0;

  return (
    <div className="notes-look flex-1">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">Notes</h1>
            <p className="mt-1.5 max-w-[620px] text-[16px] font-semibold leading-snug text-muted-foreground sm:text-[17px]">
              {courses.state !== "ready"
                ? "Scribe's notes and practice questions, course by course."
                : empty
                  ? "Scribe's notes are being added course by course. For now, each course shows what its topics cover."
                  : `Scribe's own notes for ${all.filter((c) => c.noteCount > 0).length} courses, with practice questions. Read one, or add it to a subject as material.`}
            </p>
          </div>
          <label className="flex h-11 w-full shrink-0 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-[14.5px] sm:w-[280px]">
            <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
            <span className="sr-only">Search courses</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses"
              className="min-w-0 flex-1 bg-transparent font-semibold text-foreground placeholder:font-medium placeholder:text-faint focus:outline-none"
            />
          </label>
        </div>

        {courses.state === "loading" && (
          <div className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[184px] animate-pulse rounded-[var(--r-card)] bg-muted" />
            ))}
          </div>
        )}
        {courses.state === "error" && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3" role="alert">
            <span className="text-[14.5px] text-muted-foreground">We couldn&apos;t load the notes just now.</span>
            <button type="button" onClick={courses.retry} className="text-[14px] font-bold text-accent hover:underline">
              Try again
            </button>
          </div>
        )}

        {courses.state === "ready" && (
          <>
            {own.length > 0 && !q && (
              <section className="mt-8" aria-labelledby="lib-yours">
                <h2 id="lib-yours" className="text-[20px] font-extrabold">
                  Your courses
                </h2>
                <ul className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {own.map(({ course, level }) => (
                    <li key={course.id}>
                      <CourseTile course={course} href={libraryCourseHref(course.id)} sub={level ? `${course.topicCount} topics · ${level}` : undefined} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-9" aria-labelledby="lib-all">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 id="lib-all" className="text-[20px] font-extrabold">
                  {own.length > 0 && !q ? "All courses" : q ? "Courses" : "Pick a course"}
                </h2>
                {!q && groups.length > 1 && (
                  <nav aria-label="Exam boards" className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <a key={g.board} href={`#lib-${g.board}`} className="rounded-full border border-border px-3 py-1.5 text-[13px] font-bold text-foreground hover:bg-muted">
                        {BOARD_LABEL[g.board]}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
              {groups.map((g) => (
                <div key={g.board} id={`lib-${g.board}`} className="mt-5 scroll-mt-4">
                  <h3 className="flex items-baseline gap-2 text-[15px] font-extrabold text-foreground">
                    {BOARD_LABEL[g.board]}
                    <span className="text-[13px] font-semibold text-faint">
                      {g.courses.length} {g.courses.length === 1 ? "course" : "courses"}
                    </span>
                  </h3>
                  <ul className="mt-2.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {g.courses.map((c) => (
                      <li key={c.id}>
                        <CourseTile course={c} href={libraryCourseHref(c.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="mt-6 flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-9 text-center">
                  <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-[72px] w-auto" />
                  <p className="mt-3 text-[16px] font-extrabold">No course matches “{query.trim()}”</p>
                  <p className="mt-1 max-w-[380px] text-[14px] text-muted-foreground">
                    Scribe has outlines for IB, AP, GCSE and A-level courses. Studying something else?{" "}
                    <Link href="/new-subject" className="font-bold text-accent hover:underline">
                      Make a subject from your own notes
                    </Link>
                    .
                  </p>
                </div>
              )}
            </section>
            {/* Fills the tiles' meters from what this browser has read and answered. */}
            <NotesProgress key={`${all.length}-${own.length}-${q}`} />
          </>
        )}
      </div>
    </div>
  );
}
