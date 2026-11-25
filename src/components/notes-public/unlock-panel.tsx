"use client";

import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { trackNoteEvent, type LockedSummary } from "@/lib/api/public-notes";
import { insideItems, paywallHref, unlockLead } from "@/lib/notes-public/gate";

/**
 * The calm "unlock" panel on a locked topic: the headings of the sections
 * still to come, what else is inside, and one primary "Try for free" to the
 * paywall. `parentSlot` is where "Ask a parent to pay" goes once that
 * feature is on main (app PR #289); nothing renders there until then.
 * The wrapping `.notes-locked` class is what the page's paywall structured
 * data points at (cssSelector).
 */
export function UnlockPanel({
  courseId,
  topicId,
  summary,
  headings,
  parentSlot,
}: {
  courseId: string;
  topicId: string;
  summary: LockedSummary;
  /** Rendered headings of the sections that are not shown (server-rendered nodes). */
  headings: ReactNode[];
  parentSlot?: ReactNode;
}) {
  const { user } = useAuthUser();
  const items = insideItems(summary);
  const onTry = () =>
    trackNoteEvent("notes.unlock_clicked", courseId, topicId, { placement: "unlock_panel", lockedKind: summary.kind, signedIn: !!user });
  return (
    <section className="notes-locked mt-12" aria-labelledby="h-unlock">
      {headings.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Still to come in this note">
          {headings.map((h, i) => (
            <li key={i} className="nl-well flex items-start gap-2.5 px-4 py-3.5 text-read font-extrabold text-muted-foreground">
              <Lock className="mt-1 size-4 shrink-0 text-faint" strokeWidth={2.5} aria-hidden="true" />
              <span className="min-w-0">{h}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="nl-panel mt-5 px-5 py-6 sm:px-8 sm:py-8">
        <p className="inline-flex items-center gap-1.5 text-small font-extrabold text-muted-foreground">
          <Lock className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
          The rest of this topic
        </p>
        <h2 id="h-unlock" className="mt-2 text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">
          Unlock with a plan or exam pass
        </h2>
        <p className="mt-2.5 max-w-[520px] text-read font-semibold text-foreground/75">{unlockLead(summary.kind)}</p>
        {items.length > 0 && (
          <>
            <p className="mt-5 text-small font-extrabold text-muted-foreground">What&apos;s inside</p>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-read font-semibold text-foreground">
                  <Check className="mt-[3px] size-4 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />
                  {it}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={paywallHref(courseId, topicId)}
            onClick={onTry}
            className="nl-btn"
          >
            Try for free
          </a>
          {parentSlot}
        </div>
        <p className="mt-4 text-small font-semibold text-muted-foreground">Plans start with a free trial. Cancel any time.</p>
      </div>
    </section>
  );
}

/** Stub where the locked practice questions would be: how many, and the same way in. */
export function LockedQuestions({ courseId, topicId, summary }: { courseId: string; topicId: string; summary: LockedSummary }) {
  const { user } = useAuthUser();
  const more = summary.questions - summary.shownQuestions;
  if (more <= 0) return null;
  return (
    <div className="nl-well flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <p className="flex flex-1 items-start gap-2 text-ui font-semibold text-muted-foreground">
        <Lock className="mt-1 size-3.5 shrink-0 text-faint" strokeWidth={2.5} aria-hidden="true" />
        {more} more {more === 1 ? "question" : "questions"} with worked answers come with a plan or exam pass.
      </p>
      <a
        href={paywallHref(courseId, topicId)}
        onClick={() =>
          trackNoteEvent("notes.unlock_clicked", courseId, topicId, { placement: "locked_questions", lockedKind: summary.kind, signedIn: !!user })
        }
        className="nl-btn-ghost nl-btn-sm shrink-0 !bg-card"
      >
        Try for free
      </a>
    </div>
  );
}
