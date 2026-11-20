import Link from "next/link";
import { Lock } from "lucide-react";
import type { PublicTopicRow } from "@/lib/api/public-notes";
import { topicPath } from "@/lib/notes-public/slug";

/** Topics of a unit as links, with what each has (note, number of questions). */
export function TopicList({ courseId, topics, compact = false }: { courseId: string; topics: PublicTopicRow[]; compact?: boolean }) {
  return (
    <ul className={compact ? "flex flex-col gap-1.5" : "mt-3 flex flex-col divide-y divide-border rounded-2xl border border-border bg-card"}>
      {topics.map((t) => (
        <li key={t.id}>
          <Link
            href={topicPath(courseId, t)}
            className={
              compact
                ? "flex items-baseline gap-2 rounded-lg py-1 text-[15px] hover:text-accent"
                : "flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent-soft/40"
            }
          >
            <span className="w-12 shrink-0 text-[13.5px] font-bold tabular-nums text-faint">{t.code}</span>
            <span className="min-w-0 flex-1 font-semibold leading-snug">{t.name}</span>
            {t.locked && (
              <span className="shrink-0 text-faint" title="Included with a plan or exam pass">
                <Lock className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Included with a plan or exam pass</span>
              </span>
            )}
            {!compact && (
              <span className="shrink-0 text-right text-[12.5px] font-semibold text-muted-foreground">
                {[t.note ? "Notes" : null, t.questionCount ? `${t.questionCount} Qs` : null, t.hlOnly ? "HL" : null, t.bcOnly ? "BC" : null, t.higherTierOnly ? "Higher" : null]
                  .filter(Boolean)
                  .join(" · ") || "Coming soon"}
              </span>
            )}
            {compact && t.questionCount > 0 && <span className="shrink-0 text-[12.5px] text-muted-foreground">{t.questionCount} Qs</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
