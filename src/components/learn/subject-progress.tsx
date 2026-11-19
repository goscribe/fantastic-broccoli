"use client";

import { useEffect, useState } from "react";
import { proficiencyApi, type TopicLevel } from "@/lib/api/proficiency";
import { LEVEL_KEY, LEVEL_TONE } from "@/components/session/precheck";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import { cn } from "@/lib/utils";

/**
 * Subject page card: the student's level per topic (Elo-based, from the
 * pre-lesson check and every graded answer) and the switch that keeps the
 * subject in long-term spaced review.
 */
export function SubjectProgress({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();
  const [levels, setLevels] = useState<TopicLevel[] | null>(null);
  const [pref, setPref] = useState<{ longTerm: boolean; dueItems: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      proficiencyApi.list(workspaceId).catch(() => []),
      proficiencyApi.reviewPreference(workspaceId).catch(() => null),
    ]).then(([l, p]) => {
      if (cancelled) return;
      setLevels(l);
      setPref(p);
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

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-[17px] font-bold tracking-tight">{t("prof.progressTitle")}</h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-muted-foreground">{t("prof.progressEmpty")}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {shown.map((l) => (
            <li key={l.topic}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] font-semibold">{l.label}</span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", LEVEL_TONE[l.level])}>
                  {t(LEVEL_KEY[l.level])}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", l.level === "secure" ? "bg-accent" : l.level === "beginner" ? "bg-rose" : "bg-amber")}
                  style={{ width: `${Math.round(l.mastery * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pref && (
        <div className="mt-5 flex items-start justify-between gap-4 border-t border-border pt-4">
          <div className="min-w-0">
            <p id={`review-${workspaceId}`} className="text-[14px] font-semibold">
              {t("prof.reviewTitle")}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {pref.longTerm ? t("prof.reviewOnHint") : t("prof.reviewOffHint")}
            </p>
            {pref.longTerm && pref.dueItems > 0 && (
              <p className="mt-1 text-[12.5px] font-semibold text-accent">
                {t("prof.dueItems").replace("{count}", String(pref.dueItems))}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pref.longTerm}
            aria-labelledby={`review-${workspaceId}`}
            disabled={saving}
            onClick={() => void toggle()}
            className={cn(
              "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
              pref.longTerm ? "bg-accent" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                pref.longTerm ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      )}
    </section>
  );
}
