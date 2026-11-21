import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { familyFor, familyVars } from "@/lib/subject-family";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { PublicNoteBody } from "@/components/notes-public/public-note-body";
import { RichText } from "@/components/notes-public/rich-text";
import { TopicList } from "@/components/notes-public/topic-list";
import { PracticeCard, PracticeDone, PracticeProvider, PracticeScore, StartQuick5 } from "@/components/notes-public/practice";
import { SignedInNoteFallback } from "@/components/notes-public/signed-in-fallback";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { ReadingPill, ReadingRail, ReadingTracker, type RailEntry } from "@/components/notes-public/reading-progress";
import { unitTitle } from "@/lib/courses";
import type { PublicCourse, PublicQuestion, PublicTopic, PublicTopicRow, PublicUnit } from "@/lib/api/public-notes";
import { coursePath, neighbours, topicPath, unitPath } from "@/lib/notes-public/slug";
import { crumbsFor, lockedPageJsonLd, topicQuizJsonLd, topicTitle } from "@/lib/notes-public/seo";
import { isLocked, lockedBadge } from "@/lib/notes-public/gate";
import { LockedTopicGate } from "@/components/notes-public/locked-topic";
import { LockedQuestions, UnlockPanel } from "@/components/notes-public/unlock-panel";
import { jsonLdScriptProps, siteUrl } from "@/lib/seo";
import { splitInline } from "@/lib/notes-public/inline-split";
import { topicKey } from "@/lib/notes-public/progress";
import { readingMinutes } from "@/lib/notes-public/reading";
import { cn } from "@/lib/utils";

/**
 * One topic's note page: the subject band, the note (numbered sections,
 * highlights, figures, worked examples, recall), quick checks between
 * sections, the practice block and its end card, then the way on. Shared by
 * the public page (app/notes/[courseId]/[topicId], server-rendered for
 * search) and the reader inside the signed-in app (app/library/…), so the two
 * read the same. `app` switches what differs for a signed-in reader inside
 * the app shell: links stay in the app, there is no SEO markup, the header
 * carries the app's actions, and practice answers are reported to the caller.
 */

/** Where the links of a topic page lead (public /notes/… or the in-app library). */
export interface NotePaths {
  course: (courseId: string) => string;
  unit: (courseId: string, unit: Pick<PublicUnit, "id" | "name">) => string;
  topic: (courseId: string, topic: Pick<PublicTopicRow, "id" | "code" | "name">) => string;
}

export const PUBLIC_NOTE_PATHS: NotePaths = { course: coursePath, unit: unitPath, topic: topicPath };

export interface AppReaderProps {
  paths: NotePaths;
  /** Replaces the breadcrumbs (which carry JSON-LD for search). */
  top?: ReactNode;
  /** Buttons on the band (start a session, add to a subject). */
  headerActions?: ReactNode;
  /** Under the note / practice: the signed-in way on (start a session on this topic). */
  finish?: ReactNode;
  /** Shown instead of the note when Scribe has none for this topic yet. */
  emptyNote?: ReactNode;
  /** A practice question was answered (the caller records it for the Mistakes list). */
  onAnswer?: (questionId: string, choice: number, correct: boolean) => void;
}

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

const WIDE_PUBLIC = {
  grid: "lg:mt-12 lg:grid lg:grid-cols-[minmax(0,700px)_300px] lg:justify-between lg:gap-12",
  flush: "lg:mt-0",
  rail: "hidden lg:block",
  hide: "lg:hidden",
};
const WIDE_IN_APP = {
  grid: "min-[1360px]:mt-10 min-[1360px]:grid min-[1360px]:grid-cols-[minmax(0,700px)_280px] min-[1360px]:justify-between min-[1360px]:gap-10",
  flush: "min-[1360px]:mt-0",
  rail: "hidden min-[1360px]:block",
  hide: "min-[1360px]:hidden",
};

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

export function TopicView({ course, unit, data, app }: { course: PublicCourse; unit: PublicUnit; data: PublicTopic; app?: AppReaderProps }) {
  const { topic, note, questions } = data;
  const paths = app?.paths ?? PUBLIC_NOTE_PATHS;
  // The two-column layout (note + "On this page" rail) needs ~1050px of content: the app shell's sidebar takes 256px of the window first.
  const wide = app ? WIDE_IN_APP : WIDE_PUBLIC;
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
  const locked = isLocked(data.access) ? data.access : null;
  const questionCount = locked ? locked.questions : questions.length;
  const title = topicTitle(course, topic, !!note, questionCount);
  const shown = note && locked ? note.content.sections.slice(0, locked.shownSections) : null;
  const hidden = note && locked ? note.content.sections.slice(locked.shownSections) : [];
  const entries: RailEntry[] = note && !locked
    ? [
        ...note.content.sections.map((s) => ({ anchor: `sec-${s.id}`, sectionId: s.id, kind: "section" as const, label: <RichText text={s.heading} /> })),
        ...(note.content.recall.length ? [{ anchor: "sec-recall", kind: "recall" as const, label: "Check your recall" }] : []),
        ...(questions.length ? [{ anchor: "practice", kind: "practice" as const, label: `Practice: ${questions.length} questions` }] : []),
      ]
    : [];
  const nextLink = next ? (
    <Link href={paths.topic(course.id, next)} className="nl-btn">
      Next topic: {next.code} {next.name} <span aria-hidden="true">→</span>
    </Link>
  ) : null;

  // Locked topic (paid gate): the server sent only the preview; this is all of it.
  const lockedBody = locked && (
    <>
      {note && shown && (
        <div className={cn("mt-8", wide.flush)}>
          <PublicNoteBody note={{ ...note.content, sections: shown }} />
        </div>
      )}
      <UnlockPanel
        courseId={course.id}
        topicId={topic.id}
        summary={locked}
        headings={hidden.map((s) => (
          <RichText key={s.id} text={s.heading} />
        ))}
        // "Ask a parent to pay" goes here once that feature (app PR #289) is on main.
        parentSlot={null}
      />
      {questions.length > 0 && (
        <section id="practice" className="mt-16 scroll-mt-4" aria-labelledby="h-practice">
          <div className="nl-panel relative overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" data-nl-reveal="">
            <Image src="/design/cat3-pencil.webp" alt="" width={360} height={400} unoptimized loading="lazy" className="absolute -bottom-2 right-3 h-[92px] w-auto sm:right-7 sm:h-[132px]" />
            <h2 id="h-practice" className="pr-[84px] text-[30px] font-black leading-[1.05] text-foreground sm:pr-[120px] sm:text-[38px]">
              Try {questions.length === 1 ? "a practice question" : `${questions.length} practice questions`}
            </h2>
            <p className="mt-2.5 max-w-[440px] pr-[84px] text-[16px] font-semibold leading-snug text-foreground/75 sm:pr-[120px] sm:text-[17px]">
              Tap an answer to see if you&apos;re right and the worked explanation.
            </p>
          </div>
          <div className="mt-4 flex flex-col">{questions.map((q, i) => questionCard(q, i + 1, "practice"))}</div>
          <div className="mt-4">
            <LockedQuestions courseId={course.id} topicId={topic.id} summary={locked} />
          </div>
        </section>
      )}
    </>
  );

  return (
    <PracticeProvider courseId={course.id} topicId={topic.id} questionIds={ids} signupHref={signupHref} trackView={!app} onAnswer={app?.onAnswer}>
      {!app && questions.length > 0 && (
        <script
          {...jsonLdScriptProps(topicQuizJsonLd({ siteUrl, path, course, topic, questions: order, locale }))}
        />
      )}
      {!app && locked && <script {...jsonLdScriptProps(lockedPageJsonLd({ siteUrl, path, title, locale }))} />}
      {note && !locked && <ReadingTracker topicKey={key} sectionIds={note.content.sections.map((s) => s.id)} anchors={entries.map((e) => e.anchor)} />}
      <article className="mx-auto w-full max-w-[1120px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
        {app ? app.top : <Breadcrumbs crumbs={crumbsFor.topic(course, unit, topic)} />}
        {/* The note's header band: the subject's colour and illustration. The reading body under it stays white and calm. */}
        <header
          className="subject-band nl-band mt-4 px-5 pb-6 pt-5 sm:px-10 sm:pb-9 sm:pt-8 sm:pr-[220px] lg:pr-[340px]"
          style={familyVars(familyFor(`${course.subject} ${course.title}`)) as React.CSSProperties}
        >
          <SubjectArt family={familyFor(`${course.subject} ${course.title}`)} eager />
          {/* Top line, like a paper's: the course and where this sits in it. */}
          <p className="nl-rise flex min-h-[84px] items-center pr-[96px] text-[14px] font-bold leading-snug text-white/90 sm:min-h-0 sm:pr-0">
            <span>
              <span className="font-extrabold text-white">{course.title}</span> · {unitTitle(course, unit)}
            </span>
          </p>
          <h1 className="nl-rise mt-2 text-[34px] font-black leading-[1.04] sm:mt-3 sm:text-[50px] lg:text-[56px]" style={stagger(1)}>
            <span className="text-white/75">{topic.code}</span> {topic.name}
          </h1>
          <p className="nl-rise mt-3 text-[17px] font-semibold leading-[1.4] text-white/95 sm:text-[20px]" style={stagger(2)}>
            {note ? <RichText text={note.content.objectiveLine} /> : "Scribe's note for this topic is on its way. Here is what it covers."}
          </p>
          <ul className="nl-meta nl-rise mt-3.5" style={stagger(3)}>
            {note && !locked && <li>{minutes} min read</li>}
            {note && <li>{locked ? locked.sections : note.content.sections.length} parts</li>}
            {questionCount > 0 && <li>{questionCount} questions</li>}
            {!note && questionCount === 0 && <li>Topic outline</li>}
            {note && <li>{note.label === "reviewed" ? "Reviewed" : "Draft"}</li>}
            {locked ? (
              <li>
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3.5" strokeWidth={2.75} aria-hidden="true" /> {lockedBadge(locked.kind)}
                </span>
              </li>
            ) : (
              topic.hlOnly && <li>HL only</li>
            )}
            {topic.bcOnly && <li>BC only</li>}
            {topic.higherTierOnly && <li>Higher tier</li>}
          </ul>
          <div className="nl-rise mt-5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-3" style={stagger(4)}>
            {app?.headerActions ?? <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="header" />}
            {questions.length > 0 && !locked && (
              <a href="#practice" className="nl-btn-ghost max-sm:!min-h-11 max-sm:!border-0 max-sm:!bg-transparent max-sm:!shadow-none max-sm:underline max-sm:decoration-white/50 max-sm:decoration-2 max-sm:underline-offset-4">
                Jump to the {questions.length} questions
              </a>
            )}
          </div>
        </header>

        <div className={cn("mt-6", wide.grid)}>
          <div id="nl-article" className="min-w-0">
            {locked ? (
              app ? (
                // In the app the data already is this learner's (the server ran the entitlement check): no second look-up.
                lockedBody
              ) : (
                <LockedTopicGate courseId={course.id} topicId={topic.id} kind={locked.kind} signupHref={signupHref}>
                  {lockedBody}
                </LockedTopicGate>
              )
            ) : note ? (
              // The pill is sticky only while the note itself is on screen (the practice section has its own score bar).
              <div>
                <ReadingPill topicKey={key} entries={entries} hideClass={wide.hide} />
                <div className={cn("mt-8", wide.flush)}>
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
                {app ? app.emptyNote : <SignedInNoteFallback courseId={course.id} topicId={topic.id} />}
              </>
            )}

            {questions.length > 0 && !locked && (
              <section id="practice" className="mt-16 scroll-mt-4" aria-labelledby="h-practice">
                <div className="nl-panel relative overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" data-nl-reveal="">
                  <Image src="/design/cat3-pencil.webp" alt="" width={360} height={400} unoptimized loading="lazy" className="absolute -bottom-2 right-3 h-[92px] w-auto sm:right-7 sm:h-[132px]" />
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
                <div className="mt-4 flex flex-col">{rest.map((q) => questionCard(q, ids.indexOf(q.id) + 1, "practice"))}</div>
                <div className="mt-6">
                  <PracticeDone nextTopic={nextLink} quick5={<StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="practice_end" variant="secondary" />} />
                </div>
              </section>
            )}

            {note && questions.length === 0 && !locked && (
              <section className="nl-panel relative mt-16 overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" aria-labelledby="h-finish" data-nl-reveal="">
                <Image src="/design/cat3-cheer.webp" alt="" width={363} height={400} unoptimized loading="lazy" className="absolute right-3 top-4 h-[88px] w-auto sm:right-7 sm:h-[128px]" />
                <h2 id="h-finish" className="pr-[80px] text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">
                  Now make it stick
                </h2>
                <p className="mt-2.5 max-w-[440px] pr-[80px] text-[16px] font-semibold leading-snug text-foreground/75 sm:pr-[120px] sm:text-[17px]">
                  Five quick questions on {topic.name} while it is fresh, or keep going with the next topic.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <StartQuick5 courseId={course.id} topicId={topic.id} level={level} placement="note_cta" />
                  {next && (
                    <Link href={paths.topic(course.id, next)} className="nl-btn-ghost">
                      Next topic: {next.code} {next.name} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </section>
            )}

            {app?.finish}

            <nav aria-label="More topics" className="mt-14">
              <h2 className="text-[22px] font-black leading-tight sm:text-[26px]">Keep going</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {next && (
                  <Link href={paths.topic(course.id, next)} className="nl-card nl-lift group flex items-center gap-3 px-4 py-4 sm:order-2">
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
                  <Link href={paths.topic(course.id, prev)} className="nl-card nl-lift group flex items-center gap-3 px-4 py-4 sm:order-1">
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
                    <Link href={paths.unit(course.id, unit)} className="text-accent hover:text-accent-dim">
                      {unitTitle(course, unit)}
                    </Link>
                  </p>
                  <div className="mt-3">
                    <TopicList courseId={course.id} topics={relatedWindow(unit.topics, topic.id)} compact current={topic.id} hrefFor={app ? (t) => paths.topic(course.id, t) : undefined} />
                  </div>
                </div>
              )}
              <p className="mt-5 text-[14.5px]">
                <Link href={paths.course(course.id)} className="font-extrabold text-accent hover:text-accent-dim">
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
          {note && !locked && (
            <aside className={wide.rail}>
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
