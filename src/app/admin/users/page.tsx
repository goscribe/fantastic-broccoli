"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/api/admin";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { formatRelativeDate } from "@/lib/utils";
import { useDebounced } from "@/lib/use-debounced";

const PAGE_SIZE = 20;
type VerifiedFilter = "all" | "yes" | "no";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", debouncedSearch, verified, page],
    queryFn: () =>
      adminApi.listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        emailVerified: verified,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone using Scribe. Admin accounts are excluded from this list."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, email, or user id…"
          className="max-w-md"
        />
        <select
          value={verified}
          onChange={(e) => {
            setVerified(e.target.value as VerifiedFilter);
            setPage(1);
          }}
          className="h-9 rounded-full border border-border bg-card px-3 text-sm"
        >
          <option value="all">All accounts</option>
          <option value="yes">Verified</option>
          <option value="no">Unverified</option>
        </select>
      </div>

      <Table headers={["User", "Verified", "Plan", "Joined", ""]}>
        {isLoading ? (
          <TableSkeletonRows cols={5} />
        ) : !data?.users.length ? (
          <EmptyRow colSpan={5}>No users match this search.</EmptyRow>
        ) : (
          data.users.map((user) => {
            const subscription = user.subscriptions?.[0];
            return (
              <tr key={user.id} className="hover:bg-muted/40">
                <Td>
                  <p className="font-medium">{user.name ?? "—"}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {user.email ?? "—"}
                  </p>
                </Td>
                <Td>
                  {user.emailVerified ? (
                    <Badge variant="success">verified</Badge>
                  ) : (
                    <Badge variant="muted">pending</Badge>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {subscription?.plan?.name ?? "Free"}
                </Td>
                <Td className="text-muted-foreground">
                  {formatRelativeDate(user.createdAt)}
                </Td>
                <Td>
                  <Link
                    href={`/admin/workspaces?q=${encodeURIComponent(user.email ?? user.id)}`}
                    className="text-[13px] text-accent hover:underline"
                  >
                    Workspaces
                  </Link>
                </Td>
              </tr>
            );
          })
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
