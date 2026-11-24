"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminMetricsApi, type MetricDays, type UploadsPeriod } from "@/lib/api/admin-metrics";
import { barWidths, formatMetric, shortDate, trackingNote } from "@/lib/admin-metrics";
import { cn } from "@/lib/utils";
import { Bar, Card, ChangeText, MetricTile, Section, TD, TH, useUserList } from "./metrics-ui";

const opts = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

const REASON_LABELS: Record<keyof UploadsPeriod["reasons"], { label: string; definition: string }> = {
  size: { label: "Too large", definition: "Over the app's 1 GB limit, or the storage allowance was full." },
  type: { label: "File type", definition: "Processing said the format is not supported." },
  extraction: { label: "Could not read", definition: "Processing failed for any other reason (text extraction, OCR, transcription)." },
  stuck: { label: "Stuck processing", definition: "Still not ready 30+ minutes after the upload." },
  transfer: { label: "Upload failed", definition: "The file never reached storage (network, browser)." },
  refused: { label: "Refused", definition: "The server would not register the upload (other errors)." },
};

// ── 4. Uploads ────────────────────────────────────────────────────────

export function UploadsSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "uploads", days], queryFn: () => adminMetricsApi.uploads(days), ...opts });
  const users = useUserList();
  const c = data?.current;
  const reasonKeys = Object.keys(REASON_LABELS) as Array<keyof UploadsPeriod["reasons"]>;
  const widths = barWidths(c ? reasonKeys.map((k) => c.reasons[k]) : []);
  return (
    <Section
      id="uploads"
      n={4}
      title="Uploads health"
      description="Files learners uploaded themselves (Scribe notes, pasted text, own notes and imports are not uploads)."
      error={error}
      loading={isLoading}
    >
      {data && c && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Uploads attempted" value={c.attempted} previous={data.previous.attempted} change={data.change.attempted} definition="Files registered, plus uploads the server refused and ones the app gave up on before they arrived." />
            <MetricTile label="Ready to study" value={c.successRate} previous={data.previous.successRate} change={data.change.successRate} unit="percent" definition={`Share of attempts that became usable material (${c.succeeded} files; ${c.processing} still processing).`} />
            <MetricTile
              label="Failed or stuck"
              value={c.failed}
              previous={data.previous.failed}
              change={data.change.failed}
              better="down"
              definition="Attempts that never became material, for any of the reasons below. Click for the users."
              onOpen={() => users.open({ list: "uploadFailed", key: "all", title: "Uploads failed or stuck" })}
            />
            <MetricTile
              label="Median time to ready"
              value={c.medianMinutesToReady}
              previous={data.previous.medianMinutesToReady}
              change={data.change.medianMinutesToReady}
              unit="minutes"
              better="down"
              definition={`From registering the file to usable material (${c.readyMeasured} measured).`}
              note={trackingNote(data.trackingSince.timeToReady, data.previousFrom, data.trackingSince.expected)}
            />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Card title="Failures by reason" note={trackingNote(data.trackingSince.clientFailures, data.previousFrom, data.trackingSince.expected) ? "too-large / transfer: new tracking" : null}>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {reasonKeys.map((k, i) => (
                    <tr key={k}>
                      <td className={TD}>
                        <span className="font-medium">{REASON_LABELS[k].label}</span>
                        <p className="text-[11px] text-muted-foreground">{REASON_LABELS[k].definition}</p>
                      </td>
                      <td className={`${TD} w-24`}>
                        <Bar width={widths[i]} />
                      </td>
                      <td className={`${TD} text-right`}>{c.reasons[k]}</td>
                      <td className={`${TD} text-right text-[11px] text-faint`}>{data.previous.reasons[k]} before</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <SplitTable title="By file type" rows={c.byType} />
            <SplitTable title="By device (from the upload request)" rows={c.byDevice} />
          </div>
          {c.topMessages.length > 0 && (
            <Card title="Most common failure messages" className="mt-3">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {c.topMessages.map((m) => (
                    <tr key={m.message}>
                      <td className={`${TD} font-mono text-[12px]`}>{m.message}</td>
                      <td className={`${TD} text-muted-foreground`}>{REASON_LABELS[m.reason as keyof typeof REASON_LABELS]?.label ?? m.reason}</td>
                      <td className={`${TD} text-right`}>{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </Section>
  );
}

function SplitTable({ title, rows }: { title: string; rows: UploadsPeriod["byType"] }) {
  return (
    <Card title={title}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH} />
            <th className={`${TH} text-right`}>Tried</th>
            <th className={`${TH} text-right`}>Ready</th>
            <th className={`${TH} text-right`}>Failed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No uploads.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.label}>
                <td className={`${TD} capitalize`}>{r.label}</td>
                <td className={`${TD} text-right`}>{r.attempted}</td>
                <td className={`${TD} text-right`}>{formatMetric(r.successRate, "percent")}</td>
                <td className={`${TD} text-right`}>{r.failed}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ── 5. Revenue ────────────────────────────────────────────────────────

export function RevenueSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "revenue", days], queryFn: () => adminMetricsApi.revenue(days), ...opts });
  const users = useUserList();
  return (
    <Section
      id="revenue"
      n={5}
      title="Revenue"
      description="Real paying users only: complimentary grants (comp_…) and users given free access by an admin are left out of every money and conversion number."
      error={error}
      loading={isLoading}
    >
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Cash collected" value={data.payments.cashCents.current} previous={data.payments.cashCents.previous} change={data.payments.cashCents.change} unit="cents" definition={`Paid invoices above $0 in the period (${data.payments.count.current ?? 0} payments). Accounts deleted since still count.`} />
            <MetricTile label="MRR now" value={data.subscribersNow.mrr} unit="usd" definition="Monthly value of active and past-due paid subscriptions today (yearly plans ÷ 12). A snapshot: no history is stored." />
            <MetricTile
              label="Paying subscribers now"
              value={data.subscribersNow.paying}
              definition={`Active or past-due paid subscriptions today; ${data.subscribersNow.trialing} more on a trial. Click for the users.`}
              onOpen={() => users.open({ list: "paying", key: "all", title: "Paying subscribers" })}
            />
            <MetricTile label="Checkout → subscribed" value={data.conversion.subscribedRate.current} previous={data.conversion.subscribedRate.previous} change={data.conversion.subscribedRate.change} unit="percent" definition={`Of ${data.conversion.current.starters} users who tried checkout, share who started a trial or paid plan within 7 days (${formatMetric(data.conversion.paidRate.current, "percent")} paid).`} />
            <MetricTile label="Checkout attempts" value={data.checkout.attempts.current} previous={data.checkout.attempts.previous} change={data.checkout.attempts.change} definition="Times a learner pressed to open checkout." />
            <MetricTile label="Checkout errors" value={data.checkout.failed.current} previous={data.checkout.failed.previous} change={data.checkout.failed.change} better="down" definition="Attempts where checkout could not be opened (messages below)." />
            <MetricTile label="New paid subscriptions" value={data.newSubscriptions.total.current} previous={data.newSubscriptions.total.previous} change={data.newSubscriptions.total.change} definition="Trials and paid subscriptions started with a provider in the period." />
            <MetricTile label="Cancellations" value={data.cancellations.total.current} previous={data.cancellations.total.previous} change={data.cancellations.total.change} better="down" definition={`Paid subscriptions cancelled in the period: ${data.cancellations.afterPaying.current ?? 0} after paying, ${data.cancellations.duringTrial.current ?? 0} before any payment.`} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card title="Checkout by plan">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH}>Plan</th>
                    <th className={`${TH} text-right`}>Tried</th>
                    <th className={`${TH} text-right`}>Opened</th>
                    <th className={`${TH} text-right`}>Error</th>
                    <th className={`${TH} text-right`}>Tried before</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.checkout.byPlan.map((p) => (
                    <tr key={p.plan}>
                      <td className={TD}>{p.plan}</td>
                      <td className={`${TD} text-right`}>{p.current.attempts}</td>
                      <td className={`${TD} text-right`}>{p.current.opened}</td>
                      <td className={`${TD} text-right`}>{p.current.failed}</td>
                      <td className={`${TD} text-right text-faint`}>{p.previous.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Opened by provider:{" "}
                {data.checkout.openedByProvider.length
                  ? data.checkout.openedByProvider.map((r) => `${r.provider} ${r.plan} ${r.value}`).join(" · ")
                  : "none recorded"}
                {trackingNote(data.checkout.providerTrackingSince, data.previousFrom, "2026-11-24") && (
                  <span className="text-amber-700 dark:text-amber-400"> ({trackingNote(data.checkout.providerTrackingSince, data.previousFrom, "2026-11-24")})</span>
                )}
              </p>
            </Card>
            <Card title="Checkout errors by message">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.checkout.errors.length + data.checkout.blocked.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground">No checkout errors.</td>
                    </tr>
                  ) : (
                    <>
                      {data.checkout.errors.map((e) => (
                        <tr key={e.message}>
                          <td className={`${TD} font-mono text-[12px]`}>{e.message}</td>
                          <td className={`${TD} text-right`}>{e.current}</td>
                          <td className={`${TD} text-right text-[11px] text-faint`}>{e.previous} before</td>
                        </tr>
                      ))}
                      {data.checkout.blocked.map((b) => (
                        <tr key={`${b.stage}${b.detail}`}>
                          <td className={TD}>
                            <span className="font-medium">{b.stage}</span>
                            <p className="font-mono text-[11px] text-muted-foreground">{b.detail}</p>
                          </td>
                          <td className={`${TD} text-right`}>{b.current}</td>
                          <td className={`${TD} text-right text-[11px] text-faint`}>{b.previous} before</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </Card>
            <Card title="Payments by plan and provider (this period)">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.payments.byPlanProvider.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground">No payments.</td>
                    </tr>
                  ) : (
                    data.payments.byPlanProvider.map((r) => (
                      <tr key={`${r.plan}${r.provider}`}>
                        <td className={TD}>{r.plan}</td>
                        <td className={`${TD} capitalize text-muted-foreground`}>{r.provider}</td>
                        <td className={`${TD} text-right`}>{r.payments}</td>
                        <td className={`${TD} text-right font-medium`}>{formatMetric(r.value, "cents")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
            <Card title="Free access outstanding" note="active today · granted this period">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.complimentary.map((c) => (
                    <tr key={c.kind}>
                      <td className={TD}>{c.label}</td>
                      <td className={`${TD} text-right font-medium`}>{c.outstanding}</td>
                      <td className={`${TD} text-right text-muted-foreground`}>+{c.grantedCurrent}</td>
                      <td className={`${TD} text-right text-[11px] text-faint`}>+{c.grantedPrevious} before</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={TD}>
                      Coursework review credits
                      <p className="text-[11px] text-muted-foreground">
                        {data.courseworkCredits.grantedAllTime} given, {data.courseworkCredits.usedAllTime} used (all time); outstanding shown
                      </p>
                    </td>
                    <td className={`${TD} text-right font-medium`}>{data.courseworkCredits.outstanding}</td>
                    <td className={`${TD} text-right text-muted-foreground`}>+{data.courseworkCredits.granted.current ?? 0}</td>
                    <td className={`${TD} text-right text-[11px] text-faint`}>{data.courseworkCredits.used.current ?? 0} used</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}

// ── 6. Paywall ────────────────────────────────────────────────────────

export function PaywallSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "paywall", days], queryFn: () => adminMetricsApi.paywall(days), ...opts });
  const users = useUserList();
  return (
    <Section
      id="paywall"
      n={6}
      title="Paywall and free limits"
      description="Users refused by a free limit in the period, and what they did within 7 days of their first refusal. Users who hit a limit in the last 7 days are still in their window."
      error={error}
      loading={isLoading}
    >
      {data && (
        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Limit</th>
                  <th className={`${TH} text-right`}>Users</th>
                  <th className={`${TH} text-right`}>Opened checkout ≤7d</th>
                  <th className={`${TH} text-right`}>Subscribed ≤7d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.limits.map((l) => (
                  <tr key={l.key} className="hover:bg-muted/40">
                    <td className={TD}>
                      {l.key === "grader" ? (
                        <span className="font-medium">{l.label}</span>
                      ) : (
                        <button type="button" className="font-medium hover:text-accent" onClick={() => users.open({ list: "limit", key: l.key, title: `Hit the limit: ${l.label}` })}>
                          {l.label}
                        </button>
                      )}
                      {l.current.stillInWindow > 0 && <p className="text-[11px] text-faint">{l.current.stillInWindow} still inside 7 days</p>}
                    </td>
                    <td className={`${TD} text-right`}>
                      {l.current.users}
                      <div>
                        <ChangeText change={l.change.users} better="down" className="text-[11px]" />
                      </div>
                    </td>
                    <td className={`${TD} text-right`}>
                      {formatMetric(l.current.checkoutRate, "percent")} <span className="text-faint">({l.current.checkoutWithin7d})</span>
                      <div>
                        <ChangeText change={l.change.checkoutRate} className="text-[11px]" />
                      </div>
                    </td>
                    <td className={`${TD} text-right`}>
                      {formatMetric(l.current.upgradeRate, "percent")} <span className="text-faint">({l.current.upgradedWithin7d})</span>
                      <div>
                        <ChangeText change={l.change.upgradeRate} className="text-[11px]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              A user hit a limit when the server refused them with the free-plan message (subjects, full sessions, the daily Quick 5, flashcard tests, locked topics) or for lack of tokens; coursework from the grader&rsquo;s own limit event.
            </p>
          </Card>
          <Card title="Paywall shown, by reason" note="views · users">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {data.walls.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground">No paywall views.</td>
                  </tr>
                ) : (
                  data.walls.map((w) => (
                    <tr key={w.reason}>
                      <td className={`${TD} font-mono text-[12px]`}>{w.reason}</td>
                      <td className={`${TD} text-right`}>{w.current.shown}</td>
                      <td className={`${TD} text-right`}>{w.current.users}</td>
                      <td className={`${TD} text-right text-[11px] text-faint`}>{w.previous.users} before</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </Section>
  );
}

// ── 7. Feature adoption ───────────────────────────────────────────────

export function FeaturesSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "features", days], queryFn: () => adminMetricsApi.features(days), ...opts });
  const peak = Math.max(1, ...(data?.confidence.distribution.map((d) => d.current) ?? [0]));
  return (
    <Section id="features" n={7} title="Feature adoption" description="Uses and users of each recent feature in the period, with when its data starts." error={error} loading={isLoading}>
      {data && (
        <div className="grid gap-3 lg:grid-cols-[3fr_1fr]">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Feature</th>
                  <th className={`${TH} text-right`}>Uses</th>
                  <th className={`${TH} text-right`}>Users</th>
                  <th className={`${TH} text-right`}>Extra</th>
                  <th className={TH}>Data since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.features.map((f) => {
                  const note = f.trackingNew ? trackingNote(f.since, data.previousFrom, "2026-11-24") : null;
                  return (
                    <tr key={f.key}>
                      <td className={TD}>
                        <span className="font-medium">{f.label}</span>
                        <p className="text-[11px] leading-snug text-muted-foreground">{f.definition}</p>
                      </td>
                      <td className={`${TD} text-right`}>
                        {f.current.count}
                        <div className="text-[11px] text-faint">
                          {f.previous.count} before <ChangeText change={f.change} className="text-[11px]" />
                        </div>
                      </td>
                      <td className={`${TD} text-right`}>{f.current.users}</td>
                      <td className={`${TD} text-right`}>
                        {f.extraLabel ? (
                          <>
                            {f.current.extra === null ? "—" : f.current.extra}
                            <div className="text-[11px] text-faint">{f.extraLabel}</div>
                          </>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-[12px]", note ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                        {note ?? (f.since ? shortDate(f.since) : "no data yet")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <div className="space-y-3">
            <MetricTile label="Confidence check answer rate" value={data.confidence.answerRate.current} previous={data.confidence.answerRate.previous} change={data.confidence.answerRate.change} unit="percent" definition="Answered ÷ (answered + skipped). Skips are tracked from Nov 24." />
            <Card title="Confidence given (0–10)">
              <div role="img" aria-label="Distribution of confidence ratings" className="flex h-24 items-end gap-1 px-3 pt-3">
                {data.confidence.distribution.map((d) => (
                  <div key={d.confidence} title={`${d.confidence}: ${d.current} (${d.previous} before)`} className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-sm bg-accent" style={{ height: `${(d.current / peak) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 px-3 pb-2 pt-1 text-[10px] text-faint">
                {data.confidence.distribution.map((d) => (
                  <span key={d.confidence} className="flex-1 text-center tabular-nums">
                    {d.confidence}
                  </span>
                ))}
              </div>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">0–4 notes first · 5–7 short recap · 8–10 straight to questions</p>
            </Card>
            <Card title="Imported exams by source">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {data.examSources.map((s) => (
                    <tr key={s.source}>
                      <td className={TD}>{{ google: "Google Calendar", ics: ".ics file", file: "Timetable file" }[s.source] ?? s.source}</td>
                      <td className={`${TD} text-right`}>{s.current}</td>
                      <td className={`${TD} text-right text-[11px] text-faint`}>{s.previous} before</td>
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

// ── 8. Content quality ────────────────────────────────────────────────

export function QualitySection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "quality", days], queryFn: () => adminMetricsApi.quality(days), ...opts });
  const widths = barWidths(data?.lastRuns.map((r) => r.defectRate ?? 0) ?? []);
  return (
    <Section id="quality" n={8} title="Content quality" description="The daily content-QA sweep of newly generated sessions and bank items." error={error} loading={isLoading}>
      {data && (
        <div className="grid gap-3 lg:grid-cols-[1fr_3fr]">
          <MetricTile
            label="Defect rate"
            value={data.defectRate.current}
            previous={data.defectRate.previous}
            change={data.defectRate.change}
            unit="percent"
            better="down"
            definition={`${data.definition} ${data.defectRate.runs.current} runs in the period.`}
          />
          <Card title="Last 5 runs">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Run</th>
                  <th className={`${TH} text-right`}>Items</th>
                  <th className={`${TH} text-right`}>High</th>
                  <th className={`${TH} w-[25%]`}>Defect rate</th>
                  <th className={`${TH} text-right`}>Copies left out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lastRuns.map((r, i) => (
                  <tr key={r.id}>
                    <td className={TD}>
                      {shortDate(r.createdAt)}
                      {!r.postFix && <span className="ml-1 text-[11px] text-faint">(before fix)</span>}
                    </td>
                    <td className={`${TD} text-right`}>{r.itemsChecked}</td>
                    <td className={`${TD} text-right`}>{r.highDefects}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <Bar width={widths[i]} muted={!r.postFix} />
                        <span className="w-12 shrink-0 text-right">{formatMetric(r.defectRate, "percent")}</span>
                      </div>
                    </td>
                    <td className={`${TD} text-right text-muted-foreground`} title={`raw rate ${formatMetric(r.rawDefectRate, "percent")}`}>
                      {r.mistakeReviewItemsExcluded} items, {r.mistakeReviewHighExcluded} high
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </Section>
  );
}

// ── 9. AI cost ────────────────────────────────────────────────────────

export function AiCostSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "cost", days], queryFn: () => adminMetricsApi.aiCost(days), ...opts });
  const widths = barWidths(data?.byModel.map((r) => r.usd) ?? []);
  return (
    <Section id="cost" n={9} title="AI cost" description={data?.definition ?? "Model spend against use and revenue."} error={error} loading={isLoading}>
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="AI cost" value={data.total.current} previous={data.total.previous} change={data.total.change} unit="usd" better="down" definition="Measured plus estimated model spend for real users in the period." />
            <MetricTile label="Per active user" value={data.perActiveUser.current} previous={data.perActiveUser.previous} change={data.perActiveUser.change} unit="usd" better="down" definition="AI cost ÷ users active in the period." />
            <MetricTile label="Per session" value={data.perSession.current} previous={data.perSession.previous} change={data.perSession.change} unit="usd" better="down" definition="AI cost ÷ study sessions started (including ones Scribe made)." />
            <MetricTile label="Cost vs revenue" value={data.costToRevenuePct.current} previous={data.costToRevenuePct.previous} change={data.costToRevenuePct.change} unit="percent" better="down" definition={`AI cost as a share of cash collected (${formatMetric(data.revenueUsd.current, "usd")}).`} />
          </div>
          <Card title="By feature and model" className="mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Feature</th>
                  <th className={TH}>Model</th>
                  <th className={`${TH} text-right`}>Calls</th>
                  <th className={`${TH} w-[25%]`}>Cost</th>
                  <th className={`${TH} text-right`}>Before</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byModel.map((r, i) => (
                  <tr key={`${r.feature}${r.model}`}>
                    <td className={TD}>{r.feature}</td>
                    <td className={`${TD} font-mono text-[12px] text-muted-foreground`}>
                      {r.model}
                    </td>
                    <td className={`${TD} text-right`}>{r.calls.toLocaleString()}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <Bar width={widths[i]} muted={!r.measured} />
                        <span className="w-16 shrink-0 text-right">{formatMetric(r.usd, "usd")}</span>
                      </div>
                    </td>
                    <td className={`${TD} text-right text-faint`}>{formatMetric(r.previousUsd, "usd")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </Section>
  );
}
