import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { PublicNoteBody } from "@/components/notes-public/public-note-body";
import { RichText } from "@/components/notes-public/rich-text";
import { TopicList } from "@/components/notes-public/topic-list";
import { PracticeCard, PracticeDone, PracticeProvider, PracticeScore, StartQuick5 } from "@/components/notes-public/practice";
import { SignedInNoteFallback } from "@/components/notes-public/signed-in-fallback";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { ReadingPill, ReadingRail, ReadingTracker, type RailEntry } from "@/components/notes-public/reading-progress";
import { unitTitle } from "@/lib/courses";
import type { PublicCourse, PublicQuestion, PublicTopic, PublicUnit } from "@/lib/api/public-notes";
import { getCourse, getTopic, indexDrafts, rowIndexable } from "@/lib/notes-public/data";
import { coursePath, neighbours, resolveSegment, topicPath, unitPath } from "@/lib/notes-public/slug";
import { crumbsFor, isTopicIndexable, topicDescription, topicQuizJsonLd, topicTitle, unitTitleSeo } from "@/lib/notes-public/seo";
import { jsonLdScriptProps, siteUrl } from "@/lib/seo";
import { splitInline } from "@/lib/notes-public/inline-split";
import { topicKey } from "@/lib/notes-public/progress";
import { readingMinutes } from "@/lib/notes-public/reading";

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

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function UnitView({ course, unit }: { course: PublicCourse; unit: PublicUnit }) {
  const i = course.units.findIndex((u) => u.id === unit.id);
  const next = course.units[i + 1];
  const notes = unit.topics.filter((t) => t.note).length;
  const first = unit.topics.find((t) => t.note) ?? unit.topics[0];
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.unit(course, unit)} />
      <header className="nl-panel relative mt-4 overflow-hidden px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-8">
        <Image src="/design/cat2-book.png" alt="" width={240} height={260} priority unoptimized className="nl-cat-in absolute right-4 top-4 h-[84px] w-auto sm:right-9 sm:top-8 sm:h-[128px]" />
        <p className="nl-rise pr-[92px] text-[14px] font-extrabold text-foreground sm:pr-[150px]">{course.title}</p>
        <h1 className="nl-rise mt-2 text-balance pr-[92px] text-[30px] font-black leading-[1.06] text-foreground sm:pr-[150px] sm:text-[42px]" style={stagger(1)}>
          {unitTitle(course, unit)}
        </h1>
        <p className="nl-rise mt-3 text-[16.5px] font-semibold leading-snug text-foreground/75 sm:text-[18px]" style={stagger(2)}>
          Notes and exam-style practice questions with worked answers
        </p>
        <ul className="nl-meta nl-rise mt-3" style={stagger(3)}>
          <li>{unit.topics.length} topics</li>
          {notes > 0 && <li>{notes} notes</li>}
        </ul>
        {first && (
          <Link href={topicPath(course.id, first)} className="nl-btn nl-rise mt-5 w-full sm:w-auto" style={stagger(4)}>
            Start with {first.code} {first.name} <span aria-hidden="true">→</span>
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
  const { inline, rest } = splitInline(note?.content.sections.length ?? 0, questions);
  const order = [...[...inline.entries()].sort((a, b) => a[0] - b[0]).map(([, q]) => q), ...rest];
  const ids = order.map((q) => q.id);
  const signupHref = `/signup?from=notes&course=${encodeURIComponent(course.id)}&topic=${encodeURIComponent(topic.id)}`;
  const locale = note?.content.locale ?? (course.board === "AP" ? "en-US" : "en-GB");
  const after = new Map<number, ReactNode>(
    [...inline.entries()].map(([slot, q]) => [slot, <div key={q.id} className="mt-12">{questionCard(q, ids.indexOf(q.id) + 1, "inline")}</div>]),
  );
  const level = levelOf(topic);
  const key = topicKey(course.id, topic.id);
  const minutes = note ? readingMinutes(note.content) : 0;
  const entries: RailEntry[] = note
    ? [
        ...note.content.sections.map((s) => ({ anchor: `sec-${s.id}`, sectionId: s.id, kind: "section" as const, label: <RichText text={s.heading} /> })),
        ...(note.content.recall.length ? [{ anchor: "sec-recall", kind: "recall" as const, label: "Check your recall" }] : []),
        ...(questions.length ? [{ anchor: "practice", kind: "practice" as const, label: `Practice: ${questions.length} questions` }] : []),
      ]
    : [];
  const nextLink = next ? (
    <Link href={topicPath(course.id, next)} className="nl-btn">
      Next topic: {next.code} {next.name} <span aria-hidden="true">→</span>
    </Link>
  ) : null;

  return (
    <PracticeProvider courseId={course.id} topicId={topic.id} questionIds={ids} signupHref={signupHref}>
      {questions.length > 0 && (
        <script
          {...jsonLdScriptProps(topicQuizJsonLd({ siteUrl, path, course, topic, questions: order, locale }))}
        />
      )}
      {note && <ReadingTracker topicKey={key} sectionIds={note.content.sections.map((s) => s.id)} anchors={entries.map((e) => e.anchor)} />}
      <article className="mx-auto w-full max-w-[1120px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
        <Breadcrumbs crumbs={crumbsFor.topic(course, unit, topic)} />
        <header className="nl-panel relative mt-4 overflow-hidden px-5 pb-6 pt-5 sm:px-10 sm:pb-9 sm:pt-8 lg:pr-[340px]">
          <Image
            src={note ? "/design/cat2-book.png" : "/design/cat2-pencil.png"}
            alt=""
            width={240}
            height={260}
            priority
            unoptimized
            className="nl-cat-in absolute right-4 top-4 h-[84px] w-auto sm:right-8 sm:top-8 sm:h-[112px] lg:right-[72px] lg:top-1/2 lg:h-[216px] lg:-translate-y-1/2"
          />
          {/* Top line, like a paper's: the course and where this sits in it. */}
          <p className="nl-rise flex min-h-[84px] items-center pr-[96px] text-[14px] font-bold leading-snug text-foreground/70 sm:min-h-0 sm:pr-[150px] lg:pr-0">
            <span>
              <span className="font-extrabold text-foreground">{course.title}</span> · {unitTitle(course, unit)}
            </span>
          </p>
          <h1 className="nl-rise mt-2 text-[34px] font-black leading-[1.04] text-foreground sm:mt-3 sm:text-[50px] lg:text-[56px]" style={stagger(1)}>
            <span className="text-foreground/45">{topic.code}</span> {topic.name}
          </h1>
          <p className="nl-rise mt-3 text-[17px] font-semibold leading-[1.4] text-foreground/80 sm:text-[20px]" style={stagger(2)}>
            {note ? <RichText text={note.content.objectiveLine} /> : "Scribe's note for this topic is on its way. Here is what it covers."}
          </p>
          <ul className="nl-meta nl-rise mt-3.5" style={stagger(3)}>
            {note && <li>{minutes} min read</li>}
            {note && <li>{note.content.sections.length} parts</li>}
            {questions.length > 0 && <li>{questions.length} questions</li>}
            {!note && questions.length === 0 && <li>Topic outline</li>}
            {note && <li>{note.label === "reviewed" ? "Reviewed" : "Draft"}</li>}
            {topic.hlOnly && <li>HL only</li>}
            {topic.bcOnly && <li>BC only</li>}
            {topic.higherTierOnly && <li>Higher tier</li>}
          </ul>
          <div className="nl-rise mt-5 flex flex-col gap-1.5 sm:flex-row sm:gap-3" style={stagger(4)}>
            <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="header" />
            {questions.length > 0 && (
              <a href="#practice" className="nl-btn-ghost max-sm:!min-h-11 max-sm:!border-0 max-sm:!bg-transparent max-sm:!shadow-none max-sm:underline max-sm:decoration-[var(--cream-edge)] max-sm:decoration-2 max-sm:underline-offset-4">
                Jump to the {questions.length} questions
              </a>
            )}
          </div>
        </header>

        <div className="mt-6 lg:mt-12 lg:grid lg:grid-cols-[minmax(0,700px)_300px] lg:justify-between lg:gap-12">
          <div id="nl-article" className="min-w-0">
            {note ? (
              // The pill is sticky only while the note itself is on screen (the practice section has its own score bar).
              <div>
                <ReadingPill topicKey={key} entries={entries} />
                <div className="mt-8 lg:mt-0">
                  <PublicNoteBody note={note.content} after={after} />
                </div>
              </div>
            ) : (
              <>
                <section className="nl-card mt-2 px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="h-objectives">
                  <h2 id="h-objectives" className="text-[24px] font-extrabold leading-tight sm:text-[28px]">
                    What this topic covers
                  </h2>
                  <div className="nl-prose mt-4">
                    <ul className="nl-bullets flex flex-col gap-2.5">
                      {topic.objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 text-[14.5px] font-semibold text-muted-foreground">Scribe&apos;s note for this topic is on its way.</p>
                </section>
                <SignedInNoteFallback courseId={course.id} topicId={topic.id} />
              </>
            )}

            {questions.length > 0 && (
              <section id="practice" className="mt-16 scroll-mt-4" aria-labelledby="h-practice">
                <div className="nl-panel relative overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" data-nl-reveal="">
                  <Image src="/design/cat2-pencil.png" alt="" width={234} height={262} unoptimized loading="lazy" className="absolute -bottom-2 right-3 h-[92px] w-auto sm:right-7 sm:h-[132px]" />
                  <h2 id="h-practice" className="text-[30px] font-black leading-[1.05] text-foreground sm:text-[38px]">
                    Practice this topic
                  </h2>
                  <p className="mt-2.5 max-w-[440px] pr-[84px] text-[16px] font-semibold leading-snug text-foreground/75 sm:pr-[120px] sm:text-[17px]">
                    {`${questions.length} quick-fire multiple-choice questions, easy to hard. `}Tap an answer to see if you&apos;re right and the worked explanation.
                    {note?.content.recall.length ? " (The written questions with mark schemes are under “Check your recall” above.)" : ""}
                  </p>
                </div>
                <div className="mt-4">
                  <PracticeScore inlineCount={inline.size} />
                </div>
                <div className="mt-4 flex flex-col gap-4">{rest.map((q) => questionCard(q, ids.indexOf(q.id) + 1, "practice"))}</div>
                <div className="mt-6">
                  <PracticeDone nextTopic={nextLink} quick5={<StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="practice_end" variant="secondary" />} />
                </div>
              </section>
            )}

            {note && questions.length === 0 && (
              <section className="nl-panel relative mt-16 overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" aria-labelledby="h-finish" data-nl-reveal="">
                <Image src="/design/cat2-cheer.png" alt="" width={244} height={288} unoptimized loading="lazy" className="absolute right-3 top-4 h-[88px] w-auto sm:right-7 sm:h-[128px]" />
                <h2 id="h-finish" className="pr-[80px] text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">
                  Now make it stick
                </h2>
                <p className="mt-2.5 max-w-[440px] pr-[80px] text-[16px] font-semibold leading-snug text-foreground/75 sm:pr-[120px] sm:text-[17px]">
                  Five quick questions on {topic.name} while it is fresh, or keep going with the next topic.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="note_cta" />
                  {next && (
                    <Link href={topicPath(course.id, next)} className="nl-btn-ghost">
                      Next topic: {next.code} {next.name} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </section>
            )}

            <nav aria-label="More topics" className="mt-14">
              <h2 className="text-[22px] font-black leading-tight sm:text-[26px]">Keep going</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {next && (
                  <Link href={topicPath(course.id, next)} className="nl-card nl-lift group flex items-center gap-3 px-4 py-4 sm:order-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold text-muted-foreground">Next topic</span>
                      <span className="mt-0.5 block text-[17px] font-extrabold leading-snug text-foreground">
                        {next.code} {next.name}
                      </span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 text-accent" strokeWidth={2.75} aria-hidden="true" />
                  </Link>
                )}
                {prev && (
                  <Link href={topicPath(course.id, prev)} className="nl-card nl-lift group flex items-center gap-3 px-4 py-4 sm:order-1">
                    <ArrowLeft className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold text-muted-foreground">Previous topic</span>
                      <span className="mt-0.5 block text-[17px] font-extrabold leading-snug text-foreground">
                        {prev.code} {prev.name}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
              {unit.topics.length > 1 && (
                <div className="mt-8">
                  <p className="text-[14px] font-extrabold text-muted-foreground">
                    More in{" "}
                    <Link href={unitPath(course.id, unit)} className="text-accent hover:text-accent-dim">
                      {unitTitle(course, unit)}
                    </Link>
                  </p>
                  <div className="mt-3">
                    <TopicList courseId={course.id} topics={relatedWindow(unit.topics, topic.id)} compact current={topic.id} />
                  </div>
                </div>
              )}
              <p className="mt-5 text-[14.5px]">
                <Link href={coursePath(course.id)} className="font-extrabold text-accent hover:text-accent-dim">
                  All {course.title} topics →
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
          </div>
          {note && (
            <aside className="hidden lg:block">
              <ReadingRail topicKey={key} entries={entries} />
            </aside>
          )}
        </div>
        <NotesProgress />
      </article>
    </PracticeProvider>
  );
}

/** Up to nine topics of the unit around the current one (which stays in the list, marked). */
function relatedWindow<T extends { id: string }>(topics: T[], id: string): T[] {
  const i = Math.max(0, topics.findIndex((t) => t.id === id));
  const start = Math.max(0, Math.min(i - 4, topics.length - 9));
  return topics.slice(start, start + 9);
}
