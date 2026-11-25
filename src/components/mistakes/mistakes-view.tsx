"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Play, X } from "lucide-react";
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
import { fixMinutes, mistakeSessionHref, mistakeTopicHref, mixedRoundSubjects } from "@/lib/mistakes";
import { coursesApi } from "@/lib/api/courses";
import { createStudySessionQuietly } from "@/lib/api/study";
import { toastError } from "@/lib/toast";
import "@/lib/i18n/purpose";
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
  STILL_INCORRECT: "bg-rose-500",
  NEVER_CORRECTED: "bg-border-strong",
  CORRECTED: "bg-emerald-500",
};
const STATE_BADGE: Record<MistakeState, string> = {
  STILL_INCORRECT: "text-rose-700",
  NEVER_CORRECTED: "text-muted-foreground",
  CORRECTED: "text-emerald-700",
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
    <p className="text-ui leading-8">
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
          ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white",
        )}
        aria-hidden
      >
        {ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
      </span>
      <div className="min-w-0 text-ui">
        <span className="mr-1.5 text-caption font-semibold text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  );
}

/** "Practise this topic": a Quick 5 on the mistake's catalog topic, or on its label in its subject. */
function PractiseTopic({ m }: { m: Mistake }) {
  const { t } = useI18n();
  const router = useRouter();
  const start = useMutation({
    mutationFn: async () => {
      if (m.courseTopic) {
        const r = await coursesApi.startTopic({ courseId: m.courseTopic.courseId, topicId: m.courseTopic.topicId });
        return `/workspace/${r.workspaceId}/session/${r.sessionId}`;
      }
      const s = await createStudySessionQuietly({ workspaceId: m.workspaceId, title: m.label, topics: m.label, depth: "light", durationMinutes: 5, quickStart: true });
      return s ? `/workspace/${m.workspaceId}/session/${s.id}` : `/workspace/${m.workspaceId}`;
    },
    onSuccess: (href) => router.push(href),
    onError: (e) => toastError(e, t("debrief.nextTopicFailed")),
  });
  return (
    <button
      type="button"
      onClick={() => start.mutate()}
      disabled={start.isPending || start.isSuccess}
      className="-my-2 inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground disabled:opacity-60"
    >
      {start.isPending && <Loader2 className="size-3.5 animate-spin" />}
      {t("purpose.practiseTopic")}
    </button>
  );
}

function MistakeCard({ m, showSubject, highlight = false }: { m: Mistake; showSubject: boolean; highlight?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(highlight);
  const topicHref = mistakeTopicHref(m);
  const sessionHref = mistakeSessionHref(m);
  const explanation = m.explanation?.trim();
  const yours =
    m.yourAnswer === "(drawing)" ? t("mistakes.drawing") : m.yourAnswer?.trim() ? m.yourAnswer : null;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (
    <li id={`mistake-${m.id}`} className={cn("life-card scroll-mt-24 p-4 sm:p-5", highlight && "ring-2 ring-accent/40")} data-highlight={highlight || undefined}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-caption font-medium text-muted-foreground">
          {t(KIND_KEY[m.kind] ?? "mistakes.kindMcq")} ·{" "}
          {topicHref ? (
            // Its topic: Scribe's note when there is one, else the topic in its subject.
            <Link href={topicHref} className="font-semibold text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground">
              {m.courseTopic ? m.courseTopic.title : m.label}
            </Link>
          ) : (
            m.label
          )}
          {showSubject && m.workspaceTitle !== m.label ? ` · ${m.workspaceTitle}` : ""}
        </p>
        <span className={cn("shrink-0 text-caption font-bold", STATE_BADGE[m.state])}>
          {t(STATE_KEY[m.state])}
        </span>
      </div>

      <div className="mt-2 text-ui font-extrabold [overflow-wrap:anywhere]">
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
            className="-my-2 inline-flex min-h-10 items-center gap-1 text-[13.5px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
          >
            {t("mistakes.why")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="life-rise mt-2 border-l-[3px] border-[var(--edge)] pl-4 text-ui text-foreground/80">
              <MathText text={explanation} />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        {sessionHref && m.session && (
          <Link href={sessionHref} className="inline-flex min-h-10 min-w-0 items-center text-small text-muted-foreground hover:text-foreground">
            <span className="truncate underline decoration-border-strong underline-offset-4">
              {fill(t("purpose.fromSession"), { session: m.session.title, date: dateFmt.format(new Date(m.session.date)) })}
            </span>
          </Link>
        )}
        {m.state !== "CORRECTED" && <PractiseTopic m={m} />}
      </div>

      {(m.wrongCount > 1 || m.correctedAt) && (
        <p className="mt-3 text-caption text-faint">
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
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
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
  focusMistakeId,
  sessionId,
  onClearSession,
}: {
  workspaceId?: string;
  onWorkspaceChange?: (id: string | undefined) => void;
  /** `?mistake=<id>` (search, links): open the list on it, scrolled to and highlighted. */
  focusMistakeId?: string;
  /** `?session=<id>` (an end screen's "N to fix"): only that session's mistakes. */
  sessionId?: string;
  onClearSession?: () => void;
}) {
  const { t } = useI18n();
  // A linked mistake may already be corrected: look in all of them.
  const [filter, setFilter] = useState<MistakeFilter>(focusMistakeId ? "all" : "open");
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
    queryFn: ({ pageParam }) => mistakesApi.list({ workspaceId, filter, cursor: pageParam, limit: focusMistakeId || sessionId ? 50 : 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const all = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const items = useMemo(() => (sessionId ? all.filter((m) => (m.session?.id ?? m.sessionId) === sessionId) : all), [all, sessionId]);
  const fromSession = sessionId ? all.find((m) => (m.session?.id ?? m.sessionId) === sessionId)?.session : undefined;
  const subjects = overall?.subjects ?? [];
  // Practice runs on this subject, or overall on every subject with something to fix (one mixed round).
  const mixed = workspaceId ? "" : mixedRoundSubjects(subjects);
  const practiceCount = summary?.open ?? 0;

  // Scroll a linked mistake into view once it is on the page.
  const focused = !!focusMistakeId && items.some((m) => m.id === focusMistakeId);
  useEffect(() => {
    if (!focused) return;
    document.getElementById(`mistake-${focusMistakeId}`)?.scrollIntoView({ block: "center" });
  }, [focused, focusMistakeId]);

  const filters: Array<{ id: MistakeFilter; label: string; count?: number }> = [
    { id: "open", label: t("mistakes.filterOpen"), count: summary?.open },
    { id: "CORRECTED", label: t("mistakes.filterCorrected"), count: summary?.counts.CORRECTED },
    { id: "all", label: t("mistakes.filterAll"), count: summary?.total },
  ];
  const chip = (active: boolean) =>
    cn(
      "inline-flex max-w-[240px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-transparent bg-muted text-foreground hover:bg-[var(--edge)]",
    );

  if (summary && summary.total === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized className="cat-bob mx-auto h-24 w-auto select-none" />
        <p className="mt-3 text-ui font-semibold">{t("mistakes.emptyTitle")}</p>
        <p className="mx-auto mt-1 max-w-sm text-ui text-muted-foreground">{t("mistakes.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        {summary ? (
          <>
            <MistakeSummaryBar counts={summary.counts} />
            {summary.open > 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href={practiceHref({ workspaceId })} className="w-full sm:w-auto">
                  <Button size="lg" className="btn-chunky h-[52px] w-full rounded-[var(--r-button)] px-7 text-[16px] font-extrabold sm:w-auto">
                    <Play className="mr-2 size-4 fill-current" />
                    {t("mistakes.practice")}
                  </Button>
                </Link>
                <span className="w-full text-center text-small text-muted-foreground sm:w-auto sm:text-left">
                  {mixed ? `${mixed} · ` : ""}
                  {fill(t(practiceCount === 1 ? "mistakes.practiceSubOne" : "mistakes.practiceSub"), {
                    n: practiceCount,
                    m: fixMinutes(practiceCount),
                  })}
                </span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-4" strokeWidth={3.5} /></span>
                <div>
                  <p className="text-ui font-semibold">{t("mistakes.allFixedTitle")}</p>
                  <p className="text-caption text-muted-foreground">{t("mistakes.allFixed")}</p>
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
              <span className="min-w-0 truncate" title={s.title}>{s.title}</span>
              {s.open > 0 && <span className="shrink-0 tabular-nums opacity-70">{s.open}</span>}
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

      {sessionId && (
        <p className="flex flex-wrap items-center gap-x-3 text-ui">
          <span className="font-semibold">{fill(t("purpose.onlySession"), { session: fromSession?.title ?? "…" })}</span>
          {onClearSession && (
            <button type="button" onClick={onClearSession} className="inline-flex min-h-10 items-center font-bold text-muted-foreground underline decoration-border-strong underline-offset-4 hover:text-foreground">
              {t("purpose.showAll")}
            </button>
          )}
        </p>
      )}

      {list.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        // Nothing left to fix is already said once, in the summary above; only the other tabs need their own line.
        filter === "open" ? null : (
          <p className="py-8 text-ui font-semibold text-muted-foreground">{t("mistakes.noneCorrected")}</p>
        )
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <MistakeCard key={m.id} m={m} showSubject={!workspaceId} highlight={m.id === focusMistakeId} />
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
