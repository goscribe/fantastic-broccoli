"use client";

import { useEffect, useId, useMemo, useState } from "react";

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 900;

// Design tokens forwarded into the sandboxed iframe so LLM-authored
// visualizers can style themselves with the app's palette via var(--token).
const THEME_TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "muted-foreground",
  "accent",
  "accent-dim",
  "accent-soft",
  "accent-bright",
  "accent-foreground",
  "energy",
  "energy-soft",
  "violet",
  "sky",
  "rose",
  "amber",
  "border",
  "border-strong",
  "radius",
] as const;

// Tailwind Play CDN configured so LLM-authored markup can use utility
// classes with token-named colors (bg-accent, text-foreground, border-border,
// text-violet, ...) that resolve to the app's design tokens.
function tailwindScript(): string {
  const colorTokens = [
    "background",
    "foreground",
    "card",
    "muted",
    "muted-foreground",
    "accent",
    "accent-dim",
    "accent-soft",
    "accent-bright",
    "accent-foreground",
    "energy",
    "energy-soft",
    "violet",
    "sky",
    "rose",
    "amber",
    "border",
    "border-strong",
  ];
  const colors = Object.fromEntries(
    colorTokens.map((t) => [t, `var(--${t})`]),
  );
  return (
    `<script src="https://cdn.tailwindcss.com"></script>` +
    `<script>tailwind.config={theme:{extend:{colors:${JSON.stringify(colors)}}}}</script>`
  );
}

function themeStyle(): string {
  const root = getComputedStyle(document.documentElement);
  const vars = THEME_TOKENS.map(
    (t) => `--${t}:${root.getPropertyValue(`--${t}`).trim()};`,
  ).join("");
  return `<style>:root{${vars}}
body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;color:var(--foreground);background:var(--card);}
input[type=range]{accent-color:var(--accent);}
button{font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--muted);color:var(--foreground);padding:4px 10px;cursor:pointer;}
button:hover{border-color:var(--border-strong);}
button[aria-pressed=true],button.is-selected{background:var(--accent);border-color:var(--accent);color:var(--accent-foreground);}
select,input[type=text],input[type=number]{font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);padding:4px 8px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
.viz-stat{display:flex;flex-direction:column;gap:2px;}
.viz-stat-value{font-size:20px;font-weight:500;font-variant-numeric:tabular-nums;}
.viz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;}
.viz-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.viz-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:8px 0;}
.viz-controls label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted-foreground);}
.viz-badge{display:inline-flex;align-items:center;border-radius:999px;background:var(--accent-soft);color:var(--accent-dim);font-size:12px;font-weight:500;padding:2px 10px;}
.text-small{font-size:12px;}
.text-muted{color:var(--muted-foreground);}</style>`;
}

function resizeScript(id: string) {
  return `<script>(function(){
  function post(){parent.postMessage({type:"scribe-widget-height",id:${JSON.stringify(id)},height:document.documentElement.scrollHeight},"*");}
  if(typeof ResizeObserver!=="undefined"){new ResizeObserver(post).observe(document.documentElement);}
  window.addEventListener("load",post);
  setTimeout(post,50);
})();</script>`;
}

interface HtmlWidgetProps {
  html: string;
  title?: string;
}

/**
 * Renders LLM-authored self-contained HTML/JS visualizers in a sandboxed
 * iframe (scripts allowed, no same-origin access — the document can't reach
 * cookies, storage, or the parent app). Height auto-fits via postMessage.
 */
export function HtmlWidget({ html, title }: HtmlWidgetProps) {
  const frameId = useId();
  const [height, setHeight] = useState(320);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        type?: string;
        id?: string;
        height?: number;
      } | null;
      if (
        d &&
        d.type === "scribe-widget-height" &&
        d.id === frameId &&
        typeof d.height === "number" &&
        Number.isFinite(d.height)
      ) {
        setHeight(Math.min(Math.max(Math.ceil(d.height), MIN_HEIGHT), MAX_HEIGHT));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId]);

  const srcDoc = useMemo(
    () => tailwindScript() + themeStyle() + html + resizeScript(frameId),
    [html, frameId],
  );

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
      <iframe
        title={title ?? "Interactive visualizer"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full border-0 bg-card"
      />
      {title && (
        <figcaption className="px-3.5 py-2 text-[11px] text-muted-foreground border-t border-border">
          {title}
        </figcaption>
      )}
    </figure>
  );
}
