"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import {
  EmptyRow,
  PageHeader,
  StatCard,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { formatRelativeDate } from "@/lib/utils";

function retentionPct(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${Math.round((part / whole) * 100)}%`;
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: adminApi.getSystemStats,
  });

  const { data: retention, isLoading: retentionLoading } = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => adminApi.getRetentionStats(),
  });

  const { data: workspaces, isLoading: workspacesLoading } = useQuery({
    queryKey: ["admin", "workspaces", "recent"],
    queryFn: () => adminApi.listWorkspaces({ limit: 8 }),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["admin", "invoices", "recent"],
    queryFn: () => adminApi.listRecentInvoices(5),
  });

  return (
    <>
      <PageHeader
        title="System overview"
        description="Platform health, recent workspaces, and revenue at a glance."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          loading={isLoading}
        />
        <StatCard
          label="Workspaces"
          value={(stats?.totalWorkspaces ?? 0).toLocaleString()}
          loading={isLoading}
        />
        <StatCard
          label="Active subscriptions"
          value={(stats?.totalSubscriptions ?? 0).toLocaleString()}
          loading={isLoading}
        />
        <StatCard
          label="Revenue"
          value={`$${(stats?.revenue ?? 0).toLocaleString()}`}
          hint={`$${(stats?.subscriptionRevenue ?? 0).toLocaleString()} subs · $${(
            stats?.topupRevenue ?? 0
          ).toLocaleString()} top-ups`}
          loading={isLoading}
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Retention</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Signups"
            value={(retention?.signups ?? 0).toLocaleString()}
            hint={retention ? `${retentionPct(retention.verified, retention.signups)} verified email` : undefined}
            loading={retentionLoading}
          />
          <StatCard
            label="Activated"
            value={retention ? retentionPct(retention.activated, retention.signups) : "—"}
            hint={retention ? `${retention.activated} generated 1+ artifact/session` : undefined}
            loading={retentionLoading}
          />
          <StatCard
            label="2+ generations"
            value={retention ? retentionPct(retention.multiGeneration, retention.signups) : "—"}
            hint={retention ? `${retention.multiGeneration} users` : undefined}
            loading={retentionLoading}
          />
          <StatCard
            label="Active 2+ days"
            value={retention ? retentionPct(retention.multiDayActive, retention.signups) : "—"}
            hint={retention ? `${retention.multiDayActive} users` : undefined}
            loading={retentionLoading}
          />
          <StatCard
            label="Generated 2+ days"
            value={retention ? retentionPct(retention.multiDayGenerated, retention.signups) : "—"}
            hint={retention ? `${retention.multiDayGenerated} users` : undefined}
            loading={retentionLoading}
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Newest workspaces</h2>
          <Link
            href="/admin/workspaces"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            Review all
          </Link>
        </div>
        <Table headers={["Workspace", "Owner", "Generated", "Created"]}>
          {workspacesLoading ? (
            <TableSkeletonRows cols={4} rows={5} />
          ) : !workspaces?.workspaces.length ? (
            <EmptyRow colSpan={4}>No workspaces yet.</EmptyRow>
          ) : (
            workspaces.workspaces.map((ws) => (
              <tr key={ws.id} className="hover:bg-muted/40">
                <Td>
                  <Link
                    href={`/admin/workspaces/${ws.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {ws.icon} {ws.title}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">
                  {ws.owner?.email ?? ws.owner?.name ?? "—"}
                </Td>
                <Td className="tabular-nums text-muted-foreground">
                  {ws._count.artifacts} artifacts · {ws._count.studySessions}{" "}
                  sessions
                </Td>
                <Td className="text-muted-foreground">
                  {formatRelativeDate(ws.createdAt)}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent purchases</h2>
          <Link
            href="/admin/invoices"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            All invoices
          </Link>
        </div>
        <Table headers={["User", "Type", "Amount", "Status", "Date"]}>
          {invoicesLoading ? (
            <TableSkeletonRows cols={5} rows={4} />
          ) : !invoices?.length ? (
            <EmptyRow colSpan={5}>No purchases yet.</EmptyRow>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/40">
                <Td>{invoice.user?.email ?? invoice.user?.name ?? "—"}</Td>
                <Td className="text-muted-foreground">
                  {invoice.type ?? "SUBSCRIPTION"}
                </Td>
                <Td className="tabular-nums font-medium">
                  ${(invoice.amountPaid / 100).toFixed(2)}
                </Td>
                <Td className="text-muted-foreground">{invoice.status}</Td>
                <Td className="text-muted-foreground">
                  {formatRelativeDate(invoice.createdAt)}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>
    </>
  );
}
