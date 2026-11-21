import Link from "next/link";
import { Check, ChevronRight, Lock } from "lucide-react";
import type { PublicTopicRow } from "@/lib/api/public-notes";
import { topicKey } from "@/lib/notes-public/progress";
import { topicPath } from "@/lib/notes-public/slug";
import { cn } from "@/lib/utils";

/**
 * Topics of a unit as a path: a node per topic on one line, with what each
 * has (note, number of questions). Nodes fill in from the visitor's own
 * progress (see notes-progress.tsx); `current` marks the page being read.
 */
export function TopicList({ courseId, topics, compact = false, current }: { courseId: string; topics: PublicTopicRow[]; compact?: boolean; current?: string }) {
  return (
    <ol className={cn("nl-path nl-card overflow-hidden", compact ? "" : "mt-3")}>
      {topics.map((t) => {
        const has = [t.note ? "Notes" : null, t.questionCount ? `${t.questionCount} questions` : null].filter(Boolean).join(" · ");
        const tier = t.hlOnly ? "HL only" : t.bcOnly ? "BC only" : t.higherTierOnly ? "Higher tier" : null;
        const here = t.id === current;
        return (
          <li key={t.id}>
            <Link
              href={topicPath(courseId, t)}
              data-nl-topic={topicKey(courseId, t.id)}
              data-q={t.questionCount}
              aria-current={here ? "page" : undefined}
              className={cn("group flex items-center gap-3 px-4 transition-colors hover:bg-muted/60", compact ? "min-h-[52px] py-2" : "min-h-[62px] py-2.5", here && "bg-muted")}
            >
              <span className="nl-node" data-empty={!t.note && !t.questionCount ? "" : undefined}>
                <Check strokeWidth={4} />
              </span>
              <span className="min-w-[46px] shrink-0 whitespace-nowrap text-[13.5px] font-black tabular-nums text-muted-foreground">{t.code}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-extrabold leading-snug text-foreground", compact ? "text-[15px]" : "text-[16px]")}>{t.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-semibold text-muted-foreground">
                  {has || "Coming soon"}
                  {tier && <span className="font-extrabold text-foreground">· {tier}</span>}
                </span>
              </span>
              {t.locked && (
                <span className="shrink-0 text-faint" title="Included with a plan or exam pass">
                  <Lock className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  <span className="sr-only">Included with a plan or exam pass</span>
                </span>
              )}
              <ChevronRight className="size-4.5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
