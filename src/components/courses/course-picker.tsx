"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Loader2, Lock, Minus } from "lucide-react";
import {
  coursesApi,
  type CatalogTopic,
  type CatalogUnit,
  type Course,
  type CourseLevel,
  type CourseSummary,
  type TopicProgress,
} from "@/lib/api/courses";
import { BOARD_LABEL, BOARD_ORDER, groupCourses, localBoardOrder, masteryPercent, searchCatalog, unitTitle, unitsForLevel } from "@/lib/courses";
import { cleanTopic } from "@/lib/first-run";
import { cn } from "@/lib/utils";
import { SubjectBand, SubjectTile } from "@/components/learn/subject-tile";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import "@/lib/i18n/notes";

// One fetch per page load: the catalog is static between deploys.
let listCache: Promise<CourseSummary[]> | null = null;
const courseCache = new Map<string, Promise<Course>>();

export function loadCourses(): Promise<CourseSummary[]> {
  listCache ??= coursesApi.list().catch((err) => {
    listCache = null;
    throw err;
  });
  return listCache;
}

export function loadCourse(id: string): Promise<Course> {
  let hit = courseCache.get(id);
  if (!hit) {
    hit = coursesApi.get(id).catch((err) => {
      courseCache.delete(id);
      throw err;
    });
    courseCache.set(id, hit);
  }
  return hit;
}

/** Every course's outline, for searching topics. Courses that fail to load are left out. */
let allCache: Promise<Course[]> | null = null;
function loadAllCourses(list: CourseSummary[]): Promise<Course[]> {
  allCache ??= Promise.all(list.map((c) => loadCourse(c.id).catch(() => null))).then((cs) => {
    const seen = new Set<string>();
    return cs.filter((c): c is Course => !!c && !seen.has(c.id) && !!seen.add(c.id));
  });
  return allCache;
}

type Step = "course" | "level" | "unit" | "topic";

const row =
  "flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-border-strong";

/** The level a topic found by search starts at: HL-only topics need HL; otherwise the course's default. */
const levelFor = (course: Course, topic: CatalogTopic): CourseLevel | undefined => (course.levels?.length && topic.hlOnly ? "HL" : undefined);

/**
 * One search field over courses and topics, then course → (IB level) → unit
 * → topic. A topic row starts straight away. Boards are ordered for where
 * the student is (US: AP first; UK: GCSE and A-level first; else IB).
 * Course, unit and topic names are the catalog's (English).
 */
export function CoursePicker({
  onStart,
  onFreeTopic,
  busyTopicId,
  enrolledCourseIds,
  unitTop,
}: {
  onStart: (course: Course, topic: CatalogTopic, level?: CourseLevel) => void;
  /** Typed text that matches nothing in the catalog: start on it anyway (first run, new subject). */
  onFreeTopic?: (text: string) => void;
  /** Shown above the unit list once a course (and level) is chosen: first run offers Scribe's notes there. */
  unitTop?: (course: Course, level?: CourseLevel) => React.ReactNode;
  /** Topic whose session is being started (shows a spinner, blocks others). */
  busyTopicId?: string | null;
  enrolledCourseIds?: string[];
}) {
  const { t } = useI18n();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [full, setFull] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<string | null>(null);
  const [level, setLevel] = useState<CourseLevel | undefined>(undefined);
  const [unit, setUnit] = useState<CatalogUnit | null>(null);
  const [step, setStep] = useState<Step>("course");
  const [query, setQuery] = useState("");
  // The browser's region applies once the list has loaded (the server render has no browser).
  const [order, setOrder] = useState(BOARD_ORDER);
  const searchRef = useRef<HTMLInputElement>(null);

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

  /** Topic search needs every outline: fetched once, on the first keystroke. */
  const wantTopics = () => {
    if (full || !courses) return;
    void loadAllCourses(courses).then(setFull);
  };

  const results = useMemo(() => (courses && query.trim() ? searchCatalog(query, courses, full ?? [], order) : null), [courses, full, query, order]);
  const freeText = cleanTopic(query);

  const chooseCourse = (id: string) => {
    setLoadingCourse(id);
    setFailed(false);
    loadCourse(id)
      .then((c) => {
        setCourse(c);
        setUnit(null);
        setStep(c.levels?.length && !level ? "level" : "unit");
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingCourse(null));
  };

  const back = () => {
    if (step === "topic") setStep("unit");
    else if (step === "unit" && course?.levels?.length) setStep("level");
    else setStep("course");
  };

  const heading =
    step === "course" ? t("course.chooseCourse") : step === "level" ? t("course.chooseLevel") : step === "unit" ? t("course.chooseUnit") : t("course.chooseTopic");
  const crumbs = [course?.title, step === "topic" && unit ? unitTitle(course!, unit) : null].filter(Boolean);

  const courseTile = (c: CourseSummary) => (
    <SubjectTile
      row
      match={c.subject || c.title}
      title={c.title}
      sub={
        <>
          {t("course.topicCount").replace("{count}", String(c.topicCount))}
          {enrolledCourseIds?.includes(c.id) ? ` · ${t("course.inYourCourses")}` : ""}
        </>
      }
      onClick={() => chooseCourse(c.id)}
      disabled={!!loadingCourse}
      className={cn("h-full", loadingCourse && loadingCourse !== c.id && "opacity-60")}
      trailing={
        loadingCourse === c.id ? (
          <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-white">
            <Loader2 className="size-4 animate-spin text-[var(--tile-a)]" />
          </span>
        ) : undefined
      }
    />
  );

  return (
    <div className="w-full">
      {step === "course" ? (
        <div>
          <label htmlFor="course-search" className="sr-only">
            {t("course.searchLabel")}
          </label>
          <input
            ref={searchRef}
            id="course-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              wantTopics();
            }}
            onFocus={wantTopics}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results && results.courses.length === 0 && results.topics.length === 0 && freeText.length >= 2) onFreeTopic?.(freeText);
            }}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t("course.searchPlaceholder")}
            className="h-12 w-full rounded-xl border border-border bg-card px-3.5 text-[16px] text-foreground placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </div>
      ) : (
        <div className="flex min-h-9 items-center gap-2">
          <button
            type="button"
            onClick={back}
            aria-label={t("course.back")}
            className="-ml-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[18px] font-extrabold leading-tight">{heading}</h2>
            {crumbs.length > 0 && (
              <p className="truncate text-[12.5px] text-faint">
                {crumbs.join(" › ")}
                {level && course?.levels?.length ? ` · ${level}` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-[13px] text-rose">
          {t("course.errorLoad")}{" "}
          <button type="button" onClick={() => void fetchList()} className="font-semibold underline">
            {t("course.retry")}
          </button>
        </p>
      )}

      {step === "course" && results && (
        <div className="mt-4 flex flex-col gap-5" aria-live="polite">
          {results.courses.length > 0 && (
            <section>
              <h3 className="mb-2 text-[14px] font-extrabold">{t("course.searchCourses")}</h3>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {results.courses.slice(0, 6).map((c) => (
                  <li key={c.id}>{courseTile(c)}</li>
                ))}
              </ul>
            </section>
          )}
          {results.topics.length > 0 && (
            <section>
              <h3 className="mb-2 text-[14px] font-extrabold">{t("course.searchTopics")}</h3>
              <ul className="flex flex-col gap-1.5">
                {results.topics.map(({ course: c, topic }) => (
                  <li key={`${c.id}-${topic.id}`}>
                    <TopicRow
                      topic={topic}
                      context={c.title}
                      onStart={() => onStart(c, topic, levelFor(c, topic))}
                      busy={busyTopicId === topic.id}
                      disabled={!!busyTopicId}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!full && results.topics.length === 0 && query.trim().length >= 2 && (
            <div className="flex items-center gap-2 text-[13px] text-faint">
              <Loader2 className="size-3.5 animate-spin" />
              {t("course.searchTopics")}…
            </div>
          )}
          {full && results.courses.length === 0 && results.topics.length === 0 && <p className="text-[13.5px] text-muted-foreground">{t("course.searchNone")}</p>}
          {onFreeTopic && freeText.length >= 2 && (
            <button type="button" onClick={() => onFreeTopic(freeText)} className={cn(row, "flex-col items-start gap-0.5")}>
              <span className="text-[14px] font-semibold">{t("course.freeTopic").replace("{text}", freeText)}</span>
              <span className="text-[12.5px] text-faint">{t(results.courses.length || results.topics.length ? "course.freeTopicAlso" : "course.freeTopicHint")}</span>
            </button>
          )}
        </div>
      )}

      {step === "course" && !results && (
        <div className="mt-5 flex flex-col gap-6">
          {!courses && !failed && (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {courses &&
            groupCourses(courses, order).map((group) => (
              <section key={group.board}>
                <h3 className="mb-2 text-[14px] font-extrabold text-foreground">{BOARD_LABEL[group.board]}</h3>
                {/* Each course is a tile in its subject's colour, so the catalog reads at a glance. */}
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {group.courses.map((c) => (
                    <li key={c.id}>{courseTile(c)}</li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {course && step !== "course" && (
        <SubjectBand match={course.subject || course.title} className="mt-3 flex min-h-[92px] flex-col justify-center !rounded-[var(--r-card)] px-5 py-4">
          <p className="subject-band__title max-w-[68%] text-[19px] font-extrabold leading-tight text-white">{course.title}</p>
          <p className="subject-tile__sub mt-0.5 max-w-[68%] text-[13px] font-semibold">
            {course.boardName}
            {level && course.levels?.length ? ` · ${level}` : ""}
          </p>
        </SubjectBand>
      )}

      {step === "level" && course && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["SL", "HL"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLevel(l);
                setStep("unit");
              }}
              className={cn(row, "min-h-[64px] flex-col items-start justify-center gap-0.5", level === l && "border-accent bg-accent-soft/50")}
            >
              <span className="text-[17px] font-bold">{l}</span>
              <span className="text-[12.5px] text-muted-foreground">{t(l === "SL" ? "course.levelSL" : "course.levelHL")}</span>
            </button>
          ))}
        </div>
      )}

      {step === "unit" && course && unitTop?.(course, level)}

      {step === "unit" && course && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {unitsForLevel(course, level).map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  setUnit(u);
                  setStep("topic");
                }}
                className={row}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug">{unitTitle(course, u)}</span>
                  <span className="block text-[12.5px] text-faint">{t("course.topicCount").replace("{count}", String(u.topics.length))}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "topic" && course && unit && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {unit.topics.map((topic) => (
            <li key={topic.id}>
              <TopicRow topic={topic} onStart={() => onStart(course, topic, level)} busy={busyTopicId === topic.id} disabled={!!busyTopicId} />
            </li>
          ))}
        </ul>
      )}

      {course && step !== "course" && (
        <p className="mt-4 text-[11.5px] leading-snug text-faint">
          {t("course.sourceNote")}
          {course.numberingNote ? ` ${course.numberingNote}` : ""}
        </p>
      )}
    </div>
  );
}

/**
 * The tick box of the topic list: empty, a dash (part of a unit picked) or ticked. Neutral, so the one purple thing
 * stays the start button. Its button carries `group/tick outline-none`, so the focus ring is drawn here.
 */
export function TickBox({ state }: { state: "none" | "some" | "all" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[18px] place-items-center rounded-[6px] border transition-colors",
        // Keyboard focus rings the box itself (the app's focus colour), not its larger touch target.
        "group-focus-visible/tick:outline-2 group-focus-visible/tick:outline-offset-2 group-focus-visible/tick:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)]",
        state === "none" ? "border-border-strong bg-card" : "border-foreground bg-foreground text-background",
      )}
    >
      {state === "all" && <Check className="size-3" strokeWidth={3.5} />}
      {state === "some" && <Minus className="size-3" strokeWidth={3.5} />}
    </span>
  );
}

/** Multi-select on a topic row (the subject page's list). */
export interface TopicRowSelect {
  /** Topics are being picked: the whole row ticks, and Start and Notes step aside. */
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
}

const LONG_PRESS_MS = 450;

/**
 * A touch held on a row for a moment calls `onLongPress` (a phone's way into
 * picking several). Moving the finger (a scroll) cancels it, and the tap that
 * ends the hold is swallowed so it does not also start the topic.
 */
function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const firedAt = useRef(0);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const justFired = () => Date.now() - firedAt.current < 800;
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!onLongPress || e.pointerType === "mouse") return;
      from.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        firedAt.current = Date.now();
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current && from.current && Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (!justFired()) return;
      firedAt.current = 0;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: React.MouseEvent) => {
      // A held touch also asks for the browser's menu; the hold already did its job.
      if (timer.current || justFired()) e.preventDefault();
    },
  };
}

/**
 * A topic: code + name, and the row itself starts it (5 questions). No
 * accordion: the objectives were a second tap between the student and the
 * question. Progress, the student's matching files and a link to Scribe's
 * note show when there are some.
 *
 * With `select` the row can be picked with others: a tick box takes the
 * code's place when the row is hovered or reached by keyboard (Space ticks
 * it), and a held touch ticks it on a phone. While topics are being picked
 * the whole row ticks and Start and Notes are hidden.
 */
export function TopicRow({
  topic,
  onStart,
  busy,
  disabled,
  progress,
  notesHref,
  context,
  files,
  select,
}: {
  topic: CatalogTopic;
  onStart: () => void;
  busy?: boolean;
  disabled?: boolean;
  progress?: TopicProgress;
  /** Reader link when Scribe has notes for this topic. */
  notesHref?: string;
  /** The course, when the row is a search result. */
  context?: string;
  /** The student's own files on this topic. */
  files?: string[];
  select?: TopicRowSelect;
}) {
  const { t } = useI18n();
  const pct = masteryPercent(progress?.mastery);
  const flag = topic.hlOnly ? "course.hlOnly" : topic.bcOnly ? "course.bcOnly" : topic.higherTierOnly ? "course.higherTier" : null;
  const sub = [context, flag ? t(flag) : null, progress?.done ? t("course.done") : null, pct !== null ? `${pct}%` : null].filter(Boolean).join(" · ");
  const selecting = !!select?.selecting;
  const hold = useLongPress(select && !selecting && !disabled ? select.onToggle : undefined);
  const body = (
    <>
      <span
        className={cn(
          "w-[52px] shrink-0 text-caption font-semibold tabular-nums text-faint",
          select && (selecting ? "opacity-0" : "group-hover/topic:opacity-0 group-has-[[data-tick]:focus-visible]/topic:opacity-0"),
        )}
      >
        {topic.code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-ui font-semibold">{topic.name}</span>
        {sub && <span className="block truncate text-[12px] text-faint">{sub}</span>}
        {files && files.length > 0 && (
          <span className="block truncate text-[12px] text-muted-foreground">{t("course.files").replace("{names}", files.join(", "))}</span>
        )}
      </span>
      {topic.locked && (
        <span className="shrink-0 text-faint" title={t("course.lockedTopic")}>
          <Lock className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{t("course.lockedTopic")}</span>
        </span>
      )}
    </>
  );
  const main = "flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left";
  return (
    <div
      {...(select ? hold : {})}
      className={cn(
        "group/topic relative flex items-stretch gap-2 rounded-2xl border border-border bg-card transition-colors hover:border-border-strong",
        select && "select-none [-webkit-touch-callout:none]",
        select?.checked && "border-border-strong bg-muted",
      )}
    >
      {select && (
        <button
          type="button"
          data-tick=""
          role="checkbox"
          aria-checked={select.checked}
          aria-label={selecting ? `${topic.code} ${topic.name}` : t("course.selectTopic").replace("{topic}", `${topic.code} ${topic.name}`)}
          onClick={select.onToggle}
          disabled={!selecting && disabled}
          className={cn(
            "group/tick absolute inset-y-0 left-0 z-10 grid w-11 place-items-center rounded-l-2xl outline-none",
            !selecting &&
              "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/topic:opacity-100 [@media(hover:hover)]:pointer-events-auto",
          )}
        >
          <TickBox state={select.checked ? "all" : "none"} />
        </button>
      )}
      {selecting ? (
        // The tick box is the control; the rest of the row is its larger target.
        <div onClick={select?.onToggle} className={cn(main, "cursor-pointer")}>
          {body}
        </div>
      ) : (
        <button type="button" onClick={onStart} disabled={disabled} aria-label={`${t("course.start")}: ${topic.code} ${topic.name}`} className={cn(main, "disabled:opacity-70")}>
          {body}
          <span className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-border px-3 text-[13px] font-bold text-foreground">
            {busy ? <Loader2 className="size-4 animate-spin" /> : t("course.start")}
          </span>
        </button>
      )}
      {notesHref && !selecting && (
        <Link href={notesHref} className="flex shrink-0 items-center pr-3.5 text-[13px] font-semibold text-accent hover:underline">
          {t("course.notes")}
        </Link>
      )}
    </div>
  );
}
