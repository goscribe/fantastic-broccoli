"use client";

import Image from "next/image";
import { McqOptionBody, McqQuestionBody, optionsHaveFigures } from "@/components/session/mcq-rich";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  proficiencyApi,
  type BankAnswerResult,
  type PrecheckItem,
  type PrecheckTopic,
  type ProficiencyLevel,
  type TopicLevel,
} from "@/lib/api/proficiency";
import { WarmupQuiz } from "@/components/onboarding/warmup-quiz";
import { HERO_KEY, HERO_OPTION } from "@/components/session/quiz-row";
import { studySessionApi, type ApiWarmupQuestion } from "@/lib/api/study-session";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import "@/app/design/design.css";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, X } from "lucide-react";

// Flat on the page like the session player; no card around it.
const HERO = "w-full text-left";

const SECTION = "mt-4 border-t border-border pt-3 text-left";

/** Up to two questions per topic: start in the middle, then step up after a right answer or down after a wrong one. */
const PER_TOPIC = 2;

/** Long label: what the level means for this topic. */
export const LEVEL_KEY: Record<ProficiencyLevel, string> = {
  unknown: "prof.levelUnknown",
  beginner: "prof.levelBeginner",
  developing: "prof.levelDeveloping",
  secure: "prof.levelSecure",
};

/** One- or two-word badge label. */
export const LEVEL_SHORT_KEY: Record<ProficiencyLevel, string> = {
  unknown: "prof.shortUnknown",
  beginner: "prof.shortBeginner",
  developing: "prof.shortDeveloping",
  secure: "prof.shortSecure",
};

/** What the session will do with a topic at this level. */
export const LEVEL_PLAN_KEY: Record<ProficiencyLevel, string> = {
  unknown: "prof.planUnknown",
  beginner: "prof.planBeginner",
  developing: "prof.planDeveloping",
  secure: "prof.planSecure",
};

/** Badge colours: rose (new) → amber (getting there) → violet (secure). */
export const LEVEL_TONE: Record<ProficiencyLevel, string> = {
  unknown: "bg-muted text-muted-foreground",
  beginner: "bg-rose-500/12 text-rose-600 [html.dark:not(.new-ui)_&]:text-rose-300",
  developing: "bg-amber-500/15 text-amber-700 [html.dark:not(.new-ui)_&]:text-amber-300",
  secure: "bg-accent-soft text-accent",
};

/** Solid fill for meters and dots, same scale as LEVEL_TONE. */
export const LEVEL_FILL: Record<ProficiencyLevel, string> = {
  unknown: "bg-faint/50",
  beginner: "bg-rose",
  developing: "bg-amber",
  secure: "bg-accent",
};

/** 0–3: how many pips of the level meter are lit. */
export const LEVEL_RANK: Record<ProficiencyLevel, number> = {
  unknown: 0,
  beginner: 1,
  developing: 2,
  secure: 3,
};

/** Rough mastery for a topic that has a level but no fresh answer this check. */
const LEVEL_MASTERY: Record<ProficiencyLevel, number> = {
  unknown: 0.08,
  beginner: 0.3,
  developing: 0.58,
  secure: 0.86,
};

/** Three pips that light up with the level, like a signal meter. */
export function LevelPips({ level, className }: { level: ProficiencyLevel; className?: string }) {
  const rank = LEVEL_RANK[level];
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[4px] rounded-full", i < rank ? LEVEL_FILL[level] : "bg-border-strong/70")}
          style={{ height: 6 + i * 3 }}
        />
      ))}
    </span>
  );
}

/** Level badge: pips + short label. */
export function LevelBadge({ level, className }: { level: ProficiencyLevel; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title={t(LEVEL_KEY[level])}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none",
        LEVEL_TONE[level],
        className,
      )}
    >
      <LevelPips level={level} />
      {t(LEVEL_SHORT_KEY[level])}
    </span>
  );
}

/** Where the quick check (and the warm-up after it) reads and marks questions; /design previews pass fixtures. */
export interface QuizApi {
  precheck: (workspaceId: string, focus?: string, sessionId?: string) => Promise<PrecheckTopic[]>;
  answer: (input: { workspaceId: string; artifactId: string; index: number; selectedIndex: number }) => Promise<BankAnswerResult>;
  warmup: (workspaceId: string) => Promise<ApiWarmupQuestion[]>;
}

export const LIVE_QUIZ_API: QuizApi = {
  precheck: proficiencyApi.precheck,
  answer: proficiencyApi.answerBankQuestion,
  warmup: studySessionApi.getWarmupQuiz,
};

interface Step {
  topicIndex: number;
  /** Position in the topic's ladder (easiest → hardest). */
  rung: number;
  asked: number;
}

function firstStep(topics: PrecheckTopic[], topicIndex: number): Step | null {
  const t = topics[topicIndex];
  if (!t) return null;
  return { topicIndex, rung: Math.floor((t.ladder.length - 1) / 2), asked: 0 };
}

/** True when this answer ends the topic (mirrors the ladder logic in `next`). */
function isLastForTopic(topic: PrecheckTopic, step: Step, correct: boolean): boolean {
  const rung = correct ? step.rung + 1 : step.rung - 1;
  return !(step.asked + 1 < PER_TOPIC && rung >= 0 && rung < topic.ladder.length);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Adaptive pre-lesson check shown on the session loading screen: up to two
 * question-bank questions per topic, starting in the middle of each topic's
 * difficulty ladder and stepping up or down on the answer. Answers are
 * marked server-side and update the topic rating that the session plan is
 * shaped around. Falls back to the plain warm-up quiz when the bank has no
 * topics yet (or after the check is skipped).
 */
export function SessionPrecheck({
  workspaceId,
  focus,
  sessionId,
  hero = false,
  api = LIVE_QUIZ_API,
  onShown,
}: {
  workspaceId: string;
  focus?: string;
  /** The session being built: the check asks about its planned topics (`focus` is the fallback). */
  sessionId?: string;
  hero?: boolean;
  api?: QuizApi;
  /** Whether a question, the results or the warm-up is on screen (the wait screen then shrinks its build header). */
  onShown?: (shown: boolean) => void;
}) {
  const { t } = useI18n();
  const [topics, setTopics] = useState<PrecheckTopic[] | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctIndex: number; explanation: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [levels, setLevels] = useState<Record<string, TopicLevel>>({});
  const [skipped, setSkipped] = useState(false);
  const [score, setScore] = useState({ right: 0, answered: 0 });
  const [burst, setBurst] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [warmupShown, setWarmupShown] = useState(false);
  const checking = topics !== null && topics.length > 0 && !skipped;
  const shown = checking || (topics !== null && warmupShown);
  useEffect(() => {
    onShown?.(shown);
  }, [shown, onShown]);

  useEffect(() => {
    let cancelled = false;
    api
      .precheck(workspaceId, focus, sessionId)
      .then((rows) => {
        if (cancelled) return;
        const usable = rows.filter((r) => r.ladder.length > 0);
        setTopics(usable);
        setStep(firstStep(usable, 0));
      })
      .catch(() => !cancelled && setTopics([]));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, focus, sessionId, api]);

  const item: PrecheckItem | undefined = useMemo(
    () => (topics && step ? topics[step.topicIndex]?.ladder[step.rung] : undefined),
    [topics, step],
  );

  const answer = useCallback(
    async (selectedIndex: number) => {
      if (!item || picked !== null) return;
      setPicked(selectedIndex);
      setSubmitting(true);
      try {
        const res = await api.answer({
          workspaceId,
          artifactId: item.artifactId,
          index: item.index,
          selectedIndex,
        });
        setResult(res);
        setScore((s) => ({ right: s.right + (res.correct ? 1 : 0), answered: s.answered + 1 }));
        if (res.topic && topics && step) {
          const key = topics[step.topicIndex].topic;
          setLevels((prev) => ({ ...prev, [key]: res.topic! }));
        }
      } catch {
        setResult({ correct: false, correctIndex: -1, explanation: "" });
      } finally {
        setSubmitting(false);
      }
    },
    [item, picked, workspaceId, topics, step, api],
  );

  const next = useCallback(() => {
    if (!topics || !step || !result) return;
    const ladder = topics[step.topicIndex].ladder;
    const asked = step.asked + 1;
    const rung = result.correct ? step.rung + 1 : step.rung - 1;
    setPicked(null);
    setResult(null);
    if (asked < PER_TOPIC && rung >= 0 && rung < ladder.length) {
      setStep({ ...step, rung, asked });
    } else {
      const following = firstStep(topics, step.topicIndex + 1);
      setStep(following);
      // Finished the whole check with at least half right: a little celebration.
      if (!following && hero && score.right * 2 >= score.answered && score.right > 0) setBurst((b) => b + 1);
    }
  }, [topics, step, result, hero, score]);

  // Hand focus to Next once the answer is marked, so Enter / Space continues.
  useEffect(() => {
    if (result) nextRef.current?.focus({ preventScroll: true });
  }, [result]);

  // Keyboard: 1–4 picks an option, Enter moves on.
  useEffect(() => {
    if (!item || skipped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (picked === null) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= item.options.length) {
          e.preventDefault();
          void answer(n - 1);
        }
      } else if (e.key === "Enter" && result && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, skipped, picked, result, answer, next]);

  if (topics === null) return null;
  if (topics.length === 0 || skipped) return <WarmupQuiz workspaceId={workspaceId} hero={hero} load={api.warmup} onShown={setWarmupShown} />;

  const wrap = hero ? HERO : SECTION;
  const levelOf = (topic: PrecheckTopic): ProficiencyLevel => levels[topic.topic]?.level ?? topic.level;

  /* ---------- Results ---------- */
  if (!step || !item) {
    return (
      <div className={cn(wrap, "animate-fade-up")}>
        <ConfettiBurst burst={burst} />
        <div className="flex items-center gap-3.5">
          <Image
            src="/design/cat3-cheer.webp"
            alt=""
            width={hero ? 48 : 40}
            height={hero ? 57 : 48}
            unoptimized
            className={cn("cat-cheer shrink-0 select-none object-contain", hero ? "h-12 w-auto" : "h-10 w-auto")}
          />
          <div className="min-w-0">
            <p className={cn("font-bold leading-snug", hero ? "text-ui font-extrabold" : "text-sm")}>
              {t("prof.doneTitle")}
            </p>
            <p className={cn("mt-0.5 text-muted-foreground", hero ? "text-small" : "text-xs")}>
              {score.answered > 0 &&
                t("prof.score")
                  .replace("{right}", String(score.right))
                  .replace("{total}", String(score.answered)) + " · "}
              {t("prof.doneHint")}
            </p>
          </div>
        </div>
        <ul className={cn("grid", hero ? "mt-3" : "mt-3 gap-2")}>
          {topics.map((topic, i) => {
            const level = levelOf(topic);
            const mastery = levels[topic.topic]?.mastery ?? LEVEL_MASTERY[level];
            return (
              <li
                key={topic.topic}
                className={cn(
                  "animate-fade-up border-b border-border last:border-0",
                  hero ? "py-2.5" : "py-2.5",
                )}
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("min-w-0 font-semibold leading-snug", hero ? "text-small" : "text-[13px]")}>
                    {topic.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {levels[topic.topic] && (
                      <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
                        {Math.round(mastery * 100)}%
                      </span>
                    )}
                    <LevelBadge level={level} />
                  </span>
                </div>
                <div
                  className={cn("h-1.5 overflow-hidden rounded-full bg-muted", hero ? "mt-2" : "mt-2.5")}
                  role="meter"
                  aria-label={t("prof.masteryLabel")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(mastery * 100)}
                >
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-700 ease-out", LEVEL_FILL[level])}
                    style={{ width: `${Math.max(6, Math.round(mastery * 100))}%` }}
                  />
                </div>
                <p className={cn("text-muted-foreground", hero ? "mt-1.5 text-caption" : "mt-2 text-[12px] leading-snug")}>{t(LEVEL_PLAN_KEY[level])}</p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ---------- Question ---------- */
  const topic = topics[step.topicIndex];
  const total = topics.length;
  const isFirst = step.topicIndex === 0 && step.asked === 0;
  const finishing = result !== null && step.topicIndex === total - 1 && isLastForTopic(topic, step, result.correct);

  return (
    <div className={wrap}>
      {/* Header: mascot, title, skip */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-accent", hero ? "text-caption font-bold uppercase tracking-wide" : "text-[11px] font-semibold uppercase tracking-wide")}>
            {t("prof.checkTitle")}
          </p>
          {hero && isFirst ? (
            <p className="mt-0.5 text-small text-muted-foreground">{t("prof.checkHint")}</p>
          ) : (
            <p className={cn("mt-0.5 truncate text-muted-foreground", hero ? "text-small" : "text-[11.5px]")}>
              <span className="font-semibold text-foreground">{topic.label}</span>
              <span className="mx-1.5">·</span>
              <span className="tabular-nums">
                {t("prof.topicOf").replace("{n}", String(step.topicIndex + 1)).replace("{total}", String(total))}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSkipped(true)}
          className={cn(
            "shrink-0 rounded-full font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            hero ? "-my-1.5 -mr-2 min-h-9 px-3 text-small font-semibold" : "-mr-1 px-2 py-0.5 text-[11.5px]",
          )}
        >
          {t("prof.skip")}
        </button>
      </div>

      {/* Per-topic stepper: finished topics take their level colour. */}
      <div className={cn("flex items-center gap-1.5", hero ? "mt-3" : "mt-2.5")} aria-hidden>
        {topics.map((tp, i) => {
          const done = i < step.topicIndex;
          const current = i === step.topicIndex;
          const fill = current ? (step.asked + (result ? 1 : 0)) / PER_TOPIC : 0;
          return (
            <span
              key={tp.topic}
              title={tp.label}
              className={cn(
                "relative h-1.5 flex-1 overflow-hidden rounded-full transition-colors",
                done ? LEVEL_FILL[levelOf(tp)] : current ? "bg-accent/20" : "bg-muted",
              )}
            >
              {current && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(18, fill * 100)}%` }}
                />
              )}
            </span>
          );
        })}
      </div>
      {hero && isFirst && (
        <p className="mt-2 truncate text-small text-muted-foreground">
          <span className="font-semibold text-foreground">{topic.label}</span>
          <span className="mx-1.5">·</span>
          <span className="tabular-nums">
            {t("prof.topicOf").replace("{n}", "1").replace("{total}", String(total))}
          </span>
        </p>
      )}

      {/* Question + options, slide in on each new question */}
      <div key={`${step.topicIndex}-${step.asked}`} className="animate-slide-in-right">
        <div className={hero ? "mt-3 text-read font-bold leading-snug" : "mt-2.5 text-sm font-medium"}>
          <McqQuestionBody text={item.question} figures={item.figures} options={item.options} />
        </div>
        <div className={cn(hero ? "mt-3 grid gap-2" : "mt-2 grid gap-1.5 sm:grid-cols-2", optionsHaveFigures(item.options) && "grid-cols-2")}>
          {item.options.map((option, i) => {
            const done = result !== null;
            const isCorrect = done && i === result.correctIndex;
            const isPicked = i === picked;
            const wrong = done && isPicked && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => void answer(i)}
                className={cn(
                  "group flex w-full items-center border bg-card text-left font-medium transition-[border-color,background-color,opacity,box-shadow] duration-200",
                  hero ? HERO_OPTION : "gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                  picked === null &&
                    "border-border hover:border-accent hover:bg-accent-soft/40 hover:shadow-[0_2px_10px_-4px_rgba(124,58,237,0.35)] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                  isCorrect && "animate-answer-pop border-accent bg-accent-soft/60",
                  wrong && "animate-answer-shake border-rose/60 bg-rose/10",
                  done && !isPicked && !isCorrect && "border-border/60 opacity-50",
                  submitting && isPicked && "animate-pulse border-accent/60",
                )}
              >
                {hero && (
                  <span
                    className={cn(
                      HERO_KEY,
                      isCorrect
                        ? "bg-accent text-white"
                        : wrong
                          ? "bg-rose text-white"
                          : isPicked
                            ? "bg-accent/80 text-white"
                            : "bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-white",
                    )}
                  >
                    {isCorrect ? <Check className="size-4" strokeWidth={3} /> : wrong ? <X className="size-4" strokeWidth={3} /> : i + 1}
                  </span>
                )}
                {!hero && isCorrect && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                {!hero && wrong && <X className="h-3.5 w-3.5 shrink-0 text-rose" />}
                <span className="min-w-0 flex-1">
                  <McqOptionBody text={option} figures={item.figures} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback */}
      {result ? (
        <div
          className={cn(
            "animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            hero ? "mt-3 rounded-[var(--r-control)] px-3.5 py-2.5" : "mt-2.5 rounded-xl px-3 py-2",
            result.correct ? "bg-accent-soft/70" : "bg-rose-500/8",
          )}
          aria-live="polite"
        >
          <div className={cn("min-w-0 flex-1 text-muted-foreground", hero ? "text-small" : "text-xs")}>
            <p className={cn("mb-0.5 font-bold", hero && "text-ui", result.correct ? "text-accent" : "text-rose-600 [html.dark:not(.new-ui)_&]:text-rose-300")}>
              {result.correct ? t("prof.correct") : t("prof.notQuite")}
            </p>
            {result.explanation && <MarkdownText text={result.explanation} />}
          </div>
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 self-stretch rounded-xl bg-accent font-semibold text-white shadow-[0_6px_16px_-8px_rgba(124,58,237,0.7)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:self-auto",
              hero ? "h-10 rounded-[var(--r-control)] px-4 text-small" : "h-7 px-3 text-xs",
            )}
          >
            {finishing ? t("prof.seeResults") : t("prof.next")}
            <ArrowRight className={hero ? "size-4" : "size-3.5"} />
          </button>
        </div>
      ) : (
        hero && (
          <p className="mt-3 hidden text-caption text-faint sm:block">
            {t("prof.keysHint")}
          </p>
        )
      )}
    </div>
  );
}
