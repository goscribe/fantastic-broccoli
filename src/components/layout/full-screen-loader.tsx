"use client";

import { ScribeMark } from "@/components/graphics/logo";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

/**
 * Boot splash while auth resolves. Keep this light — it sits in front of
 * every signed-in page — and keep the first paint deterministic so it
 * does not trip a hydration mismatch.
 */
export function FullScreenLoader() {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-6"
    >
      <ScribeMark className="h-9 w-9 text-accent" />
      <div className="mt-6 flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent motion-reduce:animate-none animate-loader-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t("misc.gettingReady")}</p>
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
