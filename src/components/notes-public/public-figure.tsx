"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { NoteFigure } from "@/lib/api/notes";

/**
 * A note figure on the public page, loaded lazily: each figure kind is its
 * own chunk (so a page without graphs never downloads the graph or maths
 * code), and live HTML / widget figures only mount when they come near the
 * viewport, inside a box that already has their height so nothing shifts.
 * The server passes whether the static SVG graph can render (`staticGraph`).
 */

const NoteGraph = dynamic(() => import("@/components/notes/note-graph").then((m) => m.NoteGraph), {
  loading: () => <Placeholder h={260} />,
});
const ExpressionGraph = dynamic(() => import("@/components/interactive/desmos").then((m) => m.ExpressionGraph), {
  ssr: false,
  loading: () => <Placeholder h={320} />,
});
const HtmlWidget = dynamic(() => import("@/components/interactive/html-widget").then((m) => m.HtmlWidget), {
  ssr: false,
  loading: () => <Placeholder h={320} />,
});
const InteractiveWidget = dynamic(
  () =>
    import("@/components/interactive").then((m) => {
      function Widget({ id }: { id: string }) {
        return id in m.widgetRegistry ? <m.InteractiveWidget id={id as keyof typeof m.widgetRegistry} /> : null;
      }
      return Widget;
    }),
  {
  ssr: false,
  loading: () => <Placeholder h={360} />,
});

function Placeholder({ h }: { h: number }) {
  return <div className="w-full rounded-xl bg-muted/50" style={{ minHeight: h }} aria-hidden="true" />;
}

function NearViewport({ h, children }: { h: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Without IntersectionObserver (very old browsers), mount straight away.
  const [show, setShow] = useState(() => typeof window !== "undefined" && typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || show || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setShow(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  return (
    <div ref={ref} style={{ minHeight: h }}>
      {show ? children : <Placeholder h={h} />}
    </div>
  );
}

export function PublicFigure({ figure, staticGraph }: { figure: NoteFigure; staticGraph: boolean }) {
  if (figure.kind === "widget" && figure.widgetId)
    return (
      <NearViewport h={360}>
        <InteractiveWidget id={figure.widgetId} />
      </NearViewport>
    );
  if (figure.kind === "graph" && figure.graph && staticGraph) return <NoteGraph graph={figure.graph} title={figure.title} />;
  if (figure.kind === "graph" && figure.graph)
    return (
      <NearViewport h={320}>
        <ExpressionGraph
          title={figure.title}
          xLabel={figure.graph.xLabel}
          yLabel={figure.graph.yLabel}
          expressions={figure.graph.expressions}
          bounds={figure.graph.bounds}
        />
      </NearViewport>
    );
  if (figure.kind === "html" && figure.html)
    return (
      <div role="img" aria-label={figure.alt}>
        <NearViewport h={320}>
          <HtmlWidget html={figure.html} title={figure.title} surface="reading_figure" />
        </NearViewport>
      </div>
    );
  return null;
}
