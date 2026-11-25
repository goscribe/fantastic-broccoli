"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { WeekStrip } from "@/components/learn/week-strip";
import { PlanTodayCard } from "@/components/planner/plan-today-card";
import { SubjectsGrid } from "@/components/learn/subjects-grid";
import { UpNextCard } from "@/components/learn/up-next-card";
import { homeSubjects, toSessionInput } from "@/lib/home-action";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions } from "@/lib/api/study";
import { fetchDueReview } from "@/lib/api/study-session";
import { onTreeChanged } from "@/lib/tree-events";
import { cn } from "@/lib/utils";
import type { Folder, StudySession, Workspace } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/ui/load-error";
import { buttonClass } from "@/components/ui/button";
import "@/app/design/design.css";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/today";

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

function sessionProgress(s: StudySession) {
  const total = s.activities.length;
  const done = s.activities.filter((a) => a.status === "completed" || a.status === "skipped").length;
  const next = s.activities.find((a) => a.status !== "completed" && a.status !== "skipped");
  return { total, done, next };
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

/** A folder's page: its subjects as home's tiles, the week, and the rail. (A subject's own page is SubjectPage.) */
export function LearnHome({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [scopeTitle, setScopeTitle] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [due, setDue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    () =>
      fetchWorkspaceTree()
        .then(async (tree) => {
          setLoadError(false);
          const folder = underFolder(tree.folders, folderId);
          const ws = folder ? folder.workspaces : [];
          setScopeTitle(folder?.name ?? null);
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
    [folderId],
  );

  useEffect(() => {
    void load();
    fetchDueReview().then((r) => setDue(r.total)).catch(() => setDue(0));
    return onTreeChanged(() => void load());
  }, [load]);

  const wsById = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  // Oldest unfinished first: the learner continues where they left off, not the newest thing generated.
  const byStart = useMemo(() => [...sessions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [sessions]);
  const suggested = byStart.find((s) => s.status === "active" && !s.generating);

  const { t } = useI18n();
  const [weekOpen, setWeekOpen] = useState(false);
  // A folder's subjects as home's tiles show them.
  const folderSubjects = useMemo(
    () =>
      homeSubjects({
        workspaces: workspaces.map((w) => ({
          id: w.id,
          title: w.title,
          folderId: w.folderId ?? null,
          subjectFamily: w.subjectFamily ?? null,
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.createdAt),
          materialCount: w.materials.length,
        })),
        sessions: sessions.map(toSessionInput),
      }),
    [workspaces, sessions],
  );

  // A folder that failed to load: one error with Retry, not an empty page under a skeleton.
  if (loadError && workspaces.length === 0) {
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

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-caption font-semibold text-faint hover:text-accent">← Home</Link>
            <h1 className="text-[22px] font-bold leading-tight sm:text-[26px]">{scopeTitle ?? <Skeleton className="h-7 w-48" />}</h1>
          </div>
        </div>
        <SubjectsGrid subjects={folderSubjects} loading={loading} onNew={() => router.push("/new-subject")} />
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
      </div>

      <div className="rail-flat rail-flush flex w-full shrink-0 flex-col lg:w-[300px]">
        {loading && !suggested && <Skeleton className="h-[150px] rounded-2xl" />}
        {suggested &&
          (() => {
            const { done, total, next } = sessionProgress(suggested);
            return (
              <div>
                <div className="text-caption font-bold text-accent-dim">Suggested next</div>
                <div className="mt-1 text-[16px] font-extrabold leading-tight">{next ? `${activityLabel(next.type)} · ${next.title}` : suggested.title}</div>
                <div className="mt-1 text-small text-muted-foreground">
                  {next ? `${next.estimatedMinutes} min · ` : ""}
                  {done} of {total} done
                  {wsById.get(suggested.workspaceId) ? ` · ${wsById.get(suggested.workspaceId)?.title}` : ""}
                </div>
                <Link href={`/workspace/${suggested.workspaceId}/session/${suggested.id}`} className={buttonClass({ className: "mt-3.5 w-full" })}>
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
              <div className="text-small text-muted-foreground">{due ? `flashcards due today across all your subjects, about ${Math.max(1, Math.round(due / 3))} min` : "Nothing due right now"}</div>
            </div>
          )}
          <Link href="/flashcards/review" className={cn("mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-full text-[14px] font-semibold", due && !suggested ? "bg-accent text-white hover:bg-accent-dim" : "bg-muted hover:bg-accent-soft")}>
            {due ? "Review now" : "Browse flashcards"}
          </Link>
        </div>
        <PlanTodayCard fallback={<UpNextCard />} />
      </div>
    </div>
  );
}
