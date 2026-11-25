"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPlannerWeek, type PlannerSlot } from "@/lib/api/planner";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The rail's next few planned slots this week (shown when there is no exam plan). */
export function UpNextCard() {
  const [upNext, setUpNext] = useState<(PlannerSlot & { date: string })[] | null>(null);
  useEffect(() => {
    fetchPlannerWeek()
      .then((w) => {
        const today = new Date().toISOString().slice(0, 10);
        setUpNext(w.days.filter((d) => d.date >= today).flatMap((d) => d.slots.map((s) => ({ ...s, date: d.date }))).slice(0, 3));
      })
      .catch(() => setUpNext([]));
  }, []);
  return (
    <div className="life-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[16px] font-extrabold">Up next</span>
        <Link href="/planner" className="text-caption font-semibold text-accent hover:underline">Open planner</Link>
      </div>
      {upNext === null ? (
        <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : upNext.length === 0 ? (
        <p className="mt-3 text-small text-faint">Nothing planned yet — set a goal and study window in the planner and your week fills itself in.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {upNext.map((s) => {
            const d = new Date(`${s.date}T00:00:00Z`);
            const isToday = s.date === new Date().toISOString().slice(0, 10);
            const label = isToday ? "Today" : DAY[(d.getUTCDay() + 6) % 7];
            const href = s.kind === "review" ? "/flashcards/review" : s.workspaceId && s.sessionId ? `/workspace/${s.workspaceId}/session/${s.sessionId}` : "/planner";
            return (
              <li key={`${s.date}-${s.id}`}>
                <Link href={href} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted">
                  <span className="w-[72px] shrink-0 text-caption font-semibold text-faint">{label} · {hhmm(s.start)}</span>
                  <span className="min-w-0 flex-1 truncate text-small font-semibold">{s.title}</span>
                  <span className="shrink-0 text-caption text-faint">{s.end - s.start} min</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
