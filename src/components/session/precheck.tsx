"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  proficiencyApi,
  type PrecheckItem,
  type PrecheckTopic,
  type ProficiencyLevel,
  type TopicLevel,
} from "@/lib/api/proficiency";
import { WarmupQuiz } from "@/components/onboarding/warmup-quiz";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

const HERO = "w-full rounded-3xl border border-border bg-card p-6";
const SECTION = "mt-4 border-t border-border pt-3 text-left";

/** Up to two questions per topic: start in the middle, then step up after a right answer or down after a wrong one. */
const PER_TOPIC = 2;

export const LEVEL_KEY: Record<ProficiencyLevel, string> = {
  unknown: "prof.levelUnknown",
  beginner: "prof.levelBeginner",
  developing: "prof.levelDeveloping",
  secure: "prof.levelSecure",
};

export const LEVEL_TONE: Record<ProficiencyLevel, string> = {
  unknown: "bg-muted text-muted-foreground",
  beginner: "bg-rose/15 text-rose",
  developing: "bg-amber/20 text-amber-700 dark:text-amber",
  secure: "bg-accent-soft text-accent",
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
  hero = false,
}: {
  workspaceId: string;
  focus?: string;
  hero?: boolean;
}) {
  const { t } = useI18n();
  const [topics, setTopics] = useState<PrecheckTopic[] | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctIndex: number; explanation: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [levels, setLevels] = useState<Record<string, TopicLevel>>({});
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    proficiencyApi
      .precheck(workspaceId, focus)
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
  }, [workspaceId, focus]);

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
        const res = await proficiencyApi.answerBankQuestion({
          workspaceId,
          artifactId: item.artifactId,
          index: item.index,
          selectedIndex,
        });
        setResult(res);
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
    [item, picked, workspaceId, topics, step],
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
      setStep(firstStep(topics, step.topicIndex + 1));
    }
  }, [topics, step, result]);

  if (topics === null) return null;
  if (topics.length === 0 || skipped) return <WarmupQuiz workspaceId={workspaceId} hero={hero} />;

  const wrap = hero ? HERO : SECTION;

  if (!step || !item) {
    return (
      <div className={wrap}>
        <p className="text-sm font-semibold">{t("prof.doneTitle")}</p>
        <ul className="mt-3 grid gap-2">
          {topics.map((topic) => {
            const level = levels[topic.topic]?.level ?? topic.level;
            return (
              <li key={topic.topic} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-medium">{topic.label}</span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", LEVEL_TONE[level])}>
                  {t(LEVEL_KEY[level])}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const topic = topics[step.topicIndex];
  const total = topics.length;
  return (
    <div className={wrap}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-[11px] font-semibold text-accent", !hero && "uppercase tracking-wide")}>
            {t("prof.checkTitle")}
          </p>
          {hero && step.topicIndex === 0 && step.asked === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{t("prof.checkHint")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSkipped(true)}
          className="shrink-0 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          {t("prof.skip")}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span className="truncate font-semibold text-foreground">{topic.label}</span>
        <span>·</span>
        <span className="tabular-nums">
          {step.topicIndex + 1}/{total}
        </span>
      </div>
      <div className={hero ? "mt-2 text-[20px] font-bold leading-[1.35]" : "mt-1.5 text-sm font-medium"}>
        <MarkdownText text={item.question} />
      </div>
      <div className={hero ? "mt-4 grid gap-2.5" : "mt-2 grid gap-1.5 sm:grid-cols-2"}>
        {item.options.map((option, i) => {
          const done = result !== null;
          const isCorrect = done && i === result.correctIndex;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              onClick={() => void answer(i)}
              className={cn(
                hero
                  ? "flex w-full items-center gap-3.5 rounded-[14px] border bg-card px-4 py-3 text-left text-[15px] font-medium transition-colors"
                  : "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                picked === null && "border-border hover:border-accent hover:bg-accent-soft/40",
                done && isCorrect && "border-accent bg-accent-soft/50",
                done && isPicked && !isCorrect && "border-rose/50 bg-rose/10",
                picked !== null && !isPicked && !isCorrect && "border-border/60 opacity-60",
                submitting && isPicked && "animate-pulse",
              )}
            >
              {hero && picked === null && (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-[13px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
              )}
              {done && isCorrect && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              {done && isPicked && !isCorrect && <X className="h-3.5 w-3.5 shrink-0 text-rose" />}
              <span className="min-w-0">
                <MarkdownText text={option} />
              </span>
            </button>
          );
        })}
      </div>
      {result && (
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
            <p className={cn("mb-0.5 font-semibold", result.correct ? "text-accent" : "text-rose")}>
              {result.correct ? t("prof.correct") : t("prof.notQuite")}
            </p>
            {result.explanation && <MarkdownText text={result.explanation} />}
          </div>
          <button
            type="button"
            onClick={next}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            {t("prof.next")}
          </button>
        </div>
      )}
    </div>
  );
}
