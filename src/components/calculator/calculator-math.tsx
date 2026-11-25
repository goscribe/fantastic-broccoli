"use client";

import { memo } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();

function toHtml(tex: string): string {
  let html = cache.get(tex);
  if (html === undefined) {
    try {
      // HTML only: these are visual copies of text the screen reader already has (the line, the result).
      html = katex.renderToString(tex, { throwOnError: true, output: "html", strict: "ignore" });
    } catch {
      html = "";
    }
    if (cache.size > 400) cache.clear();
    cache.set(tex, html);
  }
  return html;
}

/**
 * A piece of the calculator drawn as maths (the line, a result, a key face).
 * Decorative: the same thing is always readable as text next to it, so it is
 * hidden from assistive tech. `fallback` shows when the TeX does not render.
 */
export const CalcMath = memo(function CalcMath({ tex, fallback, className }: { tex: string | null; fallback?: string; className?: string }) {
  const html = tex ? toHtml(tex) : "";
  if (!html) return fallback ? <span className={cn("calc-math", className)} aria-hidden>{fallback}</span> : null;
  return <span aria-hidden className={cn("calc-math", className)} dangerouslySetInnerHTML={{ __html: html }} />;
});
