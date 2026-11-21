import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { SubjectArt } from "@/components/learn/subject-tile";
import { familyFor, familyVars } from "@/lib/subject-family";
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
      {/* The illustrated scene; the cat is its own image over it, so a new mascot swaps in without redrawing the scene. */}
      <header className="nl-hero relative mt-4 overflow-hidden px-5 pb-6 pt-[148px] sm:px-10 sm:py-11 sm:pr-[300px] lg:pr-[400px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/design/hero/scene.svg" alt="" width={1440} height={960} fetchPriority="high" decoding="async" className="nl-hero__scene" />
        <Image src="/design/cat2-book.png" alt="" width={240} height={260} priority unoptimized className="nl-cat-in absolute right-[16%] top-[26px] h-[104px] w-auto sm:right-[8%] sm:top-auto sm:bottom-[12%] sm:h-[150px] lg:right-[11%] lg:h-[190px]" />
        <h1 className="nl-rise text-[34px] font-black leading-[1.04] text-foreground sm:text-[48px]" style={{ "--i": 1 } as React.CSSProperties}>
          Free notes and practice questions
        </h1>
        <p className="nl-rise mt-3.5 max-w-[600px] text-[17px] font-semibold leading-snug text-foreground/75 sm:text-[19px]" style={{ "--i": 2 } as React.CSSProperties}>
          Pick your course, read Scribe&apos;s note for a topic, then answer exam-style questions with worked explanations. No sign-up needed.
        </p>
        <ul className="nl-meta nl-rise mt-4" style={{ "--i": 3 } as React.CSSProperties}>
          <li>{courses.length} courses</li>
          {notes > 0 && <li>{notes} topic notes</li>}
          {questions > 0 && <li>{questions.toLocaleString("en-GB")} questions</li>}
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
                {/* A course is a tile in its subject's colour with its illustration; progress and the action sit on it. */}
                <Link
                  href={coursePath(c.id)}
                  data-nl-course={c.id}
                  data-total={c.topicCount}
                  className="subject-tile h-full min-h-[184px] p-[18px] sm:p-5"
                  style={familyVars(familyFor(`${c.subject} ${c.title}`)) as React.CSSProperties}
                >
                  <SubjectArt family={familyFor(`${c.subject} ${c.title}`)} />
                  <span className="subject-tile__text block">
                    <span className="block text-[20px] font-extrabold leading-[1.15]">{c.title}</span>
                    <span className="subject-tile__sub mt-1 block text-[13.5px] font-semibold leading-snug">
                      {c.topicCount} topics
                      {c.levels?.length ? ` · ${c.levels.join(" & ")}` : ""}
                    </span>
                    <span className="subject-tile__sub block text-[13.5px] font-semibold leading-snug">
                      {[c.noteCount > 0 ? `${c.noteCount} notes` : null, c.questionCount > 0 ? `${c.questionCount} questions` : null].filter(Boolean).join(" · ") || "Topic outlines"}
                    </span>
                  </span>
                  <span className="mt-4 block">
                    <span className="nl-meter block w-[52%]" aria-hidden="true">
                      <span />
                    </span>
                    <span data-nl-count className="subject-tile__sub mt-1.5 block max-w-[58%] text-[12.5px] font-bold">
                      Not started yet
                    </span>
                    <span className="subject-pill mt-3">
                      Open
                      <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden="true" />
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
