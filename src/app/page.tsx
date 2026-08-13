"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { useAuthUser } from "@/lib/api/auth";
import type { Folder, Workspace } from "@/types";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { formatDuration } from "@/lib/utils";
import { StreakFlame } from "@/components/graphics/streak-flame";
import { FolderCard } from "@/components/workspace/folder-card";
import { StudyCalendar } from "@/components/workspace/study-calendar";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
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
} from "@/lib/api/study";
import {
  FirstSessionOnboarding,
  hasSkippedFirstSessionOnboarding,
  markFirstSessionOnboardingSkipped,
} from "@/components/onboarding/first-session-onboarding";
import { onTreeChanged } from "@/lib/tree-events";
import { Search, ArrowRight, Plus } from "lucide-react";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Banner } from "@/components/ui/banner";

function computeStreak(daily: DailyActivityPoint[]): number {
  const byDate = new Map(daily.map((d) => [d.date, d.count]));
  let streak = 0;
  const d = new Date();
  for (;;) {
    const iso = d.toISOString().split("T")[0];
    const count = byDate.get(iso) ?? 0;
    if (count > 0) streak += 1;
    else if (streak > 0 || iso !== new Date().toISOString().split("T")[0]) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

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

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootWorkspaces, setRootWorkspaces] = useState<Workspace[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityPoint[]>([]);
  const [creating, setCreating] = useState<"folder" | "workspace" | null>(null);
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

  const filtered = searchQuery
    ? allWorkspaces.filter(
        (w) =>
          w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  const activeSessions = allWorkspaces.flatMap((w) =>
    w.sessions
      .filter((s) => s.status === "active" && s.activities.length > 0)
      .map((s) => ({ session: s, workspace: w })),
  );
  const resumable = activeSessions.find(({ session }) => session.progress > 0);
  const totalPlannedMinutes = activeSessions.reduce(
    (sum, { session }) => sum + session.durationMinutes,
    0,
  );

  const revisionActivities = activeSessions.flatMap(({ session }) =>
    session.activities,
  );
  const revisionDone = revisionActivities.filter(
    (a) => a.status === "completed",
  ).length;
  const revisionPercent = revisionActivities.length
    ? Math.round((revisionDone / revisionActivities.length) * 100)
    : 0;
  const revisionBySession = activeSessions
    .map(({ session, workspace }) => ({
      id: session.id,
      workspaceId: workspace.id,
      title: session.title,
      done: session.activities.filter((a) => a.status === "completed").length,
      total: session.activities.length,
      progress: session.progress,
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  const streak = useMemo(() => computeStreak(dailyActivity), [dailyActivity]);

  const lastSevenDays = useMemo(() => {
    const byDate = new Map(dailyActivity.map((d) => [d.date, d.count]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().split("T")[0];
      return {
        label: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
        count: byDate.get(iso) ?? 0,
        isToday: i === 6,
      };
    });
  }, [dailyActivity]);

  const maxWeekCount = Math.max(1, ...lastSevenDays.map((d) => d.count));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

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
      <Banner
        variant="accent"
        dismissKey="upgrade-promo"
        action={{ label: "Upgrade Now", href: "/pricing" }}
        className="rounded-none border-x-0 border-t-0 px-4 sm:px-8"
      >
        Upgrade your plan today to access premium features!
      </Banner>
      <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* Greeting */}
        <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
          <div>
            <p className="text-[11px] font-semibold text-faint">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {greeting}{user ? `, ${user.name}` : ""}
            </h1>
          </div>
        </header>

        {/* Gradient banner */}
        <section
          data-tour="home-banner"
          className="relative overflow-hidden rounded-2xl bg-ink p-7 text-white animate-fade-up"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 120% at 90% 0%, rgba(105,82,224,0.35) 0%, transparent 60%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 40% 90% at 0% 100%, rgba(105,82,224,0.12) 0%, transparent 55%)",
            }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-lg">
              <p className="text-[11px] font-semibold text-accent-bright">
                {resumable ? "Continue studying" : "Get started"}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-2 leading-snug">
                {resumable
                  ? resumable.session.title
                  : "Start your first study session"}
              </h2>
              <p className="text-sm text-white/55 mt-1.5">
                {resumable
                  ? `${resumable.workspace.title} · ${formatDuration(resumable.session.durationMinutes)} · ${resumable.session.activities.filter((a) => a.status === "completed").length} of ${resumable.session.activities.length} activities complete`
                  : "A plan generated around your syllabus and schedule."}
              </p>
              {resumable && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                    )
                  }
                  className="group mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-bright px-4 py-2 text-[13px] font-semibold text-ink hover:bg-white transition-colors"
                >
                  Resume session
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
            {resumable && (
              <div className="hidden sm:block w-64">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] font-semibold text-white/45">
                    Progress
                  </span>
                  <span className="text-lg font-bold tabular-nums text-accent-bright">
                    {resumable.session.progress}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15">
                  <div
                    className="h-1.5 rounded-full bg-accent-bright"
                    style={{ width: `${resumable.session.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Study overview */}
        <section className="animate-fade-up">
          <h2 className="text-sm font-semibold mb-3">Study overview</h2>
          {calendarLoading || treeLoading ? (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-40 w-full" />
              </div>
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
                <div className="flex flex-1 items-end gap-2.5 min-h-28">
                  {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                    <Skeleton
                      key={i}
                      className="flex-1 max-w-9 rounded-t-md"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-border bg-card p-4">
              <StudyCalendar dailyActivity={dailyActivity} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">This week</p>
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 dark:border-amber-400/25 dark:bg-amber-400/10">
                    <StreakFlame className="h-5 w-5" />
                    <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                      <span className="text-sm font-bold tabular-nums">
                        {streak}
                      </span>{" "}
                      day streak
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex min-h-28 flex-1 items-end gap-2.5">
                  {lastSevenDays.map(({ label, count, isToday }, i) => (
                    <div
                      key={i}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                      title={`${count} session${count !== 1 ? "s" : ""}`}
                    >
                      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                        {count > 0 ? count : ""}
                      </span>
                      <div
                        className={`w-full max-w-9 rounded-t-md ${
                          count > 0
                            ? isToday
                              ? "bg-accent"
                              : "bg-accent/70"
                            : "bg-muted"
                        }`}
                        style={{
                          height:
                            count > 0 ? `${(count / maxWeekCount) * 100}%` : "4px",
                        }}
                      />
                      <span
                        className={`text-[10px] ${
                          isToday ? "font-semibold text-foreground" : "text-faint"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Active days",
                    value: String(
                      dailyActivity.filter((d) => d.count > 0).length,
                    ),
                  },
                  {
                    label: "Sessions logged",
                    value: String(
                      dailyActivity.reduce((s, d) => s + d.count, 0),
                    ),
                  },
                  { label: "Active plans", value: String(activeSessions.length) },
                  {
                    label: "Time planned",
                    value: formatDuration(totalPlannedMinutes),
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-muted/50 px-3 py-2.5 leading-tight"
                  >
                    <p className="text-base font-bold tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </section>

        {/* Revision progress */}
        {revisionActivities.length > 0 && (
          <section className="animate-fade-up">
            <h2 className="text-sm font-semibold mb-3">Revision progress</h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {revisionDone} of {revisionActivities.length} activities
                    complete across {activeSessions.length} active plan
                    {activeSessions.length !== 1 ? "s" : ""}
                  </p>
                  <span className="text-lg font-bold tabular-nums text-accent">
                    {revisionPercent}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{ width: `${revisionPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {revisionBySession.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      router.push(`/workspace/${s.workspaceId}/session/${s.id}`)
                    }
                    className="rounded-lg bg-muted/50 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12px] font-medium truncate">
                        {s.title}
                      </p>
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground shrink-0">
                        {s.done}/{s.total}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-accent/80"
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Search */}
        <div className="relative max-w-md animate-fade-up">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="w-full h-10 pl-11 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
          />
        </div>

        {/* Workspaces */}
        {filtered ? (
          <section>
            <p className="text-xs text-muted-foreground mb-4">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ws) => (
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
                      setDeleting({
                        kind: "workspace",
                        id: ws.id,
                        name: ws.title,
                      }),
                  }}
                />
              ))}
            </div>
          </section>
        ) : treeLoading ? (
          <section className="animate-fade-up space-y-3">
            <Skeleton className="h-4 w-16" />
            <CardGridSkeleton count={6} className="xl:grid-cols-4" />
          </section>
        ) : (
          <section className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Folders
              </h2>
              <button
                type="button"
                onClick={() => setCreating("folder")}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                New folder
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      setDeleting({
                        kind: "folder",
                        id: folder.id,
                        name: folder.name,
                      }),
                  }}
                />
              ))}
            </div>
            {rootWorkspaces.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Workspaces
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCreating("workspace")}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New workspace
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rootWorkspaces.map((ws) => (
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
                          }),
                        onMembers: () => setMembersFor(ws.id),
                        onDelete: () =>
                          setDeleting({
                            kind: "workspace",
                            id: ws.id,
                            name: ws.title,
                          }),
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

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
