"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineMarkdown, MathText } from "@/components/ui/markdown-text";
import { McqQuestionBody } from "@/components/session/mcq-rich";
import {
  mistakesApi,
  practiceHref,
  type Mistake,
  type MistakeFilter,
  type MistakeState,
} from "@/lib/api/mistakes";
import { fixMinutes } from "@/lib/mistakes";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/mistakes";
import { cn } from "@/lib/utils";

/** Order and colours of the three states, worst first (bar + legend + badges). */
export const STATE_ORDER: MistakeState[] = ["STILL_INCORRECT", "NEVER_CORRECTED", "CORRECTED"];
export const STATE_KEY: Record<MistakeState, string> = {
  NEVER_CORRECTED: "mistakes.stateNever",
  CORRECTED: "mistakes.stateCorrected",
  STILL_INCORRECT: "mistakes.stateStill",
};
const STATE_FILL: Record<MistakeState, string> = {
  STILL_INCORRECT: "bg-rose",
  NEVER_CORRECTED: "bg-amber",
  CORRECTED: "bg-accent",
};
const STATE_BADGE: Record<MistakeState, string> = {
  STILL_INCORRECT: "bg-rose/12 text-[#be123c]",
  NEVER_CORRECTED: "bg-amber/15 text-[#a16207]",
  CORRECTED: "bg-accent-soft text-accent-dim",
};
const KIND_KEY: Record<string, string> = {
  mcq: "mistakes.kindMcq",
  card: "mistakes.kindCard",
  cloze: "mistakes.kindCloze",
  part: "mistakes.kindPart",
};

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

/** "The water ____ moves by ____" with the learner's wrong blanks struck through next to the right word. */
function ClozePassage({ m }: { m: Mistake }) {
  const text = m.detail.textWithBlanks ?? m.prompt;
  const parts = text.split(/_{2,}|\{\{blank\}\}/g);
  const answers = m.detail.answers ?? [];
  const yours = m.detail.yours ?? [];
  const wrong = new Set(m.detail.wrong ?? []);
  return (
    <p className="text-[15px] leading-8">
      {parts.map((part, i) => (
        <span key={i}>
          <InlineMarkdown text={part} />
          {i < parts.length - 1 &&
            (wrong.has(i) ? (
              <span className="mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-muted px-1.5">
                {yours[i]?.trim() && <span className="text-[#be123c] line-through decoration-2">{yours[i]}</span>}
                <span className="font-semibold text-success">{answers[i] ?? "…"}</span>
              </span>
            ) : (
              <span className="mx-0.5 rounded-md bg-muted px-1.5 font-semibold">{answers[i] ?? "…"}</span>
            ))}
        </span>
      ))}
    </p>
  );
}

function AnswerRow({ ok, label, children }: { ok: boolean; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          ok ? "bg-success/15 text-success" : "bg-rose/15 text-[#be123c]",
        )}
        aria-hidden
      >
        {ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
      </span>
      <div className="min-w-0 text-[14px] leading-6">
        <span className="mr-1.5 text-[12.5px] font-semibold text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  );
}

function MistakeCard({ m, showSubject }: { m: Mistake; showSubject: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const explanation = m.explanation?.trim();
  const yours =
    m.yourAnswer === "(drawing)" ? t("mistakes.drawing") : m.yourAnswer?.trim() ? m.yourAnswer : null;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12.5px] font-medium text-muted-foreground">
          {t(KIND_KEY[m.kind] ?? "mistakes.kindMcq")} · {m.label}
          {showSubject && m.workspaceTitle !== m.label ? ` · ${m.workspaceTitle}` : ""}
        </p>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", STATE_BADGE[m.state])}>
          {t(STATE_KEY[m.state])}
        </span>
      </div>

      <div className="mt-2.5 text-[15px] font-semibold leading-6">
        {m.kind === "cloze" ? (
          <ClozePassage m={m} />
        ) : m.kind === "mcq" && m.detail.figures?.length ? (
          <McqQuestionBody text={m.prompt} figures={m.detail.figures} options={[]} />
        ) : (
          <MathText text={m.prompt} />
        )}
      </div>

      {m.kind !== "cloze" && (
        <div className="mt-3 space-y-2">
          <AnswerRow ok={false} label={t("mistakes.yourAnswer")}>
            {yours ? <MathText text={yours} /> : <span className="text-muted-foreground">{t("mistakes.didntKnow")}</span>}
            {typeof m.detail.total === "number" && m.detail.total > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
                {fill(t("mistakes.marks"), { a: m.detail.achieved ?? 0, b: m.detail.total })}
              </span>
            )}
          </AnswerRow>
          {m.rightAnswer && (
            <AnswerRow ok label={t("mistakes.rightAnswer")}>
              <MathText text={m.rightAnswer} />
            </AnswerRow>
          )}
        </div>
      )}

      {explanation && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-dim hover:underline"
          >
            {t("mistakes.why")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-1.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-[13.5px] leading-6 text-muted-foreground">
              <MathText text={explanation} />
            </div>
          )}
        </div>
      )}

      {(m.wrongCount > 1 || m.correctedAt) && (
        <p className="mt-3 text-[12px] text-faint">
          {m.wrongCount > 1 && fill(t("mistakes.wrongTimes"), { n: m.wrongCount })}
          {m.wrongCount > 1 && m.correctedAt && m.state === "CORRECTED" && " · "}
          {m.correctedAt && m.state === "CORRECTED" && fill(t("mistakes.correctedOn"), { date: dateFmt.format(new Date(m.correctedAt)) })}
        </p>
      )}
    </li>
  );
}

/** Summary card: one stacked bar of the three states, the legend, and the practice button. */
export function MistakeSummaryBar({ counts }: { counts: Record<MistakeState, number> }) {
  const { t } = useI18n();
  const shown = STATE_ORDER.filter((s) => counts[s] > 0);
  return (
    <>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-muted" aria-hidden>
        {shown.map((s) => (
          <span
            key={s}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", STATE_FILL[s])}
            style={{ flexGrow: counts[s], flexBasis: 0 }}
          />
        ))}
      </div>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        {STATE_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", STATE_FILL[s])} aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">{counts[s]}</span>
            {t(STATE_KEY[s])}
          </span>
        ))}
      </p>
    </>
  );
}

/**
 * The mistakes log: counts by state, the practice button, and every saved
 * mistake (question, your answer, the right one and why). Overall when
 * `workspaceId` is unset, with subject chips to narrow it.
 */
export function MistakesView({
  workspaceId,
  onWorkspaceChange,
}: {
  workspaceId?: string;
  onWorkspaceChange?: (id: string | undefined) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MistakeFilter>("open");
  // Subject chips always come from the overall summary.
  const { data: overall } = useQuery({ queryKey: ["mistakes-summary", null], queryFn: () => mistakesApi.summary() });
  const { data: scoped } = useQuery({
    queryKey: ["mistakes-summary", workspaceId ?? null],
    queryFn: () => mistakesApi.summary(workspaceId),
    enabled: !!workspaceId,
  });
  const summary = workspaceId ? scoped : overall;
  const list = useInfiniteQuery({
    queryKey: ["mistakes", workspaceId ?? null, filter],
    queryFn: ({ pageParam }) => mistakesApi.list({ workspaceId, filter, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const subjects = overall?.subjects ?? [];
  // Practice runs on one subject: this one, or overall the one with most to fix.
  const practiceSubject = workspaceId ? undefined : subjects.find((s) => s.open > 0);
  const practiceCount = workspaceId ? (summary?.open ?? 0) : (practiceSubject?.open ?? 0);

  const filters: Array<{ id: MistakeFilter; label: string; count?: number }> = [
    { id: "open", label: t("mistakes.filterOpen"), count: summary?.open },
    { id: "CORRECTED", label: t("mistakes.filterCorrected"), count: summary?.counts.CORRECTED },
    { id: "all", label: t("mistakes.filterAll"), count: summary?.total },
  ];
  const chip = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
      active ? "border-accent bg-accent-soft text-accent-dim" : "border-border bg-card text-muted-foreground hover:bg-muted",
    );

  if (summary && summary.total === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center">
        <Image src="/design/cat2-book.png" alt="" width={120} height={132} unoptimized className="cat-bob mx-auto h-24 w-auto select-none" />
        <p className="mt-3 text-[15px] font-semibold">{t("mistakes.emptyTitle")}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t("mistakes.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        {summary ? (
          <>
            <MistakeSummaryBar counts={summary.counts} />
            {summary.open > 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href={practiceHref({ workspaceId: workspaceId ?? practiceSubject?.workspaceId })} className="w-full sm:w-auto">
                  <Button size="lg" className="w-full text-[15px] sm:w-auto">
                    <Play className="mr-2 size-4 fill-current" />
                    {t("mistakes.practice")}
                  </Button>
                </Link>
                <span className="w-full text-center text-[13px] text-muted-foreground sm:w-auto sm:text-left">
                  {practiceSubject && !workspaceId && subjects.length > 1 ? `${practiceSubject.title} · ` : ""}
                  {fill(t(practiceCount === 1 ? "mistakes.practiceSubOne" : "mistakes.practiceSub"), {
                    n: practiceCount,
                    m: fixMinutes(practiceCount),
                  })}
                </span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3">
                <Check className="size-5 shrink-0 text-accent" strokeWidth={3} />
                <div>
                  <p className="text-[14px] font-semibold">{t("mistakes.allFixedTitle")}</p>
                  <p className="text-[12.5px] text-muted-foreground">{t("mistakes.allFixed")}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <Skeleton className="h-[92px] w-full rounded-2xl" />
        )}
      </section>

      {onWorkspaceChange && subjects.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t("mistakes.allSubjects")}>
          <button type="button" role="tab" aria-selected={!workspaceId} className={chip(!workspaceId)} onClick={() => onWorkspaceChange(undefined)}>
            {t("mistakes.allSubjects")}
          </button>
          {subjects.map((s) => (
            <button
              key={s.workspaceId}
              type="button"
              role="tab"
              aria-selected={workspaceId === s.workspaceId}
              className={chip(workspaceId === s.workspaceId)}
              onClick={() => onWorkspaceChange(s.workspaceId)}
            >
              {s.title}
              {s.open > 0 && <span className="tabular-nums opacity-70">{s.open}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 rounded-full bg-muted p-1 sm:w-fit" role="tablist">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex-1 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors sm:flex-none",
              filter === f.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {f.count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{f.count}</span>}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "open" ? t("mistakes.allFixed") : t("mistakes.noneCorrected")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <MistakeCard key={m.id} m={m} showSubject={!workspaceId} />
          ))}
        </ul>
      )}

      {list.hasNextPage && (
        <div className="text-center">
          <Button variant="ghost" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            <ChevronDown className="mr-1.5 size-4" />
            {t("mistakes.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
