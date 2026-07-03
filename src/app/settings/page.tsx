"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut, useAuthUser } from "@/lib/api/auth";
import {
  fetchAccountSummary,
  formatBytes,
  type AccountSummary,
} from "@/lib/api/account";

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: string;
  limit: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {used} <span className="text-faint">/ {limit}</span>
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);

  useEffect(() => {
    fetchAccountSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, plan, and usage.
        </p>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Account</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
              {user?.name.charAt(0).toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {user?.email ?? "Personal workspace"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => signOut()}
            >
              Sign out
            </Button>
          </div>
        </section>

        {summary && (
          <section className="mt-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Plan &amp; usage</h2>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-accent">
                {summary.planName}
              </span>
            </div>
            <div className="mt-2 divide-y divide-border">
              <UsageRow
                label="Storage"
                used={formatBytes(summary.storageUsedBytes)}
                limit={formatBytes(summary.storageLimitBytes)}
              />
              <UsageRow
                label="Worksheets"
                used={String(summary.worksheetsUsed)}
                limit={String(summary.worksheetsLimit)}
              />
              <UsageRow
                label="Flashcard sets"
                used={String(summary.flashcardsUsed)}
                limit={String(summary.flashcardsLimit)}
              />
            </div>
            {!summary.hasActivePlan && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                You&apos;re on the free plan. Upgrade for more storage and
                unlimited generated materials.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
