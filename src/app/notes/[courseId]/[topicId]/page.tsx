import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { PublicNoteBody } from "@/components/notes-public/public-note-body";
import { RichText } from "@/components/notes-public/rich-text";
import { TopicList } from "@/components/notes-public/topic-list";
import { PracticeCard, PracticeDone, PracticeProvider, PracticeScore, StartQuick5 } from "@/components/notes-public/practice";
import { SignedInNoteFallback } from "@/components/notes-public/signed-in-fallback";
import { NoteToc } from "@/components/notes/note-toc";
import { unitTitle } from "@/lib/courses";
import type { PublicCourse, PublicQuestion, PublicTopic, PublicUnit } from "@/lib/api/public-notes";
import { getCourse, getTopic, indexDrafts, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, neighbours, resolveSegment, topicPath, unitPath } from "@/lib/notes-public/slug";
import { crumbsFor, isTopicIndexable, topicDescription, topicQuizJsonLd, topicTitle, unitTitleSeo } from "@/lib/notes-public/seo";
import { jsonLdScriptProps, siteUrl } from "@/lib/seo";
import { splitInline } from "@/lib/notes-public/inline-split";

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
  const title = topicTitle(course, data.topic, hasNote, data.questions.length);
  const description = topicDescription(course, data.topic, hasNote, data.questions.length);
  const path = topicPath(course.id, data.topic);
  const indexable = isTopicIndexable({ note: data.note?.label ?? null, questionCount: data.questions.length, indexDrafts: indexDrafts() });
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

function UnitView({ course, unit }: { course: PublicCourse; unit: PublicUnit }) {
  const i = course.units.findIndex((u) => u.id === unit.id);
  const next = course.units[i + 1];
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-8 pt-5 sm:px-6 sm:pt-8">
      <Breadcrumbs crumbs={crumbsFor.unit(course, unit)} />
      <header className="mt-4">
        <p className="text-[13px] font-semibold text-muted-foreground">{course.title}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[32px]">{unitTitle(course, unit)}</h1>
        <p className="mt-2 text-[15.5px] text-muted-foreground">
          {unit.topics.length} topics · notes and exam-style practice questions with worked answers
        </p>
      </header>
      <TopicList courseId={course.id} topics={unit.topics} />
      <div className="mt-8 flex flex-wrap gap-3 text-[14.5px] font-semibold">
        <Link href={coursePath(course.id)} className="text-accent hover:text-accent-dim">
          ← All {course.title} units
        </Link>
        {next && (
          <Link href={unitPath(course.id, next)} className="ml-auto text-accent hover:text-accent-dim">
            Next: {next.code} {next.name} →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Topic ------------------------------- */

const levelOf = (t: { hlOnly?: boolean }) => (t.hlOnly ? ("HL" as const) : undefined);

function questionCard(q: PublicQuestion, number: number, placement: "inline" | "practice") {
  return (
    <PracticeCard
      key={q.id}
      id={q.id}
      number={number}
      difficulty={q.difficulty}
      commandTerm={q.commandTerm}
      marks={q.marks}
      correctIndex={q.correctIndex}
      placement={placement}
      stem={<RichText text={q.stem} />}
      options={q.options.map((o, i) => (
        <RichText key={i} text={o} />
      ))}
      explanation={<RichText text={q.explanation} />}
    />
  );
}

function TopicView({ course, unit, data }: { course: PublicCourse; unit: PublicUnit; data: PublicTopic }) {
  const { topic, note, questions } = data;
  const path = topicPath(course.id, topic);
  const { prev, next } = neighbours(course.units, topic.id);
  const related = unit.topics.filter((t) => t.id !== topic.id).slice(0, 8);
  const { inline, rest } = splitInline(note?.content.sections.length ?? 0, questions);
  const order = [...[...inline.entries()].sort((a, b) => a[0] - b[0]).map(([, q]) => q), ...rest];
  const ids = order.map((q) => q.id);
  const signupHref = `/signup?from=notes&course=${encodeURIComponent(course.id)}&topic=${encodeURIComponent(topic.id)}`;
  const locale = note?.content.locale ?? (course.board === "AP" ? "en-US" : "en-GB");
  const after = new Map<number, ReactNode>(
    [...inline.entries()].map(([slot, q]) => [slot, <div key={q.id} className="mt-8">{questionCard(q, ids.indexOf(q.id) + 1, "inline")}</div>]),
  );
  const level = levelOf(topic);

  return (
    <PracticeProvider courseId={course.id} topicId={topic.id} questionIds={ids} signupHref={signupHref}>
      {questions.length > 0 && (
        <script
          {...jsonLdScriptProps(topicQuizJsonLd({ siteUrl, path, course, topic, questions: order, locale }))}
        />
      )}
      <div className="mx-auto w-full max-w-[720px] lg:grid lg:max-w-[1000px] lg:grid-cols-[minmax(0,720px)_220px] lg:gap-10">
        <article className="min-w-0 px-4 pb-8 pt-5 sm:px-6 sm:pt-8 lg:px-0">
          <Breadcrumbs crumbs={crumbsFor.topic(course, unit, topic)} />
          <header className="mt-4">
            <p className="text-[13px] font-medium text-muted-foreground">
              {course.title} · {unitTitle(course, unit)}
            </p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.015em] sm:text-[32px]">
              <span className="text-faint">{topic.code}</span> {topic.name}
            </h1>
            <p className="mt-1 text-[15px] font-semibold text-muted-foreground">
              {note ? "Notes" : "Topic outline"}
              {questions.length ? ` and ${questions.length} practice questions with answers` : ""}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {note && (
                <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${note.label === "reviewed" ? "bg-accent-soft text-accent-dim" : "bg-muted text-muted-foreground"}`}>
                  {note.label === "reviewed" ? "Scribe notes · reviewed" : "Scribe notes · draft"}
                </span>
              )}
              {topic.hlOnly && <span className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">HL only</span>}
              {topic.bcOnly && <span className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">BC only</span>}
              {topic.higherTierOnly && <span className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground">Higher tier</span>}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="header" />
              {questions.length > 0 && (
                <a href="#practice" className="inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-card px-5 text-[15px] font-semibold hover:border-accent hover:text-accent">
                  Jump to {questions.length} practice questions
                </a>
              )}
            </div>
          </header>

          {note ? (
            <>
              <div className="mt-6 lg:hidden">
                <NoteToc note={note.content} variant="bar" />
              </div>
              <div className="mt-5 lg:mt-6">
                <PublicNoteBody note={note.content} after={after} />
              </div>
            </>
          ) : (
            <>
              <section className="mt-7" aria-labelledby="h-objectives">
                <h2 id="h-objectives" className="text-[19px] font-semibold sm:text-[21px]">
                  What this topic covers
                </h2>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 marker:text-faint">
                  {topic.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[14.5px] text-muted-foreground">Scribe&apos;s note for this topic is on its way.</p>
              </section>
              <SignedInNoteFallback courseId={course.id} topicId={topic.id} />
            </>
          )}

          {questions.length > 0 && (
            <section id="practice" className="mt-12 scroll-mt-4 border-t border-border pt-8" aria-labelledby="h-practice">
              <h2 id="h-practice" className="text-[21px] font-bold leading-snug sm:text-[24px]">
                Practice this topic
              </h2>
              <p className="mt-1 text-[14.5px] text-muted-foreground">
                {`${questions.length} quick-fire multiple-choice questions, easy to hard. `}Tap an answer to see if you&apos;re right and the worked explanation.
                {note?.content.recall.length ? " (The written questions with mark schemes are under “Check your recall” above.)" : ""}
              </p>
              <div className="mt-4">
                <PracticeScore inlineCount={inline.size} />
              </div>
              <div className="mt-4 flex flex-col gap-4">{rest.map((q) => questionCard(q, ids.indexOf(q.id) + 1, "practice"))}</div>
              <div className="mt-6">
                <PracticeDone
                  nextTopic={
                    next ? (
                      <Link href={topicPath(course.id, next)} className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-dim">
                        Next topic: {next.code} {next.name} →
                      </Link>
                    ) : null
                  }
                  quick5={<StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="practice_end" variant="secondary" />}
                />
              </div>
            </section>
          )}

          <nav aria-label="More topics" className="mt-12 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 text-[15px] font-semibold sm:flex-row sm:justify-between">
              {prev ? (
                <Link href={topicPath(course.id, prev)} className="text-muted-foreground hover:text-accent">
                  ← {prev.code} {prev.name}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={topicPath(course.id, next)} className="text-accent hover:text-accent-dim sm:text-right">
                  Next topic: {next.code} {next.name} →
                </Link>
              )}
            </div>
            {related.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[13px] font-semibold text-muted-foreground">
                  More in{" "}
                  <Link href={unitPath(course.id, unit)} className="text-accent hover:text-accent-dim">
                    {unitTitle(course, unit)}
                  </Link>
                </p>
                <div className="mt-2">
                  <TopicList courseId={course.id} topics={related} compact />
                </div>
              </div>
            )}
            <p className="mt-4 text-[13px]">
              <Link href={coursePath(course.id)} className="font-semibold text-accent hover:text-accent-dim">
                All {course.title} topics
              </Link>
            </p>
          </nav>

          <footer className="mt-8 flex flex-col gap-1 text-[12.5px] leading-snug text-faint">
            {note && (
              <p>
                {note.label === "reviewed"
                  ? "Written by Scribe and checked by a subject reviewer."
                  : "Draft: written by Scribe and checked automatically, not yet by a subject reviewer."}
              </p>
            )}
            {questions.length > 0 && <p>Practice questions are original, written by Scribe and checked automatically for correctness.</p>}
            <p>Topic codes follow the official numbering. Not endorsed by {course.boardName} or any exam board.</p>
          </footer>
        </article>
        {note && (
          <aside className="hidden pt-[150px] lg:block">
            <NoteToc note={note.content} variant="rail" />
          </aside>
        )}
      </div>
    </PracticeProvider>
  );
}
