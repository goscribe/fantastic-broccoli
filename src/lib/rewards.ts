"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { fetchStreak, type StreakSummary } from "@/lib/api/streak";
import {
  buyReward,
  equipReward,
  fetchRewards,
  type EquipSlot,
  type RewardsSummary,
} from "@/lib/api/rewards";
import { ACCENT_STORAGE_KEY, accentForTheme } from "@/lib/accent-theme";
import { toastError } from "@/lib/toast";

/** Daily streak + points shop: shared query keys and hooks. */

export const STREAK_KEY = ["streak"] as const;
export const REWARDS_KEY = ["rewards"] as const;

export const OUTFITS = [
  "outfit_glasses",
  "outfit_beanie",
  "outfit_headphones",
  "outfit_grad_cap",
  "outfit_crown",
] as const;
export type OutfitId = (typeof OUTFITS)[number];

export const isOutfitId = (id: string | null | undefined): id is OutfitId =>
  !!id && (OUTFITS as readonly string[]).includes(id);

export function useStreak(enabled = true) {
  return useQuery({
    queryKey: STREAK_KEY,
    queryFn: fetchStreak,
    staleTime: 60_000,
    enabled,
  });
}

export function useRewards(enabled = true) {
  return useQuery({
    queryKey: REWARDS_KEY,
    queryFn: fetchRewards,
    staleTime: 60_000,
    enabled,
  });
}

/** The outfit the cat is wearing, or null. */
export function useEquippedOutfit(): OutfitId | null {
  const { data } = useRewards();
  return isOutfitId(data?.outfit) ? data.outfit : null;
}

/** Points and streak are derived from finished work server-side: refetch after a completion. */
export function refreshProgress(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: STREAK_KEY }),
    queryClient.invalidateQueries({ queryKey: REWARDS_KEY }),
  ]);
}

/**
 * Mirrors the equipped accent theme onto <html data-accent> (and caches it so
 * the head script can apply it before paint next time). Off on public pages.
 */
export function useAccentTheme(enabled: boolean) {
  const { data } = useRewards(enabled);
  const accent = enabled ? accentForTheme(data?.theme) : null;
  const known = !enabled || data !== undefined;
  useEffect(() => {
    if (!known) return;
    const root = document.documentElement;
    if (accent) root.setAttribute("data-accent", accent);
    else root.removeAttribute("data-accent");
    if (!enabled) return;
    try {
      if (accent) localStorage.setItem(ACCENT_STORAGE_KEY, accent);
      else localStorage.removeItem(ACCENT_STORAGE_KEY);
    } catch {}
  }, [accent, enabled, known]);
}

export function useBuyReward(fallbackError: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => buyReward(itemId),
    onSuccess: (summary) => {
      queryClient.setQueryData<RewardsSummary>(REWARDS_KEY, summary);
      // A new freeze shows in the streak popover too.
      queryClient.invalidateQueries({ queryKey: STREAK_KEY });
    },
    onError: (error) => toastError(error, fallbackError),
  });
}

export function useEquipReward(fallbackError: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slot: EquipSlot; itemId: string | null }) =>
      equipReward(input.slot, input.itemId),
    onMutate: async ({ slot, itemId }) => {
      await queryClient.cancelQueries({ queryKey: REWARDS_KEY });
      const previous = queryClient.getQueryData<RewardsSummary>(REWARDS_KEY);
      if (previous) {
        queryClient.setQueryData<RewardsSummary>(REWARDS_KEY, {
          ...previous,
          [slot]: itemId,
        });
      }
      return { previous };
    },
    onSuccess: (summary) =>
      queryClient.setQueryData<RewardsSummary>(REWARDS_KEY, summary),
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REWARDS_KEY, context.previous);
      }
      toastError(error, fallbackError);
    },
  });
}

export type { StreakSummary, RewardsSummary };
