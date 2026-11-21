"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { loadNoteCourse, useLoaded } from "@/components/notes-app/data";
import type { Course, CourseLevel } from "@/lib/api/courses";
import type { PublicTopicRow, PublicUnit } from "@/lib/api/public-notes";
import { unitTitle } from "@/lib/courses";
import { defaultNotesSelection } from "@/lib/notes-offer";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";

export interface NotesOfferSelection {
  unit: PublicUnit;
  topics: PublicTopicRow[];
}

/**
 * First run, after a course is picked: Scribe's notes for it, offered as
 * ready-made material, with one action: "Start with Scribe's notes" makes the
 * subject with the first unit's notes in it and starts a Quick 5 on the first
 * topic. Onboarding ends in practice, not in reading: the note is one tap
 * away from the session and the subject afterwards. Renders nothing when the
 * course has no notes yet or they cannot be loaded.
 */
export function NotesOffer({
  course,
  level,
  disabled,
  onOffered,
  onAccept,
}: {
  course: Course;
  level?: CourseLevel;
  disabled?: boolean;
  /** Called once per course when the offer is actually shown. */
  onOffered: (noteCount: number) => void;
  onAccept: (selection: NotesOfferSelection) => void;
}) {
  const { t } = useI18n();
  const outline = useLoaded(`course:${course.id}`, () => loadNoteCourse(course.id));
  const selection = useMemo(() => (outline.state === "ready" && outline.data ? defaultNotesSelection(outline.data.units, level) : null), [outline, level]);
  const offered = useRef<string | null>(null);
  useEffect(() => {
    if (!selection || offered.current === course.id) return;
    offered.current = course.id;
    onOffered(selection.topics.length);
  }, [selection, course.id, onOffered]);

  if (!selection) return null;
  const count = selection.topics.length;
  return (
    <>
      <section className="mt-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="first-run-notes-title">
        <div className="flex items-start gap-3">
          <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized className="h-[58px] w-auto shrink-0" />
          <div className="min-w-0">
            <h3 id="first-run-notes-title" className="text-[16px] font-extrabold leading-snug">
              {t("firstRun.notesTitle").replace("{course}", course.title)}
            </h3>
            <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
              {t(count === 1 ? "firstRun.notesBodyOne" : "firstRun.notesBody")
                .replace("{unit}", unitTitle(course, selection.unit))
                .replace("{count}", String(count))}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAccept(selection)}
          disabled={disabled}
          className="mt-3.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
        >
          {t("firstRun.notesStart")}
          <ArrowRight className="size-4" />
        </button>
      </section>
      <p className="mt-5 text-[13px] font-semibold text-muted-foreground">{t("firstRun.notesOr")}</p>
    </>
  );
}
