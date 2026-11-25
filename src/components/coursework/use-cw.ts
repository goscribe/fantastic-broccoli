"use client";

import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/coursework";

/** `t("cw.key", { n: 2 })`: the coursework strings with their `{placeholders}` filled. */
export function useCw() {
  const { t, locale } = useI18n();
  const tr = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = t(key);
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [t],
  );
  return { t: tr, locale };
}
