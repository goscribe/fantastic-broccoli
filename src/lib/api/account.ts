"use client";

import { api } from "./trpc-client";
import { isLiveApi } from "./config";

export interface AccountSummary {
  planName: string;
  hasActivePlan: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  worksheetsUsed: number;
  worksheetsLimit: number;
  flashcardsUsed: number;
  flashcardsLimit: number;
}

const demoSummary: AccountSummary = {
  planName: "Free",
  hasActivePlan: false,
  storageUsedBytes: 138 * 1024 * 1024,
  storageLimitBytes: 1024 * 1024 * 1024,
  worksheetsUsed: 4,
  worksheetsLimit: 10,
  flashcardsUsed: 6,
  flashcardsLimit: 15,
};

export async function fetchAccountSummary(): Promise<AccountSummary> {
  if (!isLiveApi) return demoSummary;
  const overview = await api.payment.getUsageOverview.query();
  return {
    planName: overview.hasActivePlan ? "Pro" : "Free",
    hasActivePlan: overview.hasActivePlan,
    storageUsedBytes: Number(overview.usage.storageBytes),
    storageLimitBytes: Number(overview.limits.maxStorageBytes),
    worksheetsUsed: overview.usage.worksheets,
    worksheetsLimit: overview.limits.maxWorksheets,
    flashcardsUsed: overview.usage.flashcards,
    flashcardsLimit: overview.limits.maxFlashcards,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
