import { rpc } from "./study-session";

/**
 * Client for the server's `rewards` router. Points are derived server-side
 * from finished activities (+10) and finished sessions (+25); they buy
 * streak freezes and cosmetics only.
 */

export type RewardSlot = "freeze" | "theme" | "outfit";
export type EquipSlot = Exclude<RewardSlot, "freeze">;

export interface RewardCatalogItem {
  id: string;
  slot: RewardSlot;
  cost: number;
}

export interface RewardsSummary {
  balance: number;
  earned: number;
  spent: number;
  freezes: number;
  maxFreezes: number;
  owned: string[];
  theme: string | null;
  outfit: string | null;
  catalog: RewardCatalogItem[];
}

export const POINTS_PER_ACTIVITY = 10;
export const POINTS_PER_SESSION = 25;

export const fetchRewards = () =>
  rpc<RewardsSummary>("rewards.get", "query", undefined);

export const buyReward = (itemId: string) =>
  rpc<RewardsSummary>("rewards.buy", "mutation", { itemId });

export const equipReward = (slot: EquipSlot, itemId: string | null) =>
  rpc<RewardsSummary>("rewards.equip", "mutation", { slot, itemId });
