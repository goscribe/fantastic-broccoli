"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanOption } from "@/lib/api/account";
import { createPayLink, type CreatedPayLink } from "@/lib/api/pay-link";
import { copyText } from "@/lib/api/referrals";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate, isPass, shareTargets } from "@/lib/pass";
import { planDisplayName } from "@/lib/plan-display";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePassLabel } from "./pass-options";
import "@/lib/i18n/billing";

/** Passes first (what a parent most often pays for), then monthly plans from the cheapest. */
export function payablePlans(plans: PlanOption[]): PlanOption[] {
  const paid = plans.filter((p) => p.priceDollars > 0 && !p.isActive);
  return [
    ...paid.filter((p) => isPass(p)).sort((a, b) => a.priceDollars - b.priceDollars),
    ...paid.filter((p) => !isPass(p)).sort((a, b) => a.priceDollars - b.priceDollars),
  ];
}

const tileClass =
  "flex min-h-11 items-center justify-center rounded-[14px] border border-border bg-white px-2 text-[13px] font-bold text-foreground hover:border-border-strong hover:bg-muted";

/**
 * "Ask a parent to pay": pick a plan, then send a single-use link by the
 * phone's share sheet, WhatsApp, Messages, email or copy. The link opens the
 * public /pay/<token> page, where whoever pays needs no account.
 *
 * Plans offered: the exam passes and every monthly plan the server lists
 * (Starter, Pro, and Ultra once it is on sale); the server checks again when
 * the link is made.
 */
export function AskParentDialog({
  plans,
  defaultPlanId,
  defaultFirstName,
  onClose,
  initialLink = null,
}: {
  /** Payable plans (passes and monthly), in display order. */
  plans: PlanOption[];
  defaultPlanId?: string;
  defaultFirstName: string;
  onClose: () => void;
  /** Start on the share step (previews / screenshots). */
  initialLink?: CreatedPayLink | null;
}) {
  const { t, locale } = useI18n();
  const label = usePassLabel();
  const [planId, setPlanId] = useState(defaultPlanId ?? plans[0]?.id ?? "");
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<CreatedPayLink | null>(initialLink);
  const [copied, setCopied] = useState(false);
  // Only ever rendered after a tap, so reading `navigator` here is safe.
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const planLabel = (plan: PlanOption) =>
    isPass(plan)
      ? `${label(plan)} · $${plan.priceDollars} ${t("set.once")}`
      : `${planDisplayName(plan.name)} · ${fill(t("ask.monthlyOption"), { price: `$${plan.priceDollars}` })}`;

  const create = async () => {
    setCreating(true);
    try {
      setLink(await createPayLink(planId, firstName.trim() || null));
    } catch (err) {
      toastError(err, t("ask.failed"));
    } finally {
      setCreating(false);
    }
  };

  const message = link
    ? fill(t("ask.message"), {
        what:
          link.plan.kind === "pass" && link.plan.accessUntil
            ? fill(t("ask.whatPass"), { price: `$${link.plan.price}`, date: formatPassDate(link.plan.accessUntil, locale) })
            : fill(t("ask.whatMonthly"), { price: `$${link.plan.price}` }),
        url: link.url,
      })
    : "";
  const targets = link ? shareTargets({ text: message, subject: t("ask.messageSubject") }) : null;

  const copy = async () => {
    if (!link) return;
    if (await copyText(link.url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toastError(new Error(t("ask.copyFailed")), t("ask.copyFailed"));
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: t("ask.messageSubject"), text: message });
    } catch {
      // Dismissed, or not allowed here: the buttons below still work.
    }
  };

  // Portalled: the subscribe wall's backdrop blur would otherwise become the
  // containing block of this fixed overlay and clip it to the wall's scroll box.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-parent-title"
      className="fixed inset-0 z-[210] flex items-end justify-center bg-foreground/30 sm:items-center sm:px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-border bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-[24px] sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ask.done")}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>

        {!link ? (
          <>
            <h2 id="ask-parent-title" className="pr-10 text-[18px] font-extrabold leading-tight">
              {t("ask.title")}
            </h2>
            <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{t("ask.body")}</p>

            <fieldset className="mt-5">
              <legend className="text-[13px] font-bold">{t("ask.choosePlan")}</legend>
              <div className="mt-2 space-y-2">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3 text-[15px] transition-colors",
                      planId === plan.id ? "border-foreground font-bold" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="pay-plan"
                      className="size-4 accent-foreground"
                      checked={planId === plan.id}
                      onChange={() => setPlanId(plan.id)}
                    />
                    <span className="min-w-0 flex-1">{planLabel(plan)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-[13px] font-bold">{t("ask.nameLabel")}</span>
              <Input
                className="mt-1.5"
                value={firstName}
                maxLength={40}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
              <span className="mt-1 block text-[12px] text-muted-foreground">{t("ask.nameHint")}</span>
            </label>

            <Button size="lg" className="mt-5 w-full" disabled={!planId || creating} onClick={create}>
              {creating ? t("ask.creating") : t("ask.create")}
            </Button>
          </>
        ) : (
          <>
            <h2 id="ask-parent-title" className="pr-10 text-[18px] font-extrabold leading-tight">
              {t("ask.readyTitle")}
            </h2>
            <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
              {fill(t("ask.readyBody"), { date: formatPassDate(link.expiresAt, locale) })}
            </p>

            <div className="mt-4 rounded-[14px] bg-muted p-3.5">
              <p className="text-[13px] leading-snug text-foreground [overflow-wrap:anywhere]">{message}</p>
            </div>

            {canShare && (
              <Button size="lg" className="mt-4 w-full" onClick={share}>
                {t("ask.share")}
              </Button>
            )}
            <div className={cn("grid grid-cols-3 gap-2", canShare ? "mt-2" : "mt-4")}>
              <a href={targets!.whatsapp} target="_blank" rel="noopener noreferrer" className={tileClass}>
                {t("ask.whatsapp")}
              </a>
              <a href={targets!.sms} className={tileClass}>
                {t("ask.messages")}
              </a>
              <a href={targets!.email} className={tileClass}>
                {t("ask.email")}
              </a>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-border bg-white py-1.5 pl-3.5 pr-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" title={link.url}>
                {link.url}
              </span>
              <Button size="sm" variant={canShare ? "secondary" : "primary"} className="shrink-0" onClick={copy}>
                {copied ? t("ask.copied") : t("ask.copy")}
              </Button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setLink(null)}>
                {t("ask.another")}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                {t("ask.done")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
