"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CatalogBoard, CatalogTopic, Course, CourseLevel, CourseSummary } from "@/lib/api/courses";
import { BOARD_ORDER, firstTopic, likelyCourses, localBoardOrder, searchCatalog } from "@/lib/courses";
import { cleanTopic } from "@/lib/first-run";
import { cn } from "@/lib/utils";
import { SubjectTile } from "@/components/learn/subject-tile";
import { TopicRow, loadAllCourses, loadCourse, loadCourses } from "@/components/courses/course-picker";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";
import "@/lib/i18n/courses";

/** Tiles under the question: four on a phone (they fit above the fold with the search), six from there up. */
const TILE_COUNT = 6;
const PHONE_TILES = 4;

/** HL-only topics need HL; everything else starts at the course's default level. */
const levelFor = (course: Course, topic: CatalogTopic): CourseLevel | undefined => (course.levels?.length && topic.hlOnly ? "HL" : undefined);

/**
 * "What are you studying?" answered in one tap: a search over courses and
 * topics, and under it the few courses this student most likely takes (their
 * region's boards, anything the app already knows first) as tiles. A tile is
 * not a step: tapping it starts 5 questions on the course's first topic.
 * Typing finds any of the catalog's courses and topics, and text that matches
 * nothing starts on exactly that.
 */
export function QuickCourses({
  lead,
  onStartCourse,
  onStartTopic,
  onFreeTopic,
  onAllCourses,
  busyCourseId,
}: {
  /** Course ids to put first (what the app knows about this student). */
  lead: string[];
  /** A course tile was tapped: start on its first topic. */
  onStartCourse: (course: CourseSummary) => void;
  /** A topic found by search. */
  onStartTopic: (course: Course, topic: CatalogTopic, level?: CourseLevel) => void;
  onFreeTopic: (text: string) => void;
  /** Opens the whole catalog (units and topics to pick by hand). */
  onAllCourses: (count: number | null) => React.ReactNode;
  busyCourseId: string | null;
}) {
  const { t } = useI18n();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [full, setFull] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  // The browser's region applies once the list has loaded (the server render has no browser).
  const [order, setOrder] = useState<CatalogBoard[]>(BOARD_ORDER);
  /** First topics of the tiles' courses, as their outlines arrive. */
  const [starts, setStarts] = useState<Record<string, string>>({});

  const fetchList = () =>
    loadCourses()
      .then((list) => {
        setCourses(list);
        setOrder(localBoardOrder());
        setFailed(false);
      })
      .catch(() => setFailed(true));
  useEffect(() => {
    void fetchList();
  }, []);

  const tiles = useMemo(() => (courses ? likelyCourses(courses, order, TILE_COUNT, lead) : []), [courses, order, lead]);

  // The tiles' outlines are fetched ahead: the tile can say where it starts, and the tap does not wait for them.
  useEffect(() => {
    let cancelled = false;
    for (const c of tiles) {
      void loadCourse(c.id)
        .then((course) => {
          const name = firstTopic(course)?.topic.name;
          if (!cancelled && name) setStarts((s) => (s[c.id] === name ? s : { ...s, [c.id]: name }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [tiles]);

  /** Topic search needs every outline: fetched once, on the first keystroke. */
  const wantTopics = () => {
    if (full || !courses) return;
    void loadAllCourses(courses).then(setFull);
  };

  const results = useMemo(() => (courses && query.trim() ? searchCatalog(query, courses, full ?? [], order) : null), [courses, full, query, order]);
  const freeText = cleanTopic(query);
  const nothing = !!results && results.courses.length === 0 && results.topics.length === 0;
  const busy = busyCourseId !== null;

  const tile = (c: CourseSummary, eager: boolean) => (
    <SubjectTile
      row
      eager={eager}
      match={c.subject || c.title}
      title={c.title}
      sub={starts[c.id] ? t("firstRun.tileSub").replace("{topic}", starts[c.id]) : t("firstRun.tileSubPlain")}
      onClick={() => onStartCourse(c)}
      disabled={busy}
      className={cn("h-full", busy && busyCourseId !== c.id && "opacity-60")}
      trailing={
        busyCourseId === c.id ? (
          <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-white">
            <Loader2 className="size-4 animate-spin text-[var(--tile-a)]" />
          </span>
        ) : undefined
      }
    />
  );

  return (
    <div className="w-full">
      <label htmlFor="first-run-search" className="sr-only">
        {t("course.searchLabel")}
      </label>
      <input
        id="first-run-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          wantTopics();
        }}
        onFocus={wantTopics}
        onKeyDown={(e) => {
          if (e.key === "Enter" && nothing && freeText.length >= 2) onFreeTopic(freeText);
        }}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t("firstRun.searchPlaceholder")}
        className="h-[52px] w-full rounded-[var(--r-button)] border border-border-strong bg-card px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
      />

      {failed && (
        <p role="alert" className="mt-3 text-small text-rose">
          {t("course.errorLoad")}{" "}
          <button type="button" onClick={() => void fetchList()} className="font-semibold underline">
            {t("course.retry")}
          </button>
        </p>
      )}

      {results ? (
        <div className="mt-4 flex flex-col gap-5" aria-live="polite">
          {results.courses.length > 0 && (
            <ul className="grid gap-2.5 sm:grid-cols-2" aria-label={t("course.searchCourses")}>
              {results.courses.slice(0, 6).map((c) => (
                <li key={c.id}>{tile(c, false)}</li>
              ))}
            </ul>
          )}
          {results.topics.length > 0 && (
            <section>
              <h2 className="mb-2 text-ui font-extrabold">{t("course.searchTopics")}</h2>
              <ul className="flex flex-col gap-1.5">
                {results.topics.map(({ course: c, topic }) => (
                  <li key={`${c.id}-${topic.id}`}>
                    <TopicRow topic={topic} context={c.title} onStart={() => onStartTopic(c, topic, levelFor(c, topic))} disabled={busy} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!full && results.topics.length === 0 && query.trim().length >= 2 && (
            <div className="flex items-center gap-2 text-small text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t("course.searchTopics")}…
            </div>
          )}
          {freeText.length >= 2 &&
            (full && nothing ? (
              // Nothing in the catalog matches: questions on exactly what they typed is the one thing to do.
              <div>
                <button type="button" onClick={() => onFreeTopic(freeText)} disabled={busy} className={buttonClass({ size: "lg", className: "h-auto min-h-[52px] w-full whitespace-normal py-3 leading-snug [overflow-wrap:anywhere]" })}>
                  {t("course.freeTopic").replace("{text}", freeText)}
                </button>
                <p className="mt-2 text-small text-muted-foreground">{t("course.freeTopicHint")}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onFreeTopic(freeText)}
                disabled={busy}
                className="flex min-h-[52px] w-full flex-col items-start justify-center gap-0.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-border-strong"
              >
                <span className="text-ui font-semibold [overflow-wrap:anywhere]">{t("course.freeTopic").replace("{text}", freeText)}</span>
                <span className="text-caption text-muted-foreground">{t("course.freeTopicAlso")}</span>
              </button>
            ))}
        </div>
      ) : (
        <>
          {!courses && !failed && (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2" aria-busy="true">
              {Array.from({ length: TILE_COUNT }, (_, i) => (
                <div key={i} className={cn("h-[76px] animate-pulse rounded-[var(--r-card)] bg-muted", i >= PHONE_TILES && "hidden sm:block")} />
              ))}
            </div>
          )}
          {courses && (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2" aria-label={t("firstRun.tilesLabel")}>
              {tiles.map((c, i) => (
                <li key={c.id} className={cn(i >= PHONE_TILES && "hidden sm:block")}>
                  {tile(c, true)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {onAllCourses(courses ? courses.length : null)}
    </div>
  );
}
