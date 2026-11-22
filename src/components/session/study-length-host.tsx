"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudyLengthSlider } from "@/components/session/study-length-slider";
import { answerStudyLength, useStudyLengthRequest } from "@/lib/study-length-client";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/study-length";
import { cn } from "@/lib/utils";

/**
 * The sheet behind `chooseStudyLength()`: mounted once in <Providers/>, shown
 * when a learner's first or second session is about to be generated.
 * Same shape as the habit prompt (bottom sheet on phones, card on desktop).
 */
export function StudyLengthHost() {
  const request = useStudyLengthRequest();
  if (!request) return null;
  return <StudyLengthSheet key={request.initial} initial={request.initial} />;
}

function StudyLengthSheet({ initial }: { initial: number }) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(initial);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answerStudyLength(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onClick={() => answerStudyLength(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-length-title"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl animate-fade-up",
          "sm:rounded-[28px] sm:px-6 sm:pb-6 sm:pt-5",
        )}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <button
          type="button"
          onClick={() => answerStudyLength(null)}
          aria-label={t("session.cancel")}
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        <div className="text-center">
          <h2 id="study-length-title" className="text-[20px] font-bold leading-tight tracking-tight sm:text-[21px]">
            {t("studyLength.title")}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[22rem] text-[14px] leading-snug text-muted-foreground">
            {t("studyLength.sub")}
          </p>
        </div>
        <StudyLengthSlider value={minutes} onChange={setMinutes} className="mt-3" />
        <div className="mt-5">
          <Button ref={startRef} size="lg" className="w-full text-[15px]" onClick={() => answerStudyLength(minutes)}>
            {t("studyLength.start")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
