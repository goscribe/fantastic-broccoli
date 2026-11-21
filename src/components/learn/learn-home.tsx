"use client";

import { CourseShelf } from "@/components/courses/course-shelf";
import { CourseTopics } from "@/components/courses/course-topics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WeekStrip } from "@/components/learn/week-strip";
import { PlanTodayCard } from "@/components/planner/plan-today-card";
import { SubjectBand, SubjectTile } from "@/components/learn/subject-tile";
import { NotesOutline } from "@/components/learn/notes-outline";
import { AddMaterialMenu, NoteMaterialCard, useAttachedNotes } from "@/components/notes-app/subject-notes";
import { AttachNotesDialog } from "@/components/notes-app/attach-notes-dialog";
import { track as trackFunnel } from "@/lib/funnel";
import { SubjectProgress } from "@/components/learn/subject-progress";
import type { NotesTopic } from "@/lib/api/notes-outline";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, ChevronRight, ChevronUp, FileText, Headphones, Loader2, NotebookText, Play, Presentation } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions, fetchActivityCalendar, createStudySession } from "@/lib/api/study";
import { fetchDueReview, studySessionApi } from "@/lib/api/study-session";
import { startWorkspaceFromUploads, workspaceTitleFromFiles, fileBasename } from "@/lib/start-from-uploads";
import { fetchUploadPreviews, uploadFiles, analyzeFiles } from "@/lib/api/materials";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { onTreeChanged, emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { HOME_TILES_ALL_UP_TO, HOME_TILES_SHOWN, byRecentActivity, repeatsTitle } from "@/lib/subject-tiles";
import { toast } from "sonner";
import { cn, formatRelativeDate } from "@/lib/utils";
import { Ring, WeekBars } from "@/components/design/charts";
import type { Folder, Material, StudySession, Workspace } from "@/types";
import { fetchStreak, type StreakSummary } from "@/lib/api/streak";
import { fetchPlannerWeek, type PlannerSlot } from "@/lib/api/planner";
import { Skeleton } from "@/components/ui/skeleton";
import "@/app/design/design.css";
import { inputBoxClass, bareInputClass } from "@/components/ui/input";
import { Mascot } from "@/components/rewards/mascot";
import { useRewards } from "@/lib/rewards";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/rewards";
import "@/lib/i18n/today";
import { TodayCard } from "@/components/learn/today-card";
import { StreakCard } from "@/components/learn/streak-card";
import { useQuery } from "@tanstack/react-query";
import { mistakesApi } from "@/lib/api/mistakes";
import type { Daypart } from "@/lib/daypart";
import { useDaypart } from "@/lib/use-daypart";
import { greetingMood, isBrandNew, type GreetingMood } from "@/lib/home-today";

const GREET_KEY: Record<GreetingMood, string> = { new: "greetNew", done: "greetDone", streak: "greetStreak", fix: "greetFix", start: "greetStart" };

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

/** The same buckets as the hero's sky (src/lib/daypart.ts), so the words and the scene agree. */
const GREETING: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good evening",
  late: "Up late",
};

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
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Scribe notes attached to this subject as material (subject page only).
  const attached = useAttachedNotes(workspaceId);
  const [attachOpen, setAttachOpen] = useState(false);

  const load = useCallback(
    () =>
      fetchWorkspaceTree()
        .then(async (tree) => {
          setLoadError(false);
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
        .catch(() => setLoadError(true))
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
  const sessionsDone = sessions.filter((s) => s.status === "completed").length;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const defaultWorkspace = suggested ? wsById.get(suggested.workspaceId) : workspaces[0];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** The prompt box builds the next study session in this subject around what you typed. */
  const [asking, setAsking] = useState(false);
  const ask = async (q: string) => {
    const text = q.trim();
    if (!defaultWorkspace || !text || asking) return;
    setAsking(true);
    try {
      const picked = defaultWorkspace.materials.filter((m) => selected.has(m.id)).map((m) => m.title);
      const session = await createStudySession({
        workspaceId: defaultWorkspace.id,
        title: text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text,
        description: text,
        depth: "moderate",
        durationMinutes: 25,
        topics: [text, ...picked].join("\n").slice(0, 2000),
      });
      if (!session) throw new Error("Could not start a session");
      setPrompt("");
      router.push(`/workspace/${defaultWorkspace.id}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Could not start a session");
    } finally {
      setAsking(false);
    }
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
      // From home the upload is the first win: 5 questions on it, not a half-hour plan.
      const session = await createStudySession({
        workspaceId: target,
        title: workspaceTitleFromFiles(list),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        topics: list.map((f) => fileBasename(f.name)).filter(Boolean).join(", ").slice(0, 2000) || undefined,
      });
      router.push(session ? `/workspace/${target}/session/${session.id}` : `/workspace/${target}`);
    } catch (e) {
      toastError(e, "Upload failed");
      setUploading(false);
    }
  };

  /** A topic from the organised outline becomes a session on just that topic, grounded in the files it came from. */
  const [topicStarting, setTopicStarting] = useState<string | null>(null);
  const studyTopic = async (t: NotesTopic) => {
    if (!workspaceId || topicStarting) return;
    setTopicStarting(t.title);
    try {
      const files = (wsById.get(workspaceId)?.materials ?? []).filter((m) => t.fileIds.includes(m.id)).map((m) => m.title);
      const session = await createStudySession({
        workspaceId,
        title: t.title,
        description: t.summary || undefined,
        depth: "moderate",
        durationMinutes: 25,
        topics: [t.title, ...t.points, ...files].join("\n").slice(0, 2000),
      });
      if (!session) throw new Error("Could not start a session");
      router.push(`/workspace/${workspaceId}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Could not start a session");
      setTopicStarting(null);
    }
  };

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
      const fromNotes = list.filter(({ m }) => attached.notes.has(m.id)).length;
      if (fromNotes > 0) trackFunnel("notes.attached_session_started", { from: "subject", noteCount: fromNotes }, w.id);
      router.push(`/workspace/${w.id}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Couldn't start that");
      setStarting(null);
    }
  };

  const firstName = user?.name?.split(" ")[0];
  const home = !workspaceId && !folderId;
  // Nothing uploaded and never studied: home is one upload action and nothing else.
  const brandNew =
    home &&
    !loading &&
    !loadError &&
    isBrandNew({ workspaces: workspaces.map((w) => ({ id: w.id, materialCount: w.materials.length })), sessions });
  const [weekOpen, setWeekOpen] = useState(false);
  const { t } = useI18n();
  const shop = useShopSummary();
  const { data: mistakeSummary } = useQuery({
    queryKey: ["mistakes-summary", null],
    queryFn: () => mistakesApi.summary(),
    enabled: home,
    retry: 1,
  });
  const doneToday = !!streakInfo?.todayGoalMet;
  // The student's own clock; unknown on the server, where a plain "Hello" stands in (home renders client-side after sign-in).
  const daypart = useDaypart();
  const greeting = () => (daypart ? GREETING[daypart] : "Hello");
  const mood = greetingMood({
    brandNew: !!brandNew,
    doneToday,
    streak: streakInfo?.current ?? 0,
    openMistakes: mistakeSummary?.open ?? 0,
  });

  return (
    <div className={cn("mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:flex-row", workspaceId && "gap-8 lg:gap-10")}>
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <div className={cn("flex min-w-0 flex-1 flex-col", workspaceId ? "gap-8" : "gap-4 sm:gap-5")}>
        {workspaceId ? (
        <div>
          <Link href="/" className="text-[12px] font-semibold text-faint hover:text-accent">← Home</Link>
          {scopeTitle ? (
            // The tile the student tapped on home, opened out: the subject's colour and art, where it stands, the one thing to do next.
            <SubjectBand match={scopeTitle} stored={wsById.get(workspaceId)?.subjectFamily} seed={workspaceId} className="mt-2 !rounded-[var(--r-card)] px-[18px] py-4 sm:px-6 sm:py-5">
              <h1 title={scopeTitle} className={cn("subject-band__title max-w-[66%] font-extrabold text-white", scopeTitle.length > 40 ? "text-[18px] sm:text-[20px]" : "text-[22px] sm:text-[26px]", "leading-[1.15]")}>{scopeTitle}</h1>
              <p className="subject-tile__sub mt-1 max-w-[66%] text-[13px] font-semibold leading-snug">
                {materials.length} material{materials.length === 1 ? "" : "s"}
                {sessions.length > 0 ? ` · ${sessionsDone} of ${sessions.length} sessions done` : ""}
              </p>
              {sessions.length > 0 && (
                <div className="subject-track mt-3 w-[52%] max-w-[300px]" role="progressbar" aria-valuemin={0} aria-valuemax={sessions.length} aria-valuenow={sessionsDone}>
                  <span className="fill-grow" style={{ width: `${Math.max(sessionsDone > 0 ? 6 : 0, (sessionsDone / sessions.length) * 100)}%` }} />
                </div>
              )}
              {suggested && (
                <Link href={`/workspace/${suggested.workspaceId}/session/${suggested.id}`} className="subject-pill mt-4 h-10 max-w-full">
                  <span className="truncate">
                    {sessionProgress(suggested).done > 0 ? "Continue" : "Start"}: {suggested.title}
                  </span>
                  <ChevronRight className="size-4 shrink-0" strokeWidth={2.6} />
                </Link>
              )}
            </SubjectBand>
          ) : (
            <Skeleton className="mt-2 h-[120px] rounded-[var(--r-card)]" />
          )}
        </div>
        ) : (!home || (loadError && workspaces.length === 0)) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {folderId && <Link href="/" className="text-[12px] font-semibold text-faint hover:text-accent">← Home</Link>}
            <h1 className={cn("leading-tight", home ? "text-[30px] font-extrabold sm:text-[38px]" : "text-[22px] font-bold sm:text-[26px]")}>
              {folderId ? (scopeTitle ?? <Skeleton className="h-7 w-48" />) : `${greeting()}${firstName ? `, ${firstName}` : ""}`}
            </h1>
            {home && !loading && (
              <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground sm:text-[17px]">
                {t(`today.${GREET_KEY[mood]}`).replace("{n}", String(streakInfo?.current ?? 0))}
              </p>
            )}
          </div>
        </div>
        )}

        {workspaceId && (
        <form
          className={cn(inputBoxClass, "-mt-4 flex-col items-stretch gap-0 p-4")}
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
        >
          <div className="flex items-center gap-3">
            <Image src="/design/cat3-wave.webp" alt="" width={352} height={400} unoptimized className="cat-wiggle hidden h-10 w-auto sm:block" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={defaultWorkspace ? "What should the next session cover?" : "Add a material first, then ask for anything"}
              disabled={!defaultWorkspace}
              className={cn(bareInputClass, "text-[15px]")}
            />
            <button type="submit" disabled={!defaultWorkspace || !prompt.trim() || asking} className="grid size-9 place-items-center rounded-[10px] bg-accent text-white disabled:opacity-40">
              {asking ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
          {defaultWorkspace && (
            <div className="mt-4 flex flex-wrap gap-2">
              {["Make a study session from everything here", "Flashcards from my latest upload", "Explain what I got wrong last time"].map((c) => (
                <button key={c} type="button" onClick={() => ask(c)} className="max-w-full rounded-full border border-border px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-muted">
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>
        )}

        {workspaceId ? (
          <>
        <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">
            Your materials <span className="font-medium text-faint">· {materials.length}</span>
          </h2>
          <div className="flex items-center gap-3">
            {/* With one or two files the dashed tile in the grid is the way to add; from three up, this button is. */}
            {(loading || materials.length >= 3) &&
              (attached.available ? (
                <AddMaterialMenu uploading={uploading} onUpload={() => fileRef.current?.click()} onNotes={() => setAttachOpen(true)} />
              ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft">
              {uploading && <Loader2 className="size-3.5 animate-spin" />}
              Add material
            </button>
              ))}
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-3">
          {loading && materials.length === 0 && [0, 1, 2].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-[var(--r-card)] bg-muted" />)}
          {shown.map(({ m, w }) =>
            attached.notes.has(m.id) ? (
              <NoteMaterialCard key={m.id} note={attached.notes.get(m.id)!} workspaceId={w.id} selected={selected.has(m.id)} onToggle={() => toggleSelected(m.id)} />
            ) : (
            <div
              key={m.id}
              className={cn("life-card relative flex min-w-0 flex-col p-2.5 transition-colors sm:p-3", selected.has(m.id) && "border-accent ring-2 ring-accent/20")}
            >
              <label className="absolute left-[18px] top-[18px] z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-white shadow-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white">
                <input type="checkbox" className="peer sr-only" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`Select ${m.title}`} />
                <Check className="size-3.5 opacity-0 peer-checked:opacity-100" />
              </label>
              <button type="button" onClick={() => toggleSelected(m.id)} className="block w-full rounded-xl text-left">
                <MaterialThumb m={{ ...m, preview: m.preview ?? (previews[m.id] || undefined) }} />
              </button>
              <div className="mt-2.5 truncate px-1 text-[14.5px] font-semibold">{m.title}</div>
              <div className="truncate px-1 pb-1 text-[12px] text-faint">
                {w.title} · {formatRelativeDate(m.updatedAt)}
              </div>
            </div>
            ),
          )}
          {!loading && materials.length < 3 && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn("flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border-2 border-dashed border-border p-4 text-center hover:border-border-strong hover:bg-muted/40", materials.length === 0 && "col-span-full")}>
              <Image src="/design/cat3-sleep.webp" alt="" width={401} height={400} unoptimized className="cat-bob h-16 w-auto" />
              <div>
                <div className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold">
                  {uploading && <Loader2 className="size-3.5 animate-spin" />}
                  Add material
                </div>
                <div className="mt-0.5 text-[12px] text-faint">PDF · slides · photos of notes</div>
              </div>
            </button>
          )}
        </div>
        {attached.available && !loading && materials.length < 3 && (
          <button type="button" onClick={() => setAttachOpen(true)} className="mx-auto mt-3 flex min-h-10 items-center text-[13.5px] font-semibold text-accent hover:underline">
            Or add Scribe&apos;s notes for your course
          </button>
        )}
        {attachOpen && (
          <AttachNotesDialog workspaceId={workspaceId} workspaceTitle={scopeTitle ?? "this subject"} onClose={() => setAttachOpen(false)} onAttached={() => attached.reload()} />
        )}
        </div>

        <NotesOutline
          key={workspaceId}
          workspaceId={workspaceId}
          materials={wsById.get(workspaceId)?.materials ?? []}
          starting={topicStarting}
          onStudy={(t) => void studyTopic(t)}
        />

        <CourseTopics key={`course-${workspaceId}`} workspaceId={workspaceId} />
        <SubjectProgress key={`progress-${workspaceId}`} workspaceId={workspaceId} />
          </>
        ) : loadError && workspaces.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3" role="alert">
            <span className="text-[14px] text-muted-foreground">{t("today.loadError")}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-dim"
            >
              {t("today.retry")}
            </button>
          </div>
        ) : (
          <>
            {home && (
              <TodayCard
                workspaces={workspaces}
                sessions={sessions}
                loading={loading}
                uploading={uploading}
                onUpload={() => fileRef.current?.click()}
                doneToday={doneToday}
                greeting={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
                greetingSub={loading ? undefined : t(`today.${GREET_KEY[mood]}`).replace("{n}", String(streakInfo?.current ?? 0))}
              />
            )}
            {home && !brandNew && (
              <StreakCard streak={streakInfo} due={due} points={shop?.balance ?? 0} canAfford={!!shop?.affordable} tiles className="lg:hidden" />
            )}
            {!brandNew && (
              <SubjectsGrid workspaces={workspaces} sessions={sessions} loading={loading} onNew={() => router.push("/new-subject")} />
            )}
            {/* Courses from the course picker: a compact shelf (or one "pick a course" row) under the subjects. */}
            {!brandNew && !folderId && <CourseShelf />}
            {!brandNew && (
              <div>
                {/* Phones: the week planner is long; it opens on demand under the subjects. */}
                <button
                  type="button"
                  aria-expanded={weekOpen}
                  onClick={() => setWeekOpen((v) => !v)}
                  className="life-card flex min-h-[52px] w-full items-center justify-between px-4 text-[15px] font-bold lg:hidden"
                >
                  <span>{t("today.weekToggle")}</span>
                  <ChevronDown className={cn("size-4 text-faint transition-transform", weekOpen && "rotate-180")} />
                </button>
                <div className={cn(!weekOpen && "max-lg:hidden", "max-lg:mt-3")}>
                  <WeekStrip subjects={workspaces.map((w) => ({ id: w.id, title: w.title }))} />
                </div>
              </div>
            )}
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

      {workspaceId && picked.length > 0 && (
      <CatNudge
        count={picked.length}
        empty={!loading && materials.length === 0}
        starting={starting}
        onSession={() => void startFromSelection("session")}
        onFlashcards={() => void startFromSelection("flashcards")}
        onClear={() => setSelected(new Set())}
      />
      )}
      {!brandNew && (
      <div className={cn("w-full shrink-0 flex-col lg:w-[300px]", home ? "rail-flat hidden lg:flex" : workspaceId ? "rail-cards flex gap-3.5 lg:mt-[30px]" : "rail-flat rail-flush flex")}>
        {!home && !workspaceId && loading && !suggested && <Skeleton className="h-[150px] rounded-2xl" />}
        {!home && !workspaceId && suggested && (() => {
          const { done, total, next } = sessionProgress(suggested);
          return (
            <div>
              <div className="text-[12px] font-bold text-accent-dim">Suggested next</div>
              <div className="mt-1 text-[16px] font-extrabold leading-tight">{next ? `${activityLabel(next.type)} · ${next.title}` : suggested.title}</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {next ? `${next.estimatedMinutes} min · ` : ""}
                {done} of {total} done
                {!workspaceId && wsById.get(suggested.workspaceId) ? ` · ${wsById.get(suggested.workspaceId)?.title}` : ""}
              </div>
              <Link href={`/workspace/${suggested.workspaceId}/session/${suggested.id}`} className="mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-white hover:bg-accent-dim">
                {done > 0 ? "Continue" : "Start"}
              </Link>
            </div>
          );
        })()}
        <div className="life-card p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-extrabold">Due for review</span>
          </div>
          {due === null ? (
            <div className="mt-3 flex items-center gap-4">
              <Skeleton className="h-10 w-12 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ) : (
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-[40px] font-extrabold leading-none tabular-nums">{due}</span>
            <div className="text-[13px] leading-snug text-muted-foreground">{due ? `flashcards due today, about ${Math.max(1, Math.round(due / 3))} min` : "Nothing due right now"}</div>
          </div>
          )}
          <Link href="/flashcards/review" className={cn("mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-full text-[14px] font-semibold", due && !home && !suggested ? "bg-accent text-white hover:bg-accent-dim" : "bg-muted hover:bg-accent-soft")}>
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
        {home ? (
          <StreakCard streak={streakInfo} />
        ) : (
        <div className="life-card p-[18px]">
          <div className="text-[16px] font-extrabold">This week</div>
          <div className="mt-0.5 text-[12.5px] text-faint">
            {days.reduce((a, b) => a + b, 0)} activities
            {streakInfo && !streakInfo.todayDone ? <> · {Math.max(0, streakInfo.goalMin - streakInfo.todayMinutes)} min to go today</> : null}
          </div>
          <div className="mt-4">
            <WeekBars mins={days.length ? days : [0, 0, 0, 0, 0, 0, 0]} goal={3} today={todayIdx} accent="var(--accent)" />
          </div>
        </div>
        )}
        <PlanTodayCard
          fallback={
        <div className="life-card p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-extrabold">Up next</span>
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
                    <Link href={href} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted">
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
          }
        />
          </>
        )}
        {home && <HomeShopCard />}
      </div>
      )}

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
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex items-end gap-2 max-md:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto relative max-w-[260px] rounded-2xl border border-border bg-white px-4 py-3 text-[13.5px] leading-snug shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
        {text}
        {count > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button type="button" disabled={!!starting} onClick={onSession} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60">
              {starting === "session" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" fill="currentColor" />}
              Study session
            </button>
            <button type="button" disabled={!!starting} onClick={onFlashcards} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft disabled:opacity-60">
              {starting === "flashcards" && <Loader2 className="size-3.5 animate-spin" />}
              Flashcards
            </button>
            <button type="button" onClick={onClear} className="h-8 px-2 text-[12.5px] font-semibold text-faint hover:text-foreground">
              Clear
            </button>
          </div>
        )}
        <span className="absolute -right-1.5 bottom-4 size-3 rotate-45 border-b border-r border-border bg-white" />
      </div>
      <Image src={count > 0 ? "/design/cat3-cheer.webp" : "/design/cat3-wave.webp"} alt="" width={96} height={96} unoptimized className="cat-wiggle h-[84px] w-auto select-none" />
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
  const [showAll, setShowAll] = useState(false);
  // Most recently active first. A real account can hold dozens of subjects: past a couple of rows, home shows the recent ones and folds the rest away.
  const ordered = useMemo(() => byRecentActivity(workspaces, sessions), [workspaces, sessions]);
  const many = ordered.length > HOME_TILES_ALL_UP_TO;
  const tiles = many ? ordered.slice(0, HOME_TILES_SHOWN) : ordered;
  const rest = many ? ordered.slice(HOME_TILES_SHOWN) : [];
  const summary = (w: Workspace) => {
    const own = sessions
      .filter((x) => x.workspaceId === w.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const done = own.filter((x) => x.status === "completed").length;
    const current = own.find((x) => x.status !== "completed");
    const counts = `${w.materials.length} material${w.materials.length === 1 ? "" : "s"}${own.length ? ` · ${done}/${own.length} sessions` : ""}`;
    // "Next: <the subject's own name again>" says nothing: show where the subject stands instead.
    const sub = !current ? counts : current.generating ? "Building the next session…" : repeatsTitle(w.title, current.title) ? counts : `Next: ${current.title}`;
    return { sub, progress: own.length ? done / own.length : null, action: current ? "Continue" : "Open" };
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-[20px] font-extrabold">
          Your subjects <span className="font-medium text-faint">· {workspaces.length}</span>
        </h2>
        <button type="button" onClick={onNew} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-control)] border border-border bg-card px-4 text-[13.5px] font-bold text-foreground hover:border-border-strong sm:h-10">
          New subject
        </button>
      </div>
      {/* Each subject is a tile in its own colour with its illustration: the colour on this page lives here. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3">
        {loading && workspaces.length === 0 && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[156px] rounded-[var(--r-card)] sm:h-[176px]" />)}
        {tiles.map((w) => (
          <SubjectTile key={w.id} href={`/workspace/${w.id}`} title={w.title} stored={w.subjectFamily} seed={w.id} {...summary(w)} />
        ))}
        {!many && (
          <button type="button" onClick={onNew} className="hidden h-[176px] flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border-2 border-dashed border-border text-center hover:border-border-strong hover:bg-muted/40 sm:flex">
            <Image src="/design/cat3-sleep.webp" alt="" width={401} height={400} unoptimized className="cat-bob h-14 w-auto" />
            <div className="text-[14px] font-semibold">New subject</div>
            <div className="text-[12px] text-faint">Drop notes, get sessions</div>
          </button>
        )}
      </div>
      {rest.length > 0 && (
        <>
          {/* The rest as short rows in the same colours: thirty subjects stay a list you can scan, not a wall of cards. */}
          {showAll && (
            <div id="all-subjects" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {rest.map((w) => (
                <SubjectTile key={w.id} row href={`/workspace/${w.id}`} title={w.title} stored={w.subjectFamily} seed={w.id} sub={summary(w).sub} className="h-[76px]" />
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              aria-controls="all-subjects"
              className="inline-flex h-11 items-center gap-1.5 rounded-[var(--r-control)] border border-border bg-card px-4 text-[13.5px] font-bold text-foreground hover:border-border-strong sm:h-10"
            >
              {showAll ? (
                <>
                  Show fewer <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  Show all {ordered.length} <ChevronDown className="size-4" />
                </>
              )}
            </button>
          </div>
        </>
      )}
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
          {adding && <Loader2 className="size-3.5 animate-spin" />}
          {pickedCount > 0 ? `New session from ${pickedCount} file${pickedCount === 1 ? "" : "s"}` : "New session"}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {loading &&
          sessions.length === 0 &&
          [0, 1, 2].map((i) => (
            <div key={i} className="life-card flex items-center gap-3.5 px-4 py-3">
              <Skeleton className="size-[52px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-[108px] rounded-[9px]" />
            </div>
          ))}
        {!loading && sessions.length === 0 && (
          <div className="flex items-center gap-4 py-3 text-[14px] text-muted-foreground">
            <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized className="cat-bob h-14 w-auto" />
            No sessions yet — hit New session and I&apos;ll build one from your materials.
          </div>
        )}
        {sessions.map((s) => {
          const { total, done, next, pct } = sessionProgress(s);
          const finished = s.status === "completed";
          return (
            <div key={s.id} className="life-card flex items-center gap-3.5 px-3.5 py-3 sm:px-4">
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


function useShopSummary() {
  const { data: rewards } = useRewards();
  if (!rewards) return null;
  const affordable = rewards.catalog.some(
    (item) =>
      item.cost <= rewards.balance &&
      (item.slot === "freeze" ? rewards.freezes < rewards.maxFreezes : !rewards.owned.includes(item.id)),
  );
  return { balance: rewards.balance, affordable };
}

/** The shop from home: the cat in its outfit, the points balance, one tap to spend them. Desktop sidebar. */
function HomeShopCard() {
  const { t } = useI18n();
  const shop = useShopSummary();
  if (!shop) return null;
  return (
    <Link
      href="/shop"
      className="life-card life-press group hidden items-center gap-3.5 p-3.5 lg:flex"
    >
      <span className="grid size-[64px] shrink-0 place-items-end justify-center overflow-hidden rounded-full bg-muted">
        <Mascot pose="wave" className="cat-wiggle mb-0.5 h-[56px] w-[48px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-bold">{t("rewards.homeTitle")}</span>
          <span className="text-[12.5px] font-bold tabular-nums text-foreground">
            {t("rewards.ptsValue").replace("{n}", String(shop.balance))}
          </span>
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
          {shop.affordable ? (
            <span className="font-semibold text-accent-dim">{t("rewards.homeAfford")} →</span>
          ) : (
            t("rewards.homeBody")
          )}
        </span>
      </span>
    </Link>
  );
}
