"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyRow,
  PageHeader,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi, type FrustrationFlag } from "@/lib/api/admin";
import { formatRelativeDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";

function severityBadge(severity: number) {
  if (severity >= 3)
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-600">severe</Badge>
    );
  if (severity === 2) return <Badge variant="warning">frustrated</Badge>;
  return <Badge variant="muted">mild</Badge>;
}

export default function AdminFrustrationPage() {
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "frustration", showResolved],
    queryFn: () =>
      adminApi.listFrustrationFlags(
        showResolved ? { limit: 200 } : { resolved: false, limit: 200 },
      ),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "frustration"] });

  const scan = useMutation({
    mutationFn: () => adminApi.scanFrustration({ sinceDays: 7 }),
    onSuccess: (result) => {
      toast.success(
        `Scanned ${result.scanned} messages — ${result.flagged} new flag${result.flagged === 1 ? "" : "s"}`,
      );
      invalidate();
    },
    onError: (err) => toastError(err, "Scan failed"),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; resolved: boolean }) =>
      adminApi.setFrustrationFlagResolved(input),
    onSuccess: () => invalidate(),
    onError: (err) => toastError(err, "Update failed"),
  });

  const categoryEntries = Object.entries(data?.openByCategory ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <PageHeader
        title="Frustration flags"
        description="AI-flagged user frustration in workspace chat. A scan also runs automatically every day."
        action={
          <Button size="sm" onClick={() => scan.mutate()} disabled={scan.isPending}>
            {scan.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radar className="mr-1.5 h-3.5 w-3.5" />
            )}
            Scan last 7 days
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant={showResolved ? "outline" : "primary"}
          size="sm"
          onClick={() => setShowResolved(false)}
        >
          Open
        </Button>
        <Button
          variant={showResolved ? "primary" : "outline"}
          size="sm"
          onClick={() => setShowResolved(true)}
        >
          All
        </Button>
        {categoryEntries.map(([category, count]) => (
          <Badge key={category} variant="muted">
            {category} · {count}
          </Badge>
        ))}
      </div>

      <Table
        headers={["Severity", "Category", "User", "Workspace", "What happened", "When", ""]}
      >
        {isLoading ? (
          <TableSkeletonRows cols={7} />
        ) : !data || data.flags.length === 0 ? (
          <EmptyRow colSpan={7}>
            No frustration flags — run a scan or wait for the daily sweep.
          </EmptyRow>
        ) : (
          data.flags.map((flag: FrustrationFlag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              onResolve={(resolved) => resolve.mutate({ id: flag.id, resolved })}
              resolving={resolve.isPending && resolve.variables?.id === flag.id}
            />
          ))
        )}
      </Table>
    </>
  );
}

function FlagRow({
  flag,
  onResolve,
  resolving,
}: {
  flag: FrustrationFlag;
  onResolve: (resolved: boolean) => void;
  resolving: boolean;
}) {
  return (
    <tr className={flag.resolved ? "opacity-60" : undefined}>
      <Td>{severityBadge(flag.severity)}</Td>
      <Td className="whitespace-nowrap text-xs text-muted-foreground">
        {flag.category}
      </Td>
      <Td className="text-xs">{flag.user.email ?? flag.user.name ?? flag.userId}</Td>
      <Td>
        <Link
          href={`/admin/workspaces/${flag.workspaceId}`}
          className="font-medium hover:underline"
        >
          {flag.workspace?.title ?? flag.workspaceId}
        </Link>
      </Td>
      <Td>
        <p className="text-sm">{flag.summary}</p>
        <p className="mt-0.5 max-w-[420px] truncate text-xs text-muted-foreground">
          &ldquo;{flag.excerpt}&rdquo;
        </p>
      </Td>
      <Td className="whitespace-nowrap text-xs text-muted-foreground">
        {formatRelativeDate(flag.messageAt)}
      </Td>
      <Td>
        <Button
          variant="outline"
          size="sm"
          disabled={resolving}
          onClick={() => onResolve(!flag.resolved)}
        >
          {resolving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : flag.resolved ? (
            "Reopen"
          ) : (
            "Resolve"
          )}
        </Button>
      </Td>
    </tr>
  );
}
