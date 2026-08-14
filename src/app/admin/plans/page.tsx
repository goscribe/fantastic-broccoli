"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/api/admin";
import {
  EmptyRow,
  PageHeader,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";

function formatStorage(bytes: number | bigint | null | undefined): string {
  if (!bytes) return "—";
  return `${(Number(bytes) / 1024 ** 3).toFixed(1)} GB`;
}

export default function AdminPlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: adminApi.listPlans,
  });

  return (
    <>
      <PageHeader
        title="Plans"
        description="Billing plans offered on the pricing page, with their storage and token allowances."
      />

      <Table
        headers={[
          "Plan",
          "Price",
          "Interval",
          "Tokens / month",
          "Storage",
          "State",
        ]}
      >
        {isLoading ? (
          <TableSkeletonRows cols={6} rows={4} />
        ) : !data?.length ? (
          <EmptyRow colSpan={6}>No plans configured.</EmptyRow>
        ) : (
          data.map((plan) => (
            <tr key={plan.id} className="hover:bg-muted/40">
              <Td>
                <p className="font-medium">{plan.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {plan.description ?? plan.type}
                </p>
              </Td>
              <Td className="tabular-nums font-medium">
                {plan.price === 0 ? "Free" : `$${(plan.price / 100).toFixed(2)}`}
              </Td>
              <Td className="text-muted-foreground">{plan.interval ?? "—"}</Td>
              <Td className="tabular-nums">{plan.monthlyTokens}</Td>
              <Td className="tabular-nums text-muted-foreground">
                {formatStorage(plan.limit?.maxStorageBytes)}
              </Td>
              <Td>
                {plan.active ? (
                  <Badge variant="success">active</Badge>
                ) : (
                  <Badge variant="muted">inactive</Badge>
                )}
              </Td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
