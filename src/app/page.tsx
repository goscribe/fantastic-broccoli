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
import { StudyCalendar } from "@/components/workspace/study-calendar";
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
import { HeroScene, ConfettiDots } from "@/components/graphics/floating-decor";
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
      <Banner
        variant="accent"
        dismissKey="upgrade-promo"
        action={{ label: t("misc.upgradeNow"), href: "/pricing" }}
        className="rounded-none border-x-0 border-t-0 px-4 sm:px-8"
      >
        {t("misc.upgradeBanner")}
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

        {/* Hero */}
        <section
          data-tour="home-banner"
          className="relative z-10 grid gap-4 animate-fade-up lg:grid-cols-[1fr_250px]"
        >
          <div className="relative rounded-2xl border border-border bg-card p-7">
            {resumable ? (
              <HeroScene />
            ) : (
              <>
                <Image
                  src="/illustrations/welcome.png"
                  alt=""
                  width={220}
                  height={220}
                  priority
                  className="pointer-events-none absolute bottom-2 right-6 hidden w-44 select-none md:block lg:right-10 lg:w-52"
                />
                <ConfettiDots className="hidden md:block" />
              </>
            )}
            <div className="relative max-w-lg">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                {resumable
                  ? resumable.session.title
                  : t("misc.firstWinTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                {resumable
                  ? `${resumable.workspace.title} · ${formatDuration(resumable.session.durationMinutes)} · ${resumable.session.activities.filter((a) => a.status === "completed").length} of ${resumable.session.activities.length} activities complete`
                  : t("misc.planBlurb")}
              </p>
              {resumable ? (
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                      )
                    }
                    className="group inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
                  >
                    {t("home.resumeSession")}
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                    {(toggle) => (
                      <button
                        type="button"
                        onClick={toggle}
                        className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-card px-4 py-2 text-[13px] font-semibold hover:border-accent/50 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("nav.newWorkspace")}
                      </button>
                    )}
                  </NewWorkspaceMenu>
                </div>
              ) : (
                <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                  {(toggle) => (
                    <button
                      type="button"
                      onClick={toggle}
                      className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity sm:w-auto sm:py-2 sm:text-[13px]"
                    >
                      <Plus className="h-4 w-4" />
                      {t("nav.newWorkspace")}
                    </button>
                  )}
                </NewWorkspaceMenu>
              )}
            </div>
          </div>

          {/* Progress scene */}
          <div className="relative hidden overflow-hidden rounded-2xl border border-border bg-card p-5 lg:block">
            <ConfettiDots />
            <p className="relative text-3xl font-bold tabular-nums">
              {heroProgress}%
            </p>
            <p className="relative mt-0.5 text-[11px] font-semibold text-muted-foreground">
              {t("misc.progress")}
            </p>
            <Image
              src="/illustrations/journey.png"
              alt=""
              width={220}
              height={220}
              className="pointer-events-none absolute -bottom-3 -right-3 w-36 select-none"
            />
            <Image
              src="/illustrations/props/star-gold.png"
              alt=""
              width={60}
              height={60}
              className="pointer-events-none absolute right-4 top-4 w-7 rotate-12 select-none"
            />
          </div>
        </section>

        {dueReview && dueReview.total > 0 && (
          <Link
            href="/flashcards/review"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 animate-fade-up hover:border-accent/40 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <RotateCcw className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {t(
                    dueReview.total === 1 ? "misc.cardDue" : "misc.cardsDue",
                  ).replace("{count}", String(dueReview.total))}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {t("misc.quickReviewBlurb")}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
              {t("home.reviewNow")}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        )}

        {/* Study overview */}
        <section className="animate-fade-up">
          <h2 className="text-sm font-semibold mb-3">
            {t("misc.studyOverview")}
          </h2>
          {calendarLoading || treeLoading ? (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="hidden rounded-xl border border-border bg-card p-4 space-y-3 lg:block">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-40 w-full" />
              </div>
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="hidden flex-1 items-end gap-2.5 min-h-28 lg:flex">
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
            {/* The calendar and weekly chart are reference views, not actions:
                on phones they pushed the real content below the fold. */}
            <div className="hidden rounded-xl border border-border bg-card p-4 lg:block">
              <StudyCalendar dailyActivity={dailyActivity} />
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col">
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{t("misc.thisWeek")}</p>
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 py-1 pl-1.5 pr-3 dark:border-amber-400/25 dark:bg-amber-400/10">
                    <Image
                      src="/illustrations/icons/stat-flame.png"
                      alt=""
                      width={48}
                      height={48}
                      className="pointer-events-none h-6 w-6 shrink-0 select-none object-contain"
                    />
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span className="text-[15px] font-bold tabular-nums">
                        {streak}
                      </span>{" "}
                      {t("misc.dayStreak")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 hidden min-h-20 flex-1 items-end gap-2.5 lg:flex">
                  {lastSevenDays.map(({ label, count, isToday }, i) => (
                    <div
                      key={i}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                      title={t(
                        count === 1
                          ? "misc.sessionTooltip"
                          : "misc.sessionsTooltip",
                      ).replace("{count}", String(count))}
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
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-4">
                {[
                  {
                    label: t("misc.activeDays"),
                    value: String(
                      dailyActivity.filter((d) => d.count > 0).length,
                    ),
                    icon: "/illustrations/icons/stat-calendar.png",
                  },
                  {
                    label: t("misc.sessionsLogged"),
                    value: String(
                      dailyActivity.reduce((s, d) => s + d.count, 0),
                    ),
                    icon: "/illustrations/icons/stat-bolt.png",
                  },
                  {
                    label: t("misc.activePlans"),
                    value: String(activeSessions.length),
                    icon: "/illustrations/props/flag-mini.png",
                  },
                  {
                    label: t("misc.timePlanned"),
                    value: formatDuration(totalPlannedMinutes),
                    icon: "/illustrations/icons/stat-clock.png",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-2.5 py-2 leading-tight"
                  >
                    <Image
                      src={stat.icon}
                      alt=""
                      width={64}
                      height={64}
                      className="pointer-events-none h-6 w-6 shrink-0 select-none object-contain"
                    />
                    <div>
                      <p className="text-sm font-bold tabular-nums">
                        {stat.value}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </section>

        {/* Search */}
        <div className="relative max-w-md animate-fade-up">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("misc.searchWorkspaces")}
            className="w-full h-10 pl-11 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
          />
        </div>

        {/* Workspaces */}
        {filtered ? (
          <section>
            <p className="text-xs text-muted-foreground mb-4">
              {t(
                filtered.length === 1
                  ? "misc.resultCount"
                  : "misc.resultsCount",
              ).replace("{count}", String(filtered.length))}
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
                {t("misc.folders")}
              </h2>
              <button
                type="button"
                onClick={() => setCreating("folder")}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40 hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("misc.newFolder")}
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
            {/* Always offered: with only folders (or nothing) there was no
                visible way to create a workspace outside the sidebar. */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("misc.workspaces")}
                  </h2>
                  <NewWorkspaceMenu align="right" onSelect={openWorkspaceCreate}>
                    {(toggle) => (
                      <button
                        type="button"
                        onClick={toggle}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40 hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("nav.newWorkspace")}
                      </button>
                    )}
                  </NewWorkspaceMenu>
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
