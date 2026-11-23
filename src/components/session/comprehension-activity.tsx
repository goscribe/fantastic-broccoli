"use client";

import { MarkBadge, PlayActions, PlayDone, PlayPrimary, playField, playLink } from "@/components/session/play-ui";
import { useNewUi } from "@/lib/new-ui";
import { useState } from "react";
import { ComprehensionContent, ComprehensionEvaluation } from "@/types";
import { submitComprehensionRewrite } from "@/lib/api/study";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { Brain, Send, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { textareaClass } from "@/components/ui/input";

interface ComprehensionActivityProps {
  activityId: string;
  content: ComprehensionContent;
  draft?: Record<string, unknown>;
  onComplete: () => void;
}

export function ComprehensionActivity({
  activityId,
  content,
  draft,
  onComplete,
}: ComprehensionActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const restored = restoredDraft(activityId, draft) as
    | Partial<{ userText: string; showOriginal: boolean }>
    | undefined;
  const [userText, setUserText] = useState(restored?.userText ?? "");
  const [showOriginal, setShowOriginal] = useState(
    restored?.showOriginal ?? true,
  );
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [localEvals, setLocalEvals] = useState<ComprehensionEvaluation[]>([]);
  const [localRewrites, setLocalRewrites] = useState<string[]>([]);

  useActivityDraft(activityId, { userText, showOriginal });

  const evaluations = [...content.evaluations, ...localEvals];
  const userRewrites = [...content.userRewrites, ...localRewrites];
  const latestEval = evaluations[evaluations.length - 1];
  const hasPassed = latestEval?.passed || !!content.passedAt;
  const attemptNumber = evaluations.length + 1;

  const handleSubmit = async () => {
    const text = userText.trim();
    if (!text) return;
    setEvaluating(true);
    setError("");
    try {
      const evaluation = await submitComprehensionRewrite({
        activityId,
        rewrite: text,
      });
      setLocalEvals((prev) => [...prev, evaluation]);
      setLocalRewrites((prev) => [...prev, text]);
      setUserText("");
    } catch {
      setError(t("session.evaluationFailed"));
    } finally {
      setEvaluating(false);
    }
  };

  if (newUi) {
    const last = evaluations[evaluations.length - 1];
    if (hasPassed) {
      return (
        <PlayDone
          title={t("session.compConfirmed")}
          sub={`${t("session.compUnderstoodIn")} ${evaluations.length} ${evaluations.length === 1 ? t("session.attemptNoun") : t("session.attemptsNoun")}`}
          action={t("session.continueNext")}
          onAction={onComplete}
        >
          {last?.feedback && (
            <p className="text-ui text-foreground/80">
              <MarkdownText text={last.feedback} />
            </p>
          )}
        </PlayDone>
      );
    }
    return (
      <div className="space-y-4">
        {showOriginal ? (
          <>
            <p data-scroll-line className="text-small font-semibold text-muted-foreground">{t("session.compReadInstruction")}</p>
            {/* The passage is the page: reading-size text with nothing around it. */}
            <div className="life-rise whitespace-pre-wrap text-[18px] leading-[1.7] text-foreground sm:text-[19px]">
              <MarkdownText text={content.originalText} />
            </div>
            <PlayActions className="pt-1">
              <PlayPrimary onClick={() => setShowOriginal(false)}>{t("session.compReadDone")}</PlayPrimary>
            </PlayActions>
          </>
        ) : (
          <>
            <p data-scroll-line className="text-small font-semibold text-muted-foreground">
              {t("session.attempt")} {attemptNumber}: {t("session.compWriteBack")}
            </p>
            {last && !last.passed && (
              <div className="life-rise flex items-start gap-3" role="status">
                <MarkBadge ok={false} className="mt-0.5 !size-8 [&>svg]:!size-5" />
                <div className="min-w-0 text-ui text-foreground/80">
                  <MarkdownText text={last.feedback} />
                </div>
              </div>
            )}
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder={t("session.compPlaceholder")}
              aria-label={t("session.compPlaceholder")}
              className={cn(playField, "h-44")}
            />
            {error && <p className="text-small font-bold text-rose-700" role="alert">{error}</p>}
            <PlayActions>
              <button type="button" onClick={() => setShowOriginal(true)} className={cn(playLink, "justify-center sm:mr-3")}>
                {t("session.reReadOriginal")}
              </button>
              <PlayPrimary onClick={handleSubmit} disabled={userText.trim().length < 20 || evaluating}>
                {evaluating && <Loader2 className="mr-2 size-4 animate-spin" />}
                {evaluating ? t("session.evaluating") : t("session.submit")}
              </PlayPrimary>
            </PlayActions>
            {userRewrites.length > 0 && (
              <details className="text-small text-muted-foreground">
                <summary className="flex min-h-11 cursor-pointer items-center font-bold hover:text-foreground">
                  {userRewrites.length === 1 ? t("session.yourPreviousAttempt") : t("session.yourPreviousAttempts")}
                </summary>
                <div className="space-y-3 pb-2">
                  {userRewrites.map((rewrite, i) => (
                    <p key={i} className="border-l-[3px] border-[var(--edge)] pl-4 italic leading-6">
                      &ldquo;{rewrite}&rdquo;
                    </p>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reading phase */}
      {showOriginal && (
        <Card className="border-accent/20 bg-accent/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-accent" />
            <span className="text-ui font-medium text-accent">
              {t("session.compReadInstruction")}
            </span>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-ui whitespace-pre-wrap">
              <MarkdownText text={content.originalText} />
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowOriginal(false)}
            >
              {t("session.compReadDone")}
            </Button>
          </div>
        </Card>
      )}

      {/* Rewrite phase */}
      {!showOriginal && !hasPassed && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-ui font-medium">
              {t("session.attempt")} {attemptNumber}: {t("session.compWriteBack")}
            </span>
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {t("session.reReadOriginal")}
            </button>
          </div>

          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder={t("session.compPlaceholder")}
            className={newUi ? cn(textareaClass, "h-40 px-4 py-3 text-[15px]") : "w-full h-32 rounded-lg border border-border bg-card p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"}
          />

          <div className="flex items-center justify-end gap-3">
            {error && <span className="text-caption text-destructive">{error}</span>}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={userText.trim().length < 20 || evaluating}
            >
              {evaluating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              {evaluating ? t("session.evaluating") : t("session.submit")}
            </Button>
          </div>
        </div>
      )}

      {/* Previous evaluations */}
      {evaluations.length > 0 && (
        <div className="space-y-2">
          {evaluations.map((evaluation, i) => (
            <Card
              key={i}
              className={cn(
                "text-ui",
                evaluation.passed
                  ? "border-success/20 bg-success/5"
                  : "border-warning/20 bg-warning/5",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-caption">
                  {t("session.attempt")} {evaluation.attempt}
                </span>
                <ProgressBar
                  value={evaluation.score}
                  className="w-24"
                  size="sm"
                  showLabel
                />
              </div>
              <p className="text-caption text-muted-foreground">
                <MarkdownText text={evaluation.feedback} />
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* User's previous rewrites */}
      {userRewrites.length > 0 && !hasPassed && (
        <details className="text-caption text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            {userRewrites.length === 1
              ? t("session.yourPreviousAttempt")
              : t("session.yourPreviousAttempts")}
          </summary>
          <div className="mt-2 space-y-2">
            {userRewrites.map((rewrite, i) => (
              <p key={i} className={newUi ? "rounded-xl bg-accent-soft/50 px-4 py-3 text-small italic" : "p-2 rounded-lg border border-border bg-muted/50 italic"}>
                &ldquo;{rewrite}&rdquo;
              </p>
            ))}
          </div>
        </details>
      )}

      {/* Passed state */}
      {hasPassed && (
        <Card className="border-success/20 bg-success/5 text-center">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="text-ui font-medium">{t("session.compConfirmed")}</p>
          <p className="text-caption text-muted-foreground mt-1">
            {t("session.compUnderstoodIn")} {evaluations.length}{" "}
            {evaluations.length === 1
              ? t("session.attemptNoun")
              : t("session.attemptsNoun")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="mt-3"
          >
            {t("session.continueNext")}
          </Button>
        </Card>
      )}
    </div>
  );
}
