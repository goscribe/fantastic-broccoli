import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { SubjectTile } from "@/components/notes-public/subject-tile";
import { TopicList } from "@/components/notes-public/topic-list";
import { unitTitle } from "@/lib/courses";
import { getCourse, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, topicPath, unitPath } from "@/lib/notes-public/slug";
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
  const topicCount = course.units.reduce((a, u) => a + u.topics.length, 0);
  const first = course.units.flatMap((u) => u.topics).find((t) => t.note) ?? course.units[0]?.topics[0];
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.course(course)} />
      <header className="nl-panel relative mt-4 overflow-hidden px-5 pb-6 pt-5 sm:px-9 sm:pb-9 sm:pt-8" data-nl-course={course.id} data-total={topicCount}>
        <div className="absolute right-4 top-4 grid size-[84px] place-items-center rounded-full bg-white sm:right-8 sm:top-8 sm:size-[150px]">
          <Image src="/design/cat2-wave.png" alt="" width={240} height={255} priority unoptimized className="nl-cat-in h-[72px] w-auto sm:h-[128px]" />
        </div>
        <div className="nl-rise flex min-h-[84px] items-center gap-3 pr-[92px] sm:min-h-0 sm:pr-[170px]">
          <SubjectTile title={`${course.subject} ${course.title}`} solid />
          <p className="text-[13.5px] font-extrabold leading-snug text-accent">
            {course.boardName} · {course.qualification}
            {course.levels?.length ? ` · ${course.levels.join(" and ")}` : ""}
          </p>
        </div>
        <h1 className="nl-rise mt-2 text-[32px] font-black leading-[1.05] text-foreground sm:pr-[170px] sm:text-[46px]" style={{ "--i": 1 } as React.CSSProperties}>
          {course.title} notes and practice questions
        </h1>
        <p className="nl-rise mt-3 max-w-[560px] text-[16.5px] font-semibold leading-snug text-[#3b3650] sm:text-[18px]" style={{ "--i": 2 } as React.CSSProperties}>
          {topicCount} topics in {course.units.length} units
          {n.notes ? ` · ${n.notes} topic notes` : ""}
          {n.questions ? ` · ${n.questions} exam-style questions with worked answers` : ""}.
        </p>
        <div className="nl-rise mt-5 max-w-[460px]" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="nl-meter !bg-white" aria-hidden="true">
            <span />
          </div>
          <p data-nl-count className="mt-1.5 text-[13px] font-bold text-muted-foreground">
            Your progress shows up here as you read and practise
          </p>
        </div>
        {first && (
          <Link href={topicPath(course.id, first)} className="nl-btn nl-rise mt-5 w-full sm:w-auto" style={{ "--i": 4 } as React.CSSProperties}>
            Start with {first.code} {first.name} <span aria-hidden="true">→</span>
          </Link>
        )}
      </header>
      <nav aria-label="Units" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {course.units.map((u) => (
          <a key={u.id} href={`#u-${u.id}`} className="nl-btn-ghost nl-btn-sm shrink-0">
            {u.code}
          </a>
        ))}
      </nav>
      {course.units.map((u, ui) => (
        <section key={u.id} id={`u-${u.id}`} className="mt-10 scroll-mt-6" aria-labelledby={`uh-${u.id}`}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-[52px] min-w-[52px] shrink-0 place-items-center rounded-[18px] bg-accent px-2 text-[17px] font-black text-white shadow-[0_3px_0_0_var(--accent-edge)]" aria-hidden="true">
              {u.code.length <= 4 ? u.code : ui + 1}
            </span>
            <div className="min-w-0">
              <h2 id={`uh-${u.id}`} className="text-[21px] font-black leading-[1.15] sm:text-[25px]">
                <Link href={unitPath(course.id, u)} className="hover:text-accent">
                  {unitTitle(course, u)}
                </Link>
              </h2>
              <p className="mt-0.5 text-[13.5px] font-bold text-muted-foreground">
                {u.topics.length} topics
                {u.topics.some((t) => t.note) ? ` · ${u.topics.filter((t) => t.note).length} notes` : ""}
              </p>
            </div>
          </div>
          <TopicList courseId={course.id} topics={u.topics} />
        </section>
      ))}
      <p className="mt-10 text-[12.5px] leading-snug text-faint">{course.sourceNote}</p>
      <NotesProgress />
    </div>
  );
}
