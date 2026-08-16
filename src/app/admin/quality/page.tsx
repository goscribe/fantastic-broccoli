"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyRow,
  PageHeader,
  StatCard,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi, type QualityAssessment } from "@/lib/api/admin";
import { formatRelativeDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";

const SINCE_OPTIONS = [7, 30, 90] as const;

function scoreTone(score: number) {
  if (score >= 7) return "text-emerald-600";
  if (score >= 4) return "text-amber-600";
  return "text-red-600";
}

function ScoreCell({ score }: { score: number }) {
  return (
    <span className={`font-semibold tabular-nums ${scoreTone(score)}`}>
      {score}/10
    </span>
  );
}

export default function AdminQualityPage() {
  const queryClient = useQueryClient();
  const [sinceDays, setSinceDays] = useState<number>(30);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin", "quality", "summary", sinceDays],
    queryFn: () => adminApi.qualitySummary(sinceDays),
    placeholderData: keepPreviousData,
  });

  const { data: assessments, isLoading } = useQuery({
    queryKey: ["admin", "quality", "list"],
    queryFn: () => adminApi.listQualityAssessments({ limit: 100 }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "quality"] });

  const batchAssess = useMutation({
    mutationFn: () => adminApi.assessRecentWorkspaces({ limit: 10 }),
    onSuccess: (result) => {
      const failed = result.results.filter((r) => r.error).length;
      toast.success(
        `Assessed ${result.assessed} workspace${result.assessed === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}`,
      );
      invalidate();
    },
    onError: (err) => toastError(err, "Batch assessment failed"),
  });

  const reassess = useMutation({
    mutationFn: (workspaceId: string) =>
      adminApi.assessWorkspaceQuality(workspaceId),
    onSuccess: (assessment) => {
      toast.success(
        `Re-assessed: fit ${assessment.materialFitScore}/10, quality ${assessment.generationQualityScore}/10`,
      );
      invalidate();
    },
    onError: (err) => toastError(err, "Assessment failed"),
  });

  const flagEntries = Object.entries(summary?.flagCounts ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <PageHeader
        title="Generation quality"
        description="AI-graded material fit and generation quality per workspace. Batch runs skip workspaces assessed in the last 7 days."
        action={
          <Button
            size="sm"
            onClick={() => batchAssess.mutate()}
            disabled={batchAssess.isPending}
          >
            {batchAssess.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Assess recent workspaces
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {SINCE_OPTIONS.map((days) => (
          <Button
            key={days}
            variant={sinceDays === days ? "primary" : "outline"}
            size="sm"
            onClick={() => setSinceDays(days)}
          >
            Last {days} days
          </Button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Workspaces assessed"
          value={summary?.workspaceCount ?? "—"}
          loading={summaryLoading}
        />
        <StatCard
          label="Avg material fit"
          value={summary?.avgMaterialFit != null ? `${summary.avgMaterialFit}/10` : "—"}
          loading={summaryLoading}
        />
        <StatCard
          label="Avg generation quality"
          value={
            summary?.avgGenerationQuality != null
              ? `${summary.avgGenerationQuality}/10`
              : "—"
          }
          loading={summaryLoading}
        />
        <StatCard
          label="Low quality (≤3)"
          value={summary?.lowQualityCount ?? "—"}
          loading={summaryLoading}
        />
      </div>

      {flagEntries.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {flagEntries.map(([kind, count]) => (
            <Badge key={kind} variant="muted">
              {kind} · {count}
            </Badge>
          ))}
        </div>
      )}

      <Table
        headers={[
          "Workspace",
          "Fit",
          "Quality",
          "Flags",
          "Model",
          "Last activity",
          "Assessed",
          "",
        ]}
      >
        {isLoading ? (
          <TableSkeletonRows cols={8} />
        ) : !assessments || assessments.length === 0 ? (
          <EmptyRow colSpan={8}>
            No assessments yet — run &ldquo;Assess recent workspaces&rdquo; to grade
            the latest generated content.
          </EmptyRow>
        ) : (
          assessments.map((assessment: QualityAssessment) => (
            <AssessmentRow
              key={assessment.id}
              assessment={assessment}
              expanded={expanded === assessment.id}
              onToggle={() =>
                setExpanded(expanded === assessment.id ? null : assessment.id)
              }
              onReassess={() => reassess.mutate(assessment.workspaceId)}
              reassessing={
                reassess.isPending && reassess.variables === assessment.workspaceId
              }
            />
          ))
        )}
      </Table>
    </>
  );
}

function AssessmentRow({
  assessment,
  expanded,
  onToggle,
  onReassess,
  reassessing,
}: {
  assessment: QualityAssessment;
  expanded: boolean;
  onToggle: () => void;
  onReassess: () => void;
  reassessing: boolean;
}) {
  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-muted/40"
        onClick={onToggle}
      >
        <Td>
          <Link
            href={`/admin/workspaces/${assessment.workspaceId}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {assessment.workspace?.title ?? assessment.workspaceId}
          </Link>
        </Td>
        <Td>
          <ScoreCell score={assessment.materialFitScore} />
        </Td>
        <Td>
          <ScoreCell score={assessment.generationQualityScore} />
        </Td>
        <Td>
          <div className="flex max-w-[280px] flex-wrap gap-1">
            {assessment.flags.length === 0 ? (
              <span className="text-xs text-muted-foreground">none</span>
            ) : (
              assessment.flags.slice(0, 4).map((flag, i) => (
                <Badge key={i} variant="warning" title={flag.detail}>
                  {flag.kind}
                </Badge>
              ))
            )}
            {assessment.flags.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{assessment.flags.length - 4}
              </span>
            )}
          </div>
        </Td>
        <Td className="text-xs text-muted-foreground">{assessment.model}</Td>
        <Td className="whitespace-nowrap text-xs text-muted-foreground">
          {assessment.workspace?.updatedAt
            ? formatRelativeDate(assessment.workspace.updatedAt)
            : "—"}
        </Td>
        <Td className="whitespace-nowrap text-xs text-muted-foreground">
          {formatRelativeDate(assessment.createdAt)}
        </Td>
        <Td>
          <Button
            variant="outline"
            size="sm"
            disabled={reassessing}
            onClick={(e) => {
              e.stopPropagation();
              onReassess();
            }}
          >
            {reassessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Re-assess"
            )}
          </Button>
        </Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-muted/30 px-4 py-3">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Material fit notes
                </p>
                <p className="text-muted-foreground">
                  {assessment.materialFitNotes || "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Generation quality notes
                </p>
                <p className="text-muted-foreground">
                  {assessment.generationQualityNotes || "—"}
                </p>
              </div>
            </div>
            {assessment.flags.length > 0 && (
              <div className="mt-3 space-y-1">
                {assessment.flags.map((flag, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <Badge variant="warning" className="mr-1.5">
                      {flag.kind}
                    </Badge>
                    {flag.detail}
                  </p>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
