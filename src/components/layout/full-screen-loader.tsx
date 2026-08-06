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
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length);
        setVisible(true);
      }, 350);
    }, 3400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/25 blur-2xl animate-loader-glow" />
        <div className="absolute inset-0 animate-loader-spin rounded-full">
          <div className="loader-ring h-full w-full rounded-full" />
        </div>
        <ScribeMark className="relative h-11 w-11" />
      </div>
      <span className="mt-5 text-xl font-bold tracking-tight">Scribe</span>
      <div className="relative mt-4 h-1 w-44 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-accent animate-loader-bar" />
      </div>
      <p
        className={`mt-5 flex h-10 items-center px-6 text-center text-sm text-muted-foreground transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {lines[index]}
      </p>
    </div>
  );
}
