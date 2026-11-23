"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, Check, ChevronDown, ChevronRight, ChevronUp, FileText, Headphones, Loader2, NotebookText, Play, Presentation } from "lucide-react";
import { SubjectBand } from "@/components/learn/subject-tile";
import { SubjectProgress } from "@/components/learn/subject-progress";
import { SubjectTopics, courseNextOf, useNotesOutline, useSubjectCourse } from "@/components/learn/subject-topics";
import { UpNextCard } from "@/components/learn/up-next-card";
import { AddMaterialMenu, NoteMaterialCard, useAttachedNotes } from "@/components/notes-app/subject-notes";
import { AttachNotesDialog } from "@/components/notes-app/attach-notes-dialog";
import { PlanTodayCard } from "@/components/planner/plan-today-card";
import { PLAN_KEY, useStartTask } from "@/components/planner/plan-task";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { Ring } from "@/components/design/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/ui/load-error";
import { buttonClass } from "@/components/ui/button";
import { inputBoxClass, bareInputClass } from "@/components/ui/input";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions, createStudySession } from "@/lib/api/study";
import { studySessionApi } from "@/lib/api/study-session";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { subjectReview, type ReviewSummary } from "@/lib/api/review";
import { fetchUploadPreviews, uploadFiles, analyzeFiles } from "@/lib/api/materials";
import { practiceHref } from "@/lib/mistakes";
import { courseBadge, unitsForLevel } from "@/lib/courses";
import { chipAction, latestUpload, newSessionScope, pickSubjectNext, reviewBreakdown, subjectChips, subjectNextCopy, type SubjectNext } from "@/lib/subject-page";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { onTreeChanged, emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { track as trackFunnel } from "@/lib/funnel";
import { cn, formatRelativeDate } from "@/lib/utils";
import { dataSelector, linkTarget, revealTarget } from "@/lib/link-target";
import type { Folder, Material, StudySession, Workspace } from "@/types";
import "@/app/design/design.css";
import { chooseStudyLength } from "@/lib/study-length-client";
import { PaperPicker } from "@/components/session/paper-picker";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/practice-paper";

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
const activityLabel = (type: string) => ACTIVITY_LABEL[type.toLowerCase()] ?? type;

function findWorkspace(folders: Folder[], root: Workspace[], id: string): Workspace | null {
  const hit = root.find((w) => w.id === id);
  if (hit) return hit;
  for (const f of folders) {
    const inner = findWorkspace(f.folders ?? [], f.workspaces ?? [], id);
    if (inner) return inner;
  }
  return null;
}

function sessionProgress(s: StudySession) {
  const total = s.activities.length;
  const done = s.activities.filter((a) => a.status === "completed" || a.status === "skipped").length;
  const next = s.activities.find((a) => a.status !== "completed" && a.status !== "skipped");
  return { total, done, next, pct: total ? done / total : s.progress / 100 };
}

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

/**
 * One subject: its colour band with the one next thing (one sentence, one
 * button), then everything else as secondary: the composer, materials, one
 * topic list, progress, sessions, and one Review line.
 */
export function SubjectPage({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attached = useAttachedNotes(workspaceId);
  // Course progress is asked for once the subject is known to follow a course (most follow none).
  const course = useSubjectCourse(workspaceId, loading && !workspace ? undefined : workspace);
  const notes = useNotesOutline(workspaceId);
  const startCourseTopic = useStartCourseTopic();
  const planStarter = useStartTask();

  const load = useCallback(
    () =>
      fetchWorkspaceTree()
        .then(async (tree) => {
          setLoadError(false);
          setWorkspace(findWorkspace(tree.folders, tree.rootWorkspaces, workspaceId));
          setSessions(await fetchStudySessions(workspaceId).catch(() => [] as StudySession[]));
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false)),
    [workspaceId],
  );
  useEffect(() => {
    void load();
    return onTreeChanged(() => void load());
  }, [load]);

  const review = useQuery({ queryKey: ["review-summary", workspaceId], queryFn: () => subjectReview(workspaceId), retry: 1 });
  const plan = useQuery({ queryKey: [...PLAN_KEY, "today"], queryFn: fetchPlanToday, retry: false });

  const title = workspace?.title ?? "";
  const materials = useMemo(
    () => [...(workspace?.materials ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace],
  );
  // `?file=<id>` (search): show that material, scrolled to and outlined.
  const [fileTarget] = useState(() => linkTarget("file"));
  const fileIndex = fileTarget ? materials.findIndex((m) => m.id === fileTarget) : -1;
  const shown = expanded || fileIndex >= 3 ? materials : materials.slice(0, 3);
  const fileShown = useRef(false);
  useEffect(() => {
    if (!fileTarget || fileIndex < 0 || fileShown.current) return;
    fileShown.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => revealTarget(dataSelector("file-id", fileTarget))));
  }, [fileTarget, fileIndex]);
  const sessionsDone = sessions.filter((s) => s.status === "completed").length;

  useEffect(() => {
    if (!shown.some((m) => !(m.id in previews))) return;
    let cancelled = false;
    fetchUploadPreviews(workspaceId)
      .catch(() => [])
      .then((rows) => {
        if (cancelled) return;
        setPreviews((prev) => {
          const next = { ...prev };
          for (const row of rows) if (row) next[row.id] = row.url ?? "";
          for (const m of shown) next[m.id] ??= "";
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((m) => m.id).join(",")]);

  // ----- the one next thing -----
  const courseNext = courseNextOf(course);
  const next: SubjectNext = pickSubjectNext({
    loading: loading || review.isLoading || course.state === "loading" || plan.isLoading,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      generating: !!s.generating,
      quickStart: !!s.quickStart,
      createdAt: s.createdAt,
      activities: s.activities.map((a) => ({ status: a.status, title: a.title, estimatedMinutes: a.estimatedMinutes })),
    })),
    review: review.data ?? null,
    planTasks: (plan.data?.tasks ?? []).filter((x) => x.workspaceId === workspaceId).map((x) => ({ id: x.id, label: x.label, minutes: x.minutes, status: x.status })),
    courseNext,
    materialCount: materials.length,
  });

  /** "New session" and the quick start: the whole subject's topics, or the picked files. */
  const scope = (picked: string[]) =>
    newSessionScope({
      subject: title,
      picked,
      topics:
        course.state === "ready"
          ? unitsForLevel(course.course, course.level).flatMap((u) => u.topics.map((x) => x.name))
          : (notes.outline?.topics.map((x) => x.title) ?? []),
      materials: materials.map((m) => m.title),
    });

  const run = async (key: string, work: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await work();
    } catch (e) {
      toastError(e, fallback);
      setBusy(null);
    }
  };
  const openSession = (s: { id: string } | undefined) => {
    if (!s) throw new Error("Could not start a session");
    router.push(`/workspace/${workspaceId}/session/${s.id}`);
  };

  const startReview = (r: ReviewSummary["nextAction"]) => {
    if (r.kind === "mistakes") return router.push(practiceHref({ workspaceId }));
    if (r.kind === "cards") return router.push("/flashcards/review");
    if (r.kind === "review_items")
      return run(
        "review",
        async () => {
          // A full session in this subject: the server adds its due questions as review activities.
          const labels = Array.from(new Set((review.data?.queue ?? []).filter((q) => q.type === "item").map((q) => q.label)));
          openSession(
            await createStudySession(await chooseStudyLength({ workspaceId, title: `Review: ${title}`.slice(0, 200), depth: "light" as const, durationMinutes: 10, topics: (labels.length ? labels : [title]).join(", ").slice(0, 2000) })),
          );
        },
        "Couldn't start the review",
      );
  };

  const startNext = () => {
    switch (next.kind) {
      case "mistakes":
        return router.push(practiceHref({ workspaceId }));
      case "plan":
        return void planStarter.start(next.taskId);
      case "continue":
      case "building":
        return router.push(`/workspace/${workspaceId}/session/${next.sessionId}`);
      case "review":
        return void startReview(
          next.review === "cards"
            ? { kind: "cards", count: next.count, workspaceId, via: "flashcards.getDueReview", label: "" }
            : { kind: "review_items", count: next.count, workspaceId, via: "studySession.create", label: "" },
        );
      case "topic": {
        if (course.state !== "ready") return;
        const topic = course.course.units.flatMap((u) => u.topics).find((x) => x.id === next.topicId);
        if (topic) void startCourseTopic.start(course.course, topic, course.level);
        return;
      }
      case "quick5":
        return void run(
          "next",
          async () => {
            const s = scope([]);
            openSession(await createStudySession(await chooseStudyLength({ workspaceId, title: title || "Quick 5", depth: "light" as const, durationMinutes: 5, quickStart: true, topics: s.topics })));
          },
          "Couldn't start your 5 questions",
        );
    }
  };
  const nextBusy = busy === "next" || busy === "review" || !!planStarter.startingId || !!startCourseTopic.busyTopicId;

  // ----- composer -----
  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    void run(
      "ask",
      async () => {
        const picked = materials.filter((m) => selected.has(m.id)).map((m) => m.title);
        openSession(
          await createStudySession(
            await chooseStudyLength({
              workspaceId,
              title: text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text,
              description: text,
              depth: "moderate" as const,
              durationMinutes: 25,
              topics: [text, ...picked].join("\n").slice(0, 2000),
            }),
          ),
        );
        setPrompt("");
      },
      "Could not start a session",
    );
  };
  const latest = latestUpload(materials, (m) => attached.notes.has(m.id));
  const chips = subjectChips({ latestUploadTitle: latest?.title ?? null, openMistakes: review.data?.mistakes ?? 0 });
  const makeDeck = (files: Material[], key: string) =>
    run(
      key,
      async () => {
        const titles = files.map((m) => m.title);
        const deckTitle = titles.length <= 2 ? titles.join(" + ") : `${titles[0]} + ${titles.length - 1} more`;
        const { artifact } = await studySessionApi.generateFlashcards({ workspaceId, prompt: `Flashcards from ${titles.join(", ")}`, title: deckTitle, numCards: 20 });
        router.push(`/flashcards/${artifact.id}?ws=${workspaceId}`);
      },
      "Couldn't make the flashcards",
    );
  const onChip = (id: "flashcards" | "mistakes") => {
    const action = chipAction(id, { workspaceId, latestUploadId: latest?.id ?? null });
    if (action?.kind === "deck" && latest) void makeDeck([latest], "chip");
    else if (action?.kind === "go") router.push(action.href);
  };

  // ----- materials -----
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const out = new Set(prev);
      if (out.has(id)) out.delete(id);
      else out.add(id);
      return out;
    });
  const picked = materials.filter((m) => selected.has(m.id));
  const newSession = () =>
    run(
      "session",
      async () => {
        const s = scope(picked.map((m) => m.title));
        const created = await createStudySession(await chooseStudyLength({ workspaceId, title: s.title, depth: "moderate" as const, durationMinutes: 25, topics: s.topics }));
        const fromNotes = picked.filter((m) => attached.notes.has(m.id)).length;
        if (fromNotes > 0) trackFunnel("notes.attached_session_started", { from: "subject", noteCount: fromNotes }, workspaceId);
        openSession(created);
      },
      "Couldn't start that",
    );

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      const fileIds = await uploadFiles(workspaceId, list);
      analyzeFiles(workspaceId, fileIds).catch(() => {});
      emitTreeChanged();
      toast.success(`Added ${list.length} file${list.length === 1 ? "" : "s"}. Scribe sorts them into your topics once it has read them.`);
    } catch (e) {
      toastError(e, "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loadError && !workspace) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
        <Link href="/" className="text-caption font-semibold text-faint hover:text-accent">← Home</Link>
        <LoadError
          className="mt-10"
          onRetry={() => {
            setLoading(true);
            void load();
          }}
          retrying={loading}
        />
      </div>
    );
  }

  const badge = course.state === "ready" ? courseBadge(title, course.course.title, course.level) : null;
  const copy = next.kind === "loading" ? null : subjectNextCopy(next, title || "this subject");
  const reviewIsPrimary = next.kind === "mistakes" || next.kind === "review";
  const reviewLine = (className: string) => (
    <ReviewLine summary={review.data ?? null} isPrimary={reviewIsPrimary} busy={busy === "review"} workspaceId={workspaceId} onStart={(a) => void startReview(a)} className={className} />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:flex-row lg:gap-10">
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div>
          <Link href="/" className="text-caption font-semibold text-faint hover:text-accent">← Home</Link>
          {workspace ? (
            // The tile the student tapped on home, opened out: the subject's colour and art, where it stands, the one thing to do next.
            <SubjectBand match={title} stored={workspace.subjectFamily} seed={workspaceId} className="mt-2 !rounded-[var(--r-card)] px-[18px] py-4 sm:px-6 sm:py-5">
              <h1 title={title} className={cn("subject-band__title max-w-[66%] font-extrabold text-white", title.length > 40 ? "text-[18px] sm:text-[20px]" : "text-[22px] sm:text-[26px]", "leading-[1.15]")}>{title}</h1>
              <p className="subject-tile__sub mt-1 max-w-[66%] text-small font-semibold">
                {badge && <span className="mr-1.5 inline-block rounded-full bg-white/25 px-2 py-px align-[1px] text-[11px] font-extrabold leading-[16px] text-white">{badge}</span>}
                {materials.length} material{materials.length === 1 ? "" : "s"}
                {sessions.length > 0 ? ` · ${sessionsDone} of ${sessions.length} sessions done` : ""}
              </p>
              {sessions.length > 0 && (
                <div className="subject-track mt-3 w-[52%] max-w-[300px]" role="progressbar" aria-valuemin={0} aria-valuemax={sessions.length} aria-valuenow={sessionsDone}>
                  <span className="fill-grow" style={{ width: `${Math.max(sessionsDone > 0 ? 6 : 0, (sessionsDone / sessions.length) * 100)}%` }} />
                </div>
              )}
              {copy ? (
                <>
                  <p className="mt-3 max-w-[66%] text-ui font-semibold text-white sm:max-w-[60%]">{copy.sentence}</p>
                  <button type="button" onClick={startNext} disabled={nextBusy} className="subject-pill mt-3 h-10 max-w-full disabled:opacity-80">
                    <span className="truncate">{copy.cta}</span>
                    {nextBusy ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ChevronRight className="size-4 shrink-0" strokeWidth={2.6} />}
                  </button>
                </>
              ) : (
                <div className="mt-4 h-10 w-40 animate-pulse rounded-full bg-white/30" />
              )}
            </SubjectBand>
          ) : (
            <Skeleton className="mt-2 h-[150px] rounded-[var(--r-card)]" />
          )}
        </div>

        <form
          className={cn(inputBoxClass, "-mt-4 flex-col items-stretch gap-0 p-4")}
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
        >
          <div className="flex items-center gap-3">
            <Image src="/design/cat3-wave.webp" alt="" width={352} height={400} unoptimized className="cat-wiggle hidden h-10 w-auto sm:block" />
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should the next session cover?" aria-label="What should the next session cover?" className={cn(bareInputClass, "text-[15px]")} />
            <button
              type="submit"
              aria-label="Build the session"
              disabled={!prompt.trim() || busy === "ask"}
              className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] disabled:opacity-40", prompt.trim() ? "bg-accent text-white" : "bg-muted text-foreground")}
            >
              {busy === "ask" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
          {(
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => setPaperOpen(true)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-muted disabled:opacity-60">
                {t("paper.cta")}
              </button>
              {chips.map((c) => (
                <button key={c.id} type="button" disabled={!!busy} onClick={() => onChip(c.id)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-muted disabled:opacity-60">
                  {busy === "chip" && c.id === "flashcards" && <Loader2 className="size-3.5 animate-spin" />}
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </form>

        {reviewLine("lg:hidden")}

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
            {shown.map((m) =>
              attached.notes.has(m.id) ? (
                <NoteMaterialCard key={m.id} note={attached.notes.get(m.id)!} workspaceId={workspaceId} selected={selected.has(m.id)} onToggle={() => toggleSelected(m.id)} />
              ) : (
                <div key={m.id} data-file-id={m.id} className={cn("life-card relative flex min-w-0 flex-col p-2.5 transition-colors sm:p-3", selected.has(m.id) && "border-accent ring-2 ring-accent/20")}>
                  <label className="absolute left-[18px] top-[18px] z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-white shadow-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white">
                    <input type="checkbox" className="peer sr-only" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`Select ${m.title}`} />
                    <Check className="size-3.5 opacity-0 peer-checked:opacity-100" />
                  </label>
                  <button type="button" onClick={() => toggleSelected(m.id)} className="block w-full rounded-xl text-left">
                    <MaterialThumb m={{ ...m, preview: m.preview ?? (previews[m.id] || undefined) }} />
                  </button>
                  <div className="mt-2.5 truncate px-1 text-ui font-semibold">{m.title}</div>
                  <div className="truncate px-1 pb-1 text-caption text-faint">{formatRelativeDate(m.updatedAt)}</div>
                </div>
              ),
            )}
            {!loading && materials.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn("flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border-2 border-dashed border-border p-4 text-center hover:border-border-strong hover:bg-muted/40", materials.length === 0 && "col-span-full")}
              >
                <Image src="/design/cat3-sleep.webp" alt="" width={401} height={400} unoptimized className="cat-bob h-16 w-auto" />
                <div>
                  <div className="inline-flex items-center gap-1.5 text-ui font-semibold">
                    {uploading && <Loader2 className="size-3.5 animate-spin" />}
                    Add material
                  </div>
                  <div className="mt-0.5 text-caption text-faint">PDF · slides · photos of notes</div>
                </div>
              </button>
            )}
          </div>
          {attached.available && !loading && materials.length < 3 && (
            <button type="button" onClick={() => setAttachOpen(true)} className="mx-auto mt-3 flex min-h-10 items-center text-[13.5px] font-semibold text-accent hover:underline">
              Or add Scribe&apos;s notes for your course
            </button>
          )}
          {attachOpen && <AttachNotesDialog workspaceId={workspaceId} workspaceTitle={title || "this subject"} onClose={() => setAttachOpen(false)} onAttached={() => attached.reload()} />}
        </div>

        <SubjectTopics key={`topics-${workspaceId}`} workspaceId={workspaceId} course={course} notes={notes} materials={workspace?.materials ?? []} />
        <SubjectProgress key={`progress-${workspaceId}`} workspaceId={workspaceId} />

        <SessionList
          sessions={[...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          workspaceId={workspaceId}
          loading={loading}
          adding={busy === "session"}
          pickedCount={picked.length}
          onAdd={() => void newSession()}
        />
      </div>

      {paperOpen && <PaperPicker workspaceId={workspaceId} onClose={() => setPaperOpen(false)} />}
      {picked.length > 0 && (
        <CatNudge count={picked.length} starting={busy === "session" ? "session" : busy === "deck" ? "flashcards" : null} onSession={() => void newSession()} onFlashcards={() => void makeDeck(picked, "deck")} onClear={() => setSelected(new Set())} />
      )}
      <div className="rail-cards flex w-full shrink-0 flex-col gap-3.5 lg:mt-[30px] lg:w-[300px]">
        {reviewLine("max-lg:hidden")}
        <PlanTodayCard fallback={<UpNextCard />} />
      </div>
    </div>
  );
}

/**
 * The one review queue: mistakes, then due questions, then due cards, as one
 * count and one button. When the band already offers it, no second button.
 */
function ReviewLine({
  summary,
  isPrimary,
  busy,
  workspaceId,
  onStart,
  className,
}: {
  summary: ReviewSummary | null;
  isPrimary: boolean;
  busy: boolean;
  workspaceId: string;
  onStart: (a: ReviewSummary["nextAction"]) => void;
  className?: string;
}) {
  if (!summary) return <Skeleton className={cn("h-[92px] rounded-2xl", className)} />;
  // Nothing due: no line at all (it comes back the moment something is).
  if (summary.total === 0) return null;
  return (
    <div className={cn("life-card flex items-center gap-4 p-[18px]", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] font-extrabold">Review</span>
          <span className="text-[16px] font-extrabold tabular-nums text-faint">{summary.total}</span>
        </div>
        <p className="mt-0.5 text-small text-muted-foreground">
          {reviewBreakdown(summary)}
        </p>
        {summary.mistakes > 0 && (
          <Link href={`/mistakes?workspace=${encodeURIComponent(workspaceId)}`} className="mt-1 inline-block text-caption font-semibold text-accent hover:underline">
            See your mistakes
          </Link>
        )}
      </div>
      {!isPrimary && summary.nextAction.kind !== "none" && (
        <button type="button" onClick={() => onStart(summary.nextAction)} disabled={busy} className={buttonClass({ variant: "secondary", size: "sm", className: "shrink-0 gap-1.5" })}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {summary.nextAction.label}
        </button>
      )}
    </div>
  );
}

/** The cat pops out with a speech bubble once files are picked: a session or a deck from just those. */
function CatNudge({
  count,
  starting,
  onSession,
  onFlashcards,
  onClear,
}: {
  count: number;
  starting: "session" | "flashcards" | null;
  onSession: () => void;
  onFlashcards: () => void;
  onClear: () => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex items-end gap-2 max-md:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto relative max-w-[260px] rounded-2xl border border-border bg-white px-4 py-3 text-small shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
        {`${count} file${count === 1 ? "" : "s"} picked — ready when you are.`}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" disabled={!!starting} onClick={onSession} className={buttonClass({ size: "sm", className: "gap-1.5" })}>
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
        <span className="absolute -right-1.5 bottom-4 size-3 rotate-45 border-b border-r border-border bg-white" />
      </div>
      <Image src="/design/cat3-cheer.webp" alt="" width={96} height={96} unoptimized className="cat-wiggle h-[84px] w-auto select-none" />
    </div>
  );
}

/** The subject's study sessions, newest first, and "New session" (the whole subject, or the picked files). */
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
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-border bg-white px-3.5 text-[13.5px] font-bold text-foreground hover:border-border-strong hover:bg-muted disabled:opacity-60"
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
              <Skeleton className="h-9 w-[108px] rounded-[12px]" />
            </div>
          ))}
        {!loading && sessions.length === 0 && (
          <div className="flex items-center gap-4 py-3 text-ui text-muted-foreground">
            <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized className="cat-bob h-14 w-auto" />
            No sessions yet. New session builds one on the whole subject.
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
                  <span className="truncate text-ui font-semibold">{s.title}</span>
                  {finished && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-caption font-semibold text-emerald-700">Done</span>}
                  {s.generating && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-caption font-semibold text-accent">Building…</span>}
                </div>
                <div className="truncate text-caption text-faint">
                  {s.durationMinutes} min
                  {next && !finished ? ` · next: ${activityLabel(next.type)}` : total ? ` · ${done}/${total} activities` : ""}
                </div>
              </div>
              <div className="hidden w-20 shrink-0 text-right text-caption text-faint sm:block">{formatRelativeDate(s.updatedAt)}</div>
              <Link
                href={`/workspace/${workspaceId}/session/${s.id}`}
                className={cn(
                  // Secondary: the subject's one primary is the band's button at the top.
                  "inline-flex h-9 w-[108px] shrink-0 items-center justify-center rounded-[12px] text-[13.5px] font-bold",
                  finished ? "bg-muted hover:bg-border" : "border border-border bg-white hover:border-border-strong hover:bg-muted",
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
