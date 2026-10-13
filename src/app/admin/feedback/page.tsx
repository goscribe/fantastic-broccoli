"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyRow,
  PageHeader,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi, type FeedbackResponse } from "@/lib/api/admin";
import { CANCEL_REASONS } from "@/lib/api/feedback";
import { cn, formatRelativeDate } from "@/lib/utils";

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "GENERAL", label: "General" },
  { value: "CANCEL", label: "Cancelled" },
] as const;

const LABELS: Record<string, string> = {
  fix: "Fix next",
  useMore: "Use more",
  keep: "Would have kept",
  comeBack: "Bring back",
};

function reasonLabel(value: string | null) {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? value ?? "—";
}

function Answers({ row }: { row: FeedbackResponse }) {
  const entries = Object.entries(row.answers ?? {});
  if (entries.length === 0)
    return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <p key={k} className="text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {LABELS[k] ?? k}
          </span>
          <br />
          <span className="whitespace-pre-wrap">{v}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [kind, setKind] = useState<"GENERAL" | "CANCEL" | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "feedback", kind],
    queryFn: () => adminApi.listFeedback({ kind }),
  });

  const cancelCounts = (data?.counts ?? [])
    .filter((c) => c.kind === "CANCEL")
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader
        title="Feedback"
        description='Answers to the "what can we do better?" survey.'
        action={
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setKind(f.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium",
                  kind === f.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {cancelCounts.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cancelCounts.map((c) => (
            <span
              key={c.reason ?? "none"}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs"
            >
              {reasonLabel(c.reason)}{" "}
              <span className="font-semibold">{c.count}</span>
            </span>
          ))}
        </div>
      )}

      <Table headers={["User", "Kind", "Answers", "Reply?", "When"]}>
        {isLoading ? (
          <TableSkeletonRows rows={6} cols={5} />
        ) : !data || data.responses.length === 0 ? (
          <EmptyRow colSpan={5}>No answers yet.</EmptyRow>
        ) : (
          data.responses.map((row) => (
            <tr key={row.id} className="align-top">
              <Td>
                <span className="font-medium">{row.user.name ?? "—"}</span>
                <br />
                <a
                  href={`mailto:${row.user.email}`}
                  className="text-xs text-muted-foreground hover:text-accent"
                >
                  {row.user.email}
                </a>
              </Td>
              <Td>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    row.kind === "CANCEL"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {row.kind === "CANCEL" ? "Cancelled" : "General"}
                </span>
                {row.kind === "CANCEL" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reasonLabel(row.reason)}
                  </p>
                )}
              </Td>
              <Td>
                <Answers row={row} />
              </Td>
              <Td>{row.contactOk ? "Yes" : "No"}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {formatRelativeDate(row.createdAt)}
              </Td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
