"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, HeartHandshake, Mail, MessageCircle, MessageSquare, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanOption } from "@/lib/api/account";
import { createPayLink, type CreatedPayLink } from "@/lib/api/pay-link";
import { copyText } from "@/lib/api/referrals";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate, isPass, shareTargets } from "@/lib/pass";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePassLabel } from "./pass-options";
import "@/lib/i18n/billing";

/**
 * "Ask a parent to pay": pick a plan, then send a single-use link by the
 * phone's share sheet, WhatsApp, Messages, email or copy. The link opens the
 * public /pay/<token> page, where whoever pays needs no account.
 */
export function AskParentDialog({
  plans,
  defaultPlanId,
  defaultFirstName,
  onClose,
  initialLink = null,
}: {
  /** Payable plans (monthly and passes). */
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
      : `${plan.name.charAt(0).toUpperCase()}${plan.name.slice(1)} · ${fill(t("ask.monthlyOption"), { price: `$${plan.priceDollars}` })}`;

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
      className="fixed inset-0 z-[210] flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ask.done")}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
          <HeartHandshake className="size-5" />
        </span>

        {!link ? (
          <>
            <h2 id="ask-parent-title" className="mt-3 text-xl font-bold tracking-tight">
              {t("ask.title")}
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{t("ask.body")}</p>

            <fieldset className="mt-5">
              <legend className="text-[13px] font-semibold">{t("ask.choosePlan")}</legend>
              <div className="mt-2 space-y-2">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 text-[14px] transition-colors",
                      planId === plan.id ? "border-accent bg-accent-soft/40" : "border-border hover:border-accent/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="pay-plan"
                      className="accent-accent"
                      checked={planId === plan.id}
                      onChange={() => setPlanId(plan.id)}
                    />
                    <span className="min-w-0 flex-1">{planLabel(plan)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-[13px] font-semibold">{t("ask.nameLabel")}</span>
              <Input
                className="mt-1.5"
                value={firstName}
                maxLength={40}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
              <span className="mt-1 block text-[12px] text-faint">{t("ask.nameHint")}</span>
            </label>

            <Button size="lg" className="mt-5 w-full" disabled={!planId || creating} onClick={create}>
              {creating ? t("ask.creating") : t("ask.create")}
            </Button>
          </>
        ) : (
          <>
            <h2 id="ask-parent-title" className="mt-3 text-xl font-bold tracking-tight">
              {t("ask.readyTitle")}
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
              {fill(t("ask.readyBody"), { date: formatPassDate(link.expiresAt, locale) })}
            </p>

            <div className="mt-4 rounded-2xl border border-border bg-background p-3.5">
              <p className="text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{message}</p>
            </div>

            {canShare && (
              <Button size="lg" className="mt-4 w-full gap-2" onClick={share}>
                <Share2 className="size-4" />
                {t("ask.share")}
              </Button>
            )}
            <div className={cn("grid grid-cols-3 gap-2", canShare ? "mt-2" : "mt-4")}>
              <a
                href={targets!.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-[12.5px] font-semibold hover:border-accent/50"
              >
                <MessageCircle className="size-5 text-[#25D366]" />
                {t("ask.whatsapp")}
              </a>
              <a
                href={targets!.sms}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-[12.5px] font-semibold hover:border-accent/50"
              >
                <MessageSquare className="size-5 text-accent" />
                {t("ask.messages")}
              </a>
              <a
                href={targets!.email}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-[12.5px] font-semibold hover:border-accent/50"
              >
                <Mail className="size-5 text-accent" />
                {t("ask.email")}
              </a>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background py-1.5 pl-3.5 pr-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" title={link.url}>
                {link.url}
              </span>
              <Button size="sm" variant="secondary" className="shrink-0 gap-1.5" onClick={copy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? t("ask.copied") : t("ask.copy")}
              </Button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setLink(null)}>
                {t("ask.another")}
              </Button>
              <Button variant="outline" onClick={onClose}>
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
