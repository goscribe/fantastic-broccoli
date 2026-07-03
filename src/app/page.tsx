"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockWorkspaces, mockFolders } from "@/lib/mock-data";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { formatDuration } from "@/lib/utils";
import { StreakFlame } from "@/components/graphics/streak-flame";
import { Search, Clock, Zap, ArrowRight, FolderOpen, Plus, BookOpen } from "lucide-react";

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
      <main className="flex-1 w-full max-w-6xl px-8 py-8 space-y-8">
        {/* Hero banner */}
        <header className="relative overflow-hidden rounded-3xl bg-[#211f33] text-white p-8 animate-fade-up">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-30"
            style={{
              background:
                "radial-gradient(circle, #7c5cfc 0%, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute right-40 -bottom-28 h-64 w-64 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, #58cc02 0%, transparent 70%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b7a8ff]">
                {greeting}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-[1.15] mt-2">
                {resumable
                  ? `Keep going, Alan — “${resumable.session.title}” is ${resumable.session.progress}% done`
                  : "Ready to study, Alan?"}
              </h1>
              <p className="text-sm text-white/60 mt-2">
                {resumable
                  ? `${resumable.workspace.title} · ${formatDuration(resumable.session.durationMinutes)} · ${resumable.session.activities.filter((a) => a.status === "completed").length}/${resumable.session.activities.length} activities done`
                  : "Pick up where you left off, or start something new."}
              </p>
              {resumable && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
                    )
                  }
                  className="group mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-dim transition-colors"
                >
                  Resume session
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 backdrop-blur px-5 py-4">
              <StreakFlame className="h-10 w-10" />
              <div>
                <p className="text-lg font-bold leading-tight tabular-nums">
                  6-day streak
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[true, true, true, false, false, false, false].map(
                    (done, i) => (
                      <span
                        key={i}
                        className={
                          done
                            ? "h-2 w-2 rounded-full bg-gradient-to-b from-[#ffb020] to-[#f4442e]"
                            : "h-2 w-2 rounded-full bg-white/25"
                        }
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
          <div className="rounded-2xl bg-accent-soft p-5">
            <Zap className="h-5 w-5 text-accent" />
            <p className="text-2xl font-bold tabular-nums mt-3">
              {activeSessions.length}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Active sessions
            </p>
          </div>
          <div className="rounded-2xl bg-energy-soft p-5">
            <Clock className="h-5 w-5 text-[#3d8c02]" />
            <p className="text-2xl font-bold tabular-nums mt-3">
              {formatDuration(totalPlannedMinutes)}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Study time planned
            </p>
          </div>
          <div className="rounded-2xl bg-[#fff4e0] p-5">
            <BookOpen className="h-5 w-5 text-[#d97706]" />
            <p className="text-2xl font-bold tabular-nums mt-3">
              {allWorkspaces.length}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Workspaces
            </p>
          </div>
          <div className="rounded-2xl bg-[#e5f6fd] p-5">
            <FolderOpen className="h-5 w-5 text-[#0284c7]" />
            <p className="text-2xl font-bold tabular-nums mt-3">
              {folders.length}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Folders
            </p>
          </div>
        </div>

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
            <div className="grid sm:grid-cols-2 gap-4">
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
          <div className="space-y-5">
            {folders.map((folder) => (
              <section
                key={folder.id}
                className="rounded-2xl border border-border bg-card shadow-soft animate-fade-up"
              >
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                  <FolderOpen
                    className="h-4.5 w-4.5"
                    style={{ color: folder.color }}
                  />
                  <h2 className="font-semibold text-sm">{folder.name}</h2>
                  <span className="text-xs text-faint">
                    {folder.workspaces.length} workspace
                    {folder.workspaces.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New workspace
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                  {folder.workspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      onClick={(id) => router.push(`/workspace/${id}`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
