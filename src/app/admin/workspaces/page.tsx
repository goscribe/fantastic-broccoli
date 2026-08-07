"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api/admin";
import {
  EmptyRow,
  PageHeader,
  SearchInput,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { formatRelativeDate } from "@/lib/utils";
import { useDebounced } from "@/lib/use-debounced";

const PAGE_SIZE = 25;

export default function AdminWorkspacesPage() {
  return (
    <Suspense fallback={null}>
      <WorkspacesTable />
    </Suspense>
  );
}

function WorkspacesTable() {
  const initialSearch = useSearchParams().get("q") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounced(search, 300);
  // Cursor stack so "Prev" can walk back through the cursor-paginated list.
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "workspaces", debouncedSearch, cursor],
    queryFn: () =>
      adminApi.listWorkspaces({
        limit: PAGE_SIZE,
        cursor,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const resetPaging = (value: string) => {
    setSearch(value);
    setCursors([null]);
  };

  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Every workspace on the platform. Open one to review its uploads and generated content."
      />

      <SearchInput
        value={search}
        onChange={resetPaging}
        placeholder="Search by title, owner email, or workspace id…"
        className="mb-4 max-w-md"
      />

      <Table
        headers={[
          "Workspace",
          "Owner",
          "Uploads",
          "Artifacts",
          "Sessions",
          "Created",
        ]}
      >
        {isLoading ? (
          <TableSkeletonRows cols={6} />
        ) : !data?.workspaces.length ? (
          <EmptyRow colSpan={6}>No workspaces match this search.</EmptyRow>
        ) : (
          data.workspaces.map((ws) => (
            <tr key={ws.id} className="hover:bg-muted/40">
              <Td>
                <Link
                  href={`/admin/workspaces/${ws.id}`}
                  className="font-medium hover:text-accent"
                >
                  {ws.icon} {ws.title}
                </Link>
                {ws.fileBeingAnalyzed && (
                  <span className="ml-2 text-[11px] text-warning">
                    analyzing
                  </span>
                )}
              </Td>
              <Td className="text-muted-foreground">
                {ws.owner?.email ?? ws.owner?.name ?? "—"}
              </Td>
              <Td className="tabular-nums">{ws._count.uploads}</Td>
              <Td className="tabular-nums">{ws._count.artifacts}</Td>
              <Td className="tabular-nums">{ws._count.studySessions}</Td>
              <Td className="text-muted-foreground">
                {formatRelativeDate(ws.createdAt)}
              </Td>
            </tr>
          ))
        )}
      </Table>

      <div className="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
        <span className="tabular-nums">
          {(data?.totalCount ?? 0).toLocaleString()} workspaces
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cursors.length === 1 || isFetching}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.nextCursor || isFetching}
            onClick={() =>
              setCursors((c) => [...c, data?.nextCursor ?? null])
            }
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
