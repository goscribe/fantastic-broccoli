"use client";

/**
 * Deep links into a page (search results, mistakes, end screens point at
 * `/workspace/<id>?file=<id>` and `?topic=<id>`): read the target from the
 * URL, then scroll it into view and outline it for a moment.
 */

/** The `name` search parameter of the current URL (client only). */
export function linkTarget(name: "file" | "topic" | "mistake"): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

const MARK = ["ring-2", "ring-accent", "ring-offset-2", "ring-offset-background"];

/** Scrolls the element matching `selector` to the middle of the screen and outlines it for `ms`. Returns whether it was found. */
export function revealTarget(selector: string, ms = 4500): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  el.classList.add(...MARK);
  el.setAttribute("data-link-target", "");
  window.setTimeout(() => {
    el.classList.remove(...MARK);
    el.removeAttribute("data-link-target");
  }, ms);
  return true;
}

/** `[data-<attr>="value"]` with the value escaped for a CSS selector. */
export function dataSelector(attr: string, value: string): string {
  const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  return `[data-${attr}="${esc}"]`;
}
