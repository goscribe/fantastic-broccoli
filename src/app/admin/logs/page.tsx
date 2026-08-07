"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import {
  adminApi,
  type ActivityLogCategory,
  type ActivityLogStatus,
} from "@/lib/api/admin";
import { formatRelativeDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";
import { useDebounced } from "@/lib/use-debounced";

const PAGE_SIZE = 25;

const CATEGORIES: ActivityLogCategory[] = [
  "AUTH",
  "WORKSPACE",
  "BILLING",
  "ADMIN",
  "CONTENT",
  "SYSTEM",
];

export default function AdminLogsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ActivityLogCategory | "">("");
  const [status, setStatus] = useState<ActivityLogStatus | "">("");
  const [includeAdminActors, setIncludeAdminActors] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const filters = {
    search: debouncedSearch || undefined,
    category: category || undefined,
    status: status || undefined,
    includeAdminActors,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logs", filters, page],
    queryFn: () => adminApi.activityList({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const resetTo = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { csv, count } = await adminApi.activityExportCsv(filters);
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} rows`);
    } catch (err) {
      toastError(err, "Could not export the activity log");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Activity logs"
        description="User-facing activity across the platform. Admin accounts' own actions are hidden by default."
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={resetTo(setSearch)}
          placeholder="Search action, route, or error code…"
          className="max-w-sm"
        />
        <select
          value={category}
          onChange={(e) =>
            resetTo(setCategory)(e.target.value as ActivityLogCategory | "")
          }
          className="h-9 rounded-full border border-border bg-card px-3 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) =>
            resetTo(setStatus)(e.target.value as ActivityLogStatus | "")
          }
          className="h-9 rounded-full border border-border bg-card px-3 text-sm"
        >
          <option value="">Any outcome</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
        </select>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={includeAdminActors}
            onChange={(e) => resetTo(setIncludeAdminActors)(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Include admin accounts
        </label>
      </div>

      <Table headers={["When", "Actor", "Action", "Workspace", "Outcome"]}>
        {isLoading ? (
          <TableSkeletonRows cols={5} />
        ) : !data?.items.length ? (
          <EmptyRow colSpan={5}>No activity matches these filters.</EmptyRow>
        ) : (
          data.items.map((row) => (
            <tr key={row.id} className="hover:bg-muted/40">
              <Td className="whitespace-nowrap text-muted-foreground">
                {formatRelativeDate(row.createdAt)}
              </Td>
              <Td>
                {row.actor ? (
                  <span title={row.actor.id}>
                    {row.actor.email ?? row.actor.name ?? row.actor.id}
                  </span>
                ) : (
                  <span className="text-faint">system</span>
                )}
              </Td>
              <Td>
                <p className="font-medium">{row.description || row.action}</p>
                <p className="text-[12px] text-faint">
                  {row.category}
                  {row.trpcPath ? ` · ${row.trpcPath}` : ""}
                  {row.durationMs != null ? ` · ${row.durationMs}ms` : ""}
                </p>
              </Td>
              <Td className="text-muted-foreground">
                {row.workspace?.title ?? "—"}
              </Td>
              <Td>
                {row.status === "SUCCESS" ? (
                  <Badge variant="success">success</Badge>
                ) : (
                  <Badge variant="warning">
                    {row.errorCode ?? "failure"}
                  </Badge>
                )}
              </Td>
            </tr>
          ))
        )}
      </Table>

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
