"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { SubjectTile } from "@/components/learn/subject-tile";
import { PublicNoteBody } from "@/components/notes-public/public-note-body";
import { courseworkApi, type CourseworkGuide, type GraderStatus, type GuideResponse, type ReviewMode, type RubricSummary } from "@/lib/api/coursework";
import type { TopicNoteContent } from "@/lib/api/notes";
import { allowanceCopy, componentTitle, familyText, groupRubrics, rubricLine, wordStatus, type UltraOffer } from "@/lib/coursework";
import { track } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import { Feedback, type FeedbackHost } from "./feedback";
import { ChatView, NextSteps, RubricView, type ChatState } from "./panel-views";
import { ResultSummary } from "./summary";
import { useCw } from "./use-cw";
import { useOnline, type Grader } from "./use-grader";
import "@/app/notes/notes-look.css";

/* ---------- Which component is it? ---------- */

const n = (v: number) => v.toLocaleString("en-GB");

export function rubricSub(r: Pick<RubricSummary, "totalMarks" | "wordLimit">): string {
  return r.wordLimit ? `${r.totalMarks} marks · ${n(r.wordLimit)} words` : `${r.totalMarks} marks`;
}

/** Every component Scribe can review, the student's own subjects first; each in its subject's colour. */
export function ComponentPicker({ rubrics, onPick, dense }: { rubrics: RubricSummary[]; onPick: (r: RubricSummary) => void; /** In a narrow rail: two columns at most. */ dense?: boolean }) {
  const { t } = useCw();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupRubrics(rubrics, query), [rubrics, query]);
  return (
    <div>
      <label className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-muted px-3.5 sm:max-w-[320px]">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <span className="sr-only">{t("cw.start.search")}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("cw.start.search")}
          className="min-w-0 flex-1 bg-transparent text-ui font-semibold text-foreground placeholder:font-medium placeholder:text-faint focus:outline-none"
        />
      </label>
      {groups.map((g) => (
        <div key={g.id} className="mt-5" role="group" aria-labelledby={`cw-g-${g.id}`}>
          <p id={`cw-g-${g.id}`} className="text-small font-extrabold text-muted-foreground">
            {g.title}
          </p>
          <ul className={cn("mt-2 grid gap-2.5", dense ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3")}>
            {g.rubrics.map((r) => (
              <li key={r.id}>
                <SubjectTile row title={componentTitle(r)} match={familyText(r)} sub={`${r.totalMarks} marks`} onClick={() => onPick(r)} className="cw-pick" />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && (
        <div className="mt-5">
          <p className="text-ui font-extrabold text-foreground">{t("cw.start.noMatch", { q: query.trim() })}</p>
          <p className="mt-1 text-ui text-muted-foreground">{t("cw.start.noMatchSub")}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Marked, or feedback only ---------- */

export function ModeChoice({ mode, onChange, compact }: { mode: ReviewMode; onChange: (m: ReviewMode) => void; /** One line each (the rail); the start screen shows what each means. */ compact?: boolean }) {
  const { t } = useCw();
  const options: ReviewMode[] = ["marked", "feedback"];
  return (
    <div role="radiogroup" aria-label={t("cw.mode.label")} className={cn("grid grid-cols-2", compact ? "gap-0 rounded-[12px] bg-muted p-1" : "gap-2.5")}>
      {options.map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m)}
            className={
              compact
                ? cn("min-h-11 rounded-[9px] px-2 text-small font-extrabold transition-colors", on ? "bg-white text-foreground shadow-[0_1px_2px_rgba(22,22,26,0.12)]" : "text-muted-foreground hover:text-foreground")
                : cn("cw-radio flex min-h-[76px] flex-col justify-center rounded-[var(--r-button)] border px-4 py-3 text-left transition-colors", on ? "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]" : "border-border hover:border-border-strong")
            }
          >
            <span className={cn("font-extrabold text-foreground", compact ? undefined : "flex items-center gap-2 text-ui")}>
              {!compact && <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full border-2", on ? "border-foreground" : "border-border-strong")} aria-hidden>{on && <span className="size-2 rounded-full bg-foreground" />}</span>}
              {t(`cw.mode.${m}`)}
            </span>
            {!compact && <span className="mt-1 text-small text-muted-foreground">{t(`cw.mode.${m}Sub`)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- The one action: review, or why not ---------- */

/**
 * The allowance, before anything else: locked on free (one upgrade action),
 * the daily limit (when reviews come back, and Ultra when it is sold), or the
 * way through with the line to show beside the button ("1 of 2 reviews left today").
 */
export function AllowanceGate({ status, ultra, wide, limitHit, children }: { status: GraderStatus; ultra: UltraOffer | null; wide?: boolean; /** The server just refused for the limit. */ limitHit?: boolean; children: (line: string) => ReactNode }) {
  const { t } = useCw();
  // "in 5 h 12 min" may be a minute old; it only matters at the limit.
  const [now] = useState(() => new Date());
  const copy = allowanceCopy(status, ultra, now);
  if (copy.state === "locked") {
    return (
      <div>
        <p className="text-ui text-foreground/80">{t("cw.locked.panel")}</p>
        <Link href="/pricing" onClick={() => track("wall.shown", { reason: "grader", variant: "locked" })} className={buttonClass({ size: "md", className: cn("mt-3", wide && "w-full") })}>
          {t("cw.locked.cta")}
        </Link>
      </div>
    );
  }
  if (copy.state === "limit" || limitHit) {
    return (
      <div role="status" data-cw-limit>
        <p className="text-read font-extrabold text-foreground">{copy.state === "limit" ? copy.line : t("cw.limit.used")}</p>
        <p className="mt-1 text-ui text-foreground/80">{copy.resets ?? t("cw.limit.tomorrow")}</p>
        {copy.upsell && (
          <div className={cn("mt-4 flex flex-wrap items-center gap-x-4 gap-y-2", wide && "flex-col items-stretch")}>
            <Link href="/pricing" onClick={() => track("wall.shown", { reason: "grader", variant: "limit" })} className={buttonClass({ size: "lg", className: wide ? "w-full" : undefined })}>
              {t("cw.limit.seeUltra")}
            </Link>
            <p className={cn("text-small font-bold text-muted-foreground", wide && "text-center")}>{copy.upsell}</p>
          </div>
        )}
      </div>
    );
  }
  return <>{children(copy.line)}</>;
}

export function ReviewAction({ grader, words, wide, onRequested }: { grader: Grader; /** Words in the document now. */ words: number; /** The button fills the row (phones, the rail). */ wide?: boolean; onRequested?: () => void }) {
  const { t } = useCw();
  const online = useOnline();
  const { status, rubric, rows } = grader;
  if (!status) return null;
  const ws = wordStatus(words, rubric?.wordLimit ?? null);
  const next = rows.length + 1;
  const blocked = ws.state === "empty" || ws.state === "short" || !online || !rubric;
  return (
    <AllowanceGate status={status} ultra={grader.ultra} wide={wide} limitHit={grader.requestError === "limit"}>
      {(line) => (
        <div>
          <ModeChoice mode={grader.mode} onChange={grader.setMode} compact />
          <div className={cn("mt-3 flex flex-wrap items-center gap-x-4 gap-y-2", wide && "flex-col items-stretch")}>
            <Button
              size="lg"
              disabled={blocked || grader.requesting || grader.running}
              onClick={() => {
                void grader.request().then(onRequested);
              }}
              className={wide ? "w-full" : undefined}
            >
              {grader.requesting ? t("cw.review.busy") : next > 1 ? t("cw.review.again", { n: next }) : t("cw.review.first")}
            </Button>
            <p className={cn("text-small font-bold text-muted-foreground", wide && "text-center")}>{line}</p>
          </div>
          {!online && <p className="mt-2 text-small font-semibold text-foreground" role="status">{t("cw.err.offline")}</p>}
          {online && ws.note && <p className="mt-2 text-small font-semibold text-foreground" role="status">{ws.note}</p>}
          {grader.requestError !== null && grader.requestError !== "limit" && (
            <p className="mt-2 text-small font-semibold text-rose-700" role="alert">
              {grader.requestError || t("cw.err.request")}
            </p>
          )}
        </div>
      )}
    </AllowanceGate>
  );
}

/* ---------- The wait ---------- */

const STAGES = ["reading", "citations", "criteria", "checking"] as const;

/**
 * A review takes a minute or more. The wait says what is happening (the real
 * steps, in order) without pretending to know how far along it is: steps tick
 * only when the server reports its stage; otherwise one calm bar moves.
 */
export function GradingWait({ stage, titled }: { stage?: (typeof STAGES)[number] | null; /** Say "Reading your work" here too (where no header band already does). */ titled?: boolean }) {
  const { t } = useCw();
  const at = stage ? STAGES.indexOf(stage) : -1;
  return (
    <div role="status" aria-live="polite">
      {titled ? (
        <>
          <h2 className="page-h2">{t("cw.wait.title")}</h2>
          <p className="mb-4 mt-1 text-ui text-foreground/80">{t("cw.wait.sub")}</p>
        </>
      ) : (
        <span className="sr-only">{t("cw.wait.title")}</span>
      )}
      <div className="cw-wait-bar" aria-hidden>
        <span />
      </div>
      <ol className="mt-5 flex flex-col gap-3">
        {STAGES.map((s, i) => (
          <li key={s} className={cn("life-rise flex items-start gap-3 text-ui", at >= 0 && i > at ? "text-muted-foreground" : "text-foreground")} style={{ ["--i" as string]: i * 6 }}>
            <span className={cn("cw-step mt-[3px]", at > i && "cw-step--done", at === i && "cw-step--now")} aria-hidden />
            <span className={at === i ? "font-extrabold" : "font-semibold"}>{t(`cw.wait.s${i + 1}`)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-ui text-foreground/80">{t("cw.wait.leave")}</p>
    </div>
  );
}

/* ---------- The component's guide, in the note reader's own look ---------- */

export function guideContent(g: CourseworkGuide, title: string): TopicNoteContent {
  return { schemaVersion: 1, courseId: "", topicId: "", topicCode: "", topicName: title, unitCode: "", unitName: "", locale: "en-GB", objectiveLine: g.objectiveLine, sections: g.sections, keyTerms: [], figures: [], recall: [] };
}

/** The guide part for a criterion: an id like "criterion-a", or a heading that names it. */
export function guideSectionFor(g: CourseworkGuide, letter: string, name?: string): string | null {
  const l = letter.toLowerCase();
  const byId = g.sections.find((s) => s.id === `criterion-${l}` || s.id === `criterion-${l}-${(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}` || s.id.startsWith(`criterion-${l}-`));
  if (byId) return byId.id;
  const byHeading = g.sections.find((s) => new RegExp(`^criterion ${l}\\b`, "i").test(s.heading) || (!!name && s.heading.toLowerCase().includes(name.toLowerCase())));
  return byHeading?.id ?? null;
}

const guideCache = new Map<string, Promise<GuideResponse>>();
export function loadGuide(rubricId: string): Promise<GuideResponse> {
  let hit = guideCache.get(rubricId);
  if (!hit) {
    hit = courseworkApi.guide(rubricId).catch((err) => {
      guideCache.delete(rubricId);
      throw err;
    });
    guideCache.set(rubricId, hit);
  }
  return hit;
}

export function GuideView({ rubric, focus, fullHref }: { rubric: RubricSummary; /** A criterion letter to open at. */ focus?: { letter: string; n: number } | null; fullHref?: string }) {
  const { t } = useCw();
  const [state, setState] = useState<{ id: string; guide: GuideResponse | null; failed: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGuide(rubric.id)
      .then((g) => !cancelled && setState({ id: rubric.id, guide: g, failed: false }))
      .catch(() => !cancelled && setState({ id: rubric.id, guide: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [rubric.id]);
  const guide = state?.id === rubric.id ? state.guide?.guide ?? null : null;
  const loading = !state || state.id !== rubric.id;
  useEffect(() => {
    if (!guide || !focus) return;
    const id = guideSectionFor(guide, focus.letter, rubric.criteria.find((c) => c.letter === focus.letter)?.name);
    const el = id ? ref.current?.querySelector<HTMLElement>(`#sec-${CSS.escape(id)}`) : null;
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [guide, focus, rubric.criteria]);
  const title = t("cw.start.guide", { name: componentTitle(rubric) });
  if (loading) return <div className="h-40 animate-pulse rounded-[var(--r-card)] bg-muted" aria-busy="true" />;
  if (!guide) return <p className="text-ui text-muted-foreground">{t("cw.guide.none")}</p>;
  return (
    <div ref={ref} className="notes-look cw-guide">
      <h2 className="page-h2">{title}</h2>
      <p className="mt-1 text-ui text-foreground/80">{guide.objectiveLine}</p>
      <div className="mt-6">
        <PublicNoteBody note={guideContent(guide, title)} />
      </div>
      {fullHref && (
        <Link href={fullHref} className="mt-6 inline-flex min-h-11 items-center text-ui font-bold text-foreground underline decoration-border-strong decoration-2 underline-offset-4">
          {t("cw.guide.full")}
        </Link>
      )}
    </div>
  );
}

/* ---------- The panel ---------- */

export type PanelView = "feedback" | "next" | "rubric" | "guide" | "chat";

export interface GradePanelProps {
  grader: Grader;
  /** The document as it is now (for word counts and "edited since this review"). */
  text: string;
  words: number;
  view: PanelView;
  onView: (view: PanelView) => void;
  /** Shows a quoted passage in the document. */
  onShowQuote: (anchorId: string) => void;
  /** Where each quoted passage is ("Method"), by anchor id. */
  places: Map<string, string>;
  /** The feedback item a tapped passage belongs to. */
  open: FeedbackHost["open"];
  onGuide: (letter: string) => void;
  guideFocus: { letter: string; n: number } | null;
  /** The conversation about this piece; absent where the server has no chat. */
  chat: (ChatState & { ask: (message: string) => void }) | null;
  phone: boolean;
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * The Grade panel: pick the component, ask for a review, wait, then read it
 * as Feedback (the result, three fixes, a card per criterion, citations),
 * Next steps (a checklist), the Rubric, the Guide, or Chat. It only needs a
 * document's text and a way to show a passage, so it is the same panel on the
 * coursework page and beside any editor that opens it (a student's notes:
 * "Grade" in the toolbar).
 */
export function GradePanel({ grader, text, words, view, onView, onShowQuote, places, open, onGuide, guideFocus, chat, phone }: GradePanelProps) {
  const { t } = useCw();
  const { review, rubric } = grader;

  if (grader.phase === "loading") return <div className="h-48 animate-pulse rounded-[var(--r-card)] bg-muted" aria-busy="true" />;
  if (grader.phase === "unavailable") return <p className="text-ui text-muted-foreground">{t("cw.unavailable")}</p>;
  if (grader.phase === "error") {
    return (
      <div role="alert">
        <p className="text-ui text-foreground/80">{t("cw.loadFailed")}</p>
        <button type="button" onClick={grader.retry} className="mt-1 min-h-11 text-ui font-extrabold text-foreground underline decoration-2 underline-offset-4">
          {t("cw.retry")}
        </button>
      </div>
    );
  }

  const result = review?.status === "completed" ? review.result : null;

  if (view === "guide") {
    if (!rubric) return <p className="text-ui text-muted-foreground">{t("cw.review.pickSub")}</p>;
    return <GuideView rubric={rubric} focus={guideFocus} fullHref={`/library/coursework/${encodeURIComponent(rubric.key)}`} />;
  }
  if (view === "rubric") {
    if (!rubric) return <p className="text-ui text-muted-foreground">{t("cw.rubric.none")}</p>;
    return <RubricView rubric={rubric} result={result} hideMarks={grader.hideMarks} />;
  }
  if (view === "chat" && chat) return <ChatView chat={chat} result={result} hideMarks={grader.hideMarks} />;
  if (view === "next") {
    if (!review || !result) return <p className="text-ui text-muted-foreground">{t("cw.next.none")}</p>;
    return (
      <NextSteps
        reviewId={review.id}
        result={result}
        hideMarks={grader.hideMarks}
        onOpenCriterion={(letter) => {
          onView("feedback");
          // The card opens once the feedback is on screen.
          requestAnimationFrame(() => document.getElementById(`cw-crit-${letter}`)?.scrollIntoView({ block: "start" }));
        }}
      />
    );
  }

  // No component yet: that is the first question.
  if (!rubric) {
    return (
      <div>
        <h2 className="page-h2">{t("cw.review.pick")}</h2>
        <p className="mb-4 mt-1 text-ui text-foreground/80">{t("cw.review.pickSub")}</p>
        <ComponentPicker rubrics={grader.rubrics} onPick={(r) => grader.setRubric(r.id)} dense />
      </div>
    );
  }

  const rubricNote = (
    <p className="text-small text-muted-foreground">
      {t(grader.mode === "feedback" ? "cw.rubric.usesFeedback" : "cw.rubric.uses", { line: rubricLine(rubric) })}
      {rubric.status === "draft" && <> · {t("cw.rubric.draft")}</>}
    </p>
  );

  if (grader.running) {
    return (
      <div className="flex flex-col gap-6">
        <ResultSummary result={null} hideMarks={false} fresh={false} reading />
        <GradingWait stage={review?.stage} />
        <p className="-mt-2 text-ui text-foreground/80">{t("cw.wait.keep")}</p>
      </div>
    );
  }

  if (!review || review.status === "failed" || !review.result) {
    return (
      <div className="flex flex-col gap-5">
        {review?.status === "failed" && (
          <div role="alert">
            <h2 className="page-h2">{t("cw.err.failedTitle")}</h2>
            <p className="mt-1 text-ui text-foreground/80">{review.error && !/did not count/i.test(review.error) ? `${review.error} ` : ""}{t("cw.err.failed")}</p>
          </div>
        )}
        <ReviewAction grader={grader} words={words} wide={phone} />
        {rubricNote}
        <p className="text-small text-muted-foreground">{t("cw.start.promise")}</p>
      </div>
    );
  }

  const edited = review.snapshotText !== null && !same(review.snapshotText, text);
  const isLatest = grader.rows[grader.rows.length - 1]?.id === review.id;
  const marked = review.result.mode === "marked";
  const action = <ReviewAction grader={grader} words={words} wide={phone} />;

  return (
    <div className="flex flex-col gap-7">
      {/* Edited since the review: the next review is the next step, so it comes first. */}
      {edited && isLatest && action}
      <Feedback
        result={review.result}
        citations={review.citations}
        hideMarks={grader.hideMarks}
        phone={phone}
        host={{ text, onShowQuote, open, onGuide, places }}
        summary={<ResultSummary result={review.result} hideMarks={grader.hideMarks} fresh={grader.fresh} />}
        onNextSteps={() => onView("next")}
        footer={
          <footer className="flex flex-col gap-2 border-t border-border pt-5">
            <p className="text-small text-muted-foreground">{review.result.disclaimer}</p>
            <p className="text-small text-muted-foreground">
              {t(review.rubric.status === "draft" ? "cw.foot.rubricDraft" : "cw.foot.rubric", { line: rubricLine(review.rubric) })}. {t("cw.foot.never")}
            </p>
            {!marked && <p className="text-small text-muted-foreground">{t("cw.act.needMarks")}</p>}
          </footer>
        }
      />
      {/* Nothing edited yet: the next draft is what comes after reading the feedback. */}
      {!(edited && isLatest) && isLatest && <div className="border-t border-border pt-6">{action}</div>}
    </div>
  );
}
