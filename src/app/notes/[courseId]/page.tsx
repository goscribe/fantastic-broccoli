import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectArt } from "@/components/learn/subject-tile";
import { familyFor, familyVars } from "@/lib/subject-family";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { CourseUnits } from "@/components/notes-public/course-units";
import { getCourse, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, topicPath } from "@/lib/notes-public/slug";
import { courseDescription, courseTitle, crumbsFor } from "@/lib/notes-public/seo";
import { lockedCountLabel } from "@/lib/notes-public/gate";
import { LockedCount } from "@/components/notes-public/locked-count";

export const revalidate = 3600;

// Rendered on first request, then cached (ISR); no build-time API dependency.
export async function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ courseId: string }> };

const counts = (c: NonNullable<Awaited<ReturnType<typeof getCourse>>>) => {
  const topics = c.units.flatMap((u) => u.topics);
  return {
    notes: topics.filter((t) => t.note).length,
    questions: topics.reduce((a, t) => a + t.questionCount, 0),
    indexable: topics.some(rowIndexable),
    locked: topics.filter((t) => t.locked).length,
    lockedKind: c.board === "IB" ? ("HL" as const) : c.board === "A_LEVEL" ? ("A_LEVEL" as const) : ("PLAN" as const),
  };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const n = counts(course);
  const title = courseTitle(course);
  const description = courseDescription(course, n.notes, n.questions);
  return {
    title,
    description,
    alternates: { canonical: coursePath(course.id) },
    robots: n.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", title: `${title} | Scribe`, description, url: coursePath(course.id) },
    twitter: { card: "summary_large_image", title: `${title} | Scribe`, description },
  };
}

export default async function CourseNotesPage({ params }: Params) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();
  const n = counts(course);
  const topicCount = course.units.reduce((a, u) => a + u.topics.length, 0);
  const first = course.units.flatMap((u) => u.topics).find((t) => t.note) ?? course.units[0]?.topics[0];
  // Nothing published for this course yet: the page is its outline and says so (no promise of notes, no progress meter).
  const empty = n.notes === 0 && n.questions === 0;
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.course(course)} />
      {/* The header band is the course's subject colour with its illustration; everything under it stays white. */}
      <header
        className="subject-band nl-band mt-4 px-[var(--band-pad-x)] py-[var(--band-pad-y)] sm:pr-[220px]"
        style={familyVars(familyFor(`${course.subject} ${course.title}`)) as React.CSSProperties}
        data-nl-course={course.id}
        data-total={topicCount}
      >
        <SubjectArt family={familyFor(`${course.subject} ${course.title}`)} eager />
        <p className="nl-rise flex min-h-[56px] items-center pr-[76px] text-ui font-bold text-white/90 sm:min-h-0 sm:pr-0">
          <span>
            <span className="font-extrabold text-white">{course.boardName}</span> · {course.qualification}
            {course.levels?.length ? ` · ${course.levels.join(" and ")}` : ""}
          </span>
        </p>
        <h1 className="nl-rise mt-1.5 text-[28px] font-black leading-[1.06] sm:text-[36px]" style={{ "--i": 1 } as React.CSSProperties}>
          {empty ? `${course.title} topics` : `${course.title} notes and practice questions`}
        </h1>
        <p className="nl-rise mt-2 max-w-[560px] text-ui font-semibold text-white/90 sm:text-read" style={{ "--i": 2 } as React.CSSProperties}>
          {topicCount} topics in {course.units.length} units
          {n.notes ? ` · ${n.notes.toLocaleString("en-GB")} topic notes` : ""}
          {n.questions ? ` · ${n.questions.toLocaleString("en-GB")} exam-style questions with worked answers` : ""}.
          {empty ? " Scribe's notes and practice questions for this course are on their way. For now, see what each topic covers." : ""}
        </p>
        {n.locked > 0 && (
          <div>
            <LockedCount label={lockedCountLabel(n.locked, n.lockedKind)} />
          </div>
        )}
        {!empty && (
          <div className="nl-rise mt-5 max-w-[460px]" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="nl-meter" aria-hidden="true">
              <span />
            </div>
            <p data-nl-count className="mt-1.5 text-small font-bold text-white/90">
              Your progress shows up here as you read and practise
            </p>
          </div>
        )}
        {first && (
          <Link href={topicPath(course.id, first)} className="nl-btn nl-rise mt-5 w-full sm:w-auto" style={{ "--i": 4 } as React.CSSProperties}>
            {empty ? "See" : "Start with"} {first.code} {first.name} <span aria-hidden="true">→</span>
          </Link>
        )}
      </header>
      <CourseUnits course={course} />
      <p className="mt-10 text-small text-faint">{course.sourceNote}</p>
      <NotesProgress />
    </div>
  );
}
