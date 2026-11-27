"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminMetricsApi, type MetricDays, type RetentionKey, type RetentionLine } from "@/lib/api/admin-metrics";
import { barWidths, formatMetric, rateCell, shortDate } from "@/lib/admin-metrics";
import { Bar, Card, ChangeText, MetricTile, Section, TD, TH, useUserList } from "./metrics-ui";

const opts = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

// ── 1. Activation ─────────────────────────────────────────────────────

export function ActivationSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "activation", days], queryFn: () => adminMetricsApi.activation(days), ...opts });
  const users = useUserList();
  const widths = barWidths(data?.steps.map((s) => s.current.pctOfSignups ?? 0) ?? []);
  return (
    <Section
      id="activation"
      n={1}
      title="Activation funnel"
      description="What this period's signups went on to do (at any time since). Steps are counted on their own, so a later one can be larger. Click a step for who reached it, or the drop-off for who did not."
      error={error}
      loading={isLoading}
    >
      {data && (
        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Step</th>
                  <th className={TH}>Users</th>
                  <th className={`${TH} w-[22%]`}>% of signups</th>
                  <th className={TH}>Drop-off</th>
                  <th className={TH}>vs before</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.steps.map((s, i) => (
                  <tr key={s.key} className="hover:bg-muted/40">
                    <td className={TD}>
                      <button
                        type="button"
                        className="text-left font-medium hover:text-accent"
                        onClick={() => users.open({ list: "activation", key: s.key, title: `${s.label}: reached` })}
                      >
                        {s.label}
                      </button>
                      <p className="text-[11px] leading-snug text-muted-foreground">{s.definition}</p>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {s.current.users.toLocaleString()}
                      {(s.key === "d1" || s.key === "w1") && <span className="text-faint"> / {s.current.base}</span>}
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <Bar width={widths[i]} />
                        <span className="w-12 shrink-0 text-right">{formatMetric(s.current.pctOfSignups, "percent")}</span>
                      </div>
                    </td>
                    <td className={TD}>
                      {s.current.dropFromPrevious === null || s.current.dropFromPrevious < 0 ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <button
                          type="button"
                          className="hover:text-accent"
                          title="Who did not reach this step"
                          onClick={() => users.open({ list: "activation", key: s.key, missed: true, title: `${s.label}: not reached` })}
                        >
                          {formatMetric(s.current.dropFromPrevious, "percent")}
                        </button>
                      )}
                    </td>
                    <td className={TD}>
                      <ChangeText change={s.change} />
                      <p className="text-[11px] text-faint">
                        {s.key === "signedUp" ? s.previous.users.toLocaleString() : formatMetric(s.previous.pctOfSignups, "percent")} before
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-3">
            <Card title="First subject: how their first material arrived" note="share of signups">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.firstSubjectSplit.map((w) => (
                    <tr key={w.key}>
                      <td className={TD}>{w.label}</td>
                      <td className={`${TD} text-right`}>{w.current.users}</td>
                      <td className={`${TD} text-right text-muted-foreground`}>{formatMetric(w.current.pctOfSignups, "percent")}</td>
                      <td className={`${TD} text-right text-[11px] text-faint`}>{formatMetric(w.previous.pctOfSignups, "percent")} before</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                The earliest of: a catalog course, or a material added to a subject. &ldquo;Own file&rdquo; is only a file they uploaded; Scribe notes, pasted text and their own notes are separate.
              </p>
            </Card>
            <Card title="Ever did (any time)">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.everUsed.map((e) => (
                    <tr key={e.key}>
                      <td className={TD}>
                        {e.key === "own_file" ? (
                          <button type="button" className="font-medium hover:text-accent" onClick={() => users.open({ list: "activation", key: "own_file", title: "Uploaded their own file" })}>
                            {e.label}
                          </button>
                        ) : (
                          <span className="font-medium">{e.label}</span>
                        )}
                        <p className="text-[11px] text-muted-foreground">{e.definition}</p>
                      </td>
                      <td className={`${TD} text-right`}>{formatMetric(e.current.pctOfSignups, "percent")}</td>
                      <td className={`${TD} text-right`}>
                        <ChangeText change={e.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── 2. Retention ──────────────────────────────────────────────────────

const RET_KEYS: RetentionKey[] = ["d1", "d3", "d7", "w1", "w4"];

function RetentionCells({ line }: { line: RetentionLine }) {
  return (
    <>
      {RET_KEYS.map((k) => {
        const c = line[k];
        const shade = c.pct === null ? 0 : Math.min(1, c.pct / 60);
        return (
          <td key={k} className={`${TD} text-center`} style={shade ? { backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(shade * 28)}%, transparent)` } : undefined}>
            {c.eligible === 0 ? <span className="text-faint">—</span> : <span title={`${c.retained} of ${c.eligible}`}>{formatMetric(c.pct, "percent")}</span>}
          </td>
        );
      })}
    </>
  );
}

export function RetentionSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "retention", days], queryFn: () => adminMetricsApi.retention(days), ...opts });
  const head = (first: string) => (
    <thead>
      <tr className="border-b border-border">
        <th className={TH}>{first}</th>
        <th className={TH}>Signups</th>
        {RET_KEYS.map((k) => (
          <th key={k} className={`${TH} text-center`}>
            {k.toUpperCase()}
          </th>
        ))}
      </tr>
    </thead>
  );
  return (
    <Section
      id="retention"
      n={2}
      title="Retention cohorts"
      description="Share of signups who used the app again in each window. A cell counts only signups old enough for it (— when none are); hover for the counts."
      error={error}
      loading={isLoading}
    >
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="Weekly signup cohorts (weeks start Monday, UTC)">
            <table className="w-full text-sm">
              {head("Week of")}
              <tbody className="divide-y divide-border">
                {data.weeks.map((w) => (
                  <tr key={String(w.week)}>
                    <td className={TD}>{shortDate(w.week)}</td>
                    <td className={TD}>{w.signups}</td>
                    <RetentionCells line={w} />
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className={TD}>All, this period</td>
                  <td className={TD}>{data.total.current.signups}</td>
                  <RetentionCells line={data.total.current} />
                </tr>
                <tr className="text-muted-foreground">
                  <td className={TD}>Period before</td>
                  <td className={TD}>{data.total.previous.signups}</td>
                  <RetentionCells line={data.total.previous} />
                </tr>
              </tbody>
            </table>
          </Card>
          <Card title="By acquisition source (this period, change vs before)">
            <table className="w-full text-sm">
              {head("Source")}
              <tbody className="divide-y divide-border">
                {data.bySource.map((s) => (
                  <tr key={s.key}>
                    <td className={TD}>{s.label}</td>
                    <td className={TD}>{s.current.signups}</td>
                    {RET_KEYS.map((k) => (
                      <td key={k} className={`${TD} text-center`}>
                        {rateCell(s.current[k].retained, s.current[k].eligible, s.current[k].pct) === "—" ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <span title={`${s.current[k].retained} of ${s.current[k].eligible}`}>{formatMetric(s.current[k].pct, "percent")}</span>
                        )}
                        <div>
                          <ChangeText change={s.change[k]} className="text-[11px]" />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-0.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              {RET_KEYS.map((k) => (
                <li key={k}>
                  <span className="font-semibold">{k.toUpperCase()}</span>: {data.definitions[k]}
                </li>
              ))}
              <li>Ads: a Google Ads click id or utm google / cpc. Referral: came through an invite link. Organic: everyone else.</li>
            </ul>
          </Card>
        </div>
      )}
    </Section>
  );
}

// ── 3. Engagement ─────────────────────────────────────────────────────

export function EngagementSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "engagement", days], queryFn: () => adminMetricsApi.engagement(days), ...opts });
  const users = useUserList();
  const peak = Math.max(1, ...(data?.dauSeries.map((d) => d.dau) ?? [0]));
  return (
    <Section id="engagement" n={3} title="Engagement" description="How often real users come in and how much they study." error={error} loading={isLoading}>
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.metrics.map((m) => (
              <MetricTile
                key={m.key}
                label={m.label}
                value={m.current}
                previous={m.previous}
                change={m.change}
                unit={m.unit}
                definition={m.definition}
                onOpen={m.key === "streak3" ? () => users.open({ list: "streak", key: "streak3", title: "Streaks of 3+ days" }) : undefined}
              />
            ))}
            <Card className="p-3">
              <p className="text-[12px] font-semibold text-faint">Daily active users</p>
              <div role="img" aria-label={`Daily active users, peak ${peak}`} className="mt-2 flex h-16 items-end gap-[2px]">
                {data.dauSeries.map((d) => (
                  <div key={String(d.day)} title={`${shortDate(d.day)}: ${d.dau}`} className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-sm bg-accent" style={{ height: `${(d.dau / peak) * 100}%` }} />
                  </div>
                ))}
              </div>
              <p className="mt-1 flex justify-between text-[11px] text-faint">
                <span>{shortDate(data.from)}</span>
                <span>peak {peak}</span>
              </p>
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}
