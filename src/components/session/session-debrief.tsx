"use client";

import { MathText } from "@/components/ui/markdown-text";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import {
  Sparkles,
  Loader2,
  Check,
  ArrowRight,
  FileText,
  CalendarClock,
} from "lucide-react";
import { awardSessionCredits } from "@/lib/credits";
import { useQuery } from "@tanstack/react-query";
import { studySessionApi } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";

const stages = [
  "session.debriefReviewing",
  "session.debriefComparing",
  "session.debriefWriting",
];


export function SessionDebrief({
  onBack,
  sessionId,
}: {
  onBack: () => void;
  sessionId: string;
}) {
  const { t } = useI18n();
  const [stage, setStage] = useState(0);
  const [creditsEarned] = useState(() => awardSessionCredits(sessionId));

  const { data: debrief, isError } = useQuery({
    queryKey: ["session-debrief", sessionId],
    queryFn: () => studySessionApi.getDebrief(sessionId),
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (stage >= stages.length) return;
    const timer = setTimeout(() => setStage((s) => s + 1), 1100);
    return () => clearTimeout(timer);
  }, [stage]);

  if (!isError && (stage < stages.length || !debrief)) {
    return (
      <div className="py-14 text-center space-y-4 animate-fade-up">
        <FileText className="h-7 w-7 text-accent mx-auto" />
        <p className="text-sm font-semibold">{t("session.debriefPreparing")}</p>
        <div className="inline-block text-left space-y-1.5">
          {stages.slice(0, Math.min(stage, stages.length - 1) + 1).map((label, i) => (
            <p
              key={label}
              className="flex items-center gap-2 text-xs font-medium animate-fade-up"
            >
              {i < stage && !(i === stages.length - 1 && !debrief) ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <span className={i >= stage || (i === stages.length - 1 && !debrief) ? "text-muted-foreground" : ""}>
                {t(label)}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  const shown = debrief ?? {
    headline: t("session.debriefFallbackHeadline"),
    summary: t("session.debriefFallbackSummary"),
    sections: [],
  };

  return (
    <div className="animate-fade-up pb-10">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-card px-6 py-6">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-48 select-none sm:block"
          aria-hidden
        >
          <Image
            src="/illustrations/props/trophy.png"
            alt=""
            width={160}
            height={160}
            className="absolute -bottom-3 right-6 w-24"
          />
          <ConfettiDots />
        </div>
        <div className="relative sm:max-w-[calc(100%-11rem)]">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent-dim mb-2">
            <Sparkles className="h-3 w-3" />
            {t("session.debriefGenerated")}
          </p>
          <h2 className="text-lg font-bold tracking-tight">
            <MathText text={shown.headline} />
          </h2>
      {creditsEarned > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          <Sparkles className="h-3.5 w-3.5" />+{creditsEarned}{" "}
          {t("session.creditsEarned")}
        </p>
      )}
          <p className="text-sm text-muted-foreground leading-6 mt-1.5">
            <MathText text={shown.summary} />
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {shown.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="text-sm font-semibold mb-2 pb-1.5 border-b border-border">
              {section.heading}
            </h3>
            {section.body && (
              <p className="text-sm leading-6 text-foreground">
                <MathText text={section.body} />
              </p>
            )}
            {section.bullets && (
              <ul className="space-y-2.5">
                {section.bullets.map((b) => (
                  <li key={b.text} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-6">
                        <MathText text={b.text} />
                      </p>
                      {b.detail && (
                        <p className="text-sm text-muted-foreground leading-6">
                          <MathText text={b.detail} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-accent/25 bg-accent-soft p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-accent" />
          {t("session.nextStepTitle")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground leading-6">
          {t("session.nextStepBody")}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link href="/flashcards/review">
            <Button size="sm">
              {t("session.reviewDueCards")}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={onBack}>
            {t("session.backToWorkspace")}
          </Button>
        </div>
      </div>
    </div>
  );
}
