"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { setUiLocale, useI18n, UI_LOCALES, type Locale } from "@/lib/i18n";

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
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 ${
        plan.isActive ? "border-accent bg-accent-soft/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{plan.name}</p>
        {plan.isActive && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
            Current
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {plan.description}
      </p>
      <p className="mt-3 text-lg font-bold tabular-nums">
        {plan.priceDollars === 0 ? "Free" : `$${plan.priceDollars}`}
        {plan.priceDollars > 0 && (
          <span className="text-[12px] font-normal text-faint"> / month</span>
        )}
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-accent" />
          {formatBytes(plan.storageLimitBytes)} storage
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-accent" />
          {plan.monthlyTokens} tokens / month
        </li>
      </ul>
      <div className="mt-auto pt-4">
        {plan.isActive ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            Your plan
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={switching}
            onClick={() => onSelect(plan.id)}
          >
            {plan.priceDollars === 0 ? "Downgrade" : `Switch to ${plan.name}`}
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
    setUiLocale(code);
    try {
      await updatePreferredLanguage(code);
      toast.success(t("settings.language"));
    } catch (err) {
      toastError(err, "Failed to save language");
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
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, plan, and usage.
        </p>

        {/* Account */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Account</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Your profile as classmates see it in shared workspaces.
          </p>
          <div className="mt-3 rounded-xl border border-border bg-card p-5">
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
                  className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-lg font-semibold text-accent transition-opacity disabled:opacity-60"
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
                  className="mt-2 block w-14 text-center text-[11px] font-medium text-accent hover:underline disabled:opacity-60"
                >
                  {uploadingPhoto ? "Uploading…" : "Change"}
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
                    Display name
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3.5 text-sm transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                  <p className="mt-1.5 text-[12px] text-faint">
                    Shown to classmates in shared workspaces.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="block text-[13px] font-medium"
                  >
                    Email
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email ?? "alan@scribe.study"}
                    disabled
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-muted/60 px-3.5 text-sm text-muted-foreground"
                  />
                  <p className="mt-1.5 text-[12px] text-faint">
                    Used for sign-in — contact support to change it.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-[12px] text-accent font-medium">
                    Saved
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !name.trim() || name === user?.name}
                >
                  {saving ? "Saving…" : "Save changes"}
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
          <div className="mt-3 rounded-xl border border-border bg-card p-5">
            <select
              value={locale}
              onChange={(e) => handleLanguageChange(e.target.value as Locale)}
              className="w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Object.entries(UI_LOCALES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Plan */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Plan</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Pick the plan that fits how much you study.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {plansLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-4 space-y-3"
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
            <h2 className="text-sm font-semibold">Usage</h2>
            <div className="mt-3 rounded-xl border border-border bg-card px-5 py-2 divide-y divide-border">
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
            <h2 className="text-sm font-semibold">Usage</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              What you&apos;ve used on the {summary.planName} plan this cycle.
            </p>
            <div className="mt-3 rounded-xl border border-border bg-card px-5 py-2 divide-y divide-border">
              <UsageBar
                label="Storage"
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
          <h2 className="text-sm font-semibold">Tokens</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Tokens pay for AI generation. Unused tokens roll over — your
            balance never resets.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[12px] text-muted-foreground">Balance</p>
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
                  +{tokens.monthlyAllowance.toLocaleString()} added each month
                  on the {tokens.planName} plan
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[12px] text-muted-foreground">
                What things cost
              </p>
              {tokens ? (
                <ul className="mt-2 space-y-1 text-[12px]">
                  {(
                    [
                      ["Study session", tokens.costs.GENERATION],
                      ["Material upload & analysis", tokens.costs.GENERATION],
                      ["Podcast episode", tokens.costs.PODCAST_EPISODE],
                      ["Study guide", tokens.costs.STUDY_GUIDE],
                      ["Flashcard set / worksheet", tokens.costs.FLASHCARD_SET],
                      ["AI artifact search", tokens.costs.ARTIFACT_SEARCH],
                      ["Copilot chat", 0],
                    ] as const
                  ).map(([label, cost]) => (
                    <li
                      key={label}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">
                        {cost === 0 ? "Free" : `${cost} tokens`}
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
          <div className="mt-3 rounded-xl border border-border bg-card">
            <p className="px-4 pt-3 text-[12px] font-medium text-muted-foreground">
              Recent activity
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
                No token activity yet.
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
                  ? "Show less"
                  : `Show all ${ledger.length} entries`}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
