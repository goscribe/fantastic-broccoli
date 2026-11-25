"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, RotateCcw } from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Mascot } from "@/components/rewards/mascot";
import { Button } from "@/components/ui/button";
import { confirmRefund, fetchRefund, formatAmount, type RefundView } from "@/lib/api/refund";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate } from "@/lib/pass";
import "@/lib/i18n/billing";

function Notice({ pose, title, body }: { pose: "sleep" | "think" | "trophy" | "wave"; title: string; body: string }) {
  return (
    <div className="text-center">
      <Mascot pose={pose} outfit={null} className="mx-auto h-[100px]" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Confirm({ token, view, onDone }: { token: string; view: RefundView; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trial = view.kind === "trial_cancel";
  const amount = formatAmount(view.amount, view.currency);
  const planName = view.planName.charAt(0).toUpperCase() + view.planName.slice(1);

  const go = async () => {
    setWorking(true);
    setError(null);
    try {
      await confirmRefund(token);
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("refund.error"));
      setWorking(false);
    }
  };

  return (
    <div className="text-center">
      <Mascot pose="think" outfit={null} className="mx-auto h-[96px]" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{t(trial ? "refund.trialTitle" : "refund.passTitle")}</h1>
      <p className="mx-auto mt-1 text-[15px] font-semibold text-accent">{planName}</p>
      <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-snug text-muted-foreground">
        {trial
          ? fill(t("refund.trialBody"), {
              plan: planName,
              date: view.trialEndsAt ? formatPassDate(view.trialEndsAt, locale) : "",
            })
          : fill(t(view.paidBySomeoneElse ? "refund.passBodyPayer" : "refund.passBody"), { amount })}
      </p>
      <Button size="lg" className="mt-6 w-full max-w-sm text-[15px]" disabled={working} onClick={go}>
        {working
          ? t(trial ? "refund.trialWorking" : "refund.working")
          : trial
            ? t("refund.trialConfirm")
            : fill(t("refund.confirm"), { amount })}
      </Button>
      {error && (
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-rose" role="alert">
          {error}
        </p>
      )}
      {!trial && view.refundableUntil && (
        <p className="mt-3 text-[12px] text-faint">
          {fill(t("refund.deadline"), { date: formatPassDate(view.refundableUntil, locale) })}
        </p>
      )}
    </div>
  );
}

/** One-tap refund (or free-trial cancellation) behind a signed link: /refund/<token>. */
export default function RefundPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["refund", token],
    queryFn: () => fetchRefund(token),
    retry: 1,
    staleTime: Infinity,
  });
  const amount = data ? formatAmount(data.amount, data.currency) : "";
  const trial = data?.kind === "trial_cancel";

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
          <Lock className="size-3.5" />
          {t("pay.secureBadge")}
        </span>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 sm:px-6 sm:pt-16">
        {isLoading ? (
          <div className="space-y-4">
            <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-muted" />
            <div className="mx-auto h-8 w-2/3 animate-pulse rounded-full bg-muted" />
          </div>
        ) : isError || !data ? (
          <Notice pose="sleep" title={t("refund.notFoundTitle")} body={t("refund.notFoundBody")} />
        ) : data.status === "done" || data.status === "pending" ? (
          <Notice
            pose="wave"
            title={t(trial ? "refund.trialDoneTitle" : "refund.doneTitle")}
            body={trial ? t("refund.trialDoneBody") : fill(t("refund.doneBody"), { amount })}
          />
        ) : data.status === "failed" ? (
          <Notice pose="think" title={t("refund.failedTitle")} body={t("refund.failedBody")} />
        ) : !data.eligible ? (
          <Notice
            pose="think"
            title={t("refund.unavailableTitle")}
            body={fill(t(`refund.reason.${data.reason ?? "not_refundable"}`), { days: data.refundDays })}
          />
        ) : (
          <Confirm token={token} view={data} onDone={() => void queryClient.invalidateQueries({ queryKey: ["refund", token] })} />
        )}
        {data && !trial && (
          <p className="mt-10 flex items-center justify-center gap-1.5 text-[12px] text-faint">
            <RotateCcw className="size-3.5" />
            {fill(t("pay.refund"), { days: data.refundDays })}
          </p>
        )}
      </main>
    </div>
  );
}
