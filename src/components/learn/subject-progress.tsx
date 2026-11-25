"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { proficiencyApi, type ProficiencyLevel, type TopicLevel } from "@/lib/api/proficiency";
import { LEVEL_FILL, LevelBadge } from "@/components/session/precheck";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import { cn } from "@/lib/utils";

/** Strongest first, so the summary reads "2 secure · 1 to practise · 1 to build". */
const SUMMARY_ORDER: ProficiencyLevel[] = ["secure", "developing", "beginner", "unknown"];

const SUMMARY_KEY: Record<ProficiencyLevel, string> = {
  secure: "prof.sumSecure",
  developing: "prof.sumDeveloping",
  beginner: "prof.sumBeginner",
  unknown: "prof.sumUnknown",
};

/**
 * Subject page: the student's level per topic (Elo-based, from the pre-lesson
 * check and every graded answer). Review lives in the one Review line; long-term
 * review is always on, so there is no switch.
 */
export function SubjectProgress({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();
  const [levels, setLevels] = useState<TopicLevel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void proficiencyApi
      .list(workspaceId)
      .catch(() => [] as TopicLevel[])
      .then((l) => {
        if (!cancelled) setLevels(l);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (levels === null) return null;
  const shown = [...levels].sort((a, b) => a.mastery - b.mastery).slice(0, 8);
  const counts = SUMMARY_ORDER.map((level) => ({ level, count: levels.filter((l) => l.level === level).length })).filter(
    (c) => c.count > 0,
  );

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{t("prof.progressTitle")}</h2>
        {levels.length > 0 && (
          <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
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
            <p className="text-ui font-semibold">{t("prof.progressEmptyTitle")}</p>
            <p className="mt-0.5 text-small text-muted-foreground">{t("prof.progressEmpty")}</p>
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
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
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
                    <span className="min-w-0 truncate text-ui font-semibold">{l.label}</span>
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
                    <span className="w-9 shrink-0 text-right text-caption font-medium tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
