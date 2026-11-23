"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Check } from "lucide-react";
import { COURSEWORK_CHAT_LIMIT_PREFIX, courseworkApi, type ChatTurn, type GradeResult, type RubricDetail, type RubricSummary } from "@/lib/api/coursework";
import { criterionFor, criterionMark, criterionNext, hasMarks, rubricLine } from "@/lib/coursework";
import { cn } from "@/lib/utils";
import { BandNumber, BandTrack } from "./band-track";
import { useCw } from "./use-cw";

/* ---------- Next steps: the fixes as a checklist ---------- */

const tickListeners = new Set<() => void>();
const tickKey = (reviewId: string) => `scribe.coursework.steps.${reviewId}`;

function readTicks(reviewId: string): string {
  try {
    return localStorage.getItem(tickKey(reviewId)) ?? "";
  } catch {
    return "";
  }
}

/** Which steps of a review the student has ticked (this device). */
function useTicks(reviewId: string): [Set<number>, (i: number) => void] {
  const raw = useSyncExternalStore(
    (cb) => {
      tickListeners.add(cb);
      return () => {
        tickListeners.delete(cb);
      };
    },
    () => readTicks(reviewId),
    () => "",
  );
  const ticks = new Set(raw.split(",").filter(Boolean).map(Number));
  const toggle = (i: number) => {
    const next = new Set(ticks);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    try {
      localStorage.setItem(tickKey(reviewId), [...next].join(","));
    } catch {
      /* storage blocked */
    }
    tickListeners.forEach((l) => l());
  };
  return [ticks, toggle];
}

/**
 * The three fixes as things to do and tick off, then what would move each
 * criterion up a band, in one list. The same advice as the feedback, laid
 * out for working through with the document open.
 */
export function NextSteps({ reviewId, result, hideMarks, onOpenCriterion }: { reviewId: string; result: GradeResult; hideMarks: boolean; onOpenCriterion: (letter: string) => void }) {
  const { t } = useCw();
  const [ticks, toggle] = useTicks(reviewId);
  const marked = hasMarks(result) && !hideMarks;
  const fixes = result.topFixes.slice(0, 3);
  const done = fixes.filter((_, i) => ticks.has(i)).length;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="cw-next-h">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cw-next-h" className="page-h2">
            {t("cw.next.title")}
          </h2>
          <span className="text-small font-bold tabular-nums text-muted-foreground" role="status">
            {t("cw.next.done", { a: done, b: fixes.length })}
          </span>
        </div>
        <p className="mt-1 text-small text-muted-foreground">{t("cw.next.sub")}</p>
        <ul className="mt-4 flex flex-col gap-1">
          {fixes.map((fix, i) => {
            const on = ticks.has(i);
            const c = criterionFor(result, fix.criterion);
            return (
              <li key={i}>
                <label className="flex cursor-pointer gap-3.5 rounded-[var(--r-control)] py-2.5">
                  <input type="checkbox" checked={on} onChange={() => toggle(i)} className="peer sr-only" />
                  <span className={cn("cw-check mt-[1px] shrink-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2", on && "cw-check--on")} aria-hidden>
                    {on && <Check className="size-4" strokeWidth={3.4} />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-read font-extrabold leading-snug text-foreground", on && "text-muted-foreground line-through decoration-border-strong")}>{fix.title}</span>
                    <span className="mt-1 block text-ui text-foreground/80">{fix.detail}</span>
                    {c && <span className="mt-1 block text-small font-bold text-muted-foreground">{t("cw.fixes.criterion", { a: c.letter, name: c.name })}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="cw-next-crit">
        <h2 id="cw-next-crit" className="page-h2">
          {t(marked ? "cw.next.perCriterion" : "cw.next.perCriterionFeedback")}
        </h2>
        <ul className="mt-2 divide-y divide-border">
          {result.criteria.map((c) => (
            <li key={c.letter} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <button type="button" onClick={() => onOpenCriterion(c.letter)} className="-my-2 min-h-11 min-w-0 text-left text-ui font-extrabold text-foreground hover:underline">
                  <span className="text-muted-foreground">{c.letter}</span> {c.name}
                </button>
                {marked && "bandLow" in c && <BandNumber low={c.bandLow} high={c.bandHigh} mark={criterionMark(c)} max={c.maxMarks} className="text-small" />}
              </div>
              <p className="mt-1 text-ui text-foreground/80">{criterionNext(c)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Rubric: the criteria and their bands ---------- */

const detailCache = new Map<string, Promise<RubricDetail | null>>();
function loadDetail(rubricId: string): Promise<RubricDetail | null> {
  let hit = detailCache.get(rubricId);
  if (!hit) {
    // A server without `coursework.rubric` simply has no descriptors to show.
    hit = courseworkApi.rubricDetail(rubricId).catch(() => null);
    detailCache.set(rubricId, hit);
  }
  return hit;
}

/**
 * The rubric the work is read against: each criterion, its marks and its band
 * descriptors from the database, with the student's own band marked when the
 * review has one. Without descriptors (an older server) it lists the criteria.
 */
export function RubricView({ rubric, result, hideMarks }: { rubric: RubricSummary; result: GradeResult | null; hideMarks: boolean }) {
  const { t } = useCw();
  const [detail, setDetail] = useState<{ id: string; value: RubricDetail | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadDetail(rubric.id).then((value) => !cancelled && setDetail({ id: rubric.id, value }));
    return () => {
      cancelled = true;
    };
  }, [rubric.id]);
  const marked = hasMarks(result) && !hideMarks ? result : null;
  const bands = detail?.id === rubric.id ? detail.value : null;
  return (
    <div>
      <h2 className="page-h2">{t("cw.rubric.title")}</h2>
      <p className="mt-1 text-small text-muted-foreground">
        {t("cw.rubric.sub", { line: rubricLine(rubric), n: rubric.totalMarks })}. {t(rubric.status === "draft" ? "cw.rubric.draftNote" : "cw.rubric.reviewedNote")}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rubric.criteria.map((c) => {
          const mine = marked?.criteria.find((x) => x.letter === c.letter);
          const d = bands?.criteria.find((x) => x.letter === c.letter);
          return (
            <article key={c.letter} className="life-card px-4 py-4 sm:px-5" aria-labelledby={`cw-rub-${c.letter}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={`cw-rub-${c.letter}`} className="min-w-0 text-ui font-extrabold text-foreground">
                  <span className="text-muted-foreground">{c.letter}</span> {c.name}
                </h3>
                {mine ? <BandNumber low={mine.bandLow} high={mine.bandHigh} mark={criterionMark(mine)} max={c.maxMarks} className="text-ui" /> : <span className="whitespace-nowrap text-small font-bold text-muted-foreground">{t("cw.rubric.max", { n: c.maxMarks })}</span>}
              </div>
              {mine && <BandTrack low={mine.bandLow} high={mine.bandHigh} mark={criterionMark(mine)} max={c.maxMarks} scale className="mt-2" />}
              {d && d.bands.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {[...d.bands].reverse().map((b) => {
                    const yours = !!mine && mine.bandHigh >= b.minMarks && mine.bandLow <= b.maxMarks;
                    return (
                      <li key={b.minMarks} className={cn("cw-band-row", yours && "cw-band-row--yours")}>
                        <p className="text-small font-extrabold text-foreground">
                          {b.minMarks === b.maxMarks ? t("cw.rubric.marksOne", { a: b.minMarks }) : t("cw.rubric.marks", { a: b.minMarks, b: b.maxMarks })}
                          {yours && <span className="ml-2 font-bold text-muted-foreground">{t("cw.rubric.yours")}</span>}
                        </p>
                        <p className="mt-0.5 text-ui text-foreground/80">{b.descriptor}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {d && (d.pitfalls?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="text-small font-extrabold text-foreground">{t("cw.rubric.pitfalls")}</p>
                  <ul className="mt-1 list-disc pl-5 text-ui text-foreground/80">
                    {d.pitfalls!.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {d && d.lookFor.length > 0 && (
                <div className="mt-3">
                  <p className="text-small font-extrabold text-foreground">{t("cw.rubric.look")}</p>
                  <ul className="mt-1 list-disc pl-5 text-ui text-foreground/80">
                    {d.lookFor.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Chat: ask about this piece ---------- */

export interface ChatState {
  turns: ChatTurn[];
  busy: boolean;
  /** Why the last message got no answer: today's messages are used up (the server's words), or it did not send. */
  failed: string | null;
}

/** The conversation about one document, kept by the host so it survives a change of tab. */
export function useChat(documentId: string, draftId: string | undefined, reviewId: string | undefined): ChatState & { ask: (message: string) => void } {
  const [state, setState] = useState<ChatState>({ turns: [], busy: false, failed: null });
  const turns = useRef<ChatTurn[]>([]);
  const ask = (message: string) => {
    const content = message.trim().slice(0, 2000);
    if (!content || state.busy) return;
    const history = turns.current.slice(-12);
    turns.current = [...turns.current, { role: "user", content }];
    setState({ turns: turns.current, busy: true, failed: null });
    courseworkApi
      .ask({ documentId, ...(draftId ? { draftId } : {}), ...(reviewId ? { reviewId } : {}), message: content, history })
      .then((out) => {
        turns.current = [...turns.current, { role: "assistant", content: out.reply }];
        setState({ turns: turns.current, busy: false, failed: null });
      })
      .catch((err) => {
        const limit = err instanceof Error && err.message.startsWith(COURSEWORK_CHAT_LIMIT_PREFIX);
        setState({ turns: turns.current, busy: false, failed: limit ? err.message.slice(COURSEWORK_CHAT_LIMIT_PREFIX.length).replace(/^[:\s]+/, "") : "" });
      });
  };
  return { ...state, ask };
}

export function AskInput({ onAsk, busy, autoFocus, className }: { onAsk: (message: string) => void; busy: boolean; autoFocus?: boolean; className?: string }) {
  const { t } = useCw();
  const [value, setValue] = useState("");
  const send = () => {
    if (!value.trim() || busy) return;
    onAsk(value);
    setValue("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn("flex items-center gap-2 rounded-[var(--r-button)] border border-border bg-white py-1.5 pl-4 pr-1.5 focus-within:border-border-strong", className)}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t("cw.chat.title")}
        placeholder={t("cw.chat.placeholder")}
        autoFocus={autoFocus}
        className="h-11 min-w-0 flex-1 bg-transparent text-ui text-foreground placeholder:text-faint focus:outline-none"
      />
      <button type="submit" disabled={!value.trim() || busy} aria-label={t("cw.chat.send")} className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-foreground text-white transition-opacity disabled:opacity-25">
        <ArrowUp className="size-5" strokeWidth={2.6} />
      </button>
    </form>
  );
}

/**
 * Ask about this piece: why a band, what to fix first, what an examiner
 * looks for. The answers explain and advise; they never write or rewrite the
 * student's text (the server's hints-only guard), and the tab says so.
 */
export function ChatView({ chat, result, hideMarks }: { chat: ChatState & { ask: (message: string) => void }; result: GradeResult | null; hideMarks: boolean }) {
  const { t } = useCw();
  const end = useRef<HTMLDivElement>(null);
  const count = chat.turns.length;
  useEffect(() => {
    if (count > 0) end.current?.scrollIntoView({ block: "nearest" });
  }, [count, chat.busy]);
  const marked = hasMarks(result) && !hideMarks;
  // The weakest criterion is the obvious thing to ask about.
  const weakest = result ? [...result.criteria].sort((a, b) => ("bandHigh" in a && "bandHigh" in b ? criterionMark(a) / a.maxMarks - criterionMark(b) / b.maxMarks : 0))[0] : null;
  const starters = [t("cw.chat.s1"), ...(weakest ? [t(marked ? "cw.chat.s2" : "cw.chat.s2Feedback", { name: weakest.name })] : []), t("cw.chat.s3")];
  return (
    <div className="flex flex-col gap-4">
      {count === 0 ? (
        <div>
          <h2 className="page-h2">{t("cw.chat.title")}</h2>
          <p className="mt-1 text-ui text-foreground/80">{t("cw.chat.intro")}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {starters.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => chat.ask(s)} className="flex min-h-11 w-full items-center rounded-[var(--r-control)] bg-muted px-4 py-2 text-left text-ui font-bold text-foreground hover:bg-border">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-live="polite">
          {chat.turns.map((turn, i) => (
            <li key={i} className={turn.role === "user" ? "self-end rounded-[18px] rounded-br-[6px] bg-muted px-4 py-2.5 text-ui text-foreground max-w-[88%]" : "text-ui text-foreground"}>
              <span className="sr-only">{turn.role === "user" ? t("cw.chat.you") : t("cw.chat.scribe")}: </span>
              {turn.content.split(/\n{2,}/).map((para, k) => (
                <p key={k} className={k > 0 ? "mt-2" : undefined}>
                  {para}
                </p>
              ))}
            </li>
          ))}
          {chat.busy && <li className="text-ui text-muted-foreground">{t("cw.chat.thinking")}</li>}
          {chat.failed !== null && (
            <li className="text-ui font-semibold text-foreground" role="alert">
              {chat.failed || t("cw.chat.failed")}
            </li>
          )}
        </ol>
      )}
      <div ref={end} />
      <AskInput onAsk={chat.ask} busy={chat.busy} className="sticky bottom-2" />
    </div>
  );
}
