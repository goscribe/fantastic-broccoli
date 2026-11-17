"use client";

import { use, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CreditCard,
  FolderOpen,
  Frown,
  Layers,
  MessageCircle,
  PencilLine,
  Sparkles,
  Star,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard } from "@/components/admin/admin-ui";
import {
  adminApi,
  type JourneyEvent,
  type JourneyKind,
  type JourneyVisit,
  type UserTimeline,
} from "@/lib/api/admin";
import { formatDuration, humanizeTag } from "@/lib/admin-insights";
import { cn, formatRelativeDate } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

const KIND_ICON: Record<JourneyKind, LucideIcon> = {
  account: UserRound,
  subject: FolderOpen,
  upload: Upload,
  session: BookOpen,
  practice: PencilLine,
  flashcards: Layers,
  copilot: MessageCircle,
  planner: CalendarDays,
  generate: Sparkles,
  billing: CreditCard,
  feedback: Star,
  frustration: Frown,
  error: AlertTriangle,
};

const day = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const shortDate = (d: Date) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const time = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function EventRow({ event }: { event: JourneyEvent }) {
  const Icon = KIND_ICON[event.kind] ?? Sparkles;
  const isError = event.kind === "error";
  const items = event.items.map((i) =>
    event.kind === "frustration" || event.kind === "feedback" ? humanizeTag(i) : i,
  );
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className="w-16 shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-faint">
        {time(event.at)}
      </span>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          isError
            ? "bg-warning/10 text-warning"
            : event.milestone
              ? "bg-accent-soft text-accent"
              : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 text-sm">
        <p className={cn(event.milestone && "font-medium")}>
          {event.text}
          {event.workspace && (
            <>
              {" in "}
              <Link
                href={`/admin/workspaces/${event.workspace.id}`}
                className="text-accent hover:underline"
              >
                {event.workspace.title}
              </Link>
            </>
          )}
        </p>
        {items.length > 0 && (
          <p className="truncate text-[12px] text-muted-foreground">
            {items.slice(0, 4).join(" · ")}
            {items.length > 4 ? ` · +${items.length - 4} more` : ""}
          </p>
        )}
        {event.error && (
          <p className="text-[12px] text-muted-foreground">
            While: {event.error.action}
            {event.error.code ? ` · ${event.error.code}` : ""}
            {event.error.message ? ` · ${event.error.message}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}

function VisitCard({ visit }: { visit: JourneyVisit }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold">
          {day(visit.startedAt)}
          <span className="ml-2 font-normal text-muted-foreground">
            {visit.offline
              ? `${time(visit.startedAt)} · while away from the site`
              : `${time(visit.startedAt)} – ${time(visit.endedAt)}`}
          </span>
        </p>
        {!visit.offline && (
          <p className="text-[12px] text-muted-foreground">
            On the site for at least {formatDuration(visit.durationSeconds)}
            {visit.device ? ` · ${visit.device}` : ""}
          </p>
        )}
      </div>
      {visit.events.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Browsed without doing anything we record as an action (
          {visit.requests} background request{visit.requests === 1 ? "" : "s"}).
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visit.events.map((event, i) => (
            <EventRow key={`${event.at.getTime()}-${i}`} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Totals({ totals }: { totals: UserTimeline["totals"] }) {
  const rows: Array<[string, string]> = [
    ["Subjects", totals.subjects.toLocaleString()],
    ["Files uploaded", totals.uploads.toLocaleString()],
    [
      "Study sessions",
      `${totals.sessionsStarted.toLocaleString()} started · ${totals.sessionsFinished.toLocaleString()} finished`,
    ],
    ["Activities completed", totals.activitiesCompleted.toLocaleString()],
    ["Flashcard reviews", totals.flashcardReviews.toLocaleString()],
    ["Copilot messages", totals.copilotMessages.toLocaleString()],
    ["Planner messages", totals.plannerMessages.toLocaleString()],
    ["Total paid", `$${(totals.totalSpentCents / 100).toFixed(2)}`],
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
        All time
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Milestones({ milestones }: { milestones: UserTimeline["milestones"] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
        First times
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {milestones.map((m) => (
          <div key={m.key} className="flex justify-between gap-3">
            <dt className={cn(!m.at && "text-muted-foreground")}>{m.label}</dt>
            <dd
              className={cn("text-right tabular-nums", !m.at && "text-faint")}
              title={
                m.at && m.approximate
                  ? "Date the session was started; finish times are not stored"
                  : undefined
              }
            >
              {m.at ? shortDate(m.at) : "Not yet"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function AdminUserActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [days, setDays] = useState<number>(30);
  /** End of the window; undefined = up to now. */
  const [before, setBefore] = useState<Date | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "user-timeline", id, days, before?.getTime() ?? null],
    queryFn: () => adminApi.getUserTimeline({ userId: id, days, before }),
    placeholderData: keepPreviousData,
  });

  const user = data?.user;
  const visits = data ? [...data.visits].reverse() : [];

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Users
      </Link>

      <PageHeader
        title={user ? (user.name ?? user.email ?? "User") : "User activity"}
        description={
          user
            ? `${user.email ?? "No email"} · joined ${shortDate(user.createdAt)}${
                user.source ? ` via ${user.source}` : ""
              } · ${
                user.lastActiveAt
                  ? `last active ${formatRelativeDate(user.lastActiveAt).toLowerCase()}`
                  : "no activity on record"
              }`
            : undefined
        }
        action={
          user ? (
            <Link
              href={`/admin/workspaces?q=${encodeURIComponent(user.email ?? user.id)}`}
              className="text-[13px] text-accent hover:underline"
            >
              Their workspaces
            </Link>
          ) : undefined
        }
      />

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {`This user’s activity could not be loaded: ${(error as Error).message}`}
        </div>
      ) : (
        <>
          {user && (
            <div className="-mt-2 mb-5 flex flex-wrap gap-1.5">
              <Badge variant={user.emailVerified ? "success" : "muted"}>
                {user.emailVerified ? "email verified" : "email not verified"}
              </Badge>
              <Badge variant={user.plan ? "accent" : "muted"}>
                {user.plan ? `${user.plan.name} · ${user.plan.status}` : "Free"}
              </Badge>
              {user.plan?.cancelAt && (
                <Badge variant="warning">
                  cancels {shortDate(user.plan.cancelAt)}
                </Badge>
              )}
              {user.isAdmin && <Badge variant="violet">admin</Badge>}
              {user.deletedAt && (
                <Badge variant="warning">
                  deleted {shortDate(user.deletedAt)}
                </Badge>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">What they did</h2>
                  {data && (
                    <p className="text-[13px] text-muted-foreground">
                      {shortDate(data.window.from)} – {shortDate(data.window.to)}
                      , newest visit first
                    </p>
                  )}
                </div>
                <select
                  aria-label="Timeline period"
                  value={days}
                  onChange={(e) => {
                    setDays(Number(e.target.value));
                    setBefore(undefined);
                  }}
                  className="h-9 rounded-full border border-border bg-card px-3 text-sm"
                >
                  {RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r} days
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Visits"
                  value={(data?.summary.visits ?? 0).toLocaleString()}
                  hint="A new visit starts after 30 idle minutes"
                  loading={isLoading}
                />
                <StatCard
                  label="Active days"
                  value={`${data?.summary.activeDays ?? 0} of ${days}`}
                  loading={isLoading}
                />
                <StatCard
                  label="Time on site"
                  value={
                    data ? `≥ ${formatDuration(data.summary.timeOnSiteSeconds)}` : "—"
                  }
                  hint="First to last request of each visit"
                  loading={isLoading}
                />
                <StatCard
                  label="Errors hit"
                  value={(data?.summary.errors ?? 0).toLocaleString()}
                  loading={isLoading}
                />
              </div>

              {data?.window.truncated && (
                <p className="mb-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-2.5 text-[13px]">
                  This period has more activity than one page loads, so its
                  oldest part is missing. Pick a shorter period to see
                  everything.
                </p>
              )}

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
              ) : visits.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing recorded for this user in this period.
                </div>
              ) : (
                <div className="space-y-3">
                  {visits.map((visit) => (
                    <VisitCard key={visit.startedAt.getTime()} visit={visit} />
                  ))}
                </div>
              )}

              {data && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {data.window.from > data.user.createdAt && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setBefore(data.window.from)}
                    >
                      Show the {days} days before
                    </Button>
                  )}
                  {before && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBefore(undefined)}
                    >
                      Back to latest
                    </Button>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              {isLoading || !data ? (
                <>
                  <Skeleton className="h-64 w-full rounded-xl" />
                  <Skeleton className="h-64 w-full rounded-xl" />
                </>
              ) : (
                <>
                  <Milestones milestones={data.milestones} />
                  <Totals totals={data.totals} />
                  <div className="rounded-xl border border-border bg-card p-4 text-[12px] leading-relaxed text-muted-foreground">
                    <p className="mb-1 font-medium uppercase tracking-wide text-faint">
                      What this can&rsquo;t show
                    </p>
                    Page views, time on a page and sign-ins are not recorded.
                    Visits are inferred from the requests the app makes, so
                    time on site is a minimum. Planner use appears as counts
                    and times only: calendar events, plan contents and planner
                    chat are never shown here.
                  </div>
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
