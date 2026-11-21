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

/** Live counts from the server, as plain numbers on the page: no band, no tiles. */
export function StatsBand() {
  const [stats, setStats] = useState<PublicStats>(FALLBACK);

  useEffect(() => {
    rpc<PublicStats>("stats.public", "query", undefined)
      .then((s: PublicStats | null | undefined) => {
        if (s) setStats(s);
      })
      .catch(() => {});
  }, []);

  const items: [string, string][] = [
    [`${roundedDown(stats.artifacts, 100).toLocaleString("en-US")}+`, "quizzes, worksheets and decks built from students’ notes"],
    [`${roundedDown(stats.activities, 10).toLocaleString("en-US")}+`, "study activities completed"],
    [`${stats.countries}`, "countries studying with Scribe"],
    ["5 min", "from upload to your first question"],
  ];

  return (
    <section className="mx-auto mt-14 w-full max-w-[1160px] px-4 sm:mt-20 sm:px-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-8 border-y border-border py-9 sm:py-11 md:grid-cols-4">
        {items.map(([n, l]) => (
          <div key={l} className="flex flex-col-reverse justify-end sm:text-center">
            <dt className="mt-2 max-w-[210px] text-[14px] font-semibold leading-snug text-muted-foreground sm:mx-auto">{l}</dt>
            <dd className="m-0 text-[38px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[48px]">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
