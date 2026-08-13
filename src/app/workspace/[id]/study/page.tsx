"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  createStudySession,
  deleteStudySession,
  fetchStudySessions,
  retryStudySession,
} from "@/lib/api/study";
import { fetchMasteryMatrix } from "@/lib/api/study-session";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { SessionCard } from "@/components/session/session-card";
import { SessionCreateWizard } from "@/components/session/session-create-wizard";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { Plus, Sparkles, ArrowRight } from "lucide-react";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceStudyPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["study-sessions", workspaceId],
    queryFn: () => fetchStudySessions(workspaceId),
  });
  const { data: masteryMatrix = [] } = useQuery({
    queryKey: ["mastery-matrix", workspaceId],
    queryFn: () => fetchMasteryMatrix(workspaceId),
  });
  const createSession = useMutation({
    mutationFn: createStudySession,
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ["study-sessions", workspaceId],
      });
      setShowCreateWizard(false);
      if (created) {
        router.push(`/workspace/${workspaceId}/session/${created.id}`);
      }
    },
  });

  const retrySession = useMutation({
    mutationFn: retryStudySession,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["study-sessions", workspaceId],
      });
    },
  });
  const deleteSession = useMutation({
    mutationFn: deleteStudySession,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["study-sessions", workspaceId],
      });
    },
  });

  const activeSessions = sessions.filter((s) => s.status === "active");
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const resumable =
    activeSessions.find((s) => s.progress > 0) ?? activeSessions[0];

  if (workspaceLoading || sessionsLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-8">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
            <ListRowsSkeleton count={3} className="gap-4" />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-8">
        {resumable && (
          <button
            type="button"
            onClick={() =>
              router.push(`/workspace/${workspaceId}/session/${resumable.id}`)
            }
            className="group w-full text-left rounded-3xl border border-accent/20 bg-gradient-to-br from-accent-soft via-card to-card p-6 hover:border-accent/40 transition-all animate-fade-up"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
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

        {masteryMatrix.length > 0 && (
          <section className="animate-fade-up">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Proficiency by topic
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {masteryMatrix.map((row) => {
                const p = row.proficiency;
                const tone =
                  p === null
                    ? "border-border bg-card"
                    : p < 40
                      ? "border-red-500/25 bg-red-500/5"
                      : p < 70
                        ? "border-amber-500/25 bg-amber-500/5"
                        : "border-emerald-500/25 bg-emerald-500/5";
                const barTone =
                  p === null
                    ? "bg-muted"
                    : p < 40
                      ? "bg-red-500"
                      : p < 70
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                return (
                  <div
                    key={row.topic}
                    className={`rounded-xl border p-3.5 ${tone}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12px] font-medium truncate">
                        {row.topic}
                      </p>
                      <span className="text-sm font-bold tabular-nums shrink-0">
                        {p === null ? "—" : `${p}%`}
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-muted">
                      <div
                        className={`h-1.5 rounded-full ${barTone}`}
                        style={{ width: `${p ?? 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {row.cardsStudied} of {row.cardsTotal} cards studied
                      {row.attempts > 0 ? ` · ${row.attempts} attempts` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Study sessions
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateWizard(true)}
              data-tour="new-session"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New session
            </Button>
          </div>

          {!workspace || sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6">
              <Sparkles className="h-7 w-7 text-accent mx-auto mb-3" />
              <p className="text-sm font-semibold">
                {workspace?.sharedBy
                  ? "Your sessions are private"
                  : "No sessions yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-sm mx-auto">
                {workspace?.sharedBy
                  ? `Materials in this workspace are shared by ${workspace.sharedBy}, but study sessions stay personal — create your own plan from them.`
                  : "Tell Scribe what you're studying and it will build a plan with readings, quizzes, and comprehension checks."}
              </p>
              <Button size="sm" onClick={() => setShowCreateWizard(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Create first session
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions
                .filter((s) => s.status !== "completed")
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={(id) =>
                      router.push(`/workspace/${workspaceId}/session/${id}`)
                    }
                    onRetry={(id) => retrySession.mutate(id)}
                    onDelete={(id) => deleteSession.mutate(id)}
                    retrying={
                      retrySession.isPending &&
                      retrySession.variables === session.id
                    }
                    deleting={
                      deleteSession.isPending &&
                      deleteSession.variables === session.id
                    }
                  />
                ))}
            </div>
          )}
        </section>

        {completedSessions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-4">
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
          hasMaterials={(workspace.materials ?? []).some((m) => m.analyzed)}
          creating={createSession.isPending}
          onClose={() => setShowCreateWizard(false)}
          onCreate={(config) =>
            createSession.mutate({
              workspaceId,
              title: config.title,
              description: config.description || undefined,
              depth: config.depth,
              durationMinutes: config.durationMinutes,
              examBoard: config.examBoard || undefined,
              syllabus: config.syllabus || undefined,
              topics: config.topics || undefined,
              subject: config.subject || undefined,
            })
          }
        />
      )}
    </WorkspaceShell>
  );
}
