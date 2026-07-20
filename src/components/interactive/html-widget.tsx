"use client";

import { useEffect, useId, useMemo, useState } from "react";

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 900;

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

  const srcDoc = useMemo(() => html + resizeScript(frameId), [html, frameId]);

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
      <iframe
        title={title ?? "Interactive visualizer"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full border-0 bg-white"
      />
      {title && (
        <figcaption className="px-3.5 py-2 text-[11px] text-muted-foreground border-t border-border">
          {title}
        </figcaption>
      )}
    </figure>
  );
}
