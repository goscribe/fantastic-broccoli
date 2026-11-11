"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/api/study-session";

interface PublicStats {
  artifacts: number;
  activities: number;
  countries: number;
}

/** Last known values; shown until stats.public answers (and if it never does). */
const FALLBACK: PublicStats = { artifacts: 1717, activities: 796, countries: 27 };

const roundedDown = (n: number, step: number) => Math.floor(n / step) * step;

export function StatsBand({ background }: { background: string }) {
  const [stats, setStats] = useState<PublicStats>(FALLBACK);

  useEffect(() => {
    rpc<PublicStats>("stats.public", "query", undefined)
      .then((s: PublicStats | null | undefined) => {
        if (s) setStats(s);
      })
      .catch(() => {});
  }, []);

  const items: [string, string][] = [
    [`${roundedDown(stats.artifacts, 100).toLocaleString()}+`, "quizzes, worksheets and decks built from students’ notes"],
    [`${roundedDown(stats.activities, 10).toLocaleString()}+`, "study activities completed"],
    [`${stats.countries}`, "countries studying with Scribe"],
    ["5 min", "from upload to your first question"],
  ];

  return (
    <section className="w-full text-white" style={{ background }}>
      <div className="mx-auto grid w-full max-w-[1120px] gap-y-10 px-6 py-16 md:grid-cols-4">
        {items.map(([n, l]) => (
          <div key={l} className="text-center">
            <div className="text-[56px] font-extrabold leading-none tracking-tight">{n}</div>
            <div className="mx-auto mt-3 max-w-[200px] text-[14px] font-semibold leading-snug text-white/65">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
