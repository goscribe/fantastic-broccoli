import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
import { NotesProgress } from "@/components/notes-public/notes-progress";
import { CourseTile } from "@/components/notes-public/course-tile";
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
  // Nothing published yet (a fresh deploy before the notes are imported): the page says so instead of promising notes.
  const empty = notes === 0 && questions === 0;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 pt-2 sm:px-6 sm:pt-4">
      <Breadcrumbs crumbs={crumbsFor.index()} />
      {/* The landscape behind the headline is lit for the visitor's own time of day (tokens.css reads <html data-daypart>, set by a head script; the markup is the same for everyone, so the page stays static). */}
      {/* Nothing is faded over the scene: a band above the words on phones; from sm up the words sit on one solid card over it. */}
      <header className="nl-hero hero-card relative mt-4 overflow-hidden pt-[var(--banner-band)] sm:flex sm:min-h-[var(--banner-min)] sm:items-center sm:p-4">
        <div aria-hidden="true" className="hero-field nl-hero__field">
          <div className="absolute bottom-[10px] right-[13%] h-[92px] sm:bottom-[10%] sm:right-[6%] sm:h-[66%] sm:max-h-[170px] lg:right-[9%] lg:h-[74%] lg:max-h-[190px]">
            <span className="hero-field__ground" />
            <Image src="/design/cat3-book.webp" alt="" width={363} height={400} priority unoptimized className="nl-cat-in relative h-full w-auto" />
          </div>
        </div>
        <div className="hero-copy relative px-5 pb-5 pt-4 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:w-[62%] sm:max-w-[640px] sm:px-7 sm:py-6">
        <h1 className="text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">
          Free notes and practice questions
        </h1>
        <p className="mt-2 text-ui font-semibold text-foreground/75 sm:text-read sm:leading-snug">
          {empty
            ? "Pick your course to see what each topic covers. Scribe's notes and exam-style practice questions are being added course by course."
            : "Pick your course, read Scribe's note for a topic, then answer exam-style questions with worked explanations. No sign-up needed."}
        </p>
        <ul className="nl-meta mt-3">
          <li>{courses.length} courses</li>
          {notes > 0 && <li>{notes.toLocaleString("en-GB")} topic notes</li>}
          {questions > 0 && <li>{questions.toLocaleString("en-GB")} questions</li>}
        </ul>
        {groups.length > 1 && (
          <nav aria-label="Exam boards" className="mt-4 flex flex-wrap gap-2">
            {groups.map((g) => (
              <a key={g.board} href={`#b-${g.board}`} className="nl-btn-ghost nl-btn-sm">
                {BOARD_LABEL[g.board]}
              </a>
            ))}
          </nav>
        )}
        </div>
      </header>
      {groups.map((g) => (
        <section key={g.board} className="mt-11 scroll-mt-6" aria-labelledby={`b-${g.board}`}>
          <h2 id={`b-${g.board}`} className="flex items-baseline gap-2.5 text-[24px] font-black sm:text-[28px]">
            {BOARD_LABEL[g.board]}
            <span className="text-ui font-bold tracking-normal text-muted-foreground">
              {g.courses.length} {g.courses.length === 1 ? "course" : "courses"}
            </span>
          </h2>
          <ul className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {g.courses.map((c) => (
              <li key={c.id}>
                <CourseTile course={c} href={coursePath(c.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <NotesProgress />
    </div>
  );
}
