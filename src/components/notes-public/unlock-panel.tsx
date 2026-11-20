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
    <section className="notes-locked mt-9" aria-labelledby="h-unlock">
      {headings.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Still to come in this note">
          {headings.map((h, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-dashed border-border-strong px-4 py-3 text-[16px] font-semibold leading-snug text-muted-foreground sm:text-[17px]">
              <Lock className="mt-1 size-3.5 shrink-0 text-faint" aria-hidden="true" />
              <span className="min-w-0">{h}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-5 rounded-2xl border border-border bg-card px-5 py-5 sm:px-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] font-semibold text-accent-dim">
          <Lock className="size-3.5" aria-hidden="true" />
          The rest of this topic
        </p>
        <h2 id="h-unlock" className="mt-3 text-[20px] font-bold leading-snug sm:text-[22px]">
          Unlock with a plan or exam pass
        </h2>
        <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">{unlockLead(summary.kind)}</p>
        {items.length > 0 && (
          <>
            <p className="mt-4 text-[13px] font-semibold text-muted-foreground">What&apos;s inside</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-[15px] leading-snug">
                  <Check className="mt-[3px] size-4 shrink-0 text-accent" aria-hidden="true" />
                  {it}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={paywallHref(courseId, topicId)}
            onClick={onTry}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim"
          >
            Try for free
          </a>
          {parentSlot}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-faint">Plans start with a free trial. Cancel any time.</p>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <p className="flex flex-1 items-start gap-2 text-[15px] leading-snug text-muted-foreground">
        <Lock className="mt-1 size-3.5 shrink-0 text-faint" aria-hidden="true" />
        {more} more {more === 1 ? "question" : "questions"} with worked answers come with a plan or exam pass.
      </p>
      <a
        href={paywallHref(courseId, topicId)}
        onClick={() =>
          trackNoteEvent("notes.unlock_clicked", courseId, topicId, { placement: "locked_questions", lockedKind: summary.kind, signedIn: !!user })
        }
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-card px-4 text-[14.5px] font-semibold hover:border-accent hover:text-accent"
      >
        Try for free
      </a>
    </div>
  );
}
