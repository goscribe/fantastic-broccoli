import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/notes-public/breadcrumbs";
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
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 pb-8 pt-5 sm:px-6 sm:pt-8">
      <Breadcrumbs crumbs={crumbsFor.index()} />
      <header className="mt-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]">Free notes and practice questions</h1>
          <p className="mt-2 max-w-[620px] text-[15.5px] leading-snug text-muted-foreground sm:text-[17px]">
            Pick your course, read Scribe&apos;s note for a topic, then answer exam-style questions with worked explanations. No sign-up needed.
          </p>
        </div>
        <Image src="/design/cat2-book.png" alt="" width={120} height={130} priority unoptimized className="hidden h-[120px] w-auto shrink-0 sm:block" />
      </header>
      {groups.map((g) => (
        <section key={g.board} className="mt-10" aria-labelledby={`b-${g.board}`}>
          <h2 id={`b-${g.board}`} className="text-[19px] font-bold sm:text-[21px]">
            {BOARD_LABEL[g.board]}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.courses.map((c) => (
              <li key={c.id}>
                <Link href={coursePath(c.id)} className="flex h-full flex-col rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent">
                  <span className="text-[16px] font-bold leading-snug">{c.title}</span>
                  <span className="mt-1 text-[13.5px] text-muted-foreground">
                    {c.topicCount} topics
                    {c.noteCount > 0 && ` · ${c.noteCount} notes`}
                    {c.questionCount > 0 && ` · ${c.questionCount} questions`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
