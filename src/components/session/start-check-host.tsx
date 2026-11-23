"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "@/components/session/confidence-slider";
import { answerStartCheck, useStartCheckRequest, type StartCheckRequest } from "@/lib/start-check-client";
import { CONFIDENCE_START, FOCUS_NOTE_MAX, sessionPath, tidyFocusNote } from "@/lib/start-check";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/start-check";
import { cn } from "@/lib/utils";

/**
 * The sheet behind the start check: mounted once in <Providers/>, shown when
 * a learner starts a session on a topic (or a subject's own material) they
 * have not rated. Bottom sheet on phones, a card on desktop, like the "How
 * long?" sheet.
 */
export function StartCheckHost() {
  const request = useStartCheckRequest();
  if (!request) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4" onClick={() => answerStartCheck(null)}>
      <StartCheckSheet key={request.id} request={request} onAnswer={answerStartCheck} />
    </div>,
    document.body,
  );
}

type Answer = Parameters<StartCheckRequest["resolve"]>[0];

/**
 * One light step: the cat slider, a line saying what the answer changes,
 * then either which paper to practise (boards with more than one) or an
 * optional focus note. One primary action; Skip starts the session as usual.
 */
export function StartCheckSheet({ request, onAnswer, initial = CONFIDENCE_START, className }: { request: Pick<StartCheckRequest, "what" | "topicNames" | "papers" | "paperId">; onAnswer: (answer: Answer) => void; initial?: number; className?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  const [confidence, setConfidence] = useState(initial);
  const [paperId, setPaperId] = useState<string | null>(request.paperId);
  const [note, setNote] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const hasPapers = request.papers.length > 1;

  useEffect(() => {
    // Focus moves into the dialog; the slider is the first Tab stop (no ring until a key is used).
    formRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnswer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  const title =
    request.topicNames.length > 1
      ? t("startCheck.titleTopics").replace("{n}", String(request.topicNames.length))
      : request.what
        ? t("startCheck.title").replace("{what}", request.what)
        : t("startCheck.titleThis");

  const submit = () => {
    const focusNote = tidyFocusNote(note);
    onAnswer({ confidence, ...(hasPapers ? { paperId } : focusNote ? { focusNote } : {}) });
  };

  return (
    <form
      ref={formRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "relative max-h-[94dvh] w-full outline-none max-w-[440px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl animate-fade-up",
        "sm:rounded-[28px] sm:px-7 sm:pb-6 sm:pt-6",
        className,
      )}
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
      <h2 id={titleId} className="text-balance text-center text-[21px] font-extrabold leading-[1.2] tracking-tight sm:text-[23px]">
        {title}
      </h2>
      {request.topicNames.length > 1 ? (
        <p className="mx-auto mt-1.5 line-clamp-2 max-w-[22rem] text-center text-small font-semibold text-muted-foreground">{request.topicNames.join(" · ")}</p>
      ) : (
        <p className="mt-1.5 text-center text-ui text-muted-foreground">{t("startCheck.sub")}</p>
      )}

      <div className="mt-3">
        <ConfidenceSlider value={confidence} onChange={setConfidence} labelledBy={titleId} />
      </div>
      {/* What the answer changes, said as it changes. */}
      <p className="mt-1.5 min-h-[22px] text-center text-ui font-semibold text-muted-foreground" aria-live="polite">
        {t(`startCheck.next.${sessionPath(confidence)}`)}
      </p>

      {hasPapers ? (
        <fieldset className="mt-5 border-t border-border pt-4">
          <legend className="sr-only">{t("startCheck.paperTitle")}</legend>
          <p className="text-ui font-extrabold text-foreground" aria-hidden>
            {t("startCheck.paperTitle")}
          </p>
          <div className="mt-2 flex flex-col">
            {[{ id: null as string | null, name: t("startCheck.paperMix"), blurb: t("startCheck.paperMixSub") }, ...request.papers].map((p) => {
              const on = paperId === p.id;
              return (
                <label key={p.id ?? "mix"} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
                  <input type="radio" name="start-check-paper" className="peer sr-only" checked={on} onChange={() => setPaperId(p.id)} />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground",
                      on ? "border-foreground" : "border-border-strong",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full bg-foreground transition-transform", on ? "scale-100" : "scale-0")} />
                  </span>
                  <span className="min-w-0 text-ui leading-5">
                    <span className="font-extrabold text-foreground">{p.name}</span>
                    <span className="text-muted-foreground"> · {p.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="mt-5 border-t border-border pt-4">
          <label htmlFor={`${titleId}-note`} className="flex items-baseline justify-between gap-3 text-ui font-extrabold text-foreground">
            {t("startCheck.focusLabel")}
            <span className="text-caption font-semibold text-faint">{t("startCheck.focusOptional")}</span>
          </label>
          <input
            id={`${titleId}-note`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={FOCUS_NOTE_MAX}
            placeholder={t("startCheck.focusPlaceholder")}
            autoComplete="off"
            enterKeyHint="go"
            className="mt-2 h-12 w-full rounded-[14px] border border-border bg-white px-4 text-ui text-foreground placeholder:text-faint focus:border-foreground focus:outline-none"
          />
        </div>
      )}

      <div className="mt-5 flex flex-col items-center gap-1">
        <Button type="submit" size="lg" className="w-full">
          {t("startCheck.continue")}
        </Button>
        <button type="button" onClick={() => onAnswer(null)} className="min-h-11 px-4 text-ui font-bold text-muted-foreground hover:text-foreground">
          {t("startCheck.skip")}
        </button>
      </div>
    </form>
  );
}
