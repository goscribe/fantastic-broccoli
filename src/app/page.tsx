"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockWorkspaces, mockFolders } from "@/lib/mock-data";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { formatDuration } from "@/lib/utils";
import { StreakFlame } from "@/components/graphics/streak-flame";
import { FolderCard } from "@/components/workspace/folder-card";
import { Search, ArrowRight, Plus } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const allWorkspaces = mockWorkspaces;
  const folders = mockFolders;

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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 w-full px-8 py-8 space-y-8">
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
              {greeting}, Alan
            </h1>
          </div>
          <div className="flex items-center divide-x divide-border rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <StreakFlame className="h-6 w-6" />
              <div className="leading-tight">
                <p className="text-sm font-bold tabular-nums">6</p>
                <p className="text-[10px] font-semibold text-faint">
                  Day streak
                </p>
              </div>
            </div>
            <div className="px-4 py-2.5 leading-tight">
              <p className="text-sm font-bold tabular-nums">
                {activeSessions.length}
              </p>
              <p className="text-[10px] font-semibold text-faint">
                Sessions
              </p>
            </div>
            <div className="px-4 py-2.5 leading-tight">
              <p className="text-sm font-bold tabular-nums">
                {formatDuration(totalPlannedMinutes)}
              </p>
              <p className="text-[10px] font-semibold text-faint">
                Planned
              </p>
            </div>
            <div className="px-4 py-2.5 leading-tight">
              <p className="text-sm font-bold tabular-nums">
                {allWorkspaces.length}
              </p>
              <p className="text-[10px] font-semibold text-faint">
                Workspaces
              </p>
            </div>
          </div>
        </header>

        {/* Gradient banner */}
        <section className="relative overflow-hidden rounded-2xl bg-ink p-7 text-white animate-fade-up">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 120% at 90% 0%, rgba(111,212,32,0.28) 0%, transparent 60%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 40% 90% at 0% 100%, rgba(111,212,32,0.10) 0%, transparent 55%)",
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

        {/* Search */}
        <div className="relative max-w-md animate-fade-up">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="w-full h-10 pl-11 pr-4 rounded-xl border border-border bg-card text-sm shadow-soft focus:outline-none focus:border-accent/50 placeholder:text-faint"
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
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Folders
              </h2>
              <button
                type="button"
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
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
