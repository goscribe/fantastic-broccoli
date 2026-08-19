"use client";

import { MathText } from "@/components/ui/markdown-text";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check, ArrowRight, FileText } from "lucide-react";
import { awardSessionCredits } from "@/lib/credits";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";

const stages = [
  "session.debriefReviewing",
  "session.debriefComparing",
  "session.debriefWriting",
];

interface DebriefSection {
  heading: string;
  body?: string;
  bullets?: { text: string; detail?: string; source?: string }[];
}

const debrief: {
  headline: string;
  summary: string;
  sections: DebriefSection[];
} = {
  headline: "Session debrief — Atomic Structure & Periodicity",
  summary:
    "Solid session. Your recall of definitions is strong, but periodic-trend reasoning — especially explaining why a trend happens — is where marks slipped.",
  sections: [
    {
      heading: "What went well",
      bullets: [
        {
          text: "Definitions locked in",
          detail:
            "3/3 on vocabulary recall (Aufbau, ionization energy, shielding) and a clean flashcard run.",
        },
        {
          text: "Electron configuration",
          detail: "Full marks on the configuration sub-parts of the worksheet.",
        },
      ],
    },
    {
      heading: "What to improve",
      bullets: [
        {
          text: "Explaining trend anomalies",
          detail:
            "You identified the IE₁ dips at Al and S but the explanations missed the subshell reasoning (3p vs 3s; paired-electron repulsion).",
          source: "Topic 2 — Atomic Structure.pdf · p. 17",
        },
        {
          text: "Comprehension rewrite",
          detail:
            "Your rewrite scored 72/100 — Hund's rule was described but never named, and 'parallel spins' was left out.",
        },
        {
          text: "Data-response pacing",
          detail:
            "Graph-reading parts took ~2× the estimated time. Practice stating the trend in one sentence before elaborating.",
        },
      ],
    },
    {
      heading: "Review before next session",
      bullets: [
        {
          text: "Subshell energies and the filling order",
          source: "Topic 2 — Atomic Structure.pdf · p. 12",
        },
        {
          text: "Successive ionization jumps → group number",
          source: "Topic 2 — Atomic Structure.pdf · p. 19",
        },
      ],
    },
    {
      heading: "Suggested next session",
      body: "A 25-minute session weighted toward data-response worksheets on periodic trends, with one comprehension check on Hund's rule. Scribe has 2 unused worksheets in your bank ready for it.",
    },
  ],
};

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

  useEffect(() => {
    if (stage >= stages.length) return;
    const timer = setTimeout(() => setStage((s) => s + 1), 1100);
    return () => clearTimeout(timer);
  }, [stage]);

  if (stage < stages.length) {
    return (
      <div className="py-14 text-center space-y-4 animate-fade-up">
        <FileText className="h-7 w-7 text-accent mx-auto" />
        <p className="text-sm font-semibold">{t("session.debriefPreparing")}</p>
        <div className="inline-block text-left space-y-1.5">
          {stages.slice(0, stage + 1).map((label, i) => (
            <p
              key={label}
              className="flex items-center gap-2 text-xs font-medium animate-fade-up"
            >
              {i < stage ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <span className={i === stage ? "text-muted-foreground" : ""}>
                {t(label)}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up pb-10">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent-dim mb-2">
        <Sparkles className="h-3 w-3" />
        {t("session.debriefGenerated")}
      </p>
      <h2 className="text-lg font-bold tracking-tight">
        <MathText text={debrief.headline} />
      </h2>
      {creditsEarned > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          <Sparkles className="h-3.5 w-3.5" />+{creditsEarned}{" "}
          {t("session.creditsEarned")}
        </p>
      )}
      <p className="text-sm text-muted-foreground leading-6 mt-1.5 mb-6">
        <MathText text={debrief.summary} />
      </p>

      <div className="space-y-6">
        {debrief.sections.map((section) => (
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
                      {b.source && (
                        <p className="text-[11px] text-faint mt-0.5">
                          {b.source}
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

      <div className="flex gap-2 mt-8">
        <Button size="sm" onClick={onBack}>
          {t("session.backToWorkspace")}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
