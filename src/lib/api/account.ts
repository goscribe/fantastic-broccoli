"use client";

import { api } from "./trpc-client";

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

export async function fetchAccountSummary(): Promise<AccountSummary> {
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

export async function fetchPlanOptions(): Promise<PlanOption[]> {
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

/** Redirects to Stripe checkout for the chosen plan. */
export async function switchPlan(planId: string): Promise<void> {
  const session = await api.payment.createCheckoutSession.mutate({ planId });
  if (session.url) window.location.href = session.url;
}

export async function updateProfile(name: string): Promise<void> {
  await api.auth.updateProfile.mutate({ name });
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
