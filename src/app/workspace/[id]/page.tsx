"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getWorkspace } from "@/lib/mock-data";
import { SessionCard } from "@/components/session/session-card";
import { SessionCreateWizard } from "@/components/session/session-create-wizard";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Copilot, CopilotTrigger } from "@/components/ai/copilot";
import { formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Clock,
  Sparkles,
  BookOpen,
  FlaskConical,
  Dna,
  Sigma,
  ArrowRight,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  flask: FlaskConical,
  dna: Dna,
  sigma: Sigma,
  default: BookOpen,
};

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const workspace = getWorkspace(workspaceId);

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mt-2"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const Icon = iconMap[workspace.icon] || iconMap.default;
  const activeSessions = workspace.sessions.filter((s) => s.status === "active");
  const completedSessions = workspace.sessions.filter(
    (s) => s.status === "completed",
  );
  const totalMinutes = activeSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const resumable = activeSessions.find((s) => s.progress > 0) ?? activeSessions[0];

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-8 space-y-8">
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground animate-fade-up"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspaces
        </button>

        {/* Hero */}
        <header className="animate-fade-up">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border shrink-0"
              style={{
                backgroundColor: workspace.color + "14",
                borderColor: workspace.color + "30",
              }}
            >
              <Icon className="h-7 w-7" style={{ color: workspace.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                {workspace.title}
              </h1>
              {workspace.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {workspace.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {activeSessions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 text-accent px-3.5 py-1.5 text-xs font-semibold">
                {activeSessions.length} active
              </span>
            )}
            {totalMinutes > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(totalMinutes)} planned
              </span>
            )}
          </div>

          {workspace.totalProgress > 0 && (
            <ProgressBar
              value={workspace.totalProgress}
              className="mt-5"
              showLabel
            />
          )}
        </header>

        {/* Continue studying */}
        {resumable && (
          <button
            type="button"
            onClick={() =>
              router.push(`/workspace/${workspaceId}/session/${resumable.id}`)
            }
            className="group w-full text-left rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-card p-6 hover:border-accent/50 transition-all animate-fade-up"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Continue studying
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground bg-accent rounded-full px-3.5 py-1.5 group-hover:gap-2.5 transition-all">
                Resume
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              {resumable.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {resumable.progress}% complete ·{" "}
              {formatDuration(resumable.durationMinutes)}
            </p>
            <ProgressBar value={resumable.progress} className="mt-3.5" />
          </button>
        )}

        {/* Sessions */}
        <section className="animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Study sessions
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateWizard(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New session
            </Button>
          </div>

          {workspace.sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-strong text-center py-14 px-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-4">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <p className="text-sm font-semibold">No sessions yet</p>
              <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-sm mx-auto">
                Tell Scribe what you&apos;re studying and it will build a plan
                with readings, quizzes, and comprehension checks.
              </p>
              <Button size="sm" onClick={() => setShowCreateWizard(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Create first session
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {workspace.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={(id) =>
                    router.push(`/workspace/${workspaceId}/session/${id}`)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Completed */}
        {completedSessions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
              Completed
            </h2>
            <div className="grid gap-4 opacity-60">
              {completedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={(id) =>
                    router.push(`/workspace/${workspaceId}/session/${id}`)
                  }
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {showCreateWizard && (
        <SessionCreateWizard
          workspaceTitle={workspace.title}
          onClose={() => setShowCreateWizard(false)}
          onCreate={() => {
            setShowCreateWizard(false);
          }}
        />
      )}

      <CopilotTrigger onClick={() => setCopilotOpen(true)} />
      <Copilot
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={`Workspace: ${workspace.title}`}
      />
    </div>
  );
}
