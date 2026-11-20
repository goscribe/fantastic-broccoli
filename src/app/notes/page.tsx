import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, PencilLine } from "lucide-react";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { SubjectTile } from "@/components/notes-public/subject-tile";
import { BOARD_LABEL, BOARD_ORDER } from "@/lib/courses";
import { getCourses } from "@/lib/notes-public/data";
import { coursePath } from "@/lib/notes-public/slug";
import { crumbsFor, INDEX_DESCRIPTION, INDEX_TITLE } from "@/lib/notes-public/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: INDEX_TITLE,
  description: INDEX_DESCRIPTION,
  alternates: { canonical: "/notes" },
  openGraph: { type: "website", title: `${INDEX_TITLE} | Scribe`, description: INDEX_DESCRIPTION, url: "/notes" },
  twitter: { card: "summary_large_image", title: `${INDEX_TITLE} | Scribe`, description: INDEX_DESCRIPTION },
};

export default async function NotesIndexPage() {
  const courses = await getCourses();
  const groups = BOARD_ORDER.map((board) => ({ board, courses: courses.filter((c) => c.board === board) })).filter((g) => g.courses.length);
  const notes = courses.reduce((a, c) => a + c.noteCount, 0);
  const questions = courses.reduce((a, c) => a + c.questionCount, 0);
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.index()} />
      <header className="nl-panel relative mt-4 overflow-hidden px-5 pb-6 pt-6 sm:px-10 sm:py-11 lg:pr-[360px]">
        <div className="absolute right-4 top-4 grid size-[84px] place-items-center rounded-full bg-white sm:right-8 sm:top-8 sm:size-[120px] lg:right-16 lg:top-1/2 lg:size-[230px] lg:-translate-y-1/2">
          <Image src="/design/cat2-book.png" alt="" width={240} height={260} priority unoptimized className="nl-cat-in h-[74px] w-auto sm:h-[104px] lg:h-[196px]" />
        </div>
        <p className="nl-rise pr-[96px] text-[14px] font-extrabold text-accent sm:pr-[140px] lg:pr-0">Scribe notes · free, no sign-up</p>
        <h1 className="nl-rise mt-2 pr-[92px] text-[34px] font-black leading-[1.04] text-foreground sm:pr-[140px] sm:text-[52px] lg:pr-0" style={{ "--i": 1 } as React.CSSProperties}>
          Free notes and practice questions
        </h1>
        <p className="nl-rise mt-3.5 max-w-[600px] text-[17px] font-semibold leading-snug text-[#3b3650] sm:text-[19px]" style={{ "--i": 2 } as React.CSSProperties}>
          Pick your course, read Scribe&apos;s note for a topic, then answer exam-style questions with worked explanations. No sign-up needed.
        </p>
        <ul className="nl-rise mt-5 flex flex-wrap gap-2" style={{ "--i": 3 } as React.CSSProperties}>
          <li className="nl-chip">
            <GraduationCap aria-hidden="true" />
            {courses.length} courses
          </li>
          {notes > 0 && (
            <li className="nl-chip">
              <BookOpen aria-hidden="true" />
              {notes} topic notes
            </li>
          )}
          {questions > 0 && (
            <li className="nl-chip">
              <PencilLine aria-hidden="true" />
              {questions.toLocaleString("en-GB")} questions
            </li>
          )}
        </ul>
        {groups.length > 1 && (
          <nav aria-label="Exam boards" className="nl-rise mt-5 flex flex-wrap gap-2.5" style={{ "--i": 4 } as React.CSSProperties}>
            {groups.map((g) => (
              <a key={g.board} href={`#b-${g.board}`} className="nl-btn-ghost nl-btn-sm">
                {BOARD_LABEL[g.board]}
              </a>
            ))}
          </nav>
        )}
      </header>
      {groups.map((g) => (
        <section key={g.board} className="mt-11 scroll-mt-6" aria-labelledby={`b-${g.board}`}>
          <h2 id={`b-${g.board}`} className="flex items-baseline gap-2.5 text-[24px] font-black sm:text-[28px]">
            {BOARD_LABEL[g.board]}
            <span className="text-[14px] font-bold tracking-normal text-muted-foreground">
              {g.courses.length} {g.courses.length === 1 ? "course" : "courses"}
            </span>
          </h2>
          <ul className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {g.courses.map((c) => (
              <li key={c.id}>
                <Link href={coursePath(c.id)} data-nl-course={c.id} data-total={c.topicCount} className="nl-card nl-lift group flex h-full flex-col px-4 pb-4 pt-4">
                  <span className="flex items-center gap-3.5">
                    <SubjectTile title={`${c.subject} ${c.title}`} className="size-[54px] rounded-[18px]" iconClassName="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] font-extrabold leading-tight text-foreground">{c.title}</span>
                      <span className="mt-0.5 block text-[13.5px] font-semibold text-muted-foreground">
                        {c.topicCount} topics
                        {c.levels?.length ? ` · ${c.levels.join(" & ")}` : ""}
                      </span>
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white" aria-hidden="true">
                      <ArrowRight className="size-4.5" strokeWidth={2.75} />
                    </span>
                  </span>
                  <span className="mt-4 flex flex-wrap gap-1.5 text-[12.5px] font-extrabold">
                    {c.noteCount > 0 && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-dim">{c.noteCount} notes</span>}
                    {c.questionCount > 0 && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-dim">{c.questionCount} questions</span>}
                    {c.noteCount === 0 && c.questionCount === 0 && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Topic outlines</span>}
                  </span>
                  <span className="mt-auto block pt-4">
                    <span className="nl-meter block" aria-hidden="true">
                      <span />
                    </span>
                    <span data-nl-count className="mt-1.5 block text-[12.5px] font-bold text-muted-foreground">
                      Not started yet
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <NotesProgress />
    </div>
  );
}
