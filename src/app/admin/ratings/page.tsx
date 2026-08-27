"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import {
  EmptyRow,
  PageHeader,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi, type RatingMonth } from "@/lib/api/admin";
import { cn, formatRelativeDate } from "@/lib/utils";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= value ? "fill-warning text-warning" : "text-border",
          )}
        />
      ))}
    </span>
  );
}

function MonthCard({ month }: { month: RatingMonth }) {
  const max = Math.max(...month.counts, 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{month.period}</p>
        <p className="text-xs text-muted-foreground">
          {month.total} response{month.total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-semibold">
          {month.average.toFixed(2)}
        </span>
        <Stars value={Math.round(month.average)} />
      </div>
      <div className="mt-3 space-y-1">
        {[5, 4, 3, 2, 1].map((stars) => (
          <div key={stars} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right text-muted-foreground">
              {stars}
            </span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-warning"
                style={{
                  width: `${(month.counts[stars - 1] / max) * 100}%`,
                }}
              />
            </div>
            <span className="w-6 text-muted-foreground">
              {month.counts[stars - 1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminRatingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ratings"],
    queryFn: () => adminApi.getRatingStats(),
  });

  return (
    <>
      <PageHeader
        title="Ratings"
        description="Monthly in-app star ratings (1–5 + optional comment). Users are prompted at most once per calendar month."
      />

      {isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : data && data.months.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.months.map((month) => (
            <MonthCard key={month.period} month={month} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          No ratings yet — the prompt goes out to accounts older than a week.
        </p>
      )}

      <h2 className="mb-2 text-sm font-semibold">Recent comments</h2>
      <Table headers={["Rating", "Comment", "User", "Month", "When"]}>
        {isLoading ? (
          <TableSkeletonRows cols={5} />
        ) : !data || data.comments.length === 0 ? (
          <EmptyRow colSpan={5}>No comments yet.</EmptyRow>
        ) : (
          data.comments.map((c) => (
            <tr key={c.id}>
              <Td>
                <Stars value={c.stars} />
              </Td>
              <Td>
                <p className="max-w-[420px] text-sm">{c.comment}</p>
              </Td>
              <Td className="text-xs">{c.user.email ?? c.user.name ?? "—"}</Td>
              <Td className="whitespace-nowrap text-xs text-muted-foreground">
                {c.period}
              </Td>
              <Td className="whitespace-nowrap text-xs text-muted-foreground">
                {formatRelativeDate(c.updatedAt)}
              </Td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
