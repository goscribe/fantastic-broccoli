"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StartCheckSheet } from "@/components/session/start-check-host";
import { SaidGotRow } from "@/components/session/session-debrief";
import { confidenceResult } from "@/lib/start-check";

/**
 * Design preview of the start check's cat slider and the debrief's "You said /
 * You got" row, with fixture data and no network. `?v=6` opens the slider on
 * a score; `?view=debrief` shows the row for each pose.
 */
function Inner() {
  const q = useSearchParams();
  if (q.get("view") === "debrief") {
    const rows = [confidenceResult(1, 4, 10)!, confidenceResult(3, 7, 10)!, confidenceResult(6, 6, 10)!, confidenceResult(8, 9, 10)!, confidenceResult(10, 8, 10)!];
    return (
      <main className="mx-auto min-h-dvh max-w-[640px] bg-background px-5 py-8">
        <h1 className="text-[28px] font-extrabold tracking-tight">7 of 10 right</h1>
        <p className="mt-1 text-ui text-muted-foreground">Cell membranes · 12 min</p>
        {rows.map((r, i) => (
          <SaidGotRow key={i} result={r} className="mt-6 px-1" />
        ))}
      </main>
    );
  }
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4">
      <StartCheckSheet request={{ what: "Cell membranes", topicNames: ["Cell membranes"], papers: [], paperId: null }} onAnswer={() => {}} initial={Number(q.get("v") ?? 5)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
