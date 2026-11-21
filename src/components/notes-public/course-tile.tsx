import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import type { PublicCourseSummary } from "@/lib/api/public-notes";
import { lockedCountLabel } from "@/lib/notes-public/gate";

/**
 * A course as a tile in its subject's colour with its illustration; what it
 * has, the reader's progress (filled in by NotesProgress) and the action sit
 * on it. Used by the public notes index and the in-app notes library.
 */
export function CourseTile({ course: c, href, sub, stored }: { course: PublicCourseSummary; href: string; /** Replaces the "N topics" line (e.g. the student's level). */ sub?: string; /** The family stored for the student's subject for this course, so the tile matches their subject's. */ stored?: string | null }) {
  const family = resolveSubjectFamily(stored, `${c.subject} ${c.title}`);
  return (
    <Link
      href={href}
      data-nl-course={c.id}
      data-total={c.topicCount}
      className="subject-tile h-full min-h-[184px] p-[18px] sm:p-5"
      style={familyVars(family) as React.CSSProperties}
    >
      <SubjectArt family={family} />
      <span className="subject-tile__text block">
        <span className="block text-[20px] font-extrabold leading-[1.15]">{c.title}</span>
        <span className="subject-tile__sub mt-1 block text-[13.5px] font-semibold leading-snug">
          {sub ?? (
            <>
              {c.topicCount} topics
              {c.levels?.length ? ` · ${c.levels.join(" & ")}` : ""}
            </>
          )}
        </span>
        <span className="subject-tile__sub block text-[13.5px] font-semibold leading-snug">
          {[c.noteCount > 0 ? `${c.noteCount} notes` : null, c.questionCount > 0 ? `${c.questionCount.toLocaleString("en-GB")} questions` : null].filter(Boolean).join(" · ") || "Topic outlines"}
        </span>
        {!!c.lockedCount && (
          <span className="subject-tile__sub mt-0.5 flex items-center gap-1 text-[13px] font-semibold leading-snug">
            <Lock className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            {lockedCountLabel(c.lockedCount, c.lockedKind)}
          </span>
        )}
      </span>
      <span className="mt-4 block">
        {/* A course with nothing to read or answer yet has no progress to show: the meter keeps its space so the tiles in a row still line up. */}
        <span className={c.noteCount + c.questionCount > 0 ? "nl-meter block w-[52%]" : "nl-meter invisible block w-[52%]"} aria-hidden="true">
          <span />
        </span>
        <span data-nl-count={c.noteCount + c.questionCount > 0 ? "" : undefined} className="subject-tile__sub mt-1.5 block max-w-[58%] text-[12.5px] font-bold">
          {c.noteCount + c.questionCount > 0 ? "Not started yet" : "Notes coming soon"}
        </span>
        <span className="subject-pill mt-3">
          Open
          <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
