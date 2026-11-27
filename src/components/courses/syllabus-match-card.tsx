"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, GraduationCap, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { syllabusMatchApi, type CourseLevel, type CourseSummary } from "@/lib/api/courses";
import { loadCourses } from "@/components/courses/course-picker";
import { buttonClass } from "@/components/ui/button";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { track as trackFunnel } from "@/lib/funnel";
import {
  MATCH_BOARDS,
  MATCH_SNOOZE_KEY,
  boardGuessLine,
  boardOrder,
  coursesForBoard,
  matchHeadline,
  shouldShowMatch,
  type MatchBoardKey,
  type SyllabusMatch,
} from "@/lib/syllabus-match";
import { cn } from "@/lib/utils";

/** After an upload, the match lands a little after the file is read: look again for this long. */
const WATCH_MS = 3 * 60_000;
const WATCH_EVERY_MS = 6_000;

export const syllabusMatchKey = (workspaceId: string) => ["syllabus-match", workspaceId] as const;

const readSnoozed = (workspaceId: string) => {
  try {
    return sessionStorage.getItem(MATCH_SNOOZE_KEY(workspaceId)) === "1";
  } catch {
    return false;
  }
};

/**
 * The one light step after Scribe has matched the subject's own material to
 * a syllabus: "Looks like AQA GCSE Biology · 4.1 Cell biology. Right?" with
 * Yes / Change / Not a course (high confidence), a choice of the 2–3 likely
 * courses (medium), or "Which course is this for?" with a board-first picker
 * (low). Yes makes the subject course-backed. Never blocks anything: it can
 * be closed ("Not now") and studying goes on without an answer.
 *
 * `watch` (just uploaded): keeps looking for the match for a few minutes.
 * `match` / `onAnswer`: fixtures and tests render a given state without the server.
 */
export function SyllabusMatchCard({
  workspaceId,
  from,
  watch = false,
  className,
  match: fixed,
  onAnswer,
  courses: fixedCourses,
  initialMode = "suggest",
}: {
  workspaceId: string;
  from: "subject" | "upload";
  watch?: boolean;
  className?: string;
  match?: SyllabusMatch;
  onAnswer?: (input: { action: "confirm" | "change" | "dismiss"; courseId?: string; level?: CourseLevel | null }) => Promise<void>;
  /** Fixtures: the catalog list for the picker (otherwise loaded). */
  courses?: CourseSummary[];
  /** Fixtures: open on the picker. */
  initialMode?: "suggest" | "pick";
}) {
  const qc = useQueryClient();
  const [watchSince] = useState(() => Date.now());
  const query = useQuery({
    queryKey: syllabusMatchKey(workspaceId),
    queryFn: () => syllabusMatchApi.get(workspaceId),
    enabled: !fixed,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const data = q.state.data as SyllabusMatch | undefined;
      if (!watch || Date.now() - watchSince > WATCH_MS) return false;
      // Still being read and matched: look again.
      return !data || data.status === null ? WATCH_EVERY_MS : false;
    },
  });
  const match = fixed ?? query.data ?? null;
  const [answered, setAnswered] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState(() => readSnoozed(workspaceId));
  const [mode, setMode] = useState<"suggest" | "pick">(initialMode);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = shouldShowMatch(match, !!answered) && !snoozed;
  const shown = useRef(false);
  useEffect(() => {
    if (!visible || shown.current || fixed || !match) return;
    shown.current = true;
    trackFunnel("syllabus_match.shown", { ...(match.band ? { band: match.band } : {}), from, ...(match.suggestion ? { courseId: match.suggestion.courseId } : {}) }, workspaceId);
  }, [visible, fixed, match, from, workspaceId]);

  if (answered) {
    return (
      <div role="status" className={cn("life-card flex items-center gap-3 p-4 text-small font-semibold", className)}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="min-w-0">{answered}</span>
      </div>
    );
  }
  if (!visible || !match) return null;

  const answer = async (key: string, input: { action: "confirm" | "change" | "dismiss"; courseId?: string; level?: CourseLevel | null }, done: string) => {
    setBusy(key);
    try {
      if (onAnswer) await onAnswer(input);
      else await syllabusMatchApi.resolve({ workspaceId, from, ...input });
      setAnswered(done);
      if (!onAnswer) {
        void qc.invalidateQueries({ queryKey: syllabusMatchKey(workspaceId) });
        // The subject is now course-backed: its page reloads with the course's topics and progress.
        if (input.action !== "dismiss") emitTreeChanged();
      }
      if (input.action !== "dismiss") toast.success(done);
    } catch (e) {
      toastError(e, "Couldn't save that");
    } finally {
      setBusy(null);
    }
  };
  const confirmCourse = (courseId: string, label: string, level: CourseLevel | null, action: "confirm" | "change" = "confirm") =>
    answer(`${action}:${courseId}:${level ?? ""}`, { action, courseId, level }, `This subject now follows ${label}${level ? ` ${level}` : ""}. Sessions follow its syllabus and mark the way its exams do.`);
  const notACourse = () => answer("dismiss", { action: "dismiss" }, "Got it: Scribe won't ask again for this subject.");
  const notNow = () => {
    try {
      sessionStorage.setItem(MATCH_SNOOZE_KEY(workspaceId), "1");
    } catch {
      /* storage blocked */
    }
    setSnoozed(true);
  };

  const s = match.suggestion;
  const step = mode === "pick" || match.prompt === "pick" || !s ? "pick" : match.prompt;
  const needsLevel = !!s?.levels?.length && !s.level;

  return (
    <section aria-label="Which course is this subject for?" className={cn("life-card relative p-4 sm:p-5", className)} data-syllabus-match={step}>
      <button type="button" onClick={notNow} aria-label="Not now" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent">
          <GraduationCap className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-bold text-faint">Your exam</p>
          {step === "confirm" && s ? (
            <>
              <h2 className="mt-0.5 text-[16px] font-extrabold leading-snug sm:text-[17px]">{matchHeadline(s)}</h2>
              <p className="mt-1 text-small text-faint">Say yes and your sessions follow its syllabus, ask in its exam style, and count towards its progress.</p>
            </>
          ) : step === "choose" ? (
            <>
              <h2 className="mt-0.5 text-[16px] font-extrabold leading-snug sm:text-[17px]">Which course is this for?</h2>
              <p className="mt-1 text-small text-faint">From your material it&apos;s most likely one of these.</p>
            </>
          ) : (
            <>
              <h2 className="mt-0.5 text-[16px] font-extrabold leading-snug sm:text-[17px]">Which course is this for?</h2>
              <p className="mt-1 text-small text-faint">{boardGuessLine(match.boardGuess) ?? "Pick your board and course, and sessions follow its syllabus and exam style."}</p>
            </>
          )}
        </div>
      </div>

      {step === "confirm" && s && (
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:pl-12">
          {needsLevel ? (
            (s.levels as CourseLevel[]).map((lvl) => (
              <button key={lvl} type="button" disabled={!!busy} onClick={() => void confirmCourse(s.courseId, s.label, lvl)} className={buttonClass({ size: "sm" })}>
                {busy === `confirm:${s.courseId}:${lvl}` && <Loader2 className="size-3.5 animate-spin" />}Yes, {lvl}
              </button>
            ))
          ) : (
            <button type="button" disabled={!!busy} onClick={() => void confirmCourse(s.courseId, s.label, null)} className={buttonClass({ size: "sm" })}>
              {busy?.startsWith("confirm:") ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}Yes
            </button>
          )}
          <button type="button" disabled={!!busy} onClick={() => setMode("pick")} className={buttonClass({ variant: "outline", size: "sm" })}>
            Change
          </button>
          <button type="button" disabled={!!busy} onClick={() => void notACourse()} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {busy === "dismiss" && <Loader2 className="size-3.5 animate-spin" />}Not a course
          </button>
        </div>
      )}

      {step === "choose" && (
        <div className="mt-4 flex flex-col gap-2 sm:pl-12">
          {match.options.map((o) => (
            <button
              key={o.courseId}
              type="button"
              disabled={!!busy}
              onClick={() => void confirmCourse(o.courseId, o.label.replace(/ (SL|HL)$/, ""), (o.level as CourseLevel | null) ?? null)}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-left text-small font-semibold transition-colors hover:border-border-strong disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">{o.label}</span>
              {busy?.startsWith(`confirm:${o.courseId}:`) ? <Loader2 className="size-4 animate-spin text-faint" /> : <ChevronRight className="size-4 text-faint" />}
            </button>
          ))}
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => setMode("pick")} className={buttonClass({ variant: "outline", size: "sm" })}>
              Something else
            </button>
            <button type="button" disabled={!!busy} onClick={() => void notACourse()} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {busy === "dismiss" && <Loader2 className="size-3.5 animate-spin" />}Not a course
            </button>
          </div>
        </div>
      )}

      {step === "pick" && (
        <BoardFirstPicker
          match={match}
          fixedCourses={fixedCourses}
          busy={busy}
          onPick={(c, level) => void confirmCourse(c.id, c.title, level, "change")}
          onNotACourse={() => void notACourse()}
          onBack={match.prompt !== "pick" && s ? () => setMode("suggest") : undefined}
        />
      )}
    </section>
  );
}

/** Board → course → (IB) level, in three taps at most. */
function BoardFirstPicker({
  match,
  fixedCourses,
  busy,
  onPick,
  onNotACourse,
  onBack,
}: {
  match: SyllabusMatch;
  fixedCourses?: CourseSummary[];
  busy: string | null;
  onPick: (course: CourseSummary, level: CourseLevel | null) => void;
  onNotACourse: () => void;
  onBack?: () => void;
}) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(fixedCourses ?? null);
  const [failed, setFailed] = useState(false);
  const [board, setBoard] = useState<MatchBoardKey | null>(fixedCourses ? boardOrder(match)[0] : null);
  const [course, setCourse] = useState<CourseSummary | null>(null);
  useEffect(() => {
    if (fixedCourses) return;
    loadCourses()
      .then(setCourses)
      .catch(() => setFailed(true));
  }, [fixedCourses]);
  const order = useMemo(() => boardOrder(match), [match]);
  const list = board && courses ? coursesForBoard(courses, board) : [];
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-3.5 text-small font-semibold transition-colors",
      active ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:border-border-strong",
    );

  return (
    <div className="mt-4 sm:pl-12">
      <div role="group" aria-label="Board" className="flex flex-wrap gap-2">
        {order.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={board === key}
            onClick={() => {
              setBoard(key);
              setCourse(null);
            }}
            className={chip(board === key)}
          >
            {MATCH_BOARDS.find((b) => b.key === key)!.label}
          </button>
        ))}
      </div>
      {failed && <p className="mt-3 text-small text-faint">Courses didn&apos;t load. Try again in a moment.</p>}
      {board && !courses && !failed && <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />}
      {board && courses && !course && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => (c.levels?.length ? setCourse(c) : onPick(c, null))}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-left text-small font-semibold transition-colors hover:border-border-strong disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">{c.title}</span>
                {busy?.startsWith(`change:${c.id}:`) ? <Loader2 className="size-4 animate-spin text-faint" /> : <ChevronRight className="size-4 shrink-0 text-faint" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {course && (
        <div className="mt-3">
          <p className="text-small font-semibold">{course.title}: which level?</p>
          <div className="mt-2 flex gap-2">
            {(course.levels as CourseLevel[]).map((lvl) => (
              <button key={lvl} type="button" disabled={!!busy} onClick={() => onPick(course, lvl)} className={buttonClass({ size: "sm" })}>
                {busy === `change:${course.id}:${lvl}` && <Loader2 className="size-3.5 animate-spin" />}
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(course || onBack) && (
          <button type="button" onClick={() => (course ? setCourse(null) : onBack?.())} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={onNotACourse} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {busy === "dismiss" && <Loader2 className="size-3.5 animate-spin" />}Not a course
        </button>
      </div>
    </div>
  );
}
