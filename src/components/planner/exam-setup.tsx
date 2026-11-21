"use client";

import { buttonClass } from "@/components/ui/button";
import "@/lib/i18n/exam-planner";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Check, Loader2, Plus, X } from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import {
  dayDiff,
  fetchExamDefaults,
  fetchExamSuggestions,
  fetchExamTopics,
  saveExam,
  setWeekdayMinutes,
  suggestedDailyMinutes,
  type ExamSummary,
  type ExamTopic,
} from "@/lib/api/exam-planner";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { dayLabel, fill, fmtDuration, MONDAY_FIRST, weeklyMinutes, weekdayNames } from "@/lib/exam-planner-view";
import { useI18n } from "@/lib/i18n";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Folder, Workspace } from "@/types";
import { PLAN_KEY } from "@/components/planner/plan-task";

export type SetupMode = { kind: "new"; withTime?: boolean } | { kind: "edit"; exam: ExamSummary } | { kind: "time" };
type Step = "exam" | "topics" | "time" | "review";
type Kind = "exam" | "test" | "coursework";

const MINUTE_CHOICES = [0, 15, 30, 45, 60, 90];
const topicKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 120);
const confMastery = (c: number) => (c <= 0 ? 0.25 : c === 1 ? 0.6 : 0.85);

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  return [...root, ...folders.flatMap((f) => flatten(f.folders ?? [], f.workspaces))];
}

/** Add / edit an exam (subject, date, topics + confidence), and the minutes per weekday. One question per screen. */
export function ExamSetup({
  mode,
  today,
  weekdayMinutes,
  firstExam,
  onClose,
}: {
  mode: SetupMode;
  today: string;
  weekdayMinutes: number[];
  firstExam: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const steps: Step[] =
    mode.kind === "time" ? ["time"] : mode.kind === "edit" ? ["exam", "topics"] : mode.withTime || firstExam ? ["exam", "topics", "time", "review"] : ["exam", "topics", "review"];
  const [step, setStep] = useState<Step>(steps[0]);
  const idx = steps.indexOf(step);
  const editing = mode.kind === "edit" ? mode.exam : null;

  const [pickedWs, setPickedWs] = useState(editing?.workspaceId ?? "");
  // null until the student types: the name and date shown come from the subject's course and board.
  const [titleTyped, setTitle] = useState<string | null>(editing?.title ?? null);
  const [dateTyped, setDate] = useState<string | null>(editing?.date ?? null);
  const [kind, setKind] = useState<Kind>(editing?.kind ?? "exam");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [confidence, setConfidence] = useState<Record<string, number>>(editing?.confidence ?? {});
  // Self-rating is optional: the pre-lesson check measures each topic. Open only when asked (or already used).
  const [rating, setRating] = useState(Object.keys(editing?.confidence ?? {}).length > 0);
  const [custom, setCustom] = useState<ExamTopic[]>([]);
  const [draft, setDraft] = useState("");
  // Snap to the chips (the plan's default daily goal is 25 min).
  const [minutes, setMinutes] = useState<number[]>(() =>
    weekdayMinutes.map((m) => MINUTE_CHOICES.reduce((best, c) => (Math.abs(c - m) < Math.abs(best - m) ? c : best), 0)),
  );
  const [saving, setSaving] = useState(false);

  const subjects = useQuery({ queryKey: ["workspace-tree-flat"], queryFn: async () => { const tr = await fetchWorkspaceTree(); return flatten(tr.folders, tr.rootWorkspaces); }, enabled: mode.kind !== "time" });
  const suggestions = useQuery({ queryKey: [...PLAN_KEY, "suggestions"], queryFn: fetchExamSuggestions, enabled: mode.kind !== "time", retry: false });

  // With one subject there's nothing to pick.
  const workspaceId = pickedWs || (subjects.data?.length === 1 ? subjects.data[0].id : "");
  const defaultsQ = useQuery({ queryKey: [...PLAN_KEY, "exam-defaults", workspaceId], queryFn: () => fetchExamDefaults(workspaceId), enabled: !!workspaceId && !editing, retry: false });
  const examWindow = defaultsQ.data?.next ?? null;
  const title = titleTyped ?? defaultsQ.data?.title ?? "";
  // The start of the board's exam season, when it is still ahead: a bound the student moves to their first paper.
  const date = dateTyped ?? (examWindow && examWindow.from > today ? examWindow.from : "");
  const topicsQ = useQuery({ queryKey: [...PLAN_KEY, "topics", workspaceId], queryFn: () => fetchExamTopics(workspaceId), enabled: !!workspaceId });

  // Topics on the exam: an edited exam's list, else everything Scribe knows.
  const known = useMemo(() => topicsQ.data ?? [], [topicsQ.data]);
  const all = useMemo(() => {
    const extra = (editing?.workspaceId === workspaceId ? editing.topicLabels : [])
      .map((label) => ({ key: topicKey(label), label, level: "unknown" as const, mastery: null, attempts: 0 }))
      .filter((x) => !known.some((k) => k.key === x.key));
    return [...known, ...extra, ...custom.filter((c) => !known.some((k) => k.key === c.key))];
  }, [known, custom, editing, workspaceId]);
  const sel = useMemo(() => {
    if (selected) return selected;
    if (editing && editing.workspaceId === workspaceId && editing.topicLabels.length) return new Set(editing.topicLabels.map(topicKey));
    return new Set(all.map((x) => x.key));
  }, [selected, editing, workspaceId, all]);
  const chosen = all.filter((x) => sel.has(x.key));

  const daysLeft = date ? dayDiff(today, date) : 0;
  const studyDays = Math.max(1, Math.round((daysLeft * MONDAY_FIRST.filter((wd) => (minutes[wd] ?? 0) > 0).length) / 7));
  const suggested = suggestedDailyMinutes(
    chosen.map((x) => x.mastery ?? (confidence[x.key] !== undefined ? confMastery(confidence[x.key]) : 0.35)),
    studyDays,
  );
  const names = weekdayNames(locale);

  const canNext =
    step === "exam" ? !!workspaceId && !!date && daysLeft > 0 : step === "time" ? minutes.some((m) => m > 0) : true;

  const toggle = (key: string) => {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const addCustom = () => {
    const label = draft.trim();
    const key = topicKey(label);
    if (!key) return;
    if (!all.some((x) => x.key === key)) setCustom((c) => [...c, { key, label, level: "unknown", mastery: null, attempts: 0 }]);
    setSelected(new Set([...sel, key]));
    setDraft("");
  };

  const save = async () => {
    setSaving(true);
    try {
      if (steps.includes("exam")) {
        const wholeSubject = chosen.length === all.length && custom.length === 0 && !(editing?.topicLabels.length && editing.workspaceId === workspaceId);
        await saveExam({
          id: editing?.id,
          workspaceId,
          // Blank: the server names it after the course ("IB Biology HL"), else the subject.
          title: title.trim() || undefined,
          date,
          kind,
          topics: wholeSubject ? [] : chosen.map((x) => x.label),
          confidence: Object.fromEntries(Object.entries(confidence).filter(([k]) => sel.has(k))),
        });
      }
      if (steps.includes("time")) await setWeekdayMinutes(minutes);
      await qc.invalidateQueries({ queryKey: PLAN_KEY });
      toast.success(t("ep.toast.saved"));
      onClose();
    } catch (err) {
      toastError(err, t("ep.err.save"));
    } finally {
      setSaving(false);
    }
  };

  const last = idx === steps.length - 1;
  const heading =
    step === "exam" ? (editing ? t("ep.setup.editTitle") : t("ep.setup.examTitle")) : step === "topics" ? t("ep.setup.topicsTitle") : step === "time" ? t("ep.setup.timeTitle") : t("ep.setup.reviewTitle");

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col bg-card sm:max-h-[min(760px,calc(100vh-48px))] sm:max-w-[560px] sm:rounded-3xl sm:shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 sm:px-6 sm:pt-5">
          {steps.length > 1 ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {steps.map((s, i) => (
                  <span key={s} className={cn("h-1.5 rounded-full transition-all", i <= idx ? "w-6 bg-accent" : "w-3 bg-muted")} />
                ))}
              </div>
              <span className="text-[12px] font-semibold text-faint">{fill(t("ep.setup.step"), { n: idx + 1, t: steps.length })}</span>
            </div>
          ) : (
            <span />
          )}
          <button type="button" aria-label={t("ep.setup.close")} onClick={onClose} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3 sm:px-6">
          <h2 className="text-[21px] font-bold tracking-tight">{heading}</h2>

          {step === "exam" && (
            <div className="mt-1.5 flex flex-col gap-4">
              <p className="text-[13.5px] text-muted-foreground">{t("ep.setup.examSub")}</p>
              {suggestions.data?.suggestions.length ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-faint"><CalendarPlus className="size-3.5" />{t("ep.setup.fromCalendar")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.data.suggestions.map((s) => (
                      <button
                        key={`${s.date}-${s.title}`}
                        type="button"
                        onClick={() => {
                          setTitle(s.title);
                          setDate(s.date);
                          if (/test|quiz/i.test(s.title)) setKind("test");
                        }}
                        className={cn("rounded-full border px-3 py-1.5 text-[12.5px]", title === s.title && date === s.date ? "border-accent bg-accent-soft text-accent-dim" : "border-border hover:bg-muted")}
                      >
                        {s.title} · {dayLabel(s.date, locale, { day: "numeric", month: "short" })}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="mb-1.5 text-[12.5px] font-semibold text-faint">{t("ep.setup.subject")}</div>
                {subjects.isLoading ? (
                  <div className="h-12 animate-pulse rounded-xl bg-muted" />
                ) : !subjects.data?.length ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-[13.5px] text-muted-foreground">
                    {t("ep.setup.noSubjects")}{" "}
                    <Link href="/new-subject" className="font-semibold text-accent">{t("ep.setup.newSubject")}</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {subjects.data.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={workspaceId === w.id}
                        onClick={() => {
                          setPickedWs(w.id);
                          setSelected(null);
                          setCustom([]);
                          if (!editing) {
                            setTitle(null);
                            setDate(null);
                          }
                        }}
                        className={cn("flex h-12 items-center gap-2.5 rounded-xl border px-3 text-left text-[14px] font-semibold", workspaceId === w.id ? "border-accent bg-accent-soft/60" : "border-border hover:bg-muted")}
                      >
                        <span className="size-3 shrink-0 rounded-full" style={{ background: accentForId(w.id) }} />
                        <span className="min-w-0 flex-1 truncate">{w.title}</span>
                        {workspaceId === w.id && <Check className="size-4 shrink-0 text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px]">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-faint">{t("ep.setup.name")}</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("ep.setup.namePlaceholder")} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-[14.5px] outline-none focus:border-accent" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-faint">{t("ep.setup.date")}</span>
                  <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-[14.5px] outline-none focus:border-accent" />
                </label>
              </div>
              {examWindow && dateTyped === null && date === examWindow.from && (
                <p className="-mt-2 text-[12.5px] leading-snug text-muted-foreground">
                  {fill(t("ep.setup.windowHint"), { exam: title || defaultsQ.data?.title || "", season: `${examWindow.label} ${examWindow.year}` })}
                </p>
              )}
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {(["exam", "test", "coursework"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("h-9 flex-1 rounded-lg text-[13px] font-semibold", kind === k ? "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted-foreground")}>
                    {t(`ep.setup.kind.${k}`)}
                  </button>
                ))}
              </div>
              {date && (
                <div className={cn("text-[13px] font-semibold", daysLeft > 0 ? "text-accent-dim" : "text-[#b4530a]")}>
                  {daysLeft > 0 ? fill(t("ep.setup.daysToGo"), { n: daysLeft }) : t("ep.setup.datePast")}
                </div>
              )}
            </div>
          )}

          {step === "topics" && (
            <div className="mt-1.5 flex flex-col gap-3">
              <p className="text-[13.5px] text-muted-foreground">{t(rating ? "ep.setup.topicsSub" : "ep.setup.topicsSubAuto")}</p>
              {topicsQ.isLoading ? (
                <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
              ) : (
                <>
                  {all.length === 0 ? (
                    <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3 text-[13px] text-muted-foreground">
                      <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-10 w-auto shrink-0" />
                      {t("ep.setup.noTopics")}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[12.5px] text-faint">
                      <span>{fill(t("ep.setup.selected"), { n: chosen.length, t: all.length })}</span>
                      <span className="flex gap-2">
                        <button type="button" className="font-semibold text-accent" onClick={() => setSelected(new Set(all.map((x) => x.key)))}>{t("ep.setup.all")}</button>
                        <button type="button" className="font-semibold text-accent" onClick={() => setSelected(new Set())}>{t("ep.setup.none")}</button>
                      </span>
                    </div>
                  )}
                  <ul className="flex flex-col gap-1.5">
                    {all.map((x) => {
                      const on = sel.has(x.key);
                      const measured = x.mastery !== null;
                      return (
                        <li key={x.key} className={cn("flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center", on ? "border-border" : "border-dashed border-border opacity-60")}>
                          <button type="button" onClick={() => toggle(x.key)} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                            <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2", on ? "border-accent bg-accent text-white" : "border-border-strong")}>
                              {on && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 truncate text-[14px] font-medium">{x.label}</span>
                          </button>
                          {on &&
                            (measured ? (
                              <span className="ml-7 self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent-dim sm:ml-0 sm:self-auto">
                                {fill(t("ep.setup.measured"), { level: t(`ep.level.${x.level}`) })}
                              </span>
                            ) : !rating ? null : (
                              <div className="flex gap-1 pl-7 sm:pl-0">
                                {[0, 1, 2].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    aria-pressed={confidence[x.key] === c}
                                    onClick={() => setConfidence((m) => ({ ...m, [x.key]: c }))}
                                    className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-semibold", confidence[x.key] === c ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:brightness-95")}
                                  >
                                    {t(`ep.setup.conf${c}`)}
                                  </button>
                                ))}
                              </div>
                            ))}
                        </li>
                      );
                    })}
                  </ul>
                  {!rating && all.some((x) => x.mastery === null) && (
                    <button type="button" onClick={() => setRating(true)} className="self-start text-[13px] font-semibold text-accent hover:underline">
                      {t("ep.setup.rateToggle")}
                    </button>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addCustom();
                    }}
                  >
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} placeholder={t("ep.setup.addTopicPlaceholder")} aria-label={t("ep.setup.addTopic")} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:border-accent" />
                    <button type="submit" disabled={!draft.trim()} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-muted px-3 text-[13px] font-semibold disabled:opacity-50">
                      <Plus className="size-4" />
                      <span className="hidden sm:inline">{t("ep.setup.addTopic")}</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {step === "time" && (
            <div className="mt-1.5 flex flex-col gap-3">
              <p className="text-[13.5px] text-muted-foreground">{t("ep.setup.timeSub")}</p>
              {mode.kind !== "time" && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft/60 px-3 py-2.5 text-[13px]">
                  <span>{fill(t("ep.setup.suggestedLine"), { m: fmtDuration(suggested, t) })}</span>
                  <button type="button" onClick={() => setMinutes((ms) => ms.map((m) => (m > 0 ? suggested : 0)))} className="shrink-0 rounded-lg bg-card px-2.5 py-1 text-[12.5px] font-semibold text-accent-dim">
                    {t("ep.setup.useSuggested")}
                  </button>
                </div>
              )}
              <ul className="flex flex-col gap-1.5">
                {MONDAY_FIRST.map((wd, i) => (
                  <li key={wd} className="flex items-center gap-2">
                    <span className="w-11 shrink-0 text-[13px] font-semibold">{names[i]}</span>
                    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                      {MINUTE_CHOICES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={minutes[wd] === m}
                          onClick={() => setMinutes((ms) => ms.map((x, j) => (j === wd ? m : x)))}
                          className={cn(
                            "h-9 min-w-[44px] flex-1 rounded-lg text-[12.5px] font-semibold",
                            minutes[wd] === m ? (m ? "bg-accent text-white" : "bg-foreground/80 text-white") : "bg-muted text-muted-foreground hover:brightness-95",
                          )}
                        >
                          {m === 0 ? t("ep.setup.rest") : m}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="text-[12.5px] text-muted-foreground">{fill(t("ep.time.perWeek"), { h: fmtDuration(weeklyMinutes(minutes), t) })}</div>
            </div>
          )}

          {step === "review" && (
            <div className="mt-4 flex flex-col items-center text-center">
              <Image src="/design/cat3-cheer.webp" alt="" width={363} height={400} unoptimized className="cat-cheer h-24 w-auto" />
              <p className="mt-4 max-w-[400px] text-[16px] font-semibold leading-snug">
                {fill(t(chosen.length ? "ep.setup.reviewBody" : "ep.setup.reviewWhole"), {
                  days: daysLeft,
                  exam: title.trim(),
                  topics: chosen.length,
                  h: fmtDuration(weeklyMinutes(minutes), t),
                })}
              </p>
              <p className="mt-2 max-w-[400px] text-[13.5px] text-muted-foreground">{t("ep.setup.reviewNote")}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 sm:px-6">
          {idx > 0 ? (
            <button type="button" onClick={() => setStep(steps[idx - 1])} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-muted-foreground hover:bg-muted">
              <ArrowLeft className="size-4" />
              {t("ep.setup.back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!canNext || saving}
            onClick={() => (last ? void save() : setStep(steps[idx + 1]))}
            className={buttonClass({ className: "min-w-[120px] gap-2" })}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("ep.setup.saving") : !last ? t("ep.setup.next") : mode.kind === "new" ? t("ep.setup.create") : t("ep.setup.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
