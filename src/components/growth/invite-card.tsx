"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Share2, Users } from "lucide-react";
import {
  copyText,
  fetchReferralSummary,
  inviteUrl,
  shareOrCopy,
  type ReferralSummary,
} from "@/lib/api/referrals";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/growth";

export const REFERRALS_KEY = ["referrals"] as const;

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

function statusLine(s: ReferralSummary, t: (k: string) => string): string {
  if (s.joined === 0) return t("growth.joinedNone");
  const parts = [fill(t(s.joined === 1 ? "growth.joinedOne" : "growth.joinedMany"), { n: s.joined })];
  if (s.rewarded > 0) parts.push(fill(t(s.rewarded === 1 ? "growth.earnedOne" : "growth.earnedMany"), { n: s.rewarded }));
  if (s.pending > 0) parts.push(fill(t("growth.waiting"), { n: s.pending }));
  return parts.join(" · ");
}

/**
 * "Invite a friend — you both get a free week": the referral entry point.
 * `compact` sits under the end-of-session actions; `full` is the shop /
 * settings card with the link visible and the monthly cap explained.
 */
export function InviteCard({ variant = "full", className }: { variant?: "compact" | "full"; className?: string }) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const { data, isError } = useQuery({
    queryKey: REFERRALS_KEY,
    queryFn: fetchReferralSummary,
    staleTime: 60_000,
    retry: 1,
  });

  // The invite is a nice-to-have: never show an error box at the end of a session.
  if (isError && variant === "compact") return null;

  const url = data ? inviteUrl(data.code) : "";
  const flashCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const onCopy = async () => {
    if (!url) return;
    if (await copyText(url)) {
      flashCopied();
      toast.success(t("growth.copied"));
    } else toast.error(t("growth.copyFailed"));
  };
  const onShare = async () => {
    if (!url) return;
    const res = await shareOrCopy({ title: t("growth.shareTitle"), text: t("growth.shareText"), url });
    if (res === "copied") {
      flashCopied();
      toast.success(t("growth.copied"));
    } else if (res === "failed") toast.error(t("growth.copyFailed"));
  };

  const body = data
    ? fill(t("growth.inviteBody"), { days: data.rewardDays, pts: data.rewardPoints })
    : fill(t("growth.inviteBody"), { days: 7, pts: 100 });
  const capped = !!data && data.rewardedThisMonth >= data.monthlyCap;
  const until = data?.freeWeekUntil
    ? fill(t("growth.freeWeekUntil"), {
        date: new Date(data.freeWeekUntil).toLocaleDateString(locale, { day: "numeric", month: "short" }),
      })
    : null;

  const actions = (
    <div className={cn("flex gap-2", variant === "compact" ? "mt-3" : "mt-4")}>
      <button
        type="button"
        onClick={onShare}
        disabled={!data}
        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-dim disabled:opacity-60"
      >
        <Share2 className="size-4" />
        {t("growth.share")}
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={!data}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border-strong bg-card px-4 text-[13.5px] font-semibold text-foreground transition-colors hover:border-accent/50 disabled:opacity-60"
      >
        {copied ? <Check className="size-4 text-success" strokeWidth={3} /> : <Copy className="size-4" />}
        {t("growth.copy")}
      </button>
    </div>
  );

  if (variant === "compact") {
    return (
      <section
        aria-label={t("growth.inviteTitle")}
        className={cn("w-full rounded-2xl border border-border bg-card p-4 text-left", className)}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold leading-snug">{t("growth.inviteTitle")}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{t("growth.inviteShort")}</p>
          </div>
        </div>
        {actions}
        {data && data.joined > 0 && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Users className="mt-px size-3.5 shrink-0" />
            {statusLine(data, t)}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label={t("growth.inviteTitle")}
      className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Gift className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-snug tracking-tight">{t("growth.inviteTitle")}</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{body}</p>
        </div>
      </div>

      <label className="mt-4 block text-[12px] font-semibold text-muted-foreground" htmlFor="invite-link">
        {t("growth.linkLabel")}
      </label>
      <input
        id="invite-link"
        readOnly
        value={url}
        placeholder={isError ? t("growth.loadFailed") : "scribe.study/i/…"}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 h-10 w-full truncate rounded-xl border border-border bg-muted/40 px-3 font-mono text-[13px] text-foreground"
      />
      {actions}

      <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
        <p className="flex items-start gap-1.5 font-medium text-foreground">
          <Users className="mt-px size-4 shrink-0 text-accent" />
          {data ? statusLine(data, t) : <span className="inline-block h-3.5 w-40 animate-pulse rounded-full bg-muted" />}
        </p>
        {until && <p className="font-semibold text-accent-dim">{until}</p>}
        <p>
          {data
            ? fill(t(capped ? "growth.capReached" : "growth.capNote"), { n: data.monthlyCap })
            : fill(t("growth.capNote"), { n: 3 })}
        </p>
      </div>
    </section>
  );
}
