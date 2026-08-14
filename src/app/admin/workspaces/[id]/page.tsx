"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownText } from "@/components/ui/markdown-text";
import {
  EmptyRow,
  IncludeAdminsToggle,
  JsonBlock,
  PageHeader,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi } from "@/lib/api/admin";
import { bankPreviewNode } from "@/components/bank/bank-content";
import type { ApiArtifactKind } from "@/lib/api/study-session";
import { formatRelativeDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function ArtifactPreview({ artifactId }: { artifactId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "artifact", artifactId],
    queryFn: () => adminApi.getArtifactContent(artifactId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="p-4 text-sm text-rose">
        Could not load this artifact&apos;s content.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {data.latestVersion?.content && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Latest version (v{data.latestVersion.version})
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3">
            <MarkdownText text={data.latestVersion.content} />
          </div>
        </div>
      )}

      {data.flashcards.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Flashcards ({data.flashcards.length})
          </p>
          <ul className="space-y-1.5">
            {data.flashcards.map((card) => (
              <li
                key={card.id}
                className="rounded-lg border border-border bg-card p-2.5 text-[13px]"
              >
                <p className="font-medium">{card.front}</p>
                <p className="text-muted-foreground">{card.back}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.questions.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Questions ({data.questions.length})
          </p>
          <ul className="space-y-1.5">
            {data.questions.map((question) => (
              <li
                key={question.id}
                className="rounded-lg border border-border bg-card p-2.5 text-[13px]"
              >
                <p className="font-medium">{question.prompt}</p>
                {question.answer && (
                  <p className="text-muted-foreground">
                    Answer: {question.answer}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-faint">
                  {question.type} · {question.difficulty}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.podcastSegments.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Podcast segments ({data.podcastSegments.length})
          </p>
          <ul className="space-y-1.5">
            {data.podcastSegments.map((segment) => (
              <li
                key={segment.id}
                className="rounded-lg border border-border bg-card p-2.5 text-[13px]"
              >
                <p className="font-medium">{segment.title}</p>
                <p className="text-muted-foreground">{segment.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.content != null && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Bank content
          </p>
          {data.kind && typeof data.content === "object" && (
            <div className="mb-2 max-h-96 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
              {bankPreviewNode(
                data.kind as ApiArtifactKind,
                data.content as Record<string, unknown>,
              ) ?? (
                <p className="text-xs text-faint">No preview available.</p>
              )}
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-[12px] text-accent">
              Raw payload
            </summary>
            <div className="mt-2">
              <JsonBlock value={data.content} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SessionPreview({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "session", sessionId],
    queryFn: () => adminApi.getStudySessionContent(sessionId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="p-4 text-sm text-rose">Could not load this session.</p>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {data.activities.map((activity) => (
        <div
          key={activity.id}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium">
              {activity.order + 1}. {activity.title}
            </p>
            <Badge variant="muted">{activity.type}</Badge>
          </div>
          {activity.description && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {activity.description}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-accent">
              Generated payload
            </summary>
            <div className="mt-2">
              <JsonBlock value={activity.content} />
            </div>
          </details>
        </div>
      ))}
      {data.activities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This session has no generated activities.
        </p>
      )}
    </div>
  );
}

export default function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [openArtifact, setOpenArtifact] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [includeAdminGenerated, setIncludeAdminGenerated] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "workspace", id, includeAdminGenerated],
    queryFn: () => adminApi.getWorkspaceContent(id, includeAdminGenerated),
  });

  const archive = useMutation({
    mutationFn: ({
      artifactId,
      isArchived,
    }: {
      artifactId: string;
      isArchived: boolean;
    }) => adminApi.setArtifactArchived(artifactId, isArchived),
    onSuccess: (result) => {
      toast.success(
        result.isArchived
          ? "Artifact hidden from learners"
          : "Artifact restored",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "workspace", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "artifact"] });
    },
    onError: (err) => toastError(err, "Could not update the artifact"),
  });

  if (error) {
    return (
      <p className="text-sm text-rose">
        Could not load this workspace: {(error as Error).message}
      </p>
    );
  }

  return (
    <>
      <Link
        href="/admin/workspaces"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All workspaces
      </Link>

      <PageHeader
        title={
          isLoading ? "Loading…" : `${data?.icon ?? ""} ${data?.title ?? ""}`
        }
        description={
          data
            ? `Owned by ${data.owner.email ?? data.owner.name ?? "unknown"} · created ${formatRelativeDate(data.createdAt)}`
            : undefined
        }
        action={
          <IncludeAdminsToggle
            checked={includeAdminGenerated}
            onChange={setIncludeAdminGenerated}
            label="Include admin-generated content"
          />
        }
      />

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Uploads {data ? `(${data.uploads.length})` : ""}
        </h2>
        <Table headers={["File", "Type", "Size", "Analysis", "Uploaded"]}>
          {isLoading ? (
            <TableSkeletonRows cols={5} rows={3} />
          ) : !data?.uploads.length ? (
            <EmptyRow colSpan={5}>No uploads in this workspace.</EmptyRow>
          ) : (
            data.uploads.map((file) => (
              <tr key={file.id}>
                <Td className="font-medium">{file.name}</Td>
                <Td className="text-muted-foreground">{file.mimeType}</Td>
                <Td className="tabular-nums text-muted-foreground">
                  {formatBytes(file.size)}
                </Td>
                <Td>
                  <Badge
                    variant={
                      file.analysisStatus === "ANALYZED"
                        ? "success"
                        : file.analysisStatus === "FAILED"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {file.analysisStatus}
                  </Badge>
                  {file.analysisError && (
                    <span className="ml-2 text-[11px] text-rose">
                      {file.analysisError}
                    </span>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {formatRelativeDate(file.createdAt)}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Generated content {data ? `(${data.artifacts.length})` : ""}
        </h2>
        <div className="space-y-2">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {data?.artifacts.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nothing has been generated in this workspace yet.
            </p>
          )}
          {data?.artifacts.map((artifact) => {
            const open = openArtifact === artifact.id;
            return (
              <div
                key={artifact.id}
                className="rounded-xl border border-border bg-card"
              >
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenArtifact(open ? null : artifact.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium">
                      {artifact.title}
                      {artifact.isArchived && (
                        <span className="ml-2 text-[11px] text-faint">
                          hidden
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {artifact.type}
                      {artifact.kind ? ` · ${artifact.kind}` : ""} ·{" "}
                      {artifact._count.flashcards} cards ·{" "}
                      {artifact._count.questions} questions ·{" "}
                      {artifact._count.podcastSegments} segments · used{" "}
                      {artifact.usedCount}× · updated{" "}
                      {formatRelativeDate(artifact.updatedAt)}
                    </p>
                  </button>
                  {artifact.generating && (
                    <Badge variant="warning">generating</Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={archive.isPending}
                    onClick={() =>
                      archive.mutate({
                        artifactId: artifact.id,
                        isArchived: !artifact.isArchived,
                      })
                    }
                  >
                    {artifact.isArchived ? (
                      <>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Restore
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
                      </>
                    )}
                  </Button>
                </div>
                {open && (
                  <div className="border-t border-border">
                    <ArtifactPreview artifactId={artifact.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Study sessions {data ? `(${data.studySessions.length})` : ""}
        </h2>
        <div className="space-y-2">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {data?.studySessions.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No study sessions planned in this workspace.
            </p>
          )}
          {data?.studySessions.map((session) => {
            const open = openSession === session.id;
            return (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => setOpenSession(open ? null : session.id)}
                  className="w-full p-4 text-left"
                >
                  <p className="font-medium">{session.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {session.user.email ?? session.user.name} · {session.status}{" "}
                    · {session.depth} · {session._count.activities} activities ·{" "}
                    {session.progress}% · {formatRelativeDate(session.createdAt)}
                  </p>
                </button>
                {open && (
                  <div className="border-t border-border">
                    <SessionPreview sessionId={session.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
