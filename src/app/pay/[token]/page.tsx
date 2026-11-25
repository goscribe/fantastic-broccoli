"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Mascot } from "@/components/rewards/mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPayLink, openPayLinkCheckout, type PayLinkView } from "@/lib/api/pay-link";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate, passTitle } from "@/lib/pass";
import { planDisplayName } from "@/lib/plan-display";
import { sessionsPerMonth } from "@/lib/wall";
import "@/lib/i18n/billing";

/** Re-reads (ms) after returning from checkout while the payment is confirmed. */
const CONFIRM_DELAYS_MS = [0, 2500, 5000, 9000, 15000, 25000];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
        <span className="text-[12px] font-bold text-muted-foreground">{t("pay.secureBadge")}</span>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

function Notice({ pose, title, body }: { pose: "sleep" | "think" | "trophy" | "cheer"; title: string; body: string }) {
  return (
    <div className="pt-6 text-center" role="status">
      <Mascot pose={pose} outfit={null} className="mx-auto h-[100px]" />
      <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted-foreground">{body}</p>
    </div>
  );
}

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-[15px]">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2.6} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PayForm({ token, view }: { token: string; view: PayLinkView }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const { plan } = view;
  const pass = plan.kind === "pass";
  const price = `$${plan.price}`;
  const title = passTitle({ id: plan.id, name: plan.name, kind: plan.kind, accessUntil: plan.accessUntil });
  const until = plan.accessUntil ? formatPassDate(plan.accessUntil, locale) : null;
  const summary = title
    ? fill(t(title.key === "bill.passGraduation" ? "pay.summaryGraduation" : "pay.summaryExams"), { price, year: title.year })
    : `${planDisplayName(plan.name)} · ${fill(t("pay.summaryMonthly"), { price })}`;
  const sessions = sessionsPerMonth(plan.monthlyTokens);

  const pay = async () => {
    if (!EMAIL.test(email.trim())) {
      setError(t("pay.emailInvalid"));
      return;
    }
    setError(null);
    setOpening(true);
    try {
      const { url } = await openPayLinkCheckout(token, email.trim());
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("pay.failed"));
      setOpening(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <Mascot pose="book" outfit={null} className="mx-auto h-[84px]" />
        <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
          {view.firstName ? fill(t("pay.askingNamed"), { name: view.firstName }) : t("pay.asking")}
        </h1>
        <p className="mt-2 text-[17px] font-bold text-foreground">{summary}</p>
      </div>

      <section className="mt-6 border-t border-border pt-5">
        <h2 className="text-[15px] font-extrabold">{t("pay.whatTitle")}</h2>
        <Ticks items={[t("pay.what1"), t("pay.what2"), t("pay.what3")]} />
      </section>

      <section className="life-card mt-6 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-extrabold">{t("pay.includesTitle")}</h2>
          <p className="text-[24px] font-extrabold leading-none tracking-tight tabular-nums">
            {price}
            <span className="ml-1 text-[13px] font-semibold tracking-normal text-muted-foreground">{pass ? t("set.once") : t("bill.perMonth")}</span>
          </p>
        </div>
        <Ticks
          items={[
            until ? fill(t("pay.includesUntil"), { date: until }) : t("pay.includesUnlimited"),
            ...(sessions ? [fill(t("pay.includesTokens"), { n: plan.monthlyTokens.toLocaleString(), sessions })] : []),
            pass ? fill(t("pay.includesOnce"), { price }) : fill(t("pay.includesMonthly"), { price }),
          ]}
        />
        {/* One-click refunds are for passes; a monthly plan is cancelled in Settings instead. */}
        {pass && <p className="mt-3 text-[13px] text-muted-foreground">{fill(t("pay.refund"), { days: view.refundDays })}</p>}

        <div className="mt-5 border-t border-border pt-5">
          {view.payable ? (
            <>
              <label className="block">
                <span className="text-[13px] font-bold">{t("pay.emailLabel")}</span>
                <Input
                  className="mt-1.5"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void pay()}
                  aria-invalid={!!error}
                />
              </label>
              {error && (
                <p className="mt-2 text-[13px] text-rose-600" role="alert">
                  {error}
                </p>
              )}
              <Button size="lg" className="mt-4 w-full" disabled={opening} onClick={pay}>
                {opening ? t("pay.opening") : fill(t("pay.button"), { price })}
              </Button>
              <p className="mt-2 text-center text-[12px] text-muted-foreground">{t("pay.noAccount")}</p>
            </>
          ) : (
            <p className="text-center text-[15px] text-muted-foreground">{t("pay.unpayable")}</p>
          )}
          <p className="mt-3 text-center text-[12px] text-muted-foreground">{t("pay.secure")}</p>
        </div>
      </section>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">
        {fill(t("pay.expires"), { date: formatPassDate(view.expiresAt, locale) })}
      </p>
    </>
  );
}

/** Public page behind a student's "Ask a parent to pay" link (/pay/<token>). */
export default function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = use(params);
  const returned = use(searchParams).paid === "1";
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pay-link", token, round],
    queryFn: () => fetchPayLink(token, returned),
    retry: 1,
    staleTime: Infinity,
  });

  // Back from checkout: re-read until the payment is confirmed (the webhook may lag).
  const waiting = returned && data?.status === "open";
  useEffect(() => {
    if (!waiting || round >= CONFIRM_DELAYS_MS.length - 1) return;
    const timer = setTimeout(() => setRound((r) => r + 1), CONFIRM_DELAYS_MS[round + 1]);
    return () => clearTimeout(timer);
  }, [waiting, round]);

  return (
    <Shell>
      {isLoading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="mx-auto h-8 w-2/3 animate-pulse rounded-full bg-muted" />
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : isError || !data ? (
        <Notice pose="sleep" title={t("pay.notFoundTitle")} body={t("pay.notFoundBody")} />
      ) : data.status === "paid" ? (
        <Notice
          pose="trophy"
          title={t("pay.paidTitle")}
          body={data.firstName ? fill(t("pay.paidBodyNamed"), { name: data.firstName }) : t("pay.paidBody")}
        />
      ) : data.status === "expired" ? (
        <Notice pose="sleep" title={t("pay.expiredTitle")} body={t("pay.expiredBody")} />
      ) : data.status === "unavailable" ? (
        <Notice pose="think" title={t("pay.unavailableTitle")} body={t("pay.unavailableBody")} />
      ) : waiting ? (
        <Notice pose="think" title={t("pay.checkingTitle")} body={t("pay.checkingBody")} />
      ) : (
        <PayForm token={token} view={data} />
      )}
    </Shell>
  );
}
