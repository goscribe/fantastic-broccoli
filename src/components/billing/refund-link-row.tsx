"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, RotateCcw } from "lucide-react";
import { fetchMyRefundLink, refundPath } from "@/lib/api/refund";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate } from "@/lib/pass";
import "@/lib/i18n/billing";

/**
 * Account/billing entry to "Refund my pass" (one click within 14 days) or,
 * during a free trial, "Cancel free trial". Hidden when nothing qualifies.
 */
export function RefundLinkRow({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["my-refund-link"], queryFn: fetchMyRefundLink, retry: false });
  if (!data) return null;
  const trial = data.kind === "trial_cancel";
  const date = formatPassDate(data.until, locale);
  return (
    <Link
      href={refundPath(data.url)}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-accent/40 ${className ?? ""}`}
    >
      <RotateCcw className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{t(trial ? "refund.settingsTrial" : "refund.settingsPass")}</span>
        <span className="block text-[12.5px] text-muted-foreground">
          {trial ? fill(t("refund.settingsTrialHint"), { date }) : fill(t("refund.settingsPassHint"), { days: 14, date })}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
