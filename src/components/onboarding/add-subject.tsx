"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardPaste, Loader2, Upload } from "lucide-react";
import { coursesApi, type CatalogBoard, type CatalogTopic, type Course, type CourseLevel, type CourseSummary } from "@/lib/api/courses";
import { BOARD_LABEL, BOARD_ORDER, groupCourses, localBoardOrder, searchCatalog } from "@/lib/courses";
import { cleanTopic } from "@/lib/first-run";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { SubjectBand, SubjectTile } from "@/components/learn/subject-tile";
import { TopicRow, loadAllCourses, loadCourses } from "@/components/courses/course-picker";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";
import "@/lib/i18n/courses";

/** HL-only topics need HL; everything else starts at the course's default level. */
const levelFor = (course: Course, topic: CatalogTopic): CourseLevel | undefined => (course.levels?.length && topic.hlOnly ? "HL" : undefined);

const levelRow =
  "flex min-h-[64px] w-full flex-col items-start justify-center gap-0.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-border-strong disabled:opacity-60";

/**
 * "Add a subject" for a student who already has one: two ways in, side by
 * side (stacked on a phone, their own notes first because that card is short).
 *
 * The catalogue lists every course, grouped by board, as small tiles in the
 * course's colour. A tap adds the course as a subject and opens its page,
 * where the student chooses what to study; nothing starts by itself. An IB
 * course asks SL or HL first. A course they already have says so and opens.
 *
 * "Your own notes" is the upload, paste and typed-topic start the first-run
 * screen has always had: those make a subject and write its first 5 questions.
 */
export function AddSubject({
  onAddCourse,
  onOpenSubject,
  onStartTopic,
  onFreeTopic,
  onUpload,
  onPaste,
  onPickByHand,
  busyCourseId,
}: {
  /** Adds the course as a subject and opens it. */
  onAddCourse: (course: CourseSummary, level?: CourseLevel) => void;
  /** A course the student already has: its subject is opened. */
  onOpenSubject: (workspaceId: string) => void;
  /** A topic found by search: 5 questions on it. */
  onStartTopic: (course: Course, topic: CatalogTopic, level?: CourseLevel) => void;
  onFreeTopic: (text: string) => void;
  onUpload: (files: File[], option: "upload" | "camera") => void;
  onPaste: () => void;
  /** Opens the unit and topic picker (several can be ticked). */
  onPickByHand: () => void;
  busyCourseId: string | null;
}) {
  const { t } = useI18n();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [full, setFull] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState<CatalogBoard | null>(null);
  // The browser's region applies once the list has loaded (the server render has no browser).
  const [order, setOrder] = useState<CatalogBoard[]>(BOARD_ORDER);
  /** Course id → the subject that already follows it. */
  const [added, setAdded] = useState<Record<string, string>>({});
  /** An IB course waiting for SL or HL. */
  const [levelOf, setLevelOf] = useState<CourseSummary | null>(null);
  const [topic, setTopic] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const catalogueRef = useRef<HTMLElement>(null);

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
    // Not signed in, or an older server: no course is marked, and a tap adds as usual.
    coursesApi
      .mine()
      .then((mine) => setAdded(Object.fromEntries(mine.map((c) => [c.courseId, c.workspaceId]))))
      .catch(() => {});
  }, []);

  /** Topic search needs every outline: fetched once, on the first keystroke. */
  const wantTopics = () => {
    if (full || !courses) return;
    void loadAllCourses(courses).then(setFull);
  };

  const results = useMemo(() => (courses && query.trim() ? searchCatalog(query, courses, full ?? [], order) : null), [courses, full, query, order]);
  const groups = useMemo(() => (courses ? groupCourses(courses, order) : []), [courses, order]);
  const freeText = cleanTopic(query);
  const typedTopic = cleanTopic(topic);
  const busy = busyCourseId !== null;

  const tap = (c: CourseSummary) => {
    if (added[c.id]) onOpenSubject(added[c.id]);
    else if (c.levels?.length) {
      setLevelOf(c);
      // The level question replaces the list: bring it into view (the tile may have been far down a phone's page).
      requestAnimationFrame(() => catalogueRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
    else onAddCourse(c);
  };

  const tile = (c: CourseSummary) => {
    const has = !!added[c.id];
    return (
      <SubjectTile
        row
        compact
        match={c.subject || c.title}
        title={c.title}
        sub={
          has ? (
            <span className="inline-flex items-center gap-1 font-extrabold">
              <Check className="size-3" strokeWidth={3.5} aria-hidden />
              {t("addSubject.added")}
            </span>
          ) : undefined
        }
        onClick={() => tap(c)}
        disabled={busy}
        className={cn("h-full", busy && busyCourseId !== c.id && "opacity-60")}
        trailing={
          busyCourseId === c.id ? (
            <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-white">
              <Loader2 className="size-3.5 animate-spin text-[var(--tile-a)]" />
            </span>
          ) : undefined
        }
      />
    );
  };

  const tileGrid = "grid grid-cols-2 gap-2 sm:grid-cols-3";
  const sectionTitle = "text-[19px] font-extrabold leading-tight tracking-tight";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      {/* Their own notes: first on a phone (short), the right-hand column from lg. */}
      <section
        aria-labelledby="add-subject-notes"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onUpload(Array.from(e.dataTransfer.files), "upload");
        }}
        className={cn(
          "min-w-0 rounded-[var(--r-panel)] border bg-card p-4 transition-colors sm:p-5 lg:sticky lg:top-4 lg:order-last",
          dragging ? "border-accent bg-accent-soft/50" : "border-border",
        )}
      >
        <h2 id="add-subject-notes" className={sectionTitle}>
          {t("addSubject.notesTitle")}
        </h2>
        <p className="mt-1 text-small text-muted-foreground">{t("addSubject.notesSub")}</p>
        <div className="mt-3.5 flex flex-col gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={buttonClass({ size: "lg", className: "w-full gap-2" })}>
            <Upload className="size-4" />
            {t("firstRun.chooseFiles")}
          </button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {/* Phones: the camera is one tap away. */}
            <button type="button" onClick={() => cameraRef.current?.click()} className={buttonClass({ variant: "secondary", size: "md", className: "w-full gap-2 sm:hidden" })}>
              <Camera className="size-4" />
              {t("addSubject.photo")}
            </button>
            <button type="button" onClick={onPaste} className={buttonClass({ variant: "secondary", size: "md", className: "w-full gap-2" })}>
              <ClipboardPaste className="size-4" />
              {t("firstRun.optPaste")}
            </button>
          </div>
          <p className="hidden text-caption text-muted-foreground lg:block">{dragging ? t("firstRun.dropActive") : t("firstRun.dropHint")}</p>
        </div>
        <form
          className="mt-4 border-t border-border pt-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedTopic.length >= 2) onFreeTopic(typedTopic);
          }}
        >
          <label htmlFor="add-subject-topic" className="text-small font-bold">
            {t("addSubject.topicLabel")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="add-subject-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={100}
              autoComplete="off"
              enterKeyHint="go"
              placeholder={t("addSubject.topicPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-card px-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <button type="submit" disabled={typedTopic.length < 2} aria-label={t("course.freeTopic").replace("{text}", typedTopic)} className={buttonClass({ variant: "secondary", size: "md", className: "shrink-0 gap-1.5" })}>
              {t("addSubject.topicStart")}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </form>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            onUpload(Array.from(e.target.files ?? []), "upload");
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onUpload(Array.from(e.target.files ?? []), "camera");
            e.target.value = "";
          }}
        />
      </section>

      <section ref={catalogueRef} aria-labelledby="add-subject-catalogue" className="min-w-0 scroll-mt-4">
        <h2 id="add-subject-catalogue" className={sectionTitle}>
          {t("addSubject.catalogueTitle")}
        </h2>
        <p className="mt-1 text-small text-muted-foreground">{t("addSubject.catalogueSub")}</p>

        {levelOf ? (
          <div className="mt-3.5">
            <button
              type="button"
              onClick={() => setLevelOf(null)}
              disabled={busy}
              className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-ui font-bold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t("course.back")}
            </button>
            <SubjectBand match={levelOf.subject || levelOf.title} className="mt-1 flex min-h-[84px] flex-col justify-center !rounded-[var(--r-card)] px-5 py-4">
              <p className="subject-band__title max-w-[68%] text-[19px] font-extrabold leading-tight text-white">{levelOf.title}</p>
              <p className="subject-tile__sub mt-0.5 max-w-[68%] text-[13px] font-semibold">{levelOf.boardName}</p>
            </SubjectBand>
            <h3 className="mt-4 text-ui font-extrabold">{t("course.chooseLevel")}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["SL", "HL"] as const).map((l) => (
                <button key={l} type="button" disabled={busy} onClick={() => onAddCourse(levelOf, l)} className={levelRow}>
                  <span className="flex items-center gap-2 text-[17px] font-bold">
                    {l}
                    {busyCourseId === levelOf.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">{t(l === "SL" ? "course.levelSL" : "course.levelHL")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <label htmlFor="add-subject-search" className="sr-only">
              {t("course.searchLabel")}
            </label>
            <input
              id="add-subject-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                wantTopics();
              }}
              onFocus={wantTopics}
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t("addSubject.searchPlaceholder")}
              className="mt-3.5 h-11 w-full rounded-xl border border-border-strong bg-card px-3.5 text-[16px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
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
                  <ul className={tileGrid} aria-label={t("course.searchCourses")}>
                    {results.courses.map((c) => (
                      <li key={c.id}>{tile(c)}</li>
                    ))}
                  </ul>
                )}
                {results.topics.length > 0 && (
                  <section>
                    <h3 className="text-ui font-extrabold">{t("course.searchTopics")}</h3>
                    <p className="mb-2 text-caption text-muted-foreground">{t("addSubject.topicsHint")}</p>
                    <ul className="flex flex-col gap-1.5">
                      {results.topics.map(({ course: c, topic: found }) => (
                        <li key={`${c.id}-${found.id}`}>
                          <TopicRow topic={found} context={c.title} onStart={() => onStartTopic(c, found, levelFor(c, found))} disabled={busy} />
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
                {full && results.courses.length === 0 && results.topics.length === 0 && (
                  <div>
                    <p className="text-small text-muted-foreground">{t("course.searchNone")}</p>
                    {freeText.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => onFreeTopic(freeText)}
                        disabled={busy}
                        className={buttonClass({ variant: "secondary", size: "lg", className: "mt-2 h-auto min-h-12 w-full whitespace-normal py-2.5 leading-snug [overflow-wrap:anywhere]" })}
                      >
                        {t("course.freeTopic").replace("{text}", freeText)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {!courses && !failed && (
                  <div className={cn(tileGrid, "mt-4")} aria-busy="true">
                    {Array.from({ length: 12 }, (_, i) => (
                      <div key={i} className="h-[60px] animate-pulse rounded-[var(--r-card)] bg-muted" />
                    ))}
                  </div>
                )}
                {groups.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("addSubject.boards")}>
                    {[null, ...groups.map((g) => g.board)].map((b) => (
                      <button
                        key={b ?? "all"}
                        type="button"
                        aria-pressed={board === b}
                        onClick={() => setBoard(b)}
                        className={cn(
                          "inline-flex h-9 items-center rounded-full border px-3.5 text-small font-bold transition-colors",
                          board === b ? "border-foreground bg-foreground text-white" : "border-border bg-card text-foreground hover:border-border-strong",
                        )}
                      >
                        {b ? BOARD_LABEL[b] : t("addSubject.all")}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-5">
                  {groups
                    .filter((g) => !board || g.board === board)
                    .map((g) => (
                      <section key={g.board} aria-labelledby={`add-subject-${g.board}`}>
                        <h3 id={`add-subject-${g.board}`} className="mb-2 flex items-baseline gap-2 text-ui font-extrabold">
                          {BOARD_LABEL[g.board]}
                          <span className="text-caption font-semibold text-muted-foreground">{g.courses.length}</span>
                        </h3>
                        <ul className={tileGrid}>
                          {g.courses.map((c) => (
                            <li key={c.id}>{tile(c)}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                </div>
              </>
            )}
            {courses && (
              <button
                type="button"
                onClick={onPickByHand}
                className="mt-4 flex min-h-11 items-center text-small font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
              >
                {t("addSubject.pickByHand")}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
