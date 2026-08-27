"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { ratingApi } from "@/lib/api/rating";
import { useAuthUser } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/rating";

const SNOOZE_KEY = "scribe-rating-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  return Date.now() < until;
}

/**
 * Once-a-month star-rating card, bottom-right. Shows when the server says a
 * rating is due for the current calendar month; dismissing snoozes it locally
 * for a week (the server re-prompts next month regardless).
 */
export function MonthlyRatingPrompt() {
  const { user } = useAuthUser();
  const { t } = useI18n();
  const [due, setDue] = useState(false);
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user || isSnoozed()) return;
    let cancelled = false;
    ratingApi
      .getPrompt()
      .then((prompt) => {
        if (!cancelled && prompt.due) setDue(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!due) return null;

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setDue(false);
  };

  const submit = async (value: number, withComment: string) => {
    try {
      await ratingApi.submit({
        stars: value,
        comment: withComment.trim() || undefined,
      });
    } catch {
      // Non-critical; drop silently.
    }
  };

  const pick = (value: number) => {
    setStars(value);
    void submit(value, comment);
  };

  const finish = async () => {
    if (stars > 0) await submit(stars, comment);
    setSubmitted(true);
    setTimeout(() => setDue(false), 1500);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[19rem] rounded-2xl border border-border bg-card p-4 shadow-lg">
      {submitted ? (
        <p className="text-sm font-medium text-foreground">
          {t("rating.thanks")}
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("rating.title")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("rating.subtitle")}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("rating.dismiss")}
              onClick={snooze}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={t("rating.starLabel").replace(
                  "{count}",
                  String(value),
                )}
                onClick={() => pick(value)}
                onMouseEnter={() => setHovered(value)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    (hovered || stars) >= value
                      ? "fill-warning text-warning"
                      : "text-border",
                  )}
                />
              </button>
            ))}
          </div>
          {stars > 0 && (
            <div className="mt-3 space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("rating.commentPlaceholder")}
                rows={2}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => void finish()}
                className="w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90"
              >
                {t("rating.send")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
