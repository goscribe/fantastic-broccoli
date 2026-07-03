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

export interface PlanOption {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  storageLimitBytes: number;
  worksheetsLimit: number;
  flashcardsLimit: number;
  isActive: boolean;
}

const demoPlans: PlanOption[] = [
  {
    id: "plan-free",
    name: "Free",
    priceCents: 0,
    description: "For trying Scribe out",
    storageLimitBytes: 1024 * 1024 * 1024,
    worksheetsLimit: 10,
    flashcardsLimit: 15,
    isActive: true,
  },
  {
    id: "plan-plus",
    name: "Plus",
    priceCents: 499,
    description: "For a full course load",
    storageLimitBytes: 10 * 1024 * 1024 * 1024,
    worksheetsLimit: 100,
    flashcardsLimit: 150,
    isActive: false,
  },
  {
    id: "plan-pro",
    name: "Pro",
    priceCents: 999,
    description: "For exam season",
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    worksheetsLimit: 500,
    flashcardsLimit: 750,
    isActive: false,
  },
];

export async function fetchPlanOptions(): Promise<PlanOption[]> {
  if (!isLiveApi) return demoPlans;
  const plans = await api.payment.getPlans.query();
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceCents: plan.price,
    description: plan.description ?? "",
    storageLimitBytes: Number(plan.limit?.maxStorageBytes ?? 0),
    worksheetsLimit: plan.limit?.maxWorksheets ?? 0,
    flashcardsLimit: plan.limit?.maxFlashcards ?? 0,
    isActive: plan.isActive,
  }));
}

/** Live: redirects to Stripe checkout. Demo: resolves immediately. */
export async function switchPlan(planId: string): Promise<void> {
  if (!isLiveApi) return;
  const session = await api.payment.createCheckoutSession.mutate({ planId });
  if (session.url) window.location.href = session.url;
}

export async function updateProfile(name: string): Promise<void> {
  if (!isLiveApi) return;
  await api.auth.updateProfile.mutate({ name });
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
