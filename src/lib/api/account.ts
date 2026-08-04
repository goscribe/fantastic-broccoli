"use client";

import { api } from "./trpc-client";

export interface AccountSummary {
  planName: string;
  hasActivePlan: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  tokenBalance: number;
  monthlyTokens: number;
}

export async function fetchAccountSummary(): Promise<AccountSummary> {
  const overview = await api.payment.getUsageOverview.query();
  // `tokens` is newer than the published @goscribe/server types.
  const tokens = (
    overview as unknown as {
      tokens?: { balance: number; monthlyAllowance: number; planName?: string };
    }
  ).tokens;
  return {
    planName: tokens?.planName ?? (overview.hasActivePlan ? "Pro" : "Free"),
    hasActivePlan: overview.hasActivePlan,
    storageUsedBytes: Number(overview.usage.storageBytes),
    storageLimitBytes: Number(overview.limits.maxStorageBytes),
    tokenBalance: tokens?.balance ?? 0,
    monthlyTokens: tokens?.monthlyAllowance ?? 0,
  };
}

export interface PlanOption {
  id: string;
  name: string;
  /** Monthly price in whole dollars (matches `Plan.price` on the server). */
  priceDollars: number;
  description: string;
  storageLimitBytes: number;
  monthlyTokens: number;
  isActive: boolean;
}

export async function fetchPlanOptions(): Promise<PlanOption[]> {
  const plans = await api.payment.getPlans.query();
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceDollars: plan.price,
    description: plan.description ?? "",
    storageLimitBytes: Number(plan.limit?.maxStorageBytes ?? 0),
    // `monthlyTokens` is newer than the published @goscribe/server types.
    monthlyTokens:
      (plan as unknown as { monthlyTokens?: number }).monthlyTokens ?? 0,
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

/**
 * Uploads a new profile picture: asks the server for a signed upload URL,
 * PUTs the file straight to storage, then tells the server to broadcast the
 * change. Callers should refreshSession() afterwards to pick up the new URL.
 */
export async function uploadProfilePicture(file: File): Promise<void> {
  const { signedUrl } = await api.auth.uploadProfilePicture.mutate();
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Failed to upload image. Please try again.");
  }
  await api.auth.confirmProfileUpdate.mutate();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
