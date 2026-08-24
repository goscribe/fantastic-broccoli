"use client";

import { MathText } from "@/components/ui/markdown-text";
import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { Plus, Sparkles, ArrowRight } from "lucide-react";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { ConfettiDots, EmptyScene } from "@/components/graphics/floating-decor";
import Image from "next/image";

export default function WorkspaceStudyPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const workspaceId = params.id as string;
  // ?create=1 opens the session wizard directly (e.g. from the chat sidebar).
  const [showCreateWizard, setShowCreateWizard] = useState(
    searchParams.get("create") === "1",
  );

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
      <div className="space-y-6 sm:space-y-8">
        {resumable && (
          <button
            type="button"
            onClick={() =>
              router.push(`/workspace/${workspaceId}/session/${resumable.id}`)
            }
            className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all animate-fade-up hover:border-border-strong hover:shadow-md sm:rounded-3xl sm:p-6"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-24 hidden w-40 select-none sm:block"
              aria-hidden
            >
              <Image
                src="/illustrations/flag.png"
                alt=""
                width={200}
                height={200}
                unoptimized
                className="absolute -bottom-4 right-0 w-32 animate-bob"
              />
              <ConfettiDots />
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <h2 className="text-base font-bold tracking-tight sm:text-lg">
                {resumable.title}
              </h2>
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-all group-hover:gap-2.5">
                {t("ws.resume")}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="relative text-sm text-muted-foreground mt-0.5">
              {resumable.progress}% {t("ws.complete")} ·{" "}
              {formatDuration(resumable.durationMinutes)} ·{" "}
              <span className="font-semibold text-accent">
                {t(
                  resumable.progress >= 75
                    ? "ws.cheerNearlyDone"
                    : resumable.progress >= 25
                      ? "ws.cheerGoodPace"
                      : "ws.cheerJustStarted",
                )}
              </span>
            </p>
            <ProgressBar value={resumable.progress} className="relative mt-3.5 sm:max-w-md" />
          </button>
        )}

        <MaterialsSection
          workspaceId={workspaceId}
          materials={workspace?.materials ?? []}
        />

        {bankItems.length > 0 && (
          <section className="animate-fade-up">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
                {t("ws.artifacts")}
              </h2>
              <Link
                href={`/workspace/${workspaceId}/bank`}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                {t("ws.viewAll")} {bankItems.length}
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
                      <MathText text={item.title} />
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
          <section className="hidden animate-fade-up sm:block">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              {t("ws.proficiencyByTopic")}
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
                          {t("ws.itemsStudied")
                            .replace("{done}", String(row.cardsStudied))
                            .replace("{total}", String(row.cardsTotal))}
                          {row.cardsTotal > 0
                            ? ` (${Math.round(
                                (row.cardsStudied / row.cardsTotal) * 100,
                              )}%)`
                            : ""}
                          {row.attempts > 0
                            ? ` · ${row.attempts} ${t("ws.attempts")}`
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
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
              {t("ws.studySessions")}
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setShowCreateWizard(true)}
              data-tour="new-session"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("ws.newSession")}
            </Button>
          </div>

          {!workspace || sessions.length === 0 ? (
            <EmptyScene image="/illustrations/flag.png">
              <p className="text-base font-semibold">
                {workspace?.sharedBy
                  ? t("ws.sessionsPrivate")
                  : t("ws.noSessions")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 mb-5">
                {workspace?.sharedBy
                  ? t("ws.sessionsPrivateHint").replace(
                      "{name}",
                      workspace.sharedBy,
                    )
                  : t("ws.noSessionsHint")}
              </p>
              <Button size="sm" onClick={() => setShowCreateWizard(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {t("ws.createFirstSession")}
              </Button>
            </EmptyScene>
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
              {t("ws.completedSection")}
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
