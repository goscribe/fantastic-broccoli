"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { useAuthUser } from "@/lib/api/auth";
import type { Folder, StudySession, Workspace } from "@/types";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { formatDuration } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { FolderCard } from "@/components/workspace/folder-card";
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
} from "@/lib/api/study";
import {
  FirstSessionOnboarding,
  hasSkippedFirstSessionOnboarding,
  markFirstSessionOnboardingSkipped,
} from "@/components/onboarding/first-session-onboarding";
import { onTreeChanged } from "@/lib/tree-events";
import { Search, ArrowRight, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HomeUploadRow } from "@/components/workspace/home-upload-row";

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
  const { t } = useI18n();
  const { user } = useAuthUser();
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
  const resumable = activeSessions.find(({ session }) => session.progress > 0);
  const totalPlannedMinutes = activeSessions.reduce(
    (sum, { session }) => sum + session.durationMinutes,
    0,
  );

  const streak = useMemo(() => computeStreak(dailyActivity), [dailyActivity]);

  const heroProgress = resumable ? resumable.session.progress : 0;


  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("misc.goodMorning")
      : hour < 18
        ? t("misc.goodAfternoon")
        : t("misc.goodEvening");

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
      <main className="w-full flex-1 px-4 py-5 sm:px-8 sm:py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/illustrations/bot.png"
              alt=""
              width={96}
              height={96}
              className="pointer-events-none h-12 w-12 shrink-0 select-none object-contain"
            />
            <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {greeting}{user ? `, ${user.name}` : ""}
            </h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {streak > 0 && ` · ${streak} ${t("misc.dayStreak")}`}
              {activeSessions.length > 0 &&
                ` · ${activeSessions.length} ${t("misc.activePlans").toLowerCase()} · ${formatDuration(totalPlannedMinutes)} ${t("misc.timePlanned").toLowerCase()}`}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating("folder")}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("misc.newFolder")}
            </Button>
            <NewWorkspaceMenu align="right" onSelect={openWorkspaceCreate}>
              {(toggle) => (
                <Button size="sm" onClick={toggle}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("ws.newWorkspace")}
                </Button>
              )}
            </NewWorkspaceMenu>
          </div>
        </header>

        <section data-tour="home-banner" className="mt-5 space-y-2">
          {calendarLoading || treeLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : resumable ? (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-accent/20 bg-gradient-to-r from-accent-soft via-card to-card px-4 py-3 dark:from-accent-soft/60">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                  {t("home.resumeSession")}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
                  {resumable.session.title}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {resumable.workspace.title} ·{" "}
                  {resumable.session.activities.filter((a) => a.status === "completed").length}
                  /{resumable.session.activities.length} ·{" "}
                  {formatDuration(resumable.session.durationMinutes)}
                </p>
                <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, heroProgress)}%` }}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  router.push(
                    `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                  )
                }
              >
                {t("home.resumeSession")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}

          {dueReview && dueReview.total > 0 && (
            <Link
              href="/flashcards/review"
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] hover:border-border-strong"
            >
              <RotateCcw className="h-3.5 w-3.5 text-accent" />
              <span className="font-medium">
                {t(dueReview.total === 1 ? "misc.cardDue" : "misc.cardsDue").replace(
                  "{count}",
                  String(dueReview.total),
                )}
              </span>
              <span className="text-muted-foreground">{t("misc.quickReviewBlurb")}</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-faint" />
            </Link>
          )}

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <HomeUploadRow />
          </div>
        </section>

        <div className="relative mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("misc.searchWorkspaces")}
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-ring"
          />
        </div>

        {filtered ? (
          <section className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              {t(filtered.length === 1 ? "misc.resultCount" : "misc.resultsCount").replace(
                "{count}",
                String(filtered.length),
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      setDeleting({ kind: "workspace", id: ws.id, name: ws.title }),
                  }}
                />
              ))}
            </div>
          </section>
        ) : treeLoading ? (
          <div className="mt-6">
            <CardGridSkeleton count={6} className="xl:grid-cols-4" />
          </div>
        ) : (
          <>
            {folders.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {t("misc.folders")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              </section>
            )}
            {rootWorkspaces.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {t("misc.workspaces")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                            icon: ws.icon,
                          }),
                        onMembers: () => setMembersFor(ws.id),
                        onDelete: () =>
                          setDeleting({ kind: "workspace", id: ws.id, name: ws.title }),
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
            {folders.length === 0 && rootWorkspaces.length === 0 && (
              <section className="mt-6 rounded-lg border border-dashed border-border px-4 py-6">
                <p className="text-sm font-medium">{t("misc.firstWinTitle")}</p>
                <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                  {t("misc.planBlurb")}
                </p>
                <div className="mt-3 flex gap-2">
                  <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                    {(toggle) => (
                      <Button size="sm" onClick={toggle}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("ws.newWorkspace")}
                      </Button>
                    )}
                  </NewWorkspaceMenu>
                </div>
              </section>
            )}
          </>
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
