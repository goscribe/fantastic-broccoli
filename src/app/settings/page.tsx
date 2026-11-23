"use client";
import { cn } from "@/lib/utils";

import { Suspense, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BILLING_PAUSED } from "@/lib/billing-paused";
import { CHECKOUT_REFRESH_DELAYS_MS, checkoutReturn } from "@/lib/checkout-return";
import { planBilling, planDisplayName } from "@/lib/plan-display";
import { CourseworkPlanRow } from "@/components/coursework/settings-row";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { refreshSession, signOut, useAuthUser } from "@/lib/api/auth";
import { toast, toastError } from "@/lib/toast";
import {
  cancelSubscription,
  fetchCurrentSubscription,
  fetchPlanOptions,
  resumeSubscription,
  updatePreferredLanguage,
  updateProfile,
  uploadProfilePicture,
  type CurrentSubscription,
  type PlanOption,
} from "@/lib/api/account";
import {
  setUiLocale,
  useI18n,
  UI_LOCALES,
  UI_LOCALE_FLAGS,
  type Locale,
} from "@/lib/i18n";
import "@/lib/i18n/settings";
import "@/lib/i18n/reminders";
import { ReminderSettings } from "@/components/reminders/reminder-settings";
import { inputClass } from "@/components/ui/input";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function formatDate(value: Date | string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function needsBillingManagement(subscription: CurrentSubscription | null) {
  return Boolean(subscription && !["active", "trialing"].includes(subscription.status));
}

/**
 * The plan as one row: what you are on, what happens next, and where to
 * change it (Pricing). Cancelling stays here: a subscriber must always be
 * able to stop a trial or a renewal from their account.
 */
function PlanRow({
  plans,
  subscription,
  loading,
  switching,
  onCancel,
  onResume,
}: {
  plans: PlanOption[];
  subscription: CurrentSubscription | null;
  loading: boolean;
  switching: boolean;
  onCancel: () => void;
  onResume: () => void;
}) {
  const { t, locale } = useI18n();
  const active = plans.find((p) => p.isActive && p.priceDollars > 0) ?? null;
  const name = active ? planDisplayName(active.name) : subscription ? planDisplayName(subscription.planName) : t("set.free");
  const isPass = active ? planBilling(active) === "once" : false;
  const manageable = subscription && !needsBillingManagement(subscription) && !isPass;
  let status: string | null = null;
  if (subscription?.cancelAt) status = t("set.endsOn").replace("{date}", formatDate(subscription.cancelAt, locale));
  else if (subscription?.isTrial) status = t("set.trialEndsOn").replace("{date}", formatDate(subscription.currentPeriodEnd, locale));
  else if (isPass && active?.accessUntil) status = t("set.accessUntil").replace("{date}", formatDate(active.accessUntil, locale));
  else if (subscription && !needsBillingManagement(subscription)) status = t("set.renewsOn").replace("{date}", formatDate(subscription.currentPeriodEnd, locale));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-5 w-28" />
        ) : (
          <p className="text-[16px] font-extrabold">{name}</p>
        )}
        {!loading && status && <p className="mt-0.5 text-small text-muted-foreground">{status}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {manageable && subscription?.cancelAt ? (
          <Button variant="ghost" size="sm" disabled={switching} onClick={onResume}>
            {t("set.keepPlan")}
          </Button>
        ) : manageable ? (
          <Button variant="ghost" size="sm" disabled={switching} onClick={onCancel}>
            {subscription?.isTrial ? t("set.cancelTrial") : t("set.cancelPlan")}
          </Button>
        ) : null}
        {!BILLING_PAUSED && (
          <Link href="/pricing" className={buttonClass({ variant: "secondary", size: "sm" })}>
            {active || subscription ? t("set.changePlan") : t("set.seePlans")}
          </Link>
        )}
      </div>
    </div>
  );
}

const SETTINGS_SECTIONS = [
  ["account", "settings.account"],
  ["language", "settings.language"],
  ["reminders", "remind.settingsTitle"],
  ["plan", "settings.plan"],
] as const;

/**
 * Back from the hosted checkout (`/settings?checkout=success|cancelled`): say what
 * happened without claiming a payment or the lack of one, then re-read the plan a
 * few times for either return. The plan itself only changes when the server hears
 * from the payment provider; checkout is never reopened from here.
 */
function CheckoutReturnNotice({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const params = useSearchParams();
  const router = useRouter();
  const param = params.get("checkout");
  const refreshRef = useRef(onRefresh);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    const outcome = checkoutReturn(param);
    if (!outcome) return;
    toast.message(outcome.message);
    // Dropping the query re-runs this effect with no outcome; the timers outlive that on purpose.
    router.replace("/settings");
    timers.current = CHECKOUT_REFRESH_DELAYS_MS.map((ms) =>
      setTimeout(() => void refreshRef.current().catch(() => {}), ms),
    );
  }, [param, router]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return null;
}

export default function SettingsPage() {
  const { user } = useAuthUser();
  const { t, locale } = useI18n();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? user?.name ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(
    null,
  );
  const [confirmingDowngrade, setConfirmingDowngrade] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);

  useEffect(() => {
    fetchPlanOptions()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setPlansLoading(false));
    fetchCurrentSubscription()
      .then(setSubscription)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setPhotoError("Image must be under 5 MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      await uploadProfilePicture(file);
      await refreshSession();
      toast.success("Profile picture updated");
    } catch (err) {
      setPhotoError(toastError(err, "Failed to upload image."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLanguageChange = async (code: Locale) => {
    const previous = locale;
    setUiLocale(code);
    setLanguageSaved(false);
    setSavingLanguage(true);
    try {
      await updatePreferredLanguage(code);
      setLanguageSaved(true);
      setTimeout(() => setLanguageSaved(false), 2500);
    } catch (err) {
      setUiLocale(previous);
      toastError(err, "Failed to save language");
    } finally {
      setSavingLanguage(false);
    }
  };

  const refreshBilling = async () => {
    const [sub, options] = await Promise.all([
      fetchCurrentSubscription(),
      fetchPlanOptions(),
    ]);
    setSubscription(sub);
    setPlans(options);
  };

  const openDowngrade = async () => {
    try {
      const sub = subscription ?? (await fetchCurrentSubscription());
      if (!sub) {
        toast.error("You're already on the free plan.");
        return;
      }
      setSubscription(sub);
      setConfirmingDowngrade(true);
    } catch (err) {
      toastError(err, "Couldn't load your plan");
    }
  };

  const handleDowngrade = async () => {
    setSwitching(true);
    try {
      const sub = await cancelSubscription();
      setSubscription(sub);
      setConfirmingDowngrade(false);
      toast.success(
        t(
          needsBillingManagement(sub)
            ? "set.renewalStopped"
            : sub.isTrial ? "set.trialCancelled" : "set.planCancelled",
        ).replace(
          "{date}",
          formatDate(sub.cancelAt ?? sub.currentPeriodEnd, locale),
        ),
      );
      await refreshBilling().catch(() => {});
    } catch (err) {
      toastError(err, "Failed to cancel plan");
    } finally {
      setSwitching(false);
    }
  };

  const handleResume = async () => {
    setSwitching(true);
    try {
      setSubscription(await resumeSubscription());
      toast.success(t("set.planKept"));
      await refreshBilling().catch(() => {});
    } catch (err) {
      toastError(err, "Failed to resume plan");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <PageShell max="max-w-none">
      <Suspense fallback={null}>
        <CheckoutReturnNotice onRefresh={refreshBilling} />
      </Suspense>
      <PageHeader title={<>{t("settings.title")}</>} subtitle={<>{t("set.subtitle")}</>} />
      <div className="flex flex-col gap-8 lg:flex-row">
      <nav className="hidden w-[200px] shrink-0 lg:block">
        <ul className="sticky top-[calc(var(--app-top,0px)+1.5rem)] space-y-1 text-small font-semibold">
          {SETTINGS_SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-xl px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                {t(label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 max-w-[760px]">

        {/* Account */}
        <section id="account">
          <h2 className="page-h2">{t("settings.account")}</h2>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  aria-label="Change profile picture"
                  className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-lg font-semibold text-accent transition-opacity disabled:opacity-60"
                >
                  {user?.profilePicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.profilePicture}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (name || "?").charAt(0).toUpperCase()
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-4 w-4 text-white" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="mt-2 block w-16 text-center text-[11px] font-medium text-accent hover:underline disabled:opacity-60"
                >
                  {uploadingPhoto ? t("set.uploading") : t("set.change")}
                </button>
                {photoError && (
                  <p className="mt-1 w-14 text-caption text-red-500">
                    {photoError}
                  </p>
                )}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="block text-small font-medium"
                  >
                    {t("set.displayName")}
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="block text-small font-medium"
                  >
                    {t("set.email")}
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    className={cn(inputClass, "mt-1.5 bg-muted/60 text-muted-foreground")}
                  />
                  <p className="mt-1.5 text-caption text-faint">
                    {t("set.emailHint")}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-caption text-accent font-medium">
                    {t("set.saved")}
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !name.trim() || name === user?.name}
                >
                  {saving ? t("set.saving") : t("set.saveChanges")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Language */}
        <section id="language" className="mt-8">
          <h2 className="page-h2">{t("settings.language")}</h2>
          <p className="mt-0.5 text-small text-muted-foreground">
            {t("settings.languageHint")}
          </p>
          {/* One select: it sits on the page, no card around it. */}
          <div className="mt-3">
            <label className="block max-w-sm">
              <span className="sr-only">{t("settings.language")}</span>
              <select
                value={locale}
                disabled={savingLanguage}
                onChange={(e) => handleLanguageChange(e.target.value as Locale)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[14px] font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {(Object.keys(UI_LOCALES) as Locale[]).map((code) => (
                  <option key={code} value={code}>
                    {UI_LOCALE_FLAGS[code]} {UI_LOCALES[code]}
                  </option>
                ))}
              </select>
            </label>
            <p
              className={`mt-3 text-caption font-medium text-accent transition-opacity ${
 languageSaved ?"opacity-100":"opacity-0"
 }`}
            >
              {t("settings.languageSaved")}
            </p>
          </div>
        </section>

        {/* Study reminders (time + push on this device) */}
        <ReminderSettings />

        {/* Plan: one row; plans and prices live on Pricing. */}
        <section id="plan" className="mt-8">
          <h2 className="page-h2">{t("settings.plan")}</h2>
          {needsBillingManagement(subscription) && subscription && (
            <div role="status" className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-ui font-semibold">{t("set.manageSubscription")}</p>
              <p className="text-small text-muted-foreground">
                {t("set.inactiveSubscription").replace("{plan}", subscription.planName)}
              </p>
              {subscription.cancelAt ? (
                <p className="text-small">{t("set.renewalStopped")}</p>
              ) : (
                <Button variant="outline" size="sm" disabled={switching} onClick={openDowngrade}>
                  {t("set.stopRenewal")}
                </Button>
              )}
            </div>
          )}
          <PlanRow
            plans={plans}
            subscription={subscription}
            loading={plansLoading}
            switching={switching}
            onCancel={openDowngrade}
            onResume={handleResume}
          />
          <CourseworkPlanRow />
        </section>

        <section className="mt-8">
          <Button variant="secondary" size="sm" onClick={() => signOut()}>
            {t("nav.signOut")}
          </Button>
        </section>

        {/* Delete account: last on the page, its own section. */}
        <DeleteAccountSection email={user?.email} />
      </div>

      {confirmingDowngrade && subscription && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
          onClick={() => !switching && setConfirmingDowngrade(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setConfirmingDowngrade(false)}
              aria-label="Close"
              disabled={switching}
              className="absolute right-4 top-4 rounded-full p-1 text-faint hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold tracking-tight">
              {needsBillingManagement(subscription)
                ? t("set.stopRenewal")
                : subscription.isTrial
                  ? t("set.cancelTrialTitle")
                  : t("set.downgradeTitle")}
            </h2>
            <p className="mt-2 text-ui text-muted-foreground">
              {t(
                needsBillingManagement(subscription)
                  ? "set.stopRenewalBody"
                  : subscription.isTrial
                    ? "set.cancelTrialBody"
                    : "set.downgradeBody",
              )
                .replace("{plan}", subscription.planName)
                .replace(
                  "{date}",
                  formatDate(subscription.currentPeriodEnd, locale),
                )}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                disabled={switching}
                onClick={handleDowngrade}
              >
                {switching
                  ? t("set.cancelling")
                  : needsBillingManagement(subscription)
                    ? t("set.stopRenewal")
                    : subscription.isTrial
                      ? t("set.confirmCancelTrial")
                      : t("set.confirmDowngrade")}
              </Button>
              <button
                type="button"
                disabled={switching}
                onClick={() => setConfirmingDowngrade(false)}
                className="text-xs text-faint hover:text-muted-foreground"
              >
                {t("set.keepPlan")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageShell>
  );
}
