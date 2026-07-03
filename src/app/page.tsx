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
            <h1 className="text-xl font-bold tracking-tight">
              {greeting}, Alan 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {resumable
                ? "Pick up where you left off."
                : "Ready to start something new?"}
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <StreakFlame className="h-6 w-6" />
              <div className="leading-tight">
                <p className="font-bold tabular-nums">6 days</p>
                <p className="text-[11px] text-faint">Streak</p>
              </div>
            </div>
            <div className="leading-tight">
              <p className="font-bold tabular-nums">{activeSessions.length}</p>
              <p className="text-[11px] text-faint">Active sessions</p>
            </div>
            <div className="leading-tight">
              <p className="font-bold tabular-nums">
                {formatDuration(totalPlannedMinutes)}
              </p>
              <p className="text-[11px] text-faint">Planned</p>
            </div>
            <div className="leading-tight">
              <p className="font-bold tabular-nums">{allWorkspaces.length}</p>
              <p className="text-[11px] text-faint">Workspaces</p>
            </div>
          </div>
        </header>

        {/* Gradient banner */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 text-white animate-fade-up"
          style={{
            background:
              "linear-gradient(105deg, #46a302 0%, #58cc02 55%, #8ee53f 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                "radial-gradient(circle at 85% 10%, rgba(255,255,255,0.8) 0%, transparent 45%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-md">
              <p className="text-lg font-bold">
                {resumable ? "Keep it up!" : "Start a session"}
              </p>
              <p className="text-sm text-white/85 mt-1">
                {resumable
                  ? `“${resumable.session.title}” in ${resumable.workspace.title} is ${resumable.session.progress}% done — ${resumable.session.activities.filter((a) => a.status === "completed").length}/${resumable.session.activities.length} activities finished.`
                  : "Generate a study plan tuned to your syllabus and schedule."}
              </p>
              {resumable && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                    )
                  }
                  className="group mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#46a302] hover:bg-white/90 transition-colors"
                >
                  Resume session
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
            {resumable && (
              <div className="hidden sm:block w-56">
                <div className="flex items-center justify-between text-[11px] font-medium text-white/80 mb-1.5">
                  <span>Session progress</span>
                  <span className="tabular-nums">
                    {resumable.session.progress}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/25">
                  <div
                    className="h-2 rounded-full bg-white"
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
              <h2 className="text-sm font-semibold">Folders</h2>
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
