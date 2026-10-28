"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import type { Folder, StudySession, Workspace } from "@/types";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { formatDuration } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  CreateResourceDialog,
  NewWorkspaceMenu,
} from "@/components/workspace/create-dialog";
import {
  DeleteResourceDialog,
  EditResourceDialog,
  type DeleteTarget,
  type EditTarget,
} from "@/components/workspace/resource-actions";
import { WorkspaceMembersDialog } from "@/components/workspace/workspace-members-dialog";
import {
  fetchActivityCalendar,
  fetchStudySessions,
  type DailyActivityPoint,
  computeStreak,
} from "@/lib/api/study";
import {
  FirstSessionOnboarding,
  hasSkippedFirstSessionOnboarding,
  markFirstSessionOnboardingSkipped,
} from "@/components/onboarding/first-session-onboarding";
import { onTreeChanged } from "@/lib/tree-events";
import {
  Search,
  ChevronRight,
  Plus,
  RotateCcw,
  Flame,
  Zap,
  Check,
  Clock,
} from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import { cn } from "@/lib/utils";
import { FolderCard } from "@/components/workspace/folder-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HomeUploadRow } from "@/components/workspace/home-upload-row";


function flattenWorkspaces(folders: Folder[], root: Workspace[]): Workspace[] {
  const all: Workspace[] = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all;
}

const DAILY_GOAL = 3;

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootWorkspaces, setRootWorkspaces] = useState<Workspace[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityPoint[]>([]);
  const [sessionsByWorkspace, setSessionsByWorkspace] = useState<
    Map<string, StudySession[]>
  >(new Map());
  const [creating, setCreating] = useState<"folder" | "workspace" | null>(null);

  const { data: dueReview } = useQuery({
    queryKey: ["due-review-count"],
    queryFn: fetchDueReview,
    staleTime: 60_000,
  });

  const openWorkspaceCreate = (choice: "workspace" | "bot") => {
    if (choice === "bot") {
      router.push("/study-bot");
      return;
    }
    setCreating("workspace");
  };
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  // undefined = still deciding; kept sticky so the dashboard doesn't flash in.
  const [showOnboarding, setShowOnboarding] = useState<boolean | undefined>(
    undefined,
  );

  const loadTree = () =>
    fetchWorkspaceTree()
      .then((tree) => {
        setFolders(tree.folders);
        setRootWorkspaces(tree.rootWorkspaces);
      })
      .catch(() => {})
      .finally(() => setTreeLoading(false));

  useEffect(() => {
    loadTree();
    fetchActivityCalendar()
      .then(setDailyActivity)
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
    return onTreeChanged(loadTree);
  }, []);

  // Upload-first onboarding: users with no study sessions anywhere land on
  // the "drop your notes" screen instead of the dashboard.
  useEffect(() => {
    if (treeLoading || showOnboarding !== undefined) return;
    let cancelled = false;
    const decide = async (): Promise<boolean> => {
      if (hasSkippedFirstSessionOnboarding()) return false;
      const workspaces = flattenWorkspaces(folders, rootWorkspaces);
      if (workspaces.length === 0) return true;
      // Established users (many workspaces) are never onboarding candidates —
      // skip the per-workspace session queries entirely.
      if (workspaces.length > 5) return false;
      const lists = await Promise.all(
        workspaces.map((w) => fetchStudySessions(w.id).catch(() => [])),
      );
      return lists.every((l) => l.length === 0);
    };
    decide().then((show) => {
      if (!cancelled) setShowOnboarding(show);
    });
    return () => {
      cancelled = true;
    };
  }, [treeLoading, folders, rootWorkspaces, showOnboarding]);

  const allWorkspaces = useMemo(
    () => flattenWorkspaces(folders, rootWorkspaces),
    [folders, rootWorkspaces],
  );

  // The workspace tree endpoint doesn't include sessions; fetch them per
  // workspace so the resume banner reflects real data.
  useEffect(() => {
    if (treeLoading) return;
    let cancelled = false;
    Promise.all(
      allWorkspaces.slice(0, 20).map(async (w) => {
        const sessions = await fetchStudySessions(w.id).catch(
          () => [] as StudySession[],
        );
        return [w.id, sessions] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setSessionsByWorkspace(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [treeLoading, allWorkspaces]);

  const filtered = searchQuery
    ? allWorkspaces.filter(
        (w) =>
          w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  const activeSessions = allWorkspaces.flatMap((w) => {
    const sessions = sessionsByWorkspace.get(w.id) ?? w.sessions;
    return sessions
      .filter((s) => s.status === "active" && s.activities.length > 0)
      .map((s) => ({ session: s, workspace: w }));
  });

  const streak = useMemo(() => computeStreak(dailyActivity), [dailyActivity]);

  const withSessions = (w: Workspace): Workspace => ({
    ...w,
    sessions: sessionsByWorkspace.get(w.id) ?? w.sessions,
  });
  const visibleWorkspaces = (filtered ?? allWorkspaces).map(withSessions);

  const sortedActive = [...activeSessions].sort((a, b) =>
    b.session.updatedAt.localeCompare(a.session.updatedAt),
  );
  const primary = sortedActive[0];
  const otherActive = sortedActive.slice(1, 4);

  const todayIso = new Date().toISOString().split("T")[0];
  const lastSevenDays = useMemo(() => {
    const byDate = new Map(dailyActivity.map((d) => [d.date, d.count]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().split("T")[0];
      return {
        iso,
        count: byDate.get(iso) ?? 0,
        label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      };
    });
  }, [dailyActivity]);
  const todayCount = lastSevenDays[6]?.count ?? 0;
  const dueCount = dueReview?.total ?? 0;

  const remainingMinutes = (session: StudySession) => {
    const left = session.activities
      .filter((a) => a.status !== "completed")
      .reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
    return left || Math.round((session.durationMinutes * (100 - session.progress)) / 100);
  };

  return (
    <div className="flex-1 flex flex-col">
      {showOnboarding && (
        <FirstSessionOnboarding
          onSkip={() => {
            markFirstSessionOnboardingSkipped();
            setShowOnboarding(false);
          }}
        />
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <section data-tour="home-banner">
              <h1 className="text-xl font-semibold tracking-tight">
                {t("home.continueLearning")}
              </h1>

              {treeLoading ? (
                <Skeleton className="mt-4 h-56 rounded-xl" />
              ) : primary ? (
                (() => {
                  const { session, workspace } = primary;
                  const hex = accentForId(workspace.id);
                  const next =
                    session.activities.find((a) => a.status !== "completed") ??
                    session.activities[0];
                  const href = `/workspace/${workspace.id}/session/${session.id}`;
                  return (
                    <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-xs">
                      <div className="flex flex-col gap-5 sm:flex-row">
                        <div
                          className="flex h-36 w-full shrink-0 items-center justify-center rounded-lg sm:h-auto sm:w-52"
                          style={{ background: `${hex}1a` }}
                        >
                          <Image
                            src="/illustrations/bot.png"
                            alt=""
                            width={120}
                            height={120}
                            priority
                            className="h-24 w-24 select-none object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {workspace.title}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold tracking-tight">
                            {session.title}
                          </h2>
                          {next && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t("home.nextUp")}: {next.title}
                            </p>
                          )}
                          <div className="mt-4 flex items-center gap-3 text-[13px] text-muted-foreground">
                            <ProgressBar value={session.progress} className="flex-1" size="sm" />
                            <span className="tabular-nums">{Math.round(session.progress)}%</span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="h-3.5 w-3.5" />
                              {t("home.timeLeft").replace(
                                "{time}",
                                formatDuration(remainingMinutes(session)),
                              )}
                            </span>
                          </div>
                          <Button className="mt-4 w-full" onClick={() => router.push(href)}>
                            {t("home.resumeSession")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-card p-5">
                  <p className="font-semibold">{t("home.noActive")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("home.noActiveBlurb")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => router.push("/study-bot")}>
                      <Plus className="h-4 w-4" />
                      {t("nav.newSession")}
                    </Button>
                    <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                      {(toggle) => (
                        <Button variant="secondary" onClick={toggle}>
                          {t("ws.newWorkspace")}
                        </Button>
                      )}
                    </NewWorkspaceMenu>
                  </div>
                </div>
              )}

              {otherActive.length > 0 && (
                <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {otherActive.map(({ session, workspace }) => {
                    const done = session.activities.filter(
                      (a) => a.status === "completed",
                    ).length;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() =>
                          router.push(`/workspace/${workspace.id}/session/${session.id}`)
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: accentForId(workspace.id) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {session.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {workspace.title}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {done}/{session.activities.length}
                        </span>
                        <ChevronRight className="h-4 w-4 text-faint" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {!treeLoading && (
              <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
                <HomeUploadRow />
              </section>
            )}

            <section className="mt-10">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-xl font-semibold tracking-tight">
                  {t("misc.workspaces")}
                </h2>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("misc.searchWorkspaces")}
                    className="h-9 w-44 rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => setCreating("folder")}>
                  {t("misc.newFolder")}
                </Button>
                <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                  {(toggle) => (
                    <Button size="sm" onClick={toggle}>
                      <Plus className="h-3.5 w-3.5" />
                      {t("ws.newWorkspace")}
                    </Button>
                  )}
                </NewWorkspaceMenu>
              </div>

              {filtered && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t(filtered.length === 1 ? "misc.resultCount" : "misc.resultsCount").replace(
                    "{count}",
                    String(filtered.length),
                  )}
                </p>
              )}

              {!filtered && folders.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onClick={(id) => router.push(`/folder/${id}`)}
                      actions={{
                        onRename: () =>
                          setEditing({
                            kind: "folder",
                            id: folder.id,
                            name: folder.name,
                            color: folder.color,
                          }),
                        onDelete: () =>
                          setDeleting({ kind: "folder", id: folder.id, name: folder.name }),
                      }}
                    />
                  ))}
                </div>
              )}

              {treeLoading ? (
                <div className="mt-4">
                  <CardGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-2" />
                </div>
              ) : visibleWorkspaces.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibleWorkspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      onClick={(id) => router.push(`/workspace/${id}`)}
                      actions={{
                        onRename: () =>
                          setEditing({
                            kind: "workspace",
                            id: ws.id,
                            name: ws.title,
                            description: ws.description,
                            icon: ws.icon,
                          }),
                        onMembers: () => setMembersFor(ws.id),
                        onDelete: () =>
                          setDeleting({ kind: "workspace", id: ws.id, name: ws.title }),
                      }}
                    />
                  ))}
                </div>
              ) : allWorkspaces.length === 0 && folders.length === 0 ? (
                <div className="mt-4 rounded-xl border border-border bg-card p-5">
                  <p className="font-semibold">{t("misc.firstWinTitle")}</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {t("misc.planBlurb")}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                      {(toggle) => (
                        <Button size="sm" onClick={toggle}>
                          <Plus className="h-3.5 w-3.5" />
                          {t("ws.newWorkspace")}
                        </Button>
                      )}
                    </NewWorkspaceMenu>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4 lg:pt-11">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {streak} {t("misc.dayStreak")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("home.lastSevenDays")}</p>
                </div>
                <Flame className="h-7 w-7 shrink-0 text-energy" fill="currentColor" />
              </div>
              {calendarLoading ? (
                <Skeleton className="mt-4 h-12 rounded-lg" />
              ) : (
                <div className="mt-4 flex justify-between">
                  {lastSevenDays.map((d) => (
                    <div key={d.iso} className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full",
                          d.count > 0 ? "bg-energy text-white" : "bg-muted",
                          d.iso === todayIso && "ring-2 ring-border-strong ring-offset-2 ring-offset-card",
                        )}
                      >
                        {d.count > 0 && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t("home.dailyGoal")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("home.dailyGoalBlurb").replace("{n}", String(DAILY_GOAL))}
                  </p>
                </div>
                <Zap className="h-7 w-7 shrink-0 text-amber" fill="currentColor" />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar
                  value={(todayCount / DAILY_GOAL) * 100}
                  className="flex-1"
                  barClassName="bg-amber"
                />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.min(todayCount, DAILY_GOAL)} / {DAILY_GOAL}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t("home.flashcards")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dueCount > 0
                      ? t(dueCount === 1 ? "misc.cardDue" : "misc.cardsDue").replace(
                          "{count}",
                          String(dueCount),
                        )
                      : t("home.nothingDue")}
                  </p>
                </div>
                <RotateCcw className="h-6 w-6 shrink-0 text-violet" />
              </div>
              {dueCount > 0 && (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => router.push("/flashcards/review")}
                >
                  {t("home.reviewNow")}
                </Button>
              )}
            </div>
          </aside>
        </div>

        {editing && (
          <EditResourceDialog
            target={editing}
            onClose={() => setEditing(null)}
            onSaved={loadTree}
          />
        )}
        {deleting && (
          <DeleteResourceDialog
            target={deleting}
            onClose={() => setDeleting(null)}
            onDeleted={loadTree}
          />
        )}
        <WorkspaceMembersDialog
          workspaceId={membersFor}
          open={membersFor !== null}
          onClose={() => setMembersFor(null)}
        />
        {creating && (
          <CreateResourceDialog
            kind={creating}
            onClose={() => setCreating(null)}
            onCreated={(workspaceId) => {
              if (workspaceId) router.push(`/workspace/${workspaceId}`);
              else loadTree();
            }}
          />
        )}
      </main>
    </div>
  );
}
