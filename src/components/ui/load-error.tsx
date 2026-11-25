"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/today";

/**
 * A page's data failed to load. Shown INSTEAD of the page's empty states, so a
 * student with seven subjects is never told they have none (or sent through
 * the first-run screen) because a request failed.
 */
export function LoadError({
  title,
  body,
  onRetry,
  retrying = false,
  className,
}: {
  title?: React.ReactNode;
  body?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div role="alert" className={className}>
      <EmptyState
        cat="think"
        title={title ?? t("today.loadErrorTitle")}
        body={body ?? t("today.loadErrorBody")}
        action={
          onRetry && (
            <Button onClick={onRetry} disabled={retrying}>
              {t("today.retry")}
            </Button>
          )
        }
      />
    </div>
  );
}
