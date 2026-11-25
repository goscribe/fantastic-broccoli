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
import "@/lib/i18n/written-work";
import { cn } from "@/lib/utils";
import { Brain, Send, CheckCircle2, RotateCcw, Loader2, Check, X } from "lucide-react";
import { textareaClass } from "@/components/ui/input";

interface ComprehensionActivityProps {
  activityId: string;
  content: ComprehensionContent;
  draft?: Record<string, unknown>;
  onComplete: () => void;
}

/** A check with one question is the short form; old checks (no question) are the rewrite. */
export function ComprehensionActivity(props: ComprehensionActivityProps) {
  return props.content.question ? <ShortCheck {...props} /> : <RewriteCheck {...props} />;
}

/**
 * The short comprehension check: the passage and ONE question, answered in a
 * sentence or two (a recall check: pick an option, then say why in a line).
 * One "Check" gives feedback against the key points and the model answer;
 * Continue is always there after it, and Skip shows the model answer.
 * The rewrite-the-passage check it replaces was finished 3% of the time.
 */
function ShortCheck({ activityId, content, draft, onComplete }: ComprehensionActivityProps) {
  const { t } = useI18n();
  const restored = restoredDraft(activityId, draft) as Partial<{ text: string; choice: number | null }> | undefined;
  const [text, setText] = useState(restored?.text ?? "");
  const [choice, setChoice] = useState<number | null>(restored?.choice ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [local, setLocal] = useState<ComprehensionEvaluation | null>(null);
  useActivityDraft(activityId, { text, choice });

  const options = content.options ?? [];
  const isChoice = options.length >= 2 && (content.answerIndex ?? -1) >= 0;
  const result = local ?? content.evaluations[content.evaluations.length - 1] ?? null;
  const done = !!result || skipped;
  const canCheck = (isChoice ? choice !== null : true) && text.trim().length >= 3 && !busy;

  const check = async () => {
    setBusy(true);
    setError("");
    try {
      setLocal(await submitComprehensionRewrite({ activityId, rewrite: text.trim(), ...(isChoice && choice !== null ? { choiceIndex: choice } : {}) }));
    } catch {
      setError(t("session.evaluationFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="life-rise whitespace-pre-wrap text-read leading-[1.7] text-foreground">
        <MarkdownText text={content.originalText} />
      </div>
      <p className="text-[19px] font-extrabold leading-[1.35] text-foreground" data-testid="comp-question">
        <MarkdownText text={content.question ?? ""} />
      </p>
      {isChoice && (
        <div className="grid gap-2.5" role="radiogroup">
          {options.map((opt, i) => {
            const right = i === content.answerIndex;
            const picked = choice === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={done || busy}
                onClick={() => setChoice(i)}
                className={cn(
                  "min-h-12 touch-manipulation rounded-2xl px-4 py-3 text-left text-ui font-semibold ring-inset transition-colors",
                  done && right
                    ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                    : done && picked
                      ? "bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                      : picked
                        ? "bg-accent-soft ring-2 ring-accent"
                        : "bg-muted text-foreground hover:bg-[var(--edge)]",
                )}
              >
                <MarkdownText text={opt} />
              </button>
            );
          })}
        </div>
      )}
      {!done ? (
        <>
          {(!isChoice || choice !== null) && (
            <div>
              {isChoice && <p className="mb-1.5 text-small font-bold text-muted-foreground">{t("comp.why")}</p>}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t(isChoice ? "comp.whyPlaceholder" : "comp.answerPlaceholder")}
                aria-label={t(isChoice ? "comp.why" : "comp.answerPlaceholder")}
                rows={isChoice ? 2 : 3}
                enterKeyHint="done"
                className={cn(playField, "min-h-[88px] text-[17px] leading-[1.55]")}
              />
            </div>
          )}
          {error && <p className="text-small font-bold text-rose-700" role="alert">{error}</p>}
          <PlayActions>
            <button type="button" onClick={() => setSkipped(true)} disabled={busy} className={cn(playLink, "justify-center text-muted-foreground sm:mr-3")}>
              {t("comp.skip")}
            </button>
            <PlayPrimary onClick={check} disabled={!canCheck}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? t("written.checking") : t("comp.checkAnswer")}
            </PlayPrimary>
          </PlayActions>
        </>
      ) : (
        <div className="life-rise space-y-4" role="status">
          {result?.feedback && (
            <p className="text-ui text-foreground">
              <MarkdownText text={result.feedback} />
            </p>
          )}
          {(content.keyPoints?.length ?? 0) > 0 && (
            <div>
              <p className="text-small font-extrabold text-foreground">{t("comp.pointsMade")}</p>
              <ul className="mt-2 space-y-2">
                {content.keyPoints!.map((point, i) => {
                  const made = result?.points?.[i]?.made;
                  return (
                    <li key={i} className="flex items-start gap-3 text-ui">
                      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", made ? "bg-emerald-600" : made === false ? "bg-rose-500" : "bg-[var(--edge)]")}>
                        {made ? <Check className="size-3.5" strokeWidth={3.5} /> : made === false ? <X className="size-3.5" strokeWidth={3.5} /> : null}
                      </span>
                      <span className="min-w-0 flex-1"><MarkdownText text={point} /></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {content.modelAnswer && (
            <div className="rounded-2xl bg-muted px-4 py-3 text-ui" data-testid="comp-model">
              <p className="mb-1 text-small font-extrabold">{t("written.modelAnswerLabel")}</p>
              <MarkdownText text={content.modelAnswer} />
            </div>
          )}
          <PlayActions>
            <PlayPrimary onClick={onComplete}>{t("comp.continue")}</PlayPrimary>
          </PlayActions>
        </div>
      )}
    </div>
  );
}

/** The old rewrite-the-passage check. Never a dead end: after one attempt, Continue is offered whatever the score. */
function RewriteCheck({
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
              {evaluations.length > 0 && (
                <button type="button" onClick={onComplete} className={cn(playLink, "justify-center text-muted-foreground sm:mr-3")}>
                  {t("comp.continueAnyway")}
                </button>
              )}
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
            {evaluations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onComplete}>
                {t("comp.continueAnyway")}
              </Button>
            )}
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
