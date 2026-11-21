"use client";

import { buttonClass } from "@/components/ui/button";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Lock } from "lucide-react";
import {
  coursesApi,
  type CatalogTopic,
  type CatalogUnit,
  type Course,
  type CourseLevel,
  type CourseSummary,
  type TopicProgress,
} from "@/lib/api/courses";
import { BOARD_LABEL, groupCourses, masteryPercent, unitTitle, unitsForLevel } from "@/lib/courses";
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

type Step = "course" | "level" | "unit" | "topic";

const row =
  "flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-border-strong";

/**
 * Course → (IB level) → unit → topic, then `onStart`. Course, unit and topic
 * names are the catalog's (English); codes help students find their place.
 */
export function CoursePicker({
  onStart,
  busyTopicId,
  enrolledCourseIds,
}: {
  onStart: (course: Course, topic: CatalogTopic, level?: CourseLevel) => void;
  /** Topic whose session is being started (shows a spinner, blocks others). */
  busyTopicId?: string | null;
  enrolledCourseIds?: string[];
}) {
  const { t } = useI18n();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<string | null>(null);
  const [level, setLevel] = useState<CourseLevel | undefined>(undefined);
  const [unit, setUnit] = useState<CatalogUnit | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("course");

  const fetchList = () =>
    loadCourses()
      .then((list) => {
        setCourses(list);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  useEffect(() => {
    void fetchList();
  }, []);

  const chooseCourse = (id: string) => {
    setLoadingCourse(id);
    setFailed(false);
    loadCourse(id)
      .then((c) => {
        setCourse(c);
        setUnit(null);
        setOpenTopic(null);
        setStep(c.levels?.length && !level ? "level" : "unit");
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingCourse(null));
  };

  const back = () => {
    setOpenTopic(null);
    if (step === "topic") setStep("unit");
    else if (step === "unit" && course?.levels?.length) setStep("level");
    else setStep("course");
  };

  const heading =
    step === "course"
      ? t("course.chooseCourse")
      : step === "level"
        ? t("course.chooseLevel")
        : step === "unit"
          ? t("course.chooseUnit")
          : t("course.chooseTopic");

  const crumbs = [course?.title, step === "topic" && unit ? unitTitle(course!, unit) : null].filter(Boolean);

  return (
    <div className="w-full">
      <div className="flex min-h-9 items-center gap-2">
        {step !== "course" && (
          <button
            type="button"
            onClick={back}
            aria-label={t("course.back")}
            className="-ml-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold leading-tight">{heading}</h2>
          {step !== "course" && crumbs.length > 0 && (
            <p className="truncate text-[12.5px] text-faint">
              {crumbs.join(" › ")}
              {level && course?.levels?.length ? ` · ${level}` : ""}
            </p>
          )}
        </div>
      </div>

      {failed && (
        <p role="alert" className="mt-3 text-[13px] text-rose">
          {t("course.errorLoad")}{" "}
          <button type="button" onClick={() => void fetchList()} className="font-semibold underline">
            {t("course.retry")}
          </button>
        </p>
      )}

      {step === "course" && (
        <div className="mt-3 flex flex-col gap-6">
          {!courses && !failed && (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {courses &&
            groupCourses(courses).map((group) => (
              <section key={group.board}>
                <h3 className="mb-2 text-[14px] font-extrabold text-foreground">
                  {BOARD_LABEL[group.board]}
                </h3>
                {/* Each course is a tile in its subject's colour, so the catalog reads at a glance. */}
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {group.courses.map((c) => (
                    <li key={c.id}>
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
                    </li>
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
              className={cn(
                row,
                "min-h-[64px] flex-col items-start justify-center gap-0.5",
                level === l && "border-accent bg-accent-soft/50",
              )}
            >
              <span className="text-[17px] font-bold">{l}</span>
              <span className="text-[12.5px] text-muted-foreground">{t(l === "SL" ? "course.levelSL" : "course.levelHL")}</span>
            </button>
          ))}
        </div>
      )}

      {step === "unit" && course && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {unitsForLevel(course, level).map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  setUnit(u);
                  setOpenTopic(null);
                  setStep("topic");
                }}
                className={row}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug">{unitTitle(course, u)}</span>
                  <span className="block text-[12.5px] text-faint">
                    {t("course.topicCount").replace("{count}", String(u.topics.length))}
                  </span>
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
              <TopicRow
                topic={topic}
                open={openTopic === topic.id}
                onToggle={() => setOpenTopic((v) => (v === topic.id ? null : topic.id))}
                onStart={() => onStart(course, topic, level)}
                busy={busyTopicId === topic.id}
                disabled={!!busyTopicId}
              />
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

/** A topic: code + name; opens to its objectives and the start button. */
export function TopicRow({
  topic,
  open,
  onToggle,
  onStart,
  busy,
  disabled,
  progress,
  notesHref,
}: {
  topic: CatalogTopic;
  /** Reader link when Scribe has notes for this topic. */
  notesHref?: string;
  open: boolean;
  onToggle: () => void;
  onStart: () => void;
  busy?: boolean;
  disabled?: boolean;
  progress?: TopicProgress;
}) {
  const { t } = useI18n();
  const pct = masteryPercent(progress?.mastery);
  return (
    <div className={cn("rounded-2xl border bg-card transition-colors", open ? "border-border-strong" : "border-border hover:border-border-strong")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="w-[52px] shrink-0 text-[12.5px] font-semibold tabular-nums text-faint">{topic.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug">{topic.name}</span>
          {(topic.hlOnly || topic.higherTierOnly || topic.bcOnly) && (
            <span className="text-[11.5px] font-medium text-faint">
              {t(topic.hlOnly ? "course.hlOnly" : topic.bcOnly ? "course.bcOnly" : "course.higherTier")}
            </span>
          )}
        </span>
        {topic.locked && (
          <span className="shrink-0 text-faint" title={t("course.lockedTopic")}>
            <Lock className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t("course.lockedTopic")}</span>
          </span>
        )}
        {pct !== null && <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>}
        {progress?.done && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-white" aria-label={t("course.done")}>
            <Check className="size-3.5" />
          </span>
        )}
        <ChevronRight className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-1">
          <p className="text-[12px] font-semibold text-faint">{t("course.youllPractise")}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {topic.objectives.map((o) => (
              <li key={o} className="flex gap-2 text-[13.5px] leading-snug text-foreground">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent/60" />
                {o}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className={buttonClass({ className: "mt-3.5 w-full gap-2" })}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("course.building")}
              </>
            ) : (
              <>
                {t("course.startTopic")}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          {notesHref && (
            <Link
              href={notesHref}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border-strong px-5 text-[14.5px] font-semibold transition-colors hover:border-accent hover:text-accent"
            >
              {t("notes.readNotes")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

