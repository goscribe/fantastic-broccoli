import Link from "next/link";
import { TopicList } from "@/components/notes-public/topic-list";
import { unitTitle } from "@/lib/courses";
import type { PublicCourse, PublicTopicRow, PublicUnit } from "@/lib/api/public-notes";
import { unitPath } from "@/lib/notes-public/slug";

/**
 * A course's units, each with its topics as a path: jump chips, then a
 * numbered section per unit. Used by the public course page and the in-app
 * course view (which passes its own links and has no separate unit pages).
 */
export function CourseUnits({
  course,
  topicHref,
  unitHref = (u) => unitPath(course.id, u),
}: {
  course: PublicCourse;
  topicHref?: (topic: PublicTopicRow) => string;
  /** null: unit headings are not links. */
  unitHref?: ((unit: PublicUnit) => string) | null;
}) {
  return (
    <>
      <nav aria-label="Units" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {course.units.map((u) => (
          <a key={u.id} href={`#u-${u.id}`} className="nl-btn-ghost nl-btn-sm shrink-0">
            {u.code}
          </a>
        ))}
      </nav>
      {course.units.map((u, ui) => (
        <section key={u.id} id={`u-${u.id}`} className="mt-10 scroll-mt-6" aria-labelledby={`uh-${u.id}`}>
          <div className="flex items-start gap-3">
            <span className="nl-secnum mt-0.5 !w-auto min-w-[34px] px-1.5" aria-hidden="true">
              <span>{u.code.length <= 4 ? u.code : ui + 1}</span>
            </span>
            <div className="min-w-0">
              <h2 id={`uh-${u.id}`} className="text-[21px] font-black leading-[1.15] sm:text-[25px]">
                {unitHref ? (
                  <Link href={unitHref(u)} className="hover:underline">
                    {unitTitle(course, u)}
                  </Link>
                ) : (
                  unitTitle(course, u)
                )}
              </h2>
              <p className="mt-0.5 text-[13.5px] font-bold text-muted-foreground">
                {u.topics.length} topics
                {u.topics.some((t) => t.note) ? ` · ${u.topics.filter((t) => t.note).length} notes` : ""}
              </p>
            </div>
          </div>
          <TopicList courseId={course.id} topics={u.topics} hrefFor={topicHref} />
        </section>
      ))}
    </>
  );
}
