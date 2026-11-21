"use client";

import { PlayActions, PlayPrimary, playLink } from "@/components/session/play-ui";
import { useNewUi } from "@/lib/new-ui";
import { useEffect, useRef, useState } from "react";
import { ExplainAloudContent } from "@/types";
import { MathText } from "@/components/ui/markdown-text";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, Square } from "lucide-react";

interface ExplainAloudActivityProps {
  content: ExplainAloudContent;
  onComplete: () => void;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function ExplainAloudActivity({
  content,
  onComplete,
}: ExplainAloudActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const [phase, setPhase] = useState<"idle" | "recording" | "review">("idle");
  const [seconds, setSeconds] = useState(0);
  const [covered, setCovered] = useState<boolean[]>(
    content.keyPoints.map(() => false),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  if (newUi) {
    const got = covered.filter(Boolean).length;
    return (
      <div className="space-y-5">
        <p data-scroll-line className="text-[13px] font-semibold text-muted-foreground">{t("session.explainTitle")}</p>
        {/* The prompt is the headline of the page, not a box on it. */}
        <p className="life-rise text-[24px] font-extrabold leading-[1.25] tracking-tight text-foreground sm:text-[28px]">
          <MathText text={content.prompt} />
        </p>

        {phase === "idle" && (
          <>
            <p className="text-[14.5px] leading-6 text-muted-foreground">{t("session.explainHint")}</p>
            <PlayActions>
              <PlayPrimary onClick={() => setPhase("recording")}>{t("session.startExplaining")}</PlayPrimary>
            </PlayActions>
          </>
        )}

        {phase === "recording" && (
          <div className="life-rise space-y-4">
            <div className="flex items-end gap-[3px] h-12" aria-hidden>
              {Array.from({ length: 40 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 flex-1 rounded-full bg-accent/60 animate-wave motion-reduce:animate-none"
                  style={{ height: `${30 + ((i * 41) % 70)}%`, animationDelay: `${(i % 8) * 0.12}s` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2.5 text-[15.5px] font-extrabold" role="timer">
                <span className="size-2.5 rounded-full bg-rose-500 animate-pulse-dot motion-reduce:animate-none" aria-hidden />
                {t("session.listening")}
                <span className="font-semibold tabular-nums text-muted-foreground">{formatTime(seconds)}</span>
              </p>
              <PlayPrimary onClick={() => setPhase("review")}>{t("session.done")}</PlayPrimary>
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="life-rise space-y-4">
            <p className="text-[15.5px] font-extrabold">
              {t("session.keyPointsQuestion")}
              <span className="ml-2 font-semibold tabular-nums text-muted-foreground">
                {got}/{content.keyPoints.length}
              </span>
            </p>
            <div className="space-y-2.5">
              {content.keyPoints.map((point, i) => (
                <button
                  key={point}
                  type="button"
                  aria-pressed={covered[i]}
                  onClick={() => {
                    const next = [...covered];
                    next[i] = !next[i];
                    setCovered(next);
                  }}
                  className={cn(
                    "flex min-h-[56px] w-full touch-manipulation items-center gap-3 rounded-[28px] px-3.5 py-3 text-left text-[15.5px] font-semibold leading-snug ring-inset transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
                    covered[i] ? "life-pop bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500" : "bg-muted text-foreground hover:bg-[var(--edge)]",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", covered[i] ? "bg-emerald-600 text-white" : "bg-card text-transparent")}>
                    <Check className="size-4" strokeWidth={3.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <MathText text={point} />
                  </span>
                </button>
              ))}
            </div>
            <PlayActions>
              <button
                type="button"
                onClick={() => {
                  setPhase("recording");
                  setSeconds(0);
                }}
                className={cn(playLink, "justify-center sm:mr-3")}
              >
                {t("session.explainAgain")}
              </button>
              <PlayPrimary onClick={onComplete}>
                {t("session.continue")}
                <ArrowRight className="ml-1.5 size-4" />
              </PlayPrimary>
            </PlayActions>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className={newUi ? "mb-1.5 text-[15px] font-semibold text-muted-foreground" : "text-sm font-semibold mb-1.5"}>
        {t("session.explainTitle")}
      </p>
      <p className="text-xs text-muted-foreground mb-5">
        {t("session.explainHint")}
      </p>

      <Surface muted className="p-4 mb-5">
        <p className={newUi ? "text-[20px] font-bold leading-[1.35] text-foreground" : "text-sm text-foreground font-medium"}>
          <MathText text={content.prompt} />
        </p>
      </Surface>

      {phase === "idle" && (
        <Button size="sm" onClick={() => setPhase("recording")}>
          <span className="h-2 w-2 rounded-full bg-rose mr-2" />
          {t("session.startExplaining")}
        </Button>
      )}

      {phase === "recording" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose animate-pulse-dot" />
              <span className="text-sm font-semibold">{t("session.listening")}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatTime(seconds)}
              </span>
            </div>
            <Button size="sm" variant="danger" onClick={() => setPhase("review")}>
              <Square className="h-3 w-3 mr-1.5 fill-current" />
              {t("session.done")}
            </Button>
          </div>
          <div className="flex items-end gap-[3px] h-8" aria-hidden>
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-accent/60 animate-wave"
                style={{
                  height: `${30 + ((i * 41) % 70)}%`,
                  animationDelay: `${(i % 8) * 0.12}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "review" && (
        <div>
          <p className="text-sm font-semibold mb-3">
            {t("session.keyPointsQuestion")}
          </p>
          <div className="space-y-2 mb-5">
            {content.keyPoints.map((point, i) => (
              <button
                key={point}
                type="button"
                onClick={() => {
                  const next = [...covered];
                  next[i] = !next[i];
                  setCovered(next);
                }}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm",
                  covered[i]
                    ? "border-accent/40 bg-accent-soft text-foreground"
                    : "border-border hover:border-border-strong text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    covered[i]
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong",
                  )}
                >
                  {covered[i] && <Check className="h-3 w-3" />}
                </span>
                <MathText text={point} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setPhase("recording");
                setSeconds(0);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("session.explainAgain")}
            </button>
            <Button size="sm" onClick={onComplete}>
              {t("session.continue")}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
