"use client";

import { useState } from "react";
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

export default function AdminInvoicesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invoices", debouncedSearch, page],
    queryFn: () =>
      adminApi.listInvoices({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Subscription renewals and one-off top-ups charged through Stripe."
      />

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by user, invoice id, or Stripe id…"
        className="mb-4 max-w-md"
      />

      <Table headers={["User", "Type", "Plan", "Amount", "Status", "Date"]}>
        {isLoading ? (
          <TableSkeletonRows cols={6} />
        ) : !data?.items.length ? (
          <EmptyRow colSpan={6}>No invoices match this search.</EmptyRow>
        ) : (
          data.items.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-muted/40">
              <Td>{invoice.user?.email ?? invoice.user?.name ?? "—"}</Td>
              <Td className="text-muted-foreground">
                {invoice.type ?? "SUBSCRIPTION"}
              </Td>
              <Td className="text-muted-foreground">
                {invoice.subscription?.plan?.name ?? "—"}
              </Td>
              <Td className="tabular-nums font-medium">
                ${(invoice.amountPaid / 100).toFixed(2)}
              </Td>
              <Td>
                <Badge
                  variant={invoice.status === "paid" ? "success" : "muted"}
                >
                  {invoice.status}
                </Badge>
              </Td>
              <Td className="text-muted-foreground">
                {formatRelativeDate(invoice.createdAt)}
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
