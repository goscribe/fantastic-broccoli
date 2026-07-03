"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getWorkspace } from "@/lib/mock-data";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { SessionCard } from "@/components/session/session-card";
import { SessionCreateWizard } from "@/components/session/session-create-wizard";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { Plus, Sparkles, ArrowRight } from "lucide-react";

export default function WorkspaceStudyPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const workspace = getWorkspace(workspaceId);
  const activeSessions =
    workspace?.sessions.filter((s) => s.status === "active") ?? [];
  const completedSessions =
    workspace?.sessions.filter((s) => s.status === "completed") ?? [];
  const resumable =
    activeSessions.find((s) => s.progress > 0) ?? activeSessions[0];

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-8">
        {resumable && (
          <button
            type="button"
            onClick={() =>
              router.push(`/workspace/${workspaceId}/session/${resumable.id}`)
            }
            className="group w-full text-left rounded-3xl border border-accent/20 bg-gradient-to-br from-accent-soft via-card to-card p-6 shadow-soft hover:shadow-soft-lg hover:border-accent/40 transition-all animate-fade-up"
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

          {!workspace || workspace.sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft border border-accent/15 mb-4">
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
              {workspace.sessions
                .filter((s) => s.status !== "completed")
                .map((session) => (
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
      </div>

      {showCreateWizard && workspace && (
        <SessionCreateWizard
          workspaceTitle={workspace.title}
          onClose={() => setShowCreateWizard(false)}
          onCreate={() => {
            setShowCreateWizard(false);
          }}
        />
      )}
    </WorkspaceShell>
  );
}
