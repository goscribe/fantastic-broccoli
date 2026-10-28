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
import {
  CreateResourceDialog,
  NewWorkspaceMenu,
} from "@/components/workspace/create-dialog";
import {
  DeleteResourceDialog,
  EditResourceDialog,
  ResourceActionsMenu,
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
  ArrowRight,
  Plus,
  RotateCcw,
  Flame,
  BookOpen,
  Clock,
  Folder as FolderIcon,
} from "lucide-react";
import { accentForId } from "@/lib/accent-palette";
import { cn } from "@/lib/utils";
import Link from "next/link";
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
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);

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
  const totalPlannedMinutes = activeSessions.reduce(
    (sum, { session }) => sum + session.durationMinutes,
    0,
  );

  const streak = useMemo(() => computeStreak(dailyActivity), [dailyActivity]);

  const withSessions = (w: Workspace): Workspace => ({
    ...w,
    sessions: sessionsByWorkspace.get(w.id) ?? w.sessions,
  });
  const visibleWorkspaces = (
    filtered
      ? filtered
      : selectedFolder
        ? flattenWorkspaces(selectedFolder.folders ?? [], selectedFolder.workspaces)
        : allWorkspaces
  ).map(withSessions);


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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-8 sm:py-6">
        <section
          data-tour="home-banner"
          className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-r from-accent-soft via-accent-soft/60 to-card px-5 py-5 sm:px-7 sm:py-6"
        >
          <div className="relative z-10 max-w-xl">
            <p className="text-[12px] font-medium text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
              {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
              <span className="flex items-center gap-1.5 rounded-full border border-energy/25 bg-card px-2.5 py-1 text-energy">
                <Flame className="h-3.5 w-3.5" fill="currentColor" />
                {streak} {t("misc.dayStreak")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-card px-2.5 py-1 text-accent">
                <BookOpen className="h-3.5 w-3.5" />
                {activeSessions.length} {t("misc.activePlans").toLowerCase()}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(totalPlannedMinutes)} {t("misc.timePlanned").toLowerCase()}
              </span>
              {dueReview && dueReview.total > 0 && (
                <Link
                  href="/flashcards/review"
                  className="flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-amber hover:bg-amber/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t(dueReview.total === 1 ? "misc.cardDue" : "misc.cardsDue").replace(
                    "{count}",
                    String(dueReview.total),
                  )}
                </Link>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
          <Image
            src="/illustrations/bot.png"
            alt=""
            width={240}
            height={240}
            priority
            className="pointer-events-none absolute -bottom-4 right-4 hidden h-36 w-36 select-none object-contain drop-shadow-xl sm:block md:right-10 md:h-44 md:w-44"
          />
        </section>

        {(calendarLoading || treeLoading) && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="hidden h-28 rounded-xl lg:block" />
          </div>
        )}

        {!treeLoading && activeSessions.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">
              {t("home.continue")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...activeSessions]
                .sort((a, b) => b.session.updatedAt.localeCompare(a.session.updatedAt))
                .slice(0, 3)
                .map(({ session, workspace }) => {
                  const hex = accentForId(workspace.id);
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
                      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 pl-5 text-left transition-shadow hover:shadow-md"
                      style={{ background: `${hex}12` }}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-1.5"
                        style={{ background: hex }}
                      />
                      <p className="truncate text-[12px] font-semibold" style={{ color: hex }}>
                        {workspace.title}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
                        {session.title}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.max(3, session.progress)}%`, background: hex }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {done}/{session.activities.length} ·{" "}
                          {formatDuration(session.durationMinutes)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {!treeLoading && (
          <section className="mt-6 overflow-hidden rounded-xl border border-dashed border-border-strong bg-card">
            <HomeUploadRow />
          </section>
        )}

        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-[15px] font-bold tracking-tight">
              {t("home.yourSubjects")}
            </h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("misc.searchWorkspaces")}
                className="h-9 w-56 rounded-full border border-transparent bg-muted pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-card"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCreating("folder")}>
              <Plus className="h-3.5 w-3.5" />
              {t("misc.newFolder")}
            </Button>
          </div>

          {!filtered && folders.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  selectedFolder === null
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t("home.all")}
              </button>
              {folders.map((folder) => {
                const hex = folder.color || accentForId(folder.id);
                const active = selectedFolder?.id === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolder(folder)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: active ? hex : hex }}
                    />
                    {folder.name}
                  </button>
                );
              })}
            </div>
          )}

          {selectedFolder && !filtered && (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <FolderIcon
                className="h-4 w-4"
                style={{ color: selectedFolder.color || accentForId(selectedFolder.id) }}
              />
              <span className="font-semibold">{selectedFolder.name}</span>
              <Link
                href={`/folder/${selectedFolder.id}`}
                className="text-accent hover:underline"
              >
                {t("home.openFolder")}
              </Link>
              <ResourceActionsMenu
                className="relative"
                actions={{
                  onRename: () =>
                    setEditing({
                      kind: "folder",
                      id: selectedFolder.id,
                      name: selectedFolder.name,
                      color: selectedFolder.color,
                    }),
                  onDelete: () =>
                    setDeleting({
                      kind: "folder",
                      id: selectedFolder.id,
                      name: selectedFolder.name,
                    }),
                }}
              />
            </div>
          )}

          {filtered && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t(filtered.length === 1 ? "misc.resultCount" : "misc.resultsCount").replace(
                "{count}",
                String(filtered.length),
              )}
            </p>
          )}

          {treeLoading ? (
            <div className="mt-4">
              <CardGridSkeleton count={6} className="xl:grid-cols-4" />
            </div>
          ) : visibleWorkspaces.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="mt-4 rounded-xl border border-dashed border-border-strong px-4 py-6">
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
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">
              {t("home.noSubjectsInFolder")}
            </p>
          )}
        </section>

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
