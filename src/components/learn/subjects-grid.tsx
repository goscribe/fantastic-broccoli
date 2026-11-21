"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SubjectTile } from "@/components/learn/subject-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { HOME_TILES_ALL_UP_TO, HOME_TILES_SHOWN, repeatsTitle, titleHints } from "@/lib/subject-tiles";
import { isSubjectFamily } from "@/lib/subject-family";
import { tileSummary, type HomeSubject } from "@/lib/home-action";

/**
 * Every subject as a tile in its own colour: progress over its sessions and
 * the next thing in it. Subjects come most recently active first; a real
 * account can hold dozens, so past a couple of rows the rest fold away
 * behind "Show all N".
 */
export function SubjectsGrid({ subjects, loading = false, onNew }: { subjects: HomeSubject[]; loading?: boolean; onNew: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const hints = useMemo(() => titleHints(subjects), [subjects]);
  const many = subjects.length > HOME_TILES_ALL_UP_TO;
  const tiles = many ? subjects.slice(0, HOME_TILES_SHOWN) : subjects;
  const rest = many ? subjects.slice(HOME_TILES_SHOWN) : [];
  const summary = (s: HomeSubject) => tileSummary(s, hints.get(s.id), repeatsTitle);
  const stored = (s: HomeSubject) => (isSubjectFamily(s.subjectFamily) ? s.subjectFamily : undefined);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-[20px] font-extrabold">
          Your subjects <span className="font-medium text-faint">· {subjects.length}</span>
        </h2>
        <button type="button" onClick={onNew} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-control)] border border-border bg-card px-4 text-[13.5px] font-bold text-foreground hover:border-border-strong sm:h-10">
          New subject
        </button>
      </div>
      {/* The colour on this page lives in the tiles. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3">
        {loading && subjects.length === 0 && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[156px] rounded-[var(--r-card)] sm:h-[176px]" />)}
        {tiles.map((s) => (
          <SubjectTile key={s.id} href={`/workspace/${s.id}`} title={s.title} stored={stored(s)} seed={s.id} {...summary(s)} />
        ))}
        {!many && !loading && (
          <button type="button" onClick={onNew} className="hidden h-[176px] flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border-2 border-dashed border-border text-center hover:border-border-strong hover:bg-muted/40 sm:flex">
            <Image src="/design/cat3-sleep.webp" alt="" width={401} height={400} unoptimized className="cat-bob h-14 w-auto" />
            <div className="text-[14px] font-semibold">New subject</div>
            <div className="text-[12px] text-faint">Drop notes, get sessions</div>
          </button>
        )}
      </div>
      {rest.length > 0 && (
        <>
          {/* The rest as short rows in the same colours: thirty subjects stay a list you can scan, not a wall of cards. */}
          {showAll && (
            <div id="all-subjects" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {rest.map((s) => (
                <SubjectTile key={s.id} row href={`/workspace/${s.id}`} title={s.title} stored={stored(s)} seed={s.id} sub={summary(s).sub} className="h-[76px]" />
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              aria-controls="all-subjects"
              className="inline-flex h-11 items-center gap-1.5 rounded-[var(--r-control)] border border-border bg-card px-4 text-[13.5px] font-bold text-foreground hover:border-border-strong sm:h-10"
            >
              {showAll ? (
                <>
                  Show fewer <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  Show all {subjects.length} <ChevronDown className="size-4" />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
