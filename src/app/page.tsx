"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockWorkspaces, mockFolders } from "@/lib/mock-data";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Copilot, CopilotTrigger } from "@/components/ai/copilot";
import { formatDuration } from "@/lib/utils";
import { Search, Flame, Clock, Zap, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [copilotOpen, setCopilotOpen] = useState(false);

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
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-10 space-y-10">
        {/* Hero */}
        <header className="animate-fade-up">
          <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Scribe
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
            {greeting}.
            <br />
            <span className="text-muted-foreground">Ready to study?</span>
          </h1>

          {/* Stat chips */}
          <div className="flex items-center gap-2.5 mt-6 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium">
              <Flame className="h-3.5 w-3.5 text-amber" />
              6-day streak
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium">
              <Zap className="h-3.5 w-3.5 text-accent" />
              {activeSessions.length} active session
              {activeSessions.length !== 1 ? "s" : ""}
            </span>
            {totalPlannedMinutes > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium">
                <Clock className="h-3.5 w-3.5 text-sky" />
                {formatDuration(totalPlannedMinutes)} planned
              </span>
            )}
          </div>
        </header>

        {/* Jump back in */}
        {resumable && !filtered && (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/workspace/${resumable.workspace.id}/session/${resumable.session.id}`,
              )
            }
            className="group w-full text-left rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-card p-6 hover:border-accent/50 transition-all animate-fade-up"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                Jump back in
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground bg-accent rounded-full px-3.5 py-1.5 group-hover:gap-2.5 transition-all">
                Resume
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {resumable.session.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {resumable.workspace.title} ·{" "}
              {formatDuration(resumable.session.durationMinutes)} ·{" "}
              {resumable.session.activities.filter((a) => a.status === "completed").length}
              /{resumable.session.activities.length} activities done
            </p>
            <ProgressBar
              value={resumable.session.progress}
              className="mt-4"
              showLabel
            />
          </button>
        )}

        {/* Search */}
        <div className="relative animate-fade-up">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="w-full h-11 pl-11 pr-4 rounded-full border border-border bg-card text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
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
          folders.map((folder) => (
            <section key={folder.id} className="animate-fade-up">
              <div className="flex items-baseline gap-2.5 mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {folder.name}
                </h2>
                <span className="text-xs text-faint">
                  {folder.workspaces.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {folder.workspaces.map((ws) => (
                  <WorkspaceCard
                    key={ws.id}
                    workspace={ws}
                    onClick={(id) => router.push(`/workspace/${id}`)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <CopilotTrigger onClick={() => setCopilotOpen(true)} />
      <Copilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
