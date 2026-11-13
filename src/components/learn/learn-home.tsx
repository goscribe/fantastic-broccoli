"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accentForId } from "@/lib/accent-palette";
import { WeekStrip } from "@/components/learn/week-strip";
import { SubjectCover } from "@/components/learn/subject-cover";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, ChevronUp, FileText, Headphones, Layers, Loader2, NotebookText, Play, Plus, Presentation } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions, fetchActivityCalendar, createStudySession } from "@/lib/api/study";
import { fetchDueReview, studySessionApi } from "@/lib/api/study-session";
import { startWorkspaceFromUploads, workspaceTitleFromFiles, fileBasename } from "@/lib/start-from-uploads";
import { fetchUploadPreviews, uploadFiles, analyzeFiles } from "@/lib/api/materials";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { onTreeChanged, emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { toast } from "sonner";
import { cn, formatRelativeDate } from "@/lib/utils";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import type { Folder, Material, StudySession, Workspace } from "@/types";
import { fetchStreak, type StreakSummary } from "@/lib/api/streak";
import { fetchPlannerWeek, type PlannerSlot } from "@/lib/api/planner";
import { Skeleton } from "@/components/ui/skeleton";
import "@/app/design/design.css";
import { inputBoxClass, bareInputClass } from "@/components/ui/input";

const ACTIVITY_LABEL: Record<string, string> = {
  mcq: "Quick 5",
  comprehension_check: "Comprehension check",
  flashcard_review: "Flashcards",
  reading: "Reading",
  worksheet: "Worksheet",
  interactive: "Interactive",
  vocab_recall: "Vocab recall",
  cloze: "Cloze",
  explain_aloud: "Explain aloud",
};
const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const activityLabel = (type: string) => ACTIVITY_LABEL[type.toLowerCase()] ?? type;


function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  const all = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const chatHref = (workspaceId: string, q: string) =>
  `/workspace/${workspaceId}/chat?q=${encodeURIComponent(q)}`;

function MaterialThumb({ m }: { m: Material }) {
  const Icon = { pdf: FileText, note: NotebookText, slides: Presentation, audio: Headphones }[m.type] ?? FileText;
  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
      {m.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.preview} alt="" className="size-full object-cover" />
      ) : (
        <span className="absolute inset-x-6 top-4 rounded-t-md border border-b-0 border-border bg-white px-3 py-3">
          <span className="block h-[5px] w-2/3 rounded bg-neutral-300" />
          <span className="mt-2 block h-[3px] w-full rounded bg-neutral-200" />
          <span className="mt-1 block h-[3px] w-5/6 rounded bg-neutral-200" />
          <span className="mt-1 block h-[3px] w-full rounded bg-neutral-200" />
          <span className="mt-2 block h-8 w-1/2 rounded-[3px] bg-accent-soft" />
        </span>
      )}
      <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-lg bg-accent text-white shadow">
        <Icon className="size-3.5" />
      </span>
    </span>
  );
}


function sessionProgress(s: StudySession) {
  const total = s.activities.length;
  const done = s.activities.filter((a) => a.status === "completed" || a.status === "skipped").length;
  const next = s.activities.find((a) => a.status !== "completed" && a.status !== "skipped");
  return { total, done, next, pct: total ? done / total : s.progress / 100 };
}

/** Every workspace inside a folder, including nested folders. */
function underFolder(folders: Folder[], folderId: string): { name: string; workspaces: Workspace[] } | null {
  for (const f of folders) {
    if (f.id === folderId) return { name: f.name, workspaces: flatten(f.folders ?? [], f.workspaces ?? []) };
    const hit = underFolder(f.folders ?? [], folderId);
    if (hit) return hit;
  }
  return null;
}

/** Learn home. `workspaceId` / `folderId` scope it to one workspace or folder; the sidebar handles navigation. */
export function LearnHome({ workspaceId, folderId }: { workspaceId?: string; folderId?: string } = {}) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [scopeTitle, setScopeTitle] = useState<string | null>(null);
  const [upNext, setUpNext] = useState<(PlannerSlot & { date: string })[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [due, setDue] = useState<number | null>(null);
  const [actLoading, setActLoading] = useState(true);
  const [days, setDays] = useState<number[]>([]);
  const [streakInfo, setStreakInfo] = useState<StreakSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      fetchWorkspaceTree()
        .then(async (tree) => {
          const all = flatten(tree.folders, tree.rootWorkspaces);
          const folder = folderId ? underFolder(tree.folders, folderId) : null;
          const ws = workspaceId ? all.filter((w) => w.id === workspaceId) : folder ? folder.workspaces : all;
          setScopeTitle(workspaceId ? (ws[0]?.title ?? null) : (folder?.name ?? null));
          setWorkspaces(ws);
          const lists = await Promise.all(ws.map((w) => fetchStudySessions(w.id).catch(() => [] as StudySession[])));
          setSessions(
            lists
              .flat()
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
          );
        })
        .catch(() => {})
        .finally(() => setLoading(false)),
    [workspaceId, folderId],
  );

  useEffect(() => {
    void load();
    fetchDueReview().then((r) => setDue(r.total)).catch(() => setDue(0));
    fetchStreak().then(setStreakInfo).catch(() => setStreakInfo(null));
    fetchPlannerWeek()
      .then((w) => {
        const today = new Date().toISOString().slice(0, 10);
        setUpNext(w.days.filter((d) => d.date >= today).flatMap((d) => d.slots.map((s) => ({ ...s, date: d.date }))).slice(0, 3));
      })
      .catch(() => setUpNext([]));
    fetchActivityCalendar()
      .then((pts) => {
        const byDate = new Map(pts.map((p) => [p.date.slice(0, 10), p.count]));
        const out: number[] = [];
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); // Monday
        for (let i = 0; i < 7; i++) {
          out.push(byDate.get(d.toISOString().slice(0, 10)) ?? 0);
          d.setDate(d.getDate() + 1);
        }
        setDays(out);
      })
      .catch(() => setDays([]))
      .finally(() => setActLoading(false));
    return onTreeChanged(() => void load());
  }, [load]);

  const wsById = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const materials = useMemo(
    () =>
      workspaces
        .flatMap((w) => w.materials.map((m) => ({ m, w })))
        .sort((a, b) => new Date(b.m.updatedAt).getTime() - new Date(a.m.updatedAt).getTime()),
    [workspaces],
  );
  const shown = expanded ? materials : materials.slice(0, 3);
  const shownAll = useMemo(() => workspaces.flatMap((w) => w.materials.map((m) => ({ m, w }))), [workspaces]);

  useEffect(() => {
    const wsIds = Array.from(new Set(shown.map(({ w }) => w.id))).filter((id) => !shown.some(({ m, w }) => w.id === id && m.id in previews));
    if (wsIds.length === 0) return;
    let cancelled = false;
    Promise.all(wsIds.map((id) => fetchUploadPreviews(id).catch(() => [])))
      .then((lists) => {
        if (cancelled) return;
        setPreviews((prev) => {
          const next = { ...prev };
          for (const row of lists.flat()) if (row) next[row.id] = row.url ?? "";
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map(({ m }) => m.id).join(",")]);
  // Oldest unfinished first: the learner continues where they left off, not the newest thing generated.
  const byStart = useMemo(() => [...sessions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [sessions]);
  const suggested = byStart.find((s) => s.status === "active" && !s.generating);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const streak = streakInfo?.current ?? 0;
  const defaultWorkspace = suggested ? wsById.get(suggested.workspaceId) : workspaces[0];

  const ask = (q: string) => {
    if (!defaultWorkspace || !q.trim()) return;
    router.push(chatHref(defaultWorkspace.id, q.trim()));
  };

  /** Uploads go into the workspace you're looking at (or your latest one); a brand-new learner gets a workspace made for them. */
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      const target = workspaceId ?? defaultWorkspace?.id;
      if (!target) {
        const created = await startWorkspaceFromUploads(list);
        router.push(created.session ? `/workspace/${created.workspaceId}/session/${created.session.id}` : `/workspace/${created.workspaceId}`);
        return;
      }
      const fileIds = await uploadFiles(target, list);
      analyzeFiles(target, fileIds).catch(() => {});
      emitTreeChanged();
      if (workspaceId) {
        toast.success(`Added ${list.length} file${list.length === 1 ? "" : "s"} — analysing now`);
        setUploading(false);
        return;
      }
      const session = await createStudySession({
        workspaceId: target,
        title: workspaceTitleFromFiles(list),
        depth: "moderate",
        durationMinutes: 30,
        topics: list.map((f) => fileBasename(f.name)).filter(Boolean).join(", ").slice(0, 2000) || undefined,
      });
      router.push(session ? `/workspace/${target}/session/${session.id}` : `/workspace/${target}`);
    } catch (e) {
      toastError(e, "Upload failed");
      setUploading(false);
    }
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const picked = useMemo(() => shownAll.filter(({ m }) => selected.has(m.id)), [shownAll, selected]);
  const [starting, setStarting] = useState<"session" | "flashcards" | null>(null);

  /** Build a study session or a deck from the picked files (or everything in the first folder when nothing is picked). */
  const startFromSelection = async (kind: "session" | "flashcards") => {
    const list = picked.length ? picked : shownAll.slice(0, 1);
    const w = list[0]?.w ?? defaultWorkspace;
    if (!w) return;
    const titles = list.map(({ m }) => m.title);
    const title = titles.length <= 2 ? titles.join(" + ") : `${titles[0]} + ${titles.length - 1} more`;
    setStarting(kind);
    try {
      if (kind === "flashcards") {
        const { artifact } = await studySessionApi.generateFlashcards({ workspaceId: w.id, prompt: `Flashcards from ${titles.join(", ")}`, title, numCards: 20 });
        router.push(`/flashcards/${artifact.id}?ws=${w.id}`);
        return;
      }
      const session = await createStudySession({ workspaceId: w.id, title, depth: "moderate", durationMinutes: 25, topics: titles.join(", ") });
      if (!session) throw new Error("Could not start");
      router.push(`/workspace/${w.id}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Couldn't start that");
      setStarting(null);
    }
  };

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 pb-12 pt-6 lg:flex-row">
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="flex items-end justify-between">
          <div>
            {(workspaceId || folderId) && <Link href="/" className="text-[12px] font-semibold text-faint hover:text-accent">← Home</Link>}
            <h1 className="text-[22px] font-bold leading-tight sm:text-[26px]">
              {workspaceId || folderId ? (scopeTitle ?? <Skeleton className="h-7 w-48" />) : `${greeting()}${firstName ? `, ${firstName}` : ""}`}
            </h1>
          </div>
          {sessions.length > 0 && <span className="hidden text-[13px] text-faint sm:inline">{sessions.length} study session{sessions.length === 1 ? "" : "s"}</span>}
        </div>

        {workspaceId && (
        <form
          className={cn(inputBoxClass, "flex-col items-stretch gap-0 p-3.5")}
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
        >
          <div className="flex items-center gap-3">
            <Image src="/design/cat2-wave.png" alt="" width={40} height={40} unoptimized className="cat-wiggle h-10 w-auto" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={defaultWorkspace ? "What do you want to practise?" : "Add a material first, then ask for anything"}
              disabled={!defaultWorkspace}
              className={cn(bareInputClass, "text-[15px]")}
            />
            <button type="submit" disabled={!defaultWorkspace || !prompt.trim()} className="grid size-9 place-items-center rounded-[10px] bg-accent text-white disabled:opacity-40">
              <ArrowUp className="size-4" />
            </button>
          </div>
          {defaultWorkspace && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {["Make a study session from everything here", "Flashcards from my latest upload", "Explain what I got wrong last time", "Mock paper, section A"].map((c) => (
                <button key={c} type="button" onClick={() => ask(c)} className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>
        )}

        {workspaceId ? (
          <>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">
            Your materials <span className="font-medium text-faint">· {materials.length}</span>
          </h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add material
            </button>
            {materials.length > 3 && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
                {expanded ? (
                  <>
                    Show less <ChevronUp className="size-4" />
                  </>
                ) : (
                  <>
                    Show all {materials.length} <ChevronDown className="size-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-3">
          {loading && materials.length === 0 && [0, 1, 2].map((i) => <div key={i} className="h-[232px] animate-pulse rounded-2xl bg-muted" />)}
          {shown.map(({ m, w }) => (
            <div
              key={m.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-3 transition-colors",
                selected.has(m.id) ? "border-accent ring-2 ring-accent/20" : "border-border",
              )}
            >
              <label className="absolute left-5 top-5 z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-white shadow-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white">
                <input type="checkbox" className="peer sr-only" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`Select ${m.title}`} />
                <Check className="size-3.5 opacity-0 peer-checked:opacity-100" />
              </label>
              <button type="button" onClick={() => toggleSelected(m.id)} className="block w-full text-left">
                <MaterialThumb m={{ ...m, preview: m.preview ?? (previews[m.id] || undefined) }} />
              </button>
              <div className="mt-3 truncate px-0.5 text-[14.5px] font-semibold">{m.title}</div>
              <div className="truncate px-0.5 text-[12px] text-faint">
                {w.title} · {formatRelativeDate(m.updatedAt)}
              </div>
            </div>
          ))}
          {(expanded || (!loading && materials.length < 3)) && (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 sm:min-h-[200px] border-dashed border-border p-4 text-center hover:border-accent/50 hover:bg-accent-soft/40">
              <Image src="/design/cat2-sleep.png" alt="" width={64} height={64} unoptimized className="cat-bob h-16 w-auto" />
              <div>
                <div className="text-[14.5px] font-semibold">Add material</div>
                <div className="mt-0.5 text-[12px] text-faint">PDF · slides · photos of notes</div>
              </div>
            </button>
          )}
        </div>

          </>
        ) : (
          <>
            <WeekStrip subjects={workspaces.map((w) => ({ id: w.id, title: w.title }))} />
          <SubjectsGrid workspaces={workspaces} sessions={sessions} loading={loading} onNew={() => router.push("/new-subject")} />
          </>
        )}

        {workspaceId && (
          <SessionList
            sessions={[...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
            workspaceId={workspaceId}
            loading={loading}
            adding={starting === "session"}
            pickedCount={picked.length}
            onAdd={() => void startFromSelection("session")}
          />
        )}
      </div>

      {workspaceId && (
      <CatNudge
        count={picked.length}
        empty={!loading && materials.length === 0}
        starting={starting}
        onSession={() => void startFromSelection("session")}
        onFlashcards={() => void startFromSelection("flashcards")}
        onClear={() => setSelected(new Set())}
      />
      )}
      <div className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[300px]">
        {loading && !suggested && <Skeleton className="h-[150px] rounded-2xl" />}
        {suggested && (() => {
          const { done, total, next } = sessionProgress(suggested);
          return (
            <div className="relative overflow-hidden rounded-2xl p-[18px]" style={{ background: "var(--accent-soft)" }}>
              <Image src="/design/cat2-book.png" alt="" width={72} height={72} unoptimized className="cat-peek absolute right-2.5 top-2 h-[72px] w-auto" />
              <div className="flex items-center gap-2">
                <Ring pct={total ? done / total : 0} size={28} stroke={12} color="var(--accent)" />
                <span className="text-[11px] font-semibold text-accent">
                  Suggested next · {done} of {total} done
                </span>
              </div>
              <div className="mt-2 pr-16 text-[16px] font-bold leading-tight">{next ? `${activityLabel(next.type)} · ${next.title}` : suggested.title}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {next ? `${next.estimatedMinutes} min · ` : ""}
                {wsById.get(suggested.workspaceId)?.title}
              </div>
              <div className="mt-3.5 flex gap-2">
                <Link href={`/workspace/${suggested.workspaceId}/session/${suggested.id}`} className="inline-flex h-9 items-center rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white">
                  {done > 0 ? "Continue" : "Start"}
                </Link>
              </div>
            </div>
          );
        })()}
        <div className="rounded-2xl border border-border p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">Due for review</span>
          </div>
          {due === null ? (
            <div className="mt-3 flex items-center gap-4">
              <Skeleton className="size-[72px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ) : (
          <div className="mt-3 flex items-center gap-4">
            <Donut parts={due ? [[1, "var(--accent)"]] : [[1, "var(--border)"]]}>
              <span className="text-[20px] font-bold leading-none">{due ?? "–"}</span>
              <br />
              <span className="text-[11px] font-semibold text-faint">due</span>
            </Donut>
            <div className="text-[13px] text-muted-foreground">{due ? `${due} flashcards are due today. About ${Math.max(1, Math.round(due / 3))} min.` : "Nothing due right now — nice."}</div>
          </div>
          )}
          <Link href="/flashcards/review" className={cn("mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-xl text-[14px] font-semibold", due ? "bg-accent text-white" : "bg-muted")}>
            {due ? "Review now" : "Browse flashcards"}
          </Link>
        </div>
        {actLoading ? (
          <>
            <Skeleton className="h-[132px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </>
        ) : (
          <>
        <div className="rounded-2xl border border-border p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">This week</span>
            <span className="text-[12px] text-faint">
              {days.reduce((a, b) => a + b, 0)} activities{streak > 0 ? <> · <b className="text-accent">{streak}-day streak</b></> : null}
              {streakInfo && !streakInfo.todayDone ? <> · {Math.max(0, streakInfo.goalMin - streakInfo.todayMinutes)} min to go today</> : null}
            </span>
          </div>
          <div className="mt-3.5">
            <WeekBars mins={days.length ? days : [0, 0, 0, 0, 0, 0, 0]} goal={3} today={todayIdx} accent="var(--accent)" />
          </div>
        </div>
        <div className="rounded-2xl border border-border p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">Up next</span>
            <Link href="/planner" className="text-[12px] font-semibold text-accent hover:underline">Open planner</Link>
          </div>
          {upNext === null ? (
            <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : upNext.length === 0 ? (
            <p className="mt-3 text-[13px] text-faint">Nothing planned yet — set a goal and study window in the planner and your week fills itself in.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upNext.map((s) => {
                const d = new Date(`${s.date}T00:00:00Z`);
                const isToday = s.date === new Date().toISOString().slice(0, 10);
                const label = isToday ? "Today" : DAY[(d.getUTCDay() + 6) % 7];
                const href = s.kind === "review" ? "/flashcards/review" : s.workspaceId && s.sessionId ? `/workspace/${s.workspaceId}/session/${s.sessionId}` : "/planner";
                return (
                  <li key={`${s.date}-${s.id}`}>
                    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 hover:bg-muted">
                      <span className="w-[72px] shrink-0 text-[12px] font-semibold text-faint">{label} · {hhmm(s.start)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.title}</span>
                      <span className="shrink-0 text-[12px] text-faint">{s.end - s.start} min</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
          </>
        )}
      </div>

    </div>
  );
}


/** The cat pops out with a speech bubble: encouragement, and the one action that fits the moment. */
function CatNudge({
  count,
  empty,
  starting,
  onSession,
  onFlashcards,
  onClear,
}: {
  count: number;
  empty: boolean;
  starting: "session" | "flashcards" | null;
  onSession: () => void;
  onFlashcards: () => void;
  onClear: () => void;
}) {
  const text = empty
    ? "Drop a PDF, slides or a lecture link and I'll turn it into practice."
    : count === 0
      ? "Tick a few files and I'll build a study session from them."
      : `${count} file${count === 1 ? "" : "s"} picked — ready when you are.`;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto relative max-w-[260px] rounded-2xl border border-border bg-white px-4 py-3 text-[13.5px] leading-snug shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
        {text}
        {count > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button type="button" disabled={!!starting} onClick={onSession} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60">
              {starting === "session" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" fill="currentColor" />}
              Study session
            </button>
            <button type="button" disabled={!!starting} onClick={onFlashcards} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft disabled:opacity-60">
              {starting === "flashcards" ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
              Flashcards
            </button>
            <button type="button" onClick={onClear} className="h-8 px-2 text-[12.5px] font-semibold text-faint hover:text-foreground">
              Clear
            </button>
          </div>
        )}
        <span className="absolute -right-1.5 bottom-4 size-3 rotate-45 border-b border-r border-border bg-white" />
      </div>
      <Image src={count > 0 ? "/design/cat2-cheer.png" : "/design/cat2-wave.png"} alt="" width={96} height={96} unoptimized className="cat-wiggle h-[84px] w-auto select-none" />
    </div>
  );
}


/** Home: every subject as a card — progress ring over its sessions, materials count, and the next thing to do. */
function SubjectsGrid({
  workspaces,
  sessions,
  loading,
  onNew,
}: {
  workspaces: Workspace[];
  sessions: StudySession[];
  loading: boolean;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">
          Your subjects <span className="font-medium text-faint">· {workspaces.length}</span>
        </h2>
        <button type="button" onClick={onNew} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-2.5 text-[12.5px] font-semibold hover:bg-accent-soft">
          <Plus className="size-3.5" /> New subject
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
        {loading && workspaces.length === 0 && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[214px] rounded-2xl" />)}
        {workspaces.map((w) => {
          const own = sessions
            .filter((x) => x.workspaceId === w.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const done = own.filter((x) => x.status === "completed").length;
          const current = own.find((x) => x.status !== "completed");
          const pct = own.length ? done / own.length : 0;
          return (
            <Link key={w.id} href={`/workspace/${w.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/50">
              <SubjectCover title={w.title} className="h-[84px]" />
              <div className="flex items-center gap-3 p-4 pb-0">
                <Ring pct={pct} size={44} stroke={10} color={accentForId(w.id)} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{w.title}</div>
                  <div className="text-[12px] text-faint">
                    {w.materials.length} material{w.materials.length === 1 ? "" : "s"} · {done}/{own.length} sessions
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between p-4 pt-0 text-[12.5px]">
                <span className="truncate text-muted-foreground">{current ? (current.generating ? "Building the next session…" : `Next: ${current.title}`) : own.length ? "All caught up" : "No sessions yet"}</span>
                <span className="ml-2 shrink-0 font-semibold text-accent group-hover:underline">{current ? "Continue" : "Open"}</span>
              </div>
            </Link>
          );
        })}
        <button type="button" onClick={onNew} className="flex min-h-[214px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-center hover:border-accent/60 hover:bg-muted/40">
          <Image src="/design/cat2-sleep.png" alt="" width={56} height={56} unoptimized className="cat-bob h-14 w-auto" />
          <div className="text-[14px] font-semibold">New subject</div>
          <div className="text-[12px] text-faint">Drop notes, get sessions</div>
        </button>
      </div>
    </div>
  );
}

/** The subject's study sessions, newest first, with one button to add the next one. */
function SessionList({
  sessions,
  workspaceId,
  loading,
  adding,
  pickedCount,
  onAdd,
}: {
  sessions: StudySession[];
  workspaceId: string;
  loading: boolean;
  adding: boolean;
  pickedCount: number;
  onAdd: () => void;
}) {
  const doneCount = sessions.filter((s) => s.status === "completed").length;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">
          Study sessions <span className="font-medium text-faint">· {doneCount}/{sessions.length} done</span>
        </h2>
        <button
          type="button"
          disabled={adding}
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-2.5 text-[12.5px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60"
        >
          {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          {pickedCount > 0 ? `New session from ${pickedCount} file${pickedCount === 1 ? "" : "s"}` : "New session"}
        </button>
      </div>
      <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
        {loading &&
          sessions.length === 0 &&
          [0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-4 py-3">
              <Skeleton className="size-[52px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-[108px] rounded-[9px]" />
            </div>
          ))}
        {!loading && sessions.length === 0 && (
          <div className="flex items-center gap-4 px-5 py-6 text-[14px] text-muted-foreground">
            <Image src="/design/cat2-book.png" alt="" width={56} height={56} unoptimized className="cat-bob h-14 w-auto" />
            No sessions yet — hit New session and I&apos;ll build one from your materials.
          </div>
        )}
        {sessions.map((s) => {
          const { total, done, next, pct } = sessionProgress(s);
          const finished = s.status === "completed";
          return (
            <div key={s.id} className="flex items-center gap-3.5 px-4 py-3">
              <span className="relative grid size-[52px] shrink-0 place-items-center">
                <Ring pct={finished ? 1 : pct} size={52} stroke={8} color={finished ? "#10b981" : "var(--accent)"} />
                <span className="absolute inset-0 grid place-items-center">
                  {finished ? <Check className="size-5 text-emerald-600" strokeWidth={3} /> : s.generating ? <Loader2 className="size-5 animate-spin text-accent" /> : <Play className="size-4 text-accent" fill="currentColor" />}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{s.title}</span>
                  {finished && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Done</span>}
                  {s.generating && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Building…</span>}
                </div>
                <div className="truncate text-[12px] text-faint">
                  {s.durationMinutes} min · {s.depth}
                  {next && !finished ? ` · next: ${activityLabel(next.type)}` : total ? ` · ${done}/${total} activities` : ""}
                </div>
              </div>
              <div className="hidden w-20 shrink-0 text-right text-[12px] text-faint sm:block">{formatRelativeDate(s.updatedAt)}</div>
              <Link
                href={`/workspace/${workspaceId}/session/${s.id}`}
                className={cn(
                  "inline-flex h-8 w-[108px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-semibold",
                  finished ? "bg-muted hover:bg-accent-soft" : "bg-accent text-white hover:bg-accent-dim",
                )}
              >
                {finished ? "View debrief" : done > 0 ? "Continue" : "Start"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
