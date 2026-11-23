"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { DraftDetail, RubricSummary } from "@/lib/api/coursework";
import { wordLine, type WordStatus } from "@/lib/coursework";
import { CATEGORY_LABEL, countWork, excludedSummary, resolveWordCountRules, type ResolvedWordCountRules, type WordBreakdown, type WordCountCategory } from "@/lib/coursework-word-count";
import { cn } from "@/lib/utils";
import { useCw } from "./use-cw";

/** The component's counting rules (the general fallback on a server that has none yet, or before one is chosen). */
export function rulesOf(rubric: Pick<RubricSummary, "wordLimit" | "wordCount"> | null | undefined): ResolvedWordCountRules {
  return resolveWordCountRules(rubric?.wordCount, rubric?.wordLimit ?? null);
}

/**
 * A draft's count under a component's rules, from the best structure it has:
 * a Word file's HTML, the editor's document as it is now, else its text
 * (with a PDF's page ranges). Mirrors the server's draftWords().
 */
export function draftBreakdown(draft: Pick<DraftDetail, "kind" | "text"> & { content?: unknown; contentHtml?: string | null; pages?: Array<{ page: number; start: number; end: number; tables?: Array<[number, number]> }> | null }, rules: ResolvedWordCountRules, live?: unknown): WordBreakdown {
  if (draft.kind === "file") return draft.contentHtml ? countWork({ html: draft.contentHtml, file: true }, rules) : countWork({ text: draft.text, pages: draft.pages ?? null, file: true }, rules);
  const doc = live ?? draft.content;
  if (doc && typeof doc === "object") return countWork({ doc }, rules);
  if (typeof doc === "string") return { ...countWork({ html: doc }, rules), estimate: false };
  return draft.contentHtml ? { ...countWork({ html: draft.contentHtml }, rules), estimate: false } : { ...countWork({ text: draft.text }, rules), estimate: false };
}

/** The line shown for a count: "About 2,140 words counted of 2,000" (no "of N" without a word limit). */
export function lineFor(b: WordBreakdown, rules: ResolvedWordCountRules, declared: number | null): WordStatus {
  return wordLine({ counted: b.counted, total: b.total, leftOut: excludedSummary(b, 4), estimate: b.estimate, limit: rules.kind === "words" ? rules.limit : null, declared: rules.kind === "words" ? declared : null });
}

const declaredKey = (documentId: string) => `scribe.coursework.myWords.${documentId}`;

export function saveDeclaredWords(documentId: string, value: number | null) {
  try {
    if (value) localStorage.setItem(declaredKey(documentId), String(value));
    else localStorage.removeItem(declaredKey(documentId));
  } catch {
    /* private mode: the count is still sent with the review */
  }
}

/** "My word count is ___" for one piece, remembered on this device. */
export function useDeclaredWords(documentId: string | null): [number | null, (v: number | null) => void] {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (!documentId) return;
    try {
      const raw = Number(localStorage.getItem(declaredKey(documentId)));
      // Reading what this device remembers is the point of the effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(Number.isFinite(raw) && raw > 0 ? raw : null);
    } catch {
      /* nothing remembered */
    }
  }, [documentId]);
  const set = useCallback(
    (v: number | null) => {
      setValue(v);
      if (documentId) saveDeclaredWords(documentId, v);
    },
    [documentId],
  );
  return [value, set];
}

const n = (v: number) => v.toLocaleString("en-GB");

/**
 * "What's counted?": the component's rule in plain words, what was left out
 * of this piece, that a count from a file is an estimate, and the student's
 * own count, which the review uses for the limit when it is given.
 */
export function WordCountDetails({ breakdown, rules, declared, onDeclared, uncertain, className }: { breakdown: WordBreakdown; rules: ResolvedWordCountRules; declared: number | null; onDeclared: (v: number | null) => void; /** The rules are a draft (or the general fallback): say so. */ uncertain: boolean; className?: string }) {
  const { t } = useCw();
  const id = useId();
  const left = (Object.entries(breakdown.excluded) as Array<[WordCountCategory, number]>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <details className={cn("cw-wc group", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4 [&::-webkit-details-marker]:hidden">{t("cw.wc.what")}</summary>
      <div className="mt-1 flex flex-col gap-3 rounded-[var(--r-card)] border border-border px-4 py-3.5 text-small text-foreground/85">
        {rules.note && <p>{rules.note}</p>}
        {rules.kind !== "words" && <p>{t("cw.wc.noLimit")}</p>}
        <div>
          <p className="font-extrabold text-foreground">{t("cw.wc.notCounted")}</p>
          {left.length === 0 ? (
            <p>{t("cw.wc.nothing")}</p>
          ) : (
            <ul className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {left.map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-3">
                  <span className="first-letter:uppercase">{CATEGORY_LABEL[k]}</span>
                  <span className="tabular-nums text-muted-foreground">{n(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p>{t(breakdown.estimate ? "cw.wc.estimate" : "cw.wc.exact")}</p>
        {rules.kind === "words" && (
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <label htmlFor={id} className="font-extrabold text-foreground">
                {t("cw.wc.mine")}
              </label>
              <input
                id={id}
                inputMode="numeric"
                pattern="[0-9,]*"
                autoComplete="off"
                value={declared ? n(declared) : ""}
                placeholder={n(breakdown.counted)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 6));
                  onDeclared(v > 0 ? v : null);
                }}
                className="h-11 w-[112px] rounded-[12px] border border-border bg-white px-3 text-ui font-bold tabular-nums text-foreground placeholder:font-semibold placeholder:text-faint focus:border-border-strong focus:outline-none"
              />
              {declared !== null && (
                <button type="button" onClick={() => onDeclared(null)} className="min-h-11 px-1 font-extrabold text-muted-foreground hover:text-foreground">
                  {t("cw.wc.clear")}
                </button>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">{t("cw.wc.mineHint")}</p>
          </div>
        )}
        <p className="text-muted-foreground">
          {t("cw.wc.whole")}
          {uncertain && <> {t("cw.wc.checking")}</>}
        </p>
      </div>
    </details>
  );
}

/**
 * The count with what it leaves out, a calm note when short or over, and
 * "What's counted?". One block, used beside the review button everywhere.
 */
export function WordInfo({ status, breakdown, rules, declared, onDeclared, uncertain, showCount = true, showDetail, className }: { status: WordStatus; breakdown: WordBreakdown; rules: ResolvedWordCountRules; declared: number | null; onDeclared: (v: number | null) => void; uncertain: boolean; /** Leave the count line out where it is already shown right above. */ showCount?: boolean; /** With the count left out, still say what was not counted. */ showDetail?: boolean; className?: string }) {
  return (
    <div className={className}>
      {!showCount && showDetail && status.detail && <p className="text-small font-semibold text-muted-foreground first-letter:uppercase">{status.detail}</p>}
      {showCount && (
        <p className="text-small font-bold tabular-nums text-foreground" role="status">
          {status.count}
          {status.detail && <span className="font-semibold text-muted-foreground"> · {status.detail}</span>}
        </p>
      )}
      {status.note && (
        <p className={cn("text-small font-semibold text-foreground", showCount && "mt-1")} role="status">
          {status.note}
        </p>
      )}
      <WordCountDetails breakdown={breakdown} rules={rules} declared={declared} onDeclared={onDeclared} uncertain={uncertain} />
    </div>
  );
}
