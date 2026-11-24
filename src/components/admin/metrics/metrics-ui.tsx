"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminMetricsApi,
  METRIC_DAYS,
  type MetricChange,
  type MetricDays,
  type MetricUserList,
} from "@/lib/api/admin-metrics";
import { changeTone, formatChange, formatMetric, type MetricUnit } from "@/lib/admin-metrics";
import { formatRelativeDate, cn } from "@/lib/utils";

export const TONE_TEXT = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
} as const;

export const TH = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-faint";
export const TD = "px-3 py-2 align-top tabular-nums";

export function RangePicker({ days, onChange, busy }: { days: MetricDays; onChange: (d: MetricDays) => void; busy?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className={cn("flex rounded-full border border-border bg-card p-0.5 transition-opacity", busy && "opacity-60")}
    >
      {METRIC_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === days}
          onClick={() => onChange(d)}
          className={cn(
            "h-8 rounded-full px-3 text-[13px] font-semibold tabular-nums",
            d === days ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

export function ChangeText({ change, better = "up", className }: { change: MetricChange; better?: "up" | "down"; className?: string }) {
  const tone = changeTone(change, better);
  if (!change || !tone) return null;
  return <span className={cn("whitespace-nowrap text-[12px] font-semibold tabular-nums", TONE_TEXT[tone], className)}>{formatChange(change)}</span>;
}

/** One number with its change against the previous period and a plain definition under it. */
export function MetricTile({
  label,
  value,
  previous,
  change,
  unit = "count",
  better = "up",
  definition,
  note,
  onOpen,
}: {
  label: string;
  value: number | null | undefined;
  previous?: number | null;
  change?: MetricChange;
  unit?: MetricUnit;
  better?: "up" | "down";
  definition: string;
  note?: string | null;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-bold tabular-nums">{formatMetric(value, unit)}</span>
        <ChangeText change={change ?? null} better={better} />
      </div>
      {previous !== undefined && (
        <p className="text-[11px] text-faint">{previous === null ? "no earlier data" : `${formatMetric(previous, unit)} before`}</p>
      )}
      <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{definition}</p>
      {note && <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">{note}</p>}
    </>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-stretch justify-start rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent"
      title="Show the users"
    >
      {body}
    </button>
  ) : (
    <div className="rounded-xl border border-border bg-card p-3">{body}</div>
  );
}

export function Section({
  id,
  n,
  title,
  description,
  error,
  loading,
  children,
}: {
  id: string;
  n: number;
  title: string;
  description: string;
  error?: unknown;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-faint tabular-nums">{n}.</span>
        {title}
      </h2>
      <p className="mb-3 text-[13px] text-muted-foreground">{description}</p>
      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Could not load: {(error as Error).message}
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-6 w-16" />
              <Skeleton className="mt-3 h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function Card({ title, note, children, className }: { title?: string; note?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-[13px] font-semibold">{title}</p>
          {note && <p className="text-[11px] text-faint">{note}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/** A horizontal bar in the accent colour, width 0–100. */
export function Bar({ width, muted }: { width: number; muted?: boolean }) {
  return (
    <div className="h-2 w-full min-w-[60px] rounded-full bg-muted">
      <div className={cn("h-2 rounded-full", muted ? "bg-border-strong" : "bg-accent")} style={{ width: `${Math.max(width, width > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

// ── User lists behind a number ─────────────────────────────────────────

type UserListRequest = { list: MetricUserList; key: string; missed?: boolean; title: string };
const UsersContext = createContext<{ open: (r: UserListRequest) => void; days: MetricDays }>({ open: () => {}, days: 30 });

export function useUserList() {
  return useContext(UsersContext);
}

export function UserListProvider({ days, children }: { days: MetricDays; children: React.ReactNode }) {
  const [request, setRequest] = useState<UserListRequest | null>(null);
  return (
    <UsersContext.Provider value={{ open: setRequest, days }}>
      {children}
      {request && <UsersPanel request={request} days={days} onClose={() => setRequest(null)} />}
    </UsersContext.Provider>
  );
}

function UsersPanel({ request, days, onClose }: { request: UserListRequest; days: MetricDays; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "metrics", "users", request.list, request.key, request.missed ?? false, days],
    queryFn: () => adminMetricsApi.users({ list: request.list, key: request.key, missed: request.missed, days }),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={request.title}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold">{request.title}</p>
            <p className="text-[12px] text-muted-foreground">Newest first, up to 100. Last {days} days. Admin console only.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-muted-foreground">Could not load: {(error as Error).message}</p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data?.users.length ? (
          <p className="text-sm text-muted-foreground">Nobody.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.users.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <Link href={`/admin/users/${u.id}`} className="truncate font-medium hover:text-accent">
                  {u.email ?? u.name ?? u.id}
                </Link>
                <span className="shrink-0 text-[12px] text-faint">joined {formatRelativeDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
