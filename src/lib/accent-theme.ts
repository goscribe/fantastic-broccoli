import { PUBLIC_PATHS } from "./public-paths";

/**
 * Accent themes bought in the points shop. The equipped one is mirrored onto
 * <html data-accent="…">, which globals.css uses to override the brand accent
 * tokens (--accent, --accent-dim, --accent-soft, …). No attribute = default violet.
 */
export const ACCENT_THEMES = {
  theme_ocean: { accent: "ocean", swatch: "#0369a1", soft: "#e0f2fe" },
  theme_forest: { accent: "forest", swatch: "#15803d", soft: "#dcfce7" },
  theme_sunset: { accent: "sunset", swatch: "#c2410c", soft: "#ffedd5" },
  theme_rose: { accent: "rose", swatch: "#be123c", soft: "#ffe4e6" },
  theme_midnight: { accent: "midnight", swatch: "#312e81", soft: "#e0e7ff" },
} as const;

export type AccentThemeId = keyof typeof ACCENT_THEMES;

/** The look with nothing equipped, shown in the shop so students can switch back. */
export const DEFAULT_ACCENT_SWATCH = { swatch: "#7c3aed", soft: "#ede9fe" };

export const ACCENT_STORAGE_KEY = "scribe.accent";

export function accentForTheme(themeId: string | null | undefined): string | null {
  return themeId && themeId in ACCENT_THEMES
    ? ACCENT_THEMES[themeId as AccentThemeId].accent
    : null;
}

/** Runs in <head> before paint: re-applies the last equipped accent on signed-in pages so it doesn't flash violet. */
export const accentInitScript = `(function(){try{var p=location.pathname,pub=${JSON.stringify(PUBLIC_PATHS)};for(var i=0;i<pub.length;i++){if(p===pub[i]||p.indexOf(pub[i]+"/")===0)return;}var a=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(a&&/^[a-z]+$/.test(a))document.documentElement.setAttribute("data-accent",a);}catch(e){}})();`;
