"use client";

import { useEffect, useState } from "react";
import { ScribeMark } from "@/components/graphics/logo";

const lines = [
  "Small sessions beat cramming.",
  "Recall it before you reread it.",
  "Twenty focused minutes counts.",
  "Spaced practice sticks.",
  "Test yourself — it's the fastest way to learn.",
  "Consistency over intensity.",
];

export function FullScreenLoader() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * lines.length),
  );

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % lines.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="relative animate-float">
        <div className="absolute inset-0 rounded-full bg-accent/40 blur-2xl animate-loader-glow" />
        <ScribeMark className="relative h-12 w-12" />
      </div>
      <span className="text-lg font-bold tracking-tight">Scribe</span>
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-accent animate-loader-bar" />
      </div>
      <p
        key={index}
        className="animate-fade-up px-6 text-center text-sm text-muted-foreground"
      >
        {lines[index]}
      </p>
    </div>
  );
}
