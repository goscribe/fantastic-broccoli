"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type ClientSegmentRow } from "@/lib/api/admin";
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

function windowCell(w: { eligible: number; retained: number }): string {
  return w.eligible === 0
    ? "—"
    : `${retentionPct(w.retained, w.eligible)} (${w.retained}/${w.eligible})`;
}

function ClientSegmentTable({
  title,
  rows,
  totalUsers,
  totalCalls,
  loading,
}: {
  title: string;
  rows: ClientSegmentRow[] | undefined;
  totalUsers: number;
  totalCalls: number;
  loading: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">
        {title}
      </h3>
      <Table headers={[title, "Users", "Calls", "Errors"]}>
        {loading ? (
          <TableSkeletonRows cols={4} rows={3} />
        ) : !rows?.length ? (
          <EmptyRow colSpan={4}>No traffic recorded.</EmptyRow>
        ) : (
          rows.map((row) => (
            <tr key={row.label} className="hover:bg-muted/40">
              <Td>
                <span className="font-medium">{row.label}</span>
              </Td>
              <Td className="tabular-nums">
                {row.users} ({retentionPct(row.users, totalUsers)})
              </Td>
              <Td className="tabular-nums text-muted-foreground">
                {row.calls.toLocaleString()} ({retentionPct(row.calls, totalCalls)})
              </Td>
              <Td className="tabular-nums text-muted-foreground">
                {row.errorRate.toFixed(2)}%
              </Td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
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

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: () => adminApi.getClientStats(),
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
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
        </div>
        <Table headers={["Channel", "Signups", "Activated", "D1", "D3", "D7"]}>
          {retentionLoading ? (
            <TableSkeletonRows cols={6} rows={4} />
          ) : !retention?.channels.length ? (
            <EmptyRow colSpan={6}>No signups yet.</EmptyRow>
          ) : (
            retention.channels.map((row) => (
              <tr key={row.channel} className="hover:bg-muted/40">
                <Td>
                  <span className="font-medium">{row.channel}</span>
                </Td>
                <Td>{row.signups}</Td>
                <Td>{retentionPct(row.activated, row.signups)}</Td>
                <Td>{windowCell(row.d1)}</Td>
                <Td>{windowCell(row.d3)}</Td>
                <Td>{windowCell(row.d7)}</Td>
              </tr>
            ))
          )}
        </Table>
        <p className="mt-2 text-[12px] text-muted-foreground">
          D1/D3/D7 count only users signed up at least that many full days ago
          (eligible cohort); retained = any activity on or after that day.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Devices &amp; browsers</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          Last 30 days of real user traffic (admins excluded):{" "}
          {(clients?.totalUsers ?? 0).toLocaleString()} users ·{" "}
          {(clients?.totalCalls ?? 0).toLocaleString()} API calls. Users are
          counted in every segment they appear in, so columns can exceed 100%.
        </p>
        <div className="grid gap-6 lg:grid-cols-3">
          <ClientSegmentTable
            title="Device"
            rows={clients?.devices}
            totalUsers={clients?.totalUsers ?? 0}
            totalCalls={clients?.totalCalls ?? 0}
            loading={clientsLoading}
          />
          <ClientSegmentTable
            title="OS"
            rows={clients?.operatingSystems}
            totalUsers={clients?.totalUsers ?? 0}
            totalCalls={clients?.totalCalls ?? 0}
            loading={clientsLoading}
          />
          <ClientSegmentTable
            title="Browser"
            rows={clients?.browsers}
            totalUsers={clients?.totalUsers ?? 0}
            totalCalls={clients?.totalCalls ?? 0}
            loading={clientsLoading}
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
