"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { proficiencyApi, type ProficiencyLevel, type TopicLevel } from "@/lib/api/proficiency";
import { LEVEL_FILL, LevelBadge } from "@/components/session/precheck";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { mistakesApi, practiceHref, type MistakeSummary } from "@/lib/api/mistakes";
import "@/lib/i18n/mistakes";

/** Strongest first, so the summary reads "2 secure · 1 to practise · 1 to build". */
const SUMMARY_ORDER: ProficiencyLevel[] = ["secure", "developing", "beginner", "unknown"];

const SUMMARY_KEY: Record<ProficiencyLevel, string> = {
  secure: "prof.sumSecure",
  developing: "prof.sumDeveloping",
  beginner: "prof.sumBeginner",
  unknown: "prof.sumUnknown",
};

/**
 * Subject page card: the student's level per topic (Elo-based, from the
 * pre-lesson check and every graded answer) and the switch that keeps the
 * subject in long-term spaced review.
 */
export function SubjectProgress({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();
  const [levels, setLevels] = useState<TopicLevel[] | null>(null);
  const [pref, setPref] = useState<{ longTerm: boolean; dueItems: number } | null>(null);
  const [mistakes, setMistakes] = useState<MistakeSummary | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      proficiencyApi.list(workspaceId).catch(() => []),
      proficiencyApi.reviewPreference(workspaceId).catch(() => null),
      mistakesApi.summary(workspaceId).catch(() => null),
    ]).then(([l, p, m]) => {
      if (cancelled) return;
      setLevels(l);
      setPref(p);
      setMistakes(m);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const toggle = async () => {
    if (!pref || saving) return;
    const longTerm = !pref.longTerm;
    setSaving(true);
    setPref({ ...pref, longTerm });
    try {
      await proficiencyApi.setReviewPreference(workspaceId, longTerm);
    } catch {
      setPref(pref);
    } finally {
      setSaving(false);
    }
  };

  if (levels === null) return null;
  const shown = [...levels].sort((a, b) => a.mastery - b.mastery).slice(0, 8);
  const counts = SUMMARY_ORDER.map((level) => ({ level, count: levels.filter((l) => l.level === level).length })).filter(
    (c) => c.count > 0,
  );
  const labelId = `review-${workspaceId}`;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{t("prof.progressTitle")}</h2>
        {levels.length > 0 && (
          <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
            {t("prof.topicCount").replace("{count}", String(levels.length))}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="mt-3 flex items-center gap-4">
          <Image
            src="/design/cat3-book.webp"
            alt=""
            width={363}
            height={400}
            unoptimized
            className="cat-bob h-[60px] w-auto shrink-0 select-none object-contain"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{t("prof.progressEmptyTitle")}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("prof.progressEmpty")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Level mix: one stacked bar, then a legend that doubles as the summary. */}
          <div className="mt-4 flex h-2.5 gap-[3px] overflow-hidden rounded-full" aria-hidden>
            {counts.map((c) => (
              <span
                key={c.level}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", LEVEL_FILL[c.level])}
                style={{ flexGrow: c.count, flexBasis: 0 }}
              />
            ))}
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            {counts.map((c) => (
              <span key={c.level} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", LEVEL_FILL[c.level])} aria-hidden />
                <span>
                  {t(SUMMARY_KEY[c.level])
                    .split("{count}")
                    .map((part, i) => (
                      <span key={i}>
                        {i > 0 && <span className="font-semibold tabular-nums text-foreground">{c.count}</span>}
                        {part}
                      </span>
                    ))}
                </span>
              </span>
            ))}
          </p>

          <ul className="mt-4 flex flex-col gap-1">
            {shown.map((l) => {
              const pct = Math.round(l.mastery * 100);
              return (
                <li key={l.topic} className="-mx-2 min-w-0 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px] font-semibold">{l.label}</span>
                    <LevelBadge level={l.level} />
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-label={`${l.label}: ${t("prof.masteryLabel")}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    >
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", LEVEL_FILL[l.level])}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11.5px] font-medium tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {mistakes && mistakes.total > 0 && (
        <div className="mt-5 flex items-center gap-3.5 border-t border-border pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">
              {mistakes.open === 0
                ? t("mistakes.cardRowNone")
                : (mistakes.open === 1 ? t("mistakes.cardRowOne") : t("mistakes.cardRow")).replace("{n}", String(mistakes.open))}
            </p>
            <Link
              href={`/mistakes?workspace=${encodeURIComponent(workspaceId)}`}
              className="mt-0.5 inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-accent-dim hover:underline"
            >
              {t("mistakes.cardSeeAll")}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {mistakes.open > 0 && (
            <Link
              href={practiceHref({ workspaceId })}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-dim"
            >
              {t("mistakes.practice")}
            </Link>
          )}
        </div>
      )}

      {pref && (
        <div className="mt-4 flex items-start gap-3.5 border-t border-border pt-4">
          <div className="min-w-0 flex-1">
            <p id={labelId} className="text-[14px] font-semibold">
              {t("prof.reviewTitle")}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {pref.longTerm ? t("prof.reviewOnHint") : t("prof.reviewOffHint")}
            </p>
            {pref.longTerm && (
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  pref.dueItems > 0 ? "bg-accent text-white" : "bg-muted text-accent",
                )}
              >
                {pref.dueItems > 0 ? (
                  <>
                    <span className="size-1.5 rounded-full bg-white animate-pulse-dot" aria-hidden />
                    {t("prof.dueItems").replace("{count}", String(pref.dueItems))}
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    {t("prof.dueNone")}
                  </>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pref.longTerm}
            aria-labelledby={labelId}
            disabled={saving}
            onClick={() => void toggle()}
            className={cn(
              "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-70",
              pref.longTerm ? "bg-accent" : "bg-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-0.5 grid size-6 place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                pref.longTerm ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            >
              {pref.longTerm && <Check className="size-3.5 text-accent" strokeWidth={3} aria-hidden />}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
