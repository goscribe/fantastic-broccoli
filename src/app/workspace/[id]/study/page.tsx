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
import Link from "next/link";
import { fetchMasteryMatrix, studySessionApi } from "@/lib/api/study-session";
import { BankDocThumb, kindConfig } from "@/components/bank/bank-content";
import { MasteryRadar } from "@/components/graphics/mastery-radar";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { MaterialsSection } from "@/components/workspace/materials-section";
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
  const { data: bankItems = [] } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
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
            className="group w-full text-left rounded-3xl border border-border bg-card p-6 hover:border-border-strong transition-all animate-fade-up"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Continue studying
                </span>
                <h2 className="text-lg font-bold tracking-tight mt-1">
                  {resumable.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {resumable.progress}% complete ·{" "}
                  {formatDuration(resumable.durationMinutes)}
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white group-hover:opacity-90 transition-opacity shrink-0">
                Resume
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <ProgressBar value={resumable.progress} className="mt-4" />
          </button>
        )}

        <MaterialsSection
          workspaceId={workspaceId}
          materials={workspace?.materials ?? []}
        />

        {bankItems.length > 0 && (
          <section className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Artifacts
              </h2>
              <Link
                href={`/workspace/${workspaceId}/bank`}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View all {bankItems.length}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {bankItems.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/workspace/${workspaceId}/bank/${item.id}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
                >
                  <BankDocThumb
                    kind={item.kind}
                    content={item.content}
                    className="aspect-square w-full rounded-none border-0 border-b border-border"
                  />
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-[13px] font-semibold leading-tight group-hover:text-accent transition-colors">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      {kindConfig[item.kind].label}
                      {item.topic ? ` · ${item.topic}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {masteryMatrix.length > 0 && (
          <section className="animate-fade-up">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Proficiency by topic
            </h2>
            <div className="rounded-3xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-8">
              <MasteryRadar data={masteryMatrix} />
              <div className="flex-1 w-full space-y-2.5">
                {masteryMatrix.slice(0, 8).map((row) => {
                  const p = row.proficiency;
                  const dotTone =
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
                      className="flex items-center gap-3"
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${dotTone}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">
                          {row.topic}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {row.cardsStudied} of {row.cardsTotal} items studied
                          {row.cardsTotal > 0
                            ? ` (${Math.round(
                                (row.cardsStudied / row.cardsTotal) * 100,
                              )}%)`
                            : ""}
                          {row.attempts > 0
                            ? ` · ${row.attempts} attempts`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0">
                        {p === null ? "—" : `${p}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
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
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold">
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
