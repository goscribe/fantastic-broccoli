import { ACCENT_THEMES, type AccentThemeId } from "@/lib/accent-theme";
import type { OutfitId } from "@/lib/rewards";

/** The app owns names and art for the server's catalog ids. */

export const FREEZE_ID = "streak_freeze";

export const THEME_ITEMS: { id: AccentThemeId; nameKey: string }[] = [
  { id: "theme_ocean", nameKey: "rewards.themeOcean" },
  { id: "theme_forest", nameKey: "rewards.themeForest" },
  { id: "theme_sunset", nameKey: "rewards.themeSunset" },
  { id: "theme_rose", nameKey: "rewards.themeRose" },
  { id: "theme_midnight", nameKey: "rewards.themeMidnight" },
];

export const OUTFIT_ITEMS: { id: OutfitId; nameKey: string }[] = [
  { id: "outfit_glasses", nameKey: "rewards.outfitGlasses" },
  { id: "outfit_beanie", nameKey: "rewards.outfitBeanie" },
  { id: "outfit_headphones", nameKey: "rewards.outfitHeadphones" },
  { id: "outfit_grad_cap", nameKey: "rewards.outfitGradCap" },
  { id: "outfit_crown", nameKey: "rewards.outfitCrown" },
];

export const themeSwatch = (id: AccentThemeId) => ACCENT_THEMES[id];
