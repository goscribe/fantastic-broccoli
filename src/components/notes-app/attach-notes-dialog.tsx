"use client";

import { buttonClass } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Loader2, Lock, Search } from "lucide-react";
import { attachedNotesApi, type AttachOptionTopic, type AttachOptions } from "@/lib/api/notes";
import { coursesApi } from "@/lib/api/courses";
import type { PublicCourseSummary } from "@/lib/api/public-notes";
import { isPlanLimitError } from "@/lib/api/plan-limit";
import { BOARD_LABEL, BOARD_ORDER, unitTitle } from "@/lib/courses";
import { track } from "@/lib/funnel";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { loadNoteCourses } from "./data";
import { Sheet } from "./sheet";

/** Most topics the server takes in one call (MAX_ATTACH_PER_CALL there). */
const PER_CALL = 20;

/**
 * "Add material → From Scribe notes" on a subject: pick a course, then its
 * topics (search, a whole unit at once), and the notes become material in
 * the subject. Topics without a note yet, already added, or behind a plan
 * the student does not have are shown but cannot be picked.
 */
export function AttachNotesDialog({
  workspaceId,
  workspaceTitle,
  onClose,
  onAttached,
}: {
  workspaceId: string;
  workspaceTitle: string;
  onClose: () => void;
  onAttached: (count: number) => void;
}) {
  const [courses, setCourses] = useState<PublicCourseSummary[] | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [options, setOptions] = useState<AttachOptions | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const openCourse = (id: string) => {
    setLoadingCourse(id);
    attachedNotesApi
      .options(workspaceId, id)
      .then((o) => {
        setOptions(o);
        setCourseId(id);
        setPicked(new Set());
        setQuery("");
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingCourse(null));
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadNoteCourses(), coursesApi.mine().catch(() => [])])
      .then(([list, own]) => {
        if (cancelled) return;
        setCourses(list);
        setMine(own.map((o) => o.courseId));
        // A subject started from a course opens straight on that course's topics.
        const linked = own.find((o) => o.workspaceId === workspaceId)?.courseId;
        if (linked && list.some((c) => c.id === linked && c.noteCount > 0)) openCourse(linked);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const q = query.trim().toLowerCase();
  const anyNotes = (courses ?? []).some((c) => c.noteCount > 0);
  const courseGroups = useMemo(() => {
    const list = (courses ?? []).filter((c) => !q || `${c.title} ${c.boardName}`.toLowerCase().includes(q));
    const own = list.filter((c) => mine.includes(c.id));
    return [
      ...(own.length && !q ? [{ label: "Your courses", courses: own }] : []),
      ...BOARD_ORDER.map((b) => ({ label: BOARD_LABEL[b], courses: list.filter((c) => c.board === b && (q || !mine.includes(c.id))) })).filter((g) => g.courses.length),
    ];
  }, [courses, mine, q]);

  const room = options ? Math.max(0, options.max - options.count) : 0;
  const cap = Math.min(room, PER_CALL);
  const can = (t: AttachOptionTopic) => !!t.note && !t.locked && !t.attached;
  const units = useMemo(
    () =>
      (options?.units ?? [])
        .map((u) => ({ ...u, topics: u.topics.filter((t) => !q || `${t.code} ${t.name}`.toLowerCase().includes(q)) }))
        .filter((u) => u.topics.length),
    [options, q],
  );
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < cap) next.add(id);
      else toast.error(room <= PER_CALL ? `This subject has room for ${room} more Scribe note${room === 1 ? "" : "s"}.` : `Add up to ${PER_CALL} notes at a time.`);
      return next;
    });
  const toggleUnit = (topics: AttachOptionTopic[]) =>
    setPicked((prev) => {
      const ids = topics.filter(can).map((t) => t.id);
      const next = new Set(prev);
      if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
      else for (const id of ids) if (next.size < cap) next.add(id);
      return next;
    });

  const save = async () => {
    if (!courseId || picked.size === 0 || saving) return;
    setSaving(true);
    try {
      const out = await attachedNotesApi.attach(workspaceId, courseId, [...picked]);
      if (out.attached.length) {
        track("notes.attached", { from: "subject", noteCount: out.attached.length, courseId }, workspaceId);
        emitTreeChanged();
        toast.success(`Added ${out.attached.length} Scribe note${out.attached.length === 1 ? "" : "s"} to ${workspaceTitle}`);
        onAttached(out.attached.length);
        onClose();
      } else {
        toast.error("Those notes couldn't be added.");
        setSaving(false);
      }
    } catch (err) {
      setSaving(false);
      if (isPlanLimitError(err)) toast.error("Those notes are included with a plan or exam pass.");
      else toastError(err, "Couldn't add the notes");
    }
  };

  const course = options?.course;
  const search = (placeholder: string) => (
    <label className="mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-muted px-3.5">
      <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold placeholder:font-medium placeholder:text-faint focus:outline-none" />
    </label>
  );

  return (
    <Sheet
      title={
        courseId && course ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCourseId(null);
                setOptions(null);
                setQuery("");
              }}
              aria-label="Back to courses"
              className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-[18px]" />
            </button>
            <span className="min-w-0 truncate">{course.title}</span>
          </span>
        ) : (
          "Add Scribe notes"
        )
      }
      onClose={onClose}
      footer={
        courseId && options ? (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[12.5px] leading-snug text-faint">
              {room === 0 ? `This subject holds ${options.max} Scribe notes, the most it can.` : picked.size > 0 ? `${picked.size} selected` : ""}
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={picked.size === 0 || saving}
              className={buttonClass({ className: "shrink-0 gap-2" })}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {picked.size > 1 ? `Add ${picked.size} notes` : "Add note"}
            </button>
          </div>
        ) : undefined
      }
    >
      {failed && <p className="py-6 text-center text-[14.5px] text-muted-foreground">Scribe&apos;s notes can&apos;t be added right now. Please try again later.</p>}
      {!failed && !courses && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[56px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {/* Nothing imported yet: say so once, with the way that does work today. */}
      {!failed && courses && !anyNotes && (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <Image src="/design/cat3-pencil.webp" alt="" width={360} height={400} unoptimized className="h-[84px] w-auto" />
          <p className="mt-3 text-[17px] font-extrabold">Scribe&apos;s notes are on their way</p>
          <p className="mt-1 max-w-[360px] text-[14.5px] leading-snug text-muted-foreground">We are adding them course by course. For now, add your own: a PDF, slides or a photo of your notes.</p>
          <button type="button" onClick={onClose} className="mt-4 h-10 rounded-xl bg-muted px-5 text-[14.5px] font-bold hover:bg-border">
            Got it
          </button>
        </div>
      )}

      {!failed && courses && anyNotes && !courseId && (
        <>
          {search("Search courses")}
          {courseGroups.map((g) => (
            <section key={g.label} className="mt-4 first:mt-0">
              <h3 className="mb-2 text-[13px] font-extrabold text-muted-foreground">{g.label}</h3>
              <ul className="flex flex-col gap-2">
                {g.courses.map((c) => {
                  const has = c.noteCount > 0;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openCourse(c.id)}
                        disabled={!has || !!loadingCourse}
                        className={cn("life-card flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors", has ? "hover:border-border-strong" : "opacity-55")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold">{c.title}</span>
                          <span className="block text-[12.5px] text-faint">{has ? `${c.noteCount} notes` : "Notes coming soon"}</span>
                        </span>
                        {loadingCourse === c.id ? <Loader2 className="size-4 shrink-0 animate-spin text-accent" /> : has ? <ChevronRight className="size-4 shrink-0 text-faint" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {courseGroups.length === 0 && <p className="py-6 text-center text-[14px] text-muted-foreground">No course matches “{query.trim()}”.</p>}
        </>
      )}

      {!failed && courseId && options && course && (
        <>
          {search("Search topics")}
          {units.map((u) => {
            const pickable = u.topics.filter(can);
            const all = pickable.length > 0 && pickable.every((t) => picked.has(t.id));
            return (
              <section key={u.id} className="mt-4 first:mt-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-[13px] font-extrabold text-muted-foreground">{unitTitle(course, u)}</h3>
                  {pickable.length > 1 && (
                    <button type="button" onClick={() => toggleUnit(u.topics)} className="shrink-0 text-[13px] font-bold text-accent hover:underline">
                      {all ? "Clear" : `Select all ${pickable.length}`}
                    </button>
                  )}
                </div>
                <ul className="life-card overflow-hidden">
                  {u.topics.map((t) => {
                    const ok = can(t);
                    const on = picked.has(t.id);
                    const state = t.attached ? "Added" : !t.note ? "No note yet" : t.locked ? "With a plan" : null;
                    const tier = t.hlOnly ? "HL only" : t.bcOnly ? "BC only" : t.higherTierOnly ? "Higher tier" : null;
                    return (
                      <li key={t.id} className="border-t border-border first:border-t-0">
                        <label className={cn("flex min-h-[52px] items-center gap-3 px-3.5 py-2", ok ? "cursor-pointer hover:bg-muted/60" : "text-muted-foreground")}>
                          <input type="checkbox" className="peer sr-only" checked={on || t.attached} disabled={!ok} onChange={() => toggle(t.id)} />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
                              on ? "border-accent bg-accent text-white" : t.attached ? "border-border bg-muted text-muted-foreground" : ok ? "border-border-strong bg-white" : "border-border bg-muted",
                            )}
                          >
                            {(on || t.attached) && <Check className="size-3.5" strokeWidth={3.5} />}
                            {t.locked && !t.attached && <Lock className="size-3 text-faint" strokeWidth={2.5} />}
                          </span>
                          <span className="w-[46px] shrink-0 text-[12.5px] font-extrabold tabular-nums text-muted-foreground">{t.code}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-[14.5px] font-semibold leading-snug", ok && "text-foreground")}>{t.name}</span>
                            {tier && <span className="block text-[12px] font-semibold text-faint">{tier}</span>}
                          </span>
                          {state && <span className="shrink-0 text-[12.5px] font-bold text-faint">{state}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {units.length === 0 && <p className="py-6 text-center text-[14px] text-muted-foreground">No topic matches “{query.trim()}”.</p>}
        </>
      )}
    </Sheet>
  );
}
