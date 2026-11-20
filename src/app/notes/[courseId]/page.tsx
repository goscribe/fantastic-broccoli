import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { TopicList } from "@/components/notes-public/topic-list";
import { unitTitle } from "@/lib/courses";
import { getCourse, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, unitPath } from "@/lib/notes-public/slug";
import { courseDescription, courseTitle, crumbsFor } from "@/lib/notes-public/seo";

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
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-8 pt-5 sm:px-6 sm:pt-8">
      <Breadcrumbs crumbs={crumbsFor.course(course)} />
      <header className="mt-4">
        <p className="text-[13px] font-semibold text-muted-foreground">
          {course.boardName} · {course.qualification}
          {course.levels?.length ? ` · ${course.levels.join(" and ")}` : ""}
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[34px]">{course.title} notes and practice questions</h1>
        <p className="mt-2 text-[15.5px] leading-snug text-muted-foreground">
          {course.units.reduce((a, u) => a + u.topics.length, 0)} topics in {course.units.length} units
          {n.notes ? ` · ${n.notes} topic notes` : ""}
          {n.questions ? ` · ${n.questions} exam-style questions with worked answers` : ""}.
        </p>
      </header>
      <nav aria-label="Units" className="mt-5 flex flex-wrap gap-2">
        {course.units.map((u) => (
          <a key={u.id} href={`#u-${u.id}`} className="rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:border-accent hover:text-accent">
            {u.code}
          </a>
        ))}
      </nav>
      {course.units.map((u) => (
        <section key={u.id} id={`u-${u.id}`} className="mt-9 scroll-mt-6" aria-labelledby={`uh-${u.id}`}>
          <h2 id={`uh-${u.id}`} className="text-[18px] font-bold leading-snug sm:text-[20px]">
            <Link href={unitPath(course.id, u)} className="hover:text-accent">
              {unitTitle(course, u)}
            </Link>
          </h2>
          <TopicList courseId={course.id} topics={u.topics} />
        </section>
      ))}
      <p className="mt-10 text-[12.5px] leading-snug text-faint">{course.sourceNote}</p>
    </div>
  );
}
