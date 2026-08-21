"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Camera } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderDecor } from "@/components/graphics/floating-decor";
import { refreshSession, signOut, useAuthUser } from "@/lib/api/auth";
import { toast, toastError } from "@/lib/toast";
import {
  describeLedgerEntry,
  fetchAccountSummary,
  fetchPlanOptions,
  fetchTokenHistory,
  fetchTokenOverview,
  formatBytes,
  switchPlan,
  updatePreferredLanguage,
  updateProfile,
  uploadProfilePicture,
  type AccountSummary,
  type PlanOption,
  type TokenLedgerEntry,
  type TokenOverview,
} from "@/lib/api/account";
import {
  setUiLocale,
  useI18n,
  UI_LOCALES,
  UI_LOCALE_FLAGS,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import "@/lib/i18n/settings";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function UsageBar({
  label,
  used,
  limit,
  usedLabel,
  limitLabel,
}: {
  label: string;
  used: number;
  limit: number;
  usedLabel: string;
  limitLabel: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {usedLabel} <span className="text-faint">/ {limitLabel}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onSelect,
  switching,
}: {
  plan: PlanOption;
  onSelect: (id: string) => void;
  switching: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        plan.isActive ? "border-accent bg-accent-soft/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{plan.name}</p>
        {plan.isActive && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
            {t("set.current")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {plan.description}
      </p>
      <p className="mt-3 text-lg font-bold tabular-nums">
        {plan.priceDollars === 0 ? t("set.free") : `$${plan.priceDollars}`}
        {plan.priceDollars > 0 && (
          <span className="text-[12px] font-normal text-faint">
            {" "}
            {t("set.perMonth")}
          </span>
        )}
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-accent" />
          {t("set.storageAmount").replace(
            "{amount}",
            formatBytes(plan.storageLimitBytes),
          )}
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-accent" />
          {t("set.tokensPerMonth").replace(
            "{count}",
            String(plan.monthlyTokens),
          )}
        </li>
      </ul>
      <div className="mt-auto pt-4">
        {plan.isActive ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {t("set.yourPlan")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={switching}
            onClick={() => onSelect(plan.id)}
          >
            {plan.priceDollars === 0
              ? t("set.downgrade")
              : t("set.switchTo").replace("{name}", plan.name)}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthUser();
  const { t, locale } = useI18n();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? user?.name ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenOverview | null>(null);
  const [ledger, setLedger] = useState<TokenLedgerEntry[] | null>(null);
  const [showAllLedger, setShowAllLedger] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);

  useEffect(() => {
    fetchAccountSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
    fetchPlanOptions()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setPlansLoading(false));
    fetchTokenOverview()
      .then(setTokens)
      .catch(() => {});
    fetchTokenHistory(100)
      .then(setLedger)
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

  const handleSwitch = async (planId: string) => {
    setSwitching(true);
    try {
      await switchPlan(planId);
      toast.success("Plan updated");
    } catch (err) {
      toastError(err, "Failed to switch plan");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <main className="flex-1 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("set.subtitle")}
            </p>
          </div>
          <HeaderDecor image="/illustrations/icons/target.png" />
        </div>

        {/* Account */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{t("settings.account")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("set.accountHint")}
          </p>
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
                  <p className="mt-1 w-14 text-[11px] text-red-500">{photoError}</p>
                )}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="block text-[13px] font-medium"
                  >
                    {t("set.displayName")}
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                  <p className="mt-1.5 text-[12px] text-faint">
                    {t("set.displayNameHint")}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="block text-[13px] font-medium"
                  >
                    {t("set.email")}
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email ?? "alan@scribe.study"}
                    disabled
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-muted/60 px-3.5 text-sm text-muted-foreground"
                  />
                  <p className="mt-1.5 text-[12px] text-faint">
                    {t("set.emailHint")}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                {t("nav.signOut")}
              </Button>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-[12px] text-accent font-medium">
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
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{t("settings.language")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("settings.languageHint")}
          </p>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {(Object.keys(UI_LOCALES) as Locale[]).map((code) => {
                const active = code === locale;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={savingLanguage}
                    onClick={() => handleLanguageChange(code)}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">
                      {UI_LOCALE_FLAGS[code]}
                    </span>
                    <span className="truncate">{UI_LOCALES[code]}</span>
                    {active && (
                      <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p
              className={`mt-3 text-[12px] font-medium text-accent transition-opacity ${
                languageSaved ? "opacity-100" : "opacity-0"
              }`}
            >
              {t("settings.languageSaved")}
            </p>
          </div>
        </section>

        {/* Plan */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{t("settings.plan")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("set.planHint")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {plansLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3"
                  >
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              : plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSelect={handleSwitch}
                    switching={switching}
                  />
                ))}
          </div>
        </section>

        {/* Usage */}
        {summaryLoading && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t("settings.usage")}</h2>
            <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-2 divide-y divide-border">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="py-3 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </section>
        )}
        {!summaryLoading && summary && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t("settings.usage")}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {t("set.usageHint").replace("{plan}", summary.planName)}
            </p>
            <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-2 divide-y divide-border">
              <UsageBar
                label={t("set.storage")}
                used={summary.storageUsedBytes}
                limit={summary.storageLimitBytes}
                usedLabel={formatBytes(summary.storageUsedBytes)}
                limitLabel={formatBytes(summary.storageLimitBytes)}
              />
            </div>
          </section>
        )}

        {/* Tokens */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{t("set.tokensTitle")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("set.tokensHint")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Image
                src="/illustrations/icons/stat-bolt.png"
                alt=""
                width={64}
                height={64}
                unoptimized
                className="pointer-events-none h-12 w-12 shrink-0 select-none object-contain"
              />
              <div className="min-w-0">
              <p className="text-[12px] text-muted-foreground">
                {t("set.balance")}
              </p>
              {tokens ? (
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {tokens.balance.toLocaleString()}
                  <span className="ml-1.5 text-[12px] font-normal text-faint">
                    tokens
                  </span>
                </p>
              ) : (
                <Skeleton className="mt-2 h-7 w-24" />
              )}
              {tokens && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {t("set.monthlyAllowance")
                    .replace("{count}", tokens.monthlyAllowance.toLocaleString())
                    .replace("{plan}", tokens.planName)}
                </p>
              )}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] text-muted-foreground">
                {t("set.whatThingsCost")}
              </p>
              {tokens ? (
                <ul className="mt-2 space-y-1 text-[12px]">
                  {(
                    [
                      ["set.costStudySession", tokens.costs.GENERATION],
                      ["set.costUpload", tokens.costs.GENERATION],
                      ["set.costPodcast", tokens.costs.PODCAST_EPISODE],
                      ["set.costStudyGuide", tokens.costs.STUDY_GUIDE],
                      ["set.costFlashcards", tokens.costs.FLASHCARD_SET],
                      ["set.costArtifactSearch", tokens.costs.ARTIFACT_SEARCH],
                      ["set.costCopilot", 0],
                    ] as const
                  ).map(([label, cost]) => (
                    <li
                      key={label}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-muted-foreground">
                        {t(label as TranslationKey)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {cost === 0
                          ? t("set.free")
                          : t("set.nTokens").replace("{count}", String(cost))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton className="mt-2 h-24 w-full" />
              )}
            </div>
          </div>

          {/* Ledger */}
          <div className="mt-3 rounded-2xl border border-border bg-card">
            <p className="px-4 pt-3 text-[12px] font-medium text-muted-foreground">
              {t("set.recentActivity")}
            </p>
            {!ledger && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            )}
            {ledger && ledger.length === 0 && (
              <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground">
                {t("set.noTokenActivity")}
              </p>
            )}
            {ledger && ledger.length > 0 && (
              <ul className="mt-1 divide-y divide-border">
                {(showAllLedger ? ledger : ledger.slice(0, 8)).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-baseline justify-between gap-3 px-4 py-2 text-[13px]"
                  >
                    <span className="min-w-0 truncate">
                      {describeLedgerEntry(entry)}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="text-[11px] text-faint">
                        {new Date(entry.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                      <span
                        className={`font-medium tabular-nums ${
                          entry.amount >= 0
                            ? "text-emerald-600"
                            : "text-foreground"
                        }`}
                      >
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount.toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ledger && ledger.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllLedger((v) => !v)}
                className="w-full border-t border-border px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                {showAllLedger
                  ? t("set.showLess")
                  : t("set.showAll").replace("{count}", String(ledger.length))}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
