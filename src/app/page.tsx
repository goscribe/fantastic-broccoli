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
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Flag,
  Flame,
  Plus,
  RotateCcw,
  Search,
  Upload,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { ActivityIcon, IconTile } from "@/components/graphics/icon-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ACTIVITY_TYPE_LABELS } from "@/components/session/activity-item";
import "@/lib/i18n/workspace";
import "@/lib/i18n/session";
import { Banner } from "@/components/ui/banner";
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
      <main className="w-full flex-1 space-y-6 px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
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
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {greeting}{user ? `, ${user.name}` : ""}
            </h1>
          </div>
        </header>

        {/* Hero */}
        <section
          data-tour="home-banner"
          className="relative z-10 grid gap-4 animate-fade-up lg:grid-cols-[1fr_250px]"
        >
          <div className="relative grid gap-6 rounded-3xl bg-accent-soft p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative z-10 max-w-lg">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                {resumable ? t("ws.studyNow.pickUp") : t("misc.getStarted")}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-[1.75rem]">
                {resumable
                  ? resumable.session.title
                  : t("misc.firstWinTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {resumable
                  ? `${resumable.workspace.title} · ${formatDuration(resumable.session.durationMinutes)} · ${resumable.session.activities.filter((a) => a.status === "completed").length} of ${resumable.session.activities.length} activities complete`
                  : t("misc.planBlurb")}
              </p>
              {resumable ? (
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                      )
                    }
                    className="gap-2"
                  >
                    {t("home.resumeSession")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                    {(toggle) => (
                      <Button type="button" variant="outline" onClick={toggle} className="gap-2 bg-transparent">
                        <Plus className="h-3.5 w-3.5" />
                        {t("nav.newWorkspace")}
                      </Button>
                    )}
                  </NewWorkspaceMenu>
                </div>
              ) : (
                <NewWorkspaceMenu onSelect={openWorkspaceCreate}>
                  {(toggle) => (
                    <Button
                      type="button"
                      onClick={toggle}
                      className="mt-5 gap-2 w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      {t("nav.newWorkspace")}
                    </Button>
                  )}
                </NewWorkspaceMenu>
              )}
            </div>
            {resumable ? (
              <ul className="hidden w-64 space-y-1.5 md:block">
                {resumable.session.activities
                  .filter((a) => a.status !== "completed")
                  .slice(0, 3)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-[var(--shadow-card)]"
                    >
                      <ActivityIcon type={a.type} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(ACTIVITY_TYPE_LABELS[a.type] ?? "session.typeActivity")}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <ul className="hidden w-64 space-y-1.5 md:block">
                {[
                  { icon: Upload, tone: "purple" as const, label: t("ws.studyNow.uploadCta") },
                  { icon: Zap, tone: "amber" as const, label: t("ws.studyNow.quick5") },
                  { icon: RotateCcw, tone: "emerald" as const, label: t("home.reviewNow") },
                ].map((step, i) => (
                  <li
                    key={step.label}
                    className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-[var(--shadow-card)]"
                  >
                    <IconTile icon={step.icon} tone={step.tone} size="sm" />
                    <p className="truncate text-[13px] font-semibold">
                      <span className="mr-1.5 text-faint tabular-nums">{i + 1}.</span>
                      {step.label}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Progress ring */}
          <div className="hidden items-center gap-5 rounded-3xl border border-border bg-card p-5 lg:flex">
            <ProgressRing value={heroProgress} />
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none">
                {heroProgress}%
              </p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {t("misc.progress")}
              </p>
            </div>
          </div>
        </section>

        {dueReview && dueReview.total > 0 && (
          <Link
            href="/flashcards/review"
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors animate-fade-up hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
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

        {/* Stats + upload. Week bars stay on tablet/desktop so they never
            overlay a figure; phones skip the extra chart. */}
        <section className="animate-fade-up">
          {calendarLoading || treeLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  {
                    label: t("misc.dayStreak"),
                    value: String(streak),
                    icon: Flame,
                    tone: "amber" as const,
                    hideOnMobile: true,
                  },
                  {
                    label: t("misc.activeDays"),
                    value: String(
                      dailyActivity.filter((d) => d.count > 0).length,
                    ),
                    icon: CalendarDays,
                    tone: "sky" as const,
                    hideOnMobile: false,
                  },
                  {
                    label: t("misc.sessionsLogged"),
                    value: String(
                      dailyActivity.reduce((s, d) => s + d.count, 0),
                    ),
                    icon: Zap,
                    tone: "purple" as const,
                    hideOnMobile: false,
                  },
                  {
                    label: t("misc.activePlans"),
                    value: String(activeSessions.length),
                    icon: Flag,
                    tone: "pink" as const,
                    hideOnMobile: false,
                  },
                  {
                    label: t("misc.timePlanned"),
                    value: formatDuration(totalPlannedMinutes),
                    icon: Clock,
                    tone: "emerald" as const,
                    hideOnMobile: false,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`min-w-0 items-center gap-2.5 sm:gap-3 ${
                      stat.hideOnMobile ? "hidden sm:flex" : "flex"
                    }`}
                    title={stat.label}
                  >
                    <IconTile icon={stat.icon} tone={stat.tone} size="md" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold tabular-nums leading-none tracking-tight sm:text-xl">
                        {stat.value}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <HomeUploadRow />
              <div className="hidden border-t border-border px-4 py-3 sm:block">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {t("misc.thisWeek")}
                </p>
                <div className="mt-2 flex min-h-14 items-end gap-2">
                  {lastSevenDays.map(({ label, count, isToday }, i) => (
                    <div
                      key={i}
                      className="flex h-14 flex-1 flex-col items-center justify-end gap-1"
                      title={t(
                        count === 1
                          ? "misc.sessionTooltip"
                          : "misc.sessionsTooltip",
                      ).replace("{count}", String(count))}
                    >
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
                            count > 0
                              ? `${Math.max(12, (count / maxWeekCount) * 100)}%`
                              : "4px",
                        }}
                      />
                      <span
                        className={`text-[10px] ${
                          isToday
                            ? "font-semibold text-foreground"
                            : "text-faint"
                        }`}
                      >
                        {label}
                      </span>
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
