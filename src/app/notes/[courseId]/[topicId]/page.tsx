import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { familyFor, familyVars } from "@/lib/subject-family";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { TopicList } from "@/components/notes-public/topic-list";
import { TopicView } from "@/components/notes-public/topic-view";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { unitTitle } from "@/lib/courses";
import type { PublicCourse, PublicUnit } from "@/lib/api/public-notes";
import { getCourse, getTopic, indexDrafts, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, resolveSegment, topicPath, unitPath } from "@/lib/notes-public/slug";
import { crumbsFor, isTopicIndexable, topicDescription, topicTitle, unitTitleSeo } from "@/lib/notes-public/seo";
import { isLocked, lockedCountLabel } from "@/lib/notes-public/gate";
import { LockedCount } from "@/components/notes-public/locked-count";

export const revalidate = 3600;

// Rendered on first request, then cached (ISR); no build-time API dependency.
export async function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ courseId: string; topicId: string }> };

/** Resolves the URL; redirects old or bare slugs (/notes/ib-biology/a1-1) to the canonical one. */
async function resolve(courseId: string, segment: string) {
  const course = await getCourse(courseId);
  if (!course) notFound();
  const match = resolveSegment(course.units, segment);
  if (!match) notFound();
  if (!match.canonical) permanentRedirect(`${coursePath(course.id)}/${match.slug}`);
  return { course, match };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { courseId, topicId } = await params;
  const { course, match } = await resolve(courseId, topicId);
  if (match.kind === "unit") {
    const title = unitTitleSeo(course, match.unit, course.unitLabel);
    const description = `${course.title} ${match.unit.code} ${match.unit.name}: ${match.unit.topics.length} topics with Scribe notes and exam-style practice questions with worked answers. Free, no sign-up.`;
    const path = unitPath(course.id, match.unit);
    return {
      title,
      description,
      alternates: { canonical: path },
      robots: match.unit.topics.some(rowIndexable) ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: { type: "website", title: `${title} | Scribe`, description, url: path },
      twitter: { card: "summary_large_image", title: `${title} | Scribe`, description },
    };
  }
  const data = await getTopic(course.id, match.topic.id);
  if (!data) notFound();
  const hasNote = !!data.note;
  // A locked topic is described by what it has (the full set), not by its preview.
  const locked = isLocked(data.access) ? data.access : null;
  const questionCount = locked ? locked.questions : data.questions.length;
  const title = topicTitle(course, data.topic, hasNote, questionCount);
  const description = topicDescription(course, data.topic, hasNote, questionCount, !!locked);
  const path = topicPath(course.id, data.topic);
  const indexable = isTopicIndexable({ note: data.note?.label ?? null, questionCount, indexDrafts: indexDrafts() });
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "article",
      title: `${title} | Scribe`,
      description,
      url: path,
      ...(data.updatedAt ? { modifiedTime: data.updatedAt } : {}),
    },
    twitter: { card: "summary_large_image", title: `${title} | Scribe`, description },
  };
}

export default async function NotesTopicPage({ params }: Params) {
  const { courseId, topicId } = await params;
  const { course, match } = await resolve(courseId, topicId);
  if (match.kind === "unit") return <UnitView course={course} unit={match.unit} />;
  const data = await getTopic(course.id, match.topic.id);
  if (!data) notFound();
  return <TopicView course={course} unit={match.unit} data={data} />;
}

/* ------------------------------- Unit ------------------------------- */

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function UnitView({ course, unit }: { course: PublicCourse; unit: PublicUnit }) {
  const i = course.units.findIndex((u) => u.id === unit.id);
  const next = course.units[i + 1];
  const notes = unit.topics.filter((t) => t.note).length;
  const first = unit.topics.find((t) => t.note) ?? unit.topics[0];
  // Nothing published for this unit yet: say so instead of promising notes.
  const empty = notes === 0 && unit.topics.every((t) => !t.questionCount);
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.unit(course, unit)} />
      <header
        className="subject-band nl-band mt-4 px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-8 sm:pr-[230px]"
        style={familyVars(familyFor(`${course.subject} ${course.title}`)) as React.CSSProperties}
      >
        <SubjectArt family={familyFor(`${course.subject} ${course.title}`)} eager />
        <p className="nl-rise pr-[92px] text-[14px] font-extrabold sm:pr-0">{course.title}</p>
        <h1 className="nl-rise mt-2 text-balance pr-[92px] text-[30px] font-black leading-[1.06] sm:pr-0 sm:text-[42px]" style={stagger(1)}>
          {unitTitle(course, unit)}
        </h1>
        <p className="nl-rise mt-3 text-[16.5px] font-semibold leading-snug text-white/90 sm:text-[18px]" style={stagger(2)}>
          {empty ? "Scribe's notes and practice questions for this unit are on their way. For now, see what each topic covers." : "Notes and exam-style practice questions with worked answers"}
        </p>
        <ul className="nl-meta nl-rise mt-3" style={stagger(3)}>
          <li>{unit.topics.length} topics</li>
          {notes > 0 && <li>{notes} notes</li>}
        </ul>
        {unit.topics.some((t) => t.locked) && (
          <div>
            <LockedCount
              label={lockedCountLabel(
                unit.topics.filter((t) => t.locked).length,
                course.board === "IB" ? "HL" : course.board === "A_LEVEL" ? "A_LEVEL" : "PLAN",
              )}
            />
          </div>
        )}
        {first && (
          <Link href={topicPath(course.id, first)} className="nl-btn nl-rise mt-5 w-full sm:w-auto" style={stagger(4)}>
            {empty ? "See" : "Start with"} {first.code} {first.name} <span aria-hidden="true">→</span>
          </Link>
        )}
      </header>
      <div className="mt-6">
        <TopicList courseId={course.id} topics={unit.topics} />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={coursePath(course.id)} className="nl-btn-ghost">
          <ArrowLeft className="size-4" aria-hidden="true" /> All {course.title} units
        </Link>
        {next && (
          <Link href={unitPath(course.id, next)} className="nl-btn sm:ml-auto">
            Next: {next.code} {next.name} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <NotesProgress />
    </div>
  );
}
