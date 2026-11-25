"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminMetricsApi, type MetricDays, type ScoreLine, type ScoreSplit, type ShareCount } from "@/lib/api/admin-metrics";
import { barWidths, formatMetric, levelSplit, quartileNote, scoreBucketLabel, shortDate, trackingNote } from "@/lib/admin-metrics";
import { Bar, Card, ChangeText, MetricTile, Section, TD, TH, useUserList } from "./metrics-ui";

const opts = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

const pctText = (v: number | null | undefined) => formatMetric(v, "percent");

/** A share with its bar and the previous period's value under it. */
function ShareCell({ s, width }: { s: ShareCount; width?: number }) {
  return (
    <td className={TD}>
      <div className="flex items-center gap-2">
        {width !== undefined && <Bar width={width} />}
        <span className="w-12 shrink-0 text-right">{pctText(s.pctCurrent)}</span>
      </div>
      <p className="text-[11px] text-faint">
        {s.current.toLocaleString()} · {pctText(s.pctPrevious)} before <ChangeText change={s.change} className="text-[11px]" />
      </p>
    </td>
  );
}

// ── 10. What students study ───────────────────────────────────────────

export function StudySection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "study", days], queryFn: () => adminMetricsApi.study(days), ...opts });
  const users = useUserList();
  const widths = barWidths(data?.types.map((t) => t.students.pctCurrent ?? 0) ?? []);
  const famWidths = barWidths(data?.families.map((f) => f.pctStudents ?? 0) ?? []);
  return (
    <Section
      id="study"
      n={10}
      title="What students study"
      description="What the active students' subjects are made of, against the period before. Click a type, course, board or family for the students."
      error={error}
      loading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Active students" value={data.total.students.current} previous={data.total.students.previous} change={data.total.students.change} definition={data.definitions.students} />
            <MetricTile label="Subjects studied" value={data.total.subjects.current} previous={data.total.subjects.previous} change={data.total.subjects.change} definition={data.definitions.subjects} />
            <MetricTile label="Sessions finished" value={data.total.sessions.current} previous={data.total.sessions.previous} change={data.total.sessions.change} definition={data.definitions.sessions} />
            <MetricTile label="Activities completed" value={data.total.activities.current} previous={data.total.activities.previous} change={data.total.activities.change} definition={data.definitions.activities} />
          </div>

          <Card title="By material type" note="share of each total; count · before · change">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Type</th>
                  <th className={`${TH} w-[24%]`}>Students (primary type)</th>
                  <th className={TH}>Subjects</th>
                  <th className={TH}>Sessions finished</th>
                  <th className={TH}>Activities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.types.map((t, i) => (
                  <tr key={t.key} className="hover:bg-muted/40">
                    <td className={TD}>
                      <button
                        type="button"
                        className="text-left font-medium hover:text-accent"
                        onClick={() => users.open({ list: "studyType", key: t.key, title: `Mostly studied from: ${t.label}` })}
                      >
                        {t.label}
                      </button>
                      <p className="text-[11px] leading-snug text-muted-foreground">{t.definition}</p>
                    </td>
                    <ShareCell s={t.students} width={widths[i]} />
                    {t.subjectsShared ? (
                      t.key === "typed_q5" ? (
                        <td rowSpan={2} className={`${TD} border-b border-border`}>
                          <span>{pctText(t.subjects.pctCurrent)}</span>
                          <p className="text-[11px] text-faint">
                            {t.subjects.current.toLocaleString()} · {pctText(t.subjects.pctPrevious)} before <ChangeText change={t.subjects.change} className="text-[11px]" />
                          </p>
                          <p className="text-[11px] text-muted-foreground">Typed-topic subjects, both rows</p>
                        </td>
                      ) : null
                    ) : (
                      <ShareCell s={t.subjects} />
                    )}
                    <ShareCell s={t.sessions} />
                    <ShareCell s={t.activities} />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{data.definitions.type}</p>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Top 10 catalog courses" note="students with a completed activity in it">
              {data.topCourses.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No catalog study in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Course</th>
                      <th className={`${TH} text-right`}>Students</th>
                      <th className={`${TH} text-right`}>Activities</th>
                      <th className={`${TH} text-right`}>vs before</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topCourses.map((c) => (
                      <tr key={c.courseId} className="hover:bg-muted/40">
                        <td className={TD}>
                          <button
                            type="button"
                            className="text-left font-medium hover:text-accent"
                            onClick={() => users.open({ list: "studyCourse", key: c.courseId, title: `Studied ${c.title}` })}
                          >
                            {c.title}
                          </button>
                          <p className="text-[11px] text-faint">
                            {c.boardLabel}
                            {c.levels.length > 0 && ` · ${levelSplit(c.levels)}`}
                          </p>
                        </td>
                        <td className={`${TD} text-right`}>{c.students.toLocaleString()}</td>
                        <td className={`${TD} text-right`}>{c.activities.toLocaleString()}</td>
                        <td className={`${TD} text-right`}>
                          <ChangeText change={c.studentsChange} />
                          <p className="text-[11px] text-faint">{c.previousStudents} before</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="space-y-3">
              <Card title="Catalog courses by board and level" note={`share of ${data.catalogStudents.current.toLocaleString()} catalog students`}>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {data.boards.map((b) => (
                      <tr key={b.key}>
                        <td className={TD}>
                          <button type="button" className="font-medium hover:text-accent" onClick={() => users.open({ list: "studyBoard", key: b.key, title: `Studied a ${b.label} course` })}>
                            {b.label}
                          </button>
                          <p className="text-[11px] text-faint">{b.levels.map((l) => `${l.level} ${l.students}`).join(" · ")}</p>
                        </td>
                        <td className={`${TD} text-right`}>{b.students.current.toLocaleString()}</td>
                        <td className={`${TD} text-right text-muted-foreground`}>{pctText(b.students.pctCurrent)}</td>
                        <td className={`${TD} text-right text-[11px] text-faint`}>
                          {pctText(b.students.pctPrevious)} before <ChangeText change={b.students.change} className="text-[11px]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{data.definitions.board}</p>
              </Card>
              <Card title="Own subjects: exam level Scribe detected" note={`share of ${data.ownStudents.current.toLocaleString()} students on own subjects`}>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {data.detected.map((d) => (
                      <tr key={d.key}>
                        <td className={TD}>
                          <button type="button" className="font-medium hover:text-accent" onClick={() => users.open({ list: "studyDetected", key: d.key, title: `Own subjects detected as ${d.label}` })}>
                            {d.label}
                          </button>
                        </td>
                        <td className={`${TD} text-right`}>{d.students.current.toLocaleString()}</td>
                        <td className={`${TD} text-right text-muted-foreground`}>{pctText(d.students.pctCurrent)}</td>
                        <td className={`${TD} text-right text-[11px] text-faint`}>{pctText(d.students.pctPrevious)} before</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{data.definitions.detected}</p>
              </Card>
            </div>
          </div>

          <Card title="Top subject families" note="share of active students; a student can study several">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Family</th>
                  <th className={`${TH} w-[30%]`}>Students</th>
                  <th className={`${TH} text-right`}>Activities</th>
                  <th className={`${TH} text-right`}>vs before</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.families.map((f, i) => (
                  <tr key={f.key} className="hover:bg-muted/40">
                    <td className={TD}>
                      <button type="button" className="font-medium hover:text-accent" onClick={() => users.open({ list: "studyFamily", key: f.key, title: `Studied ${f.label}` })}>
                        {f.label}
                      </button>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <Bar width={famWidths[i]} />
                        <span className="w-24 shrink-0 text-right">
                          {f.students.toLocaleString()} · {pctText(f.pctStudents)}
                        </span>
                      </div>
                    </td>
                    <td className={`${TD} text-right`}>{f.activities.toLocaleString()}</td>
                    <td className={`${TD} text-right`}>
                      <ChangeText change={f.change} />
                      <p className="text-[11px] text-faint">{pctText(f.pctStudentsPrevious)} before</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{data.definitions.family}</p>
          </Card>
        </div>
      )}
    </Section>
  );
}

// ── 11. First test scores ─────────────────────────────────────────────

function ScoreCells({ line }: { line: ScoreLine }) {
  if (line.n === 0)
    return (
      <>
        <td className={`${TD} text-right text-faint`}>0</td>
        <td className={`${TD} text-right text-faint`} colSpan={3}>
          —
        </td>
      </>
    );
  return (
    <>
      <td className={`${TD} text-right`}>{line.n.toLocaleString()}</td>
      <td className={`${TD} text-right font-medium`} title={quartileNote(line.p25, line.p75)}>
        {pctText(line.median)}
      </td>
      <td className={`${TD} text-right`}>{pctText(line.perfectPct)}</td>
      <td className={`${TD} text-right`}>{pctText(line.under40Pct)}</td>
    </>
  );
}

function SplitTable({ groups }: { groups: Array<{ title: string; rows: ScoreSplit[] }> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className={TH}>First session on</th>
          <th className={`${TH} text-right`}>Students</th>
          <th className={`${TH} text-right`}>Scored</th>
          <th className={`${TH} text-right`}>Median</th>
          <th className={`${TH} text-right`}>100%</th>
          <th className={`${TH} text-right`}>&lt;40%</th>
          <th className={`${TH} text-right`}>Session median</th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.title} className="divide-y divide-border">
          <tr className="bg-muted/40">
            <td className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint" colSpan={7}>
              {g.title}
            </td>
          </tr>
          {g.rows.map((r) => (
            <tr key={r.key}>
              <td className={TD}>{r.label}</td>
              <td className={`${TD} text-right text-muted-foreground`}>{r.students.toLocaleString()}</td>
              <ScoreCells line={r.firstSet} />
              <td className={`${TD} text-right text-muted-foreground`}>{r.session.n ? pctText(r.session.median) : "—"}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function Histogram({ counts, onOpen, muted, label }: { counts: number[]; onOpen?: (i: number) => void; muted?: boolean; label: string }) {
  const peak = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div>
      <div role="img" aria-label={label} className="flex h-24 items-end gap-1">
        {counts.map((c, i) => {
          const bar = (
            <div className={muted ? "w-full rounded-t-sm bg-border-strong" : "w-full rounded-t-sm bg-accent"} style={{ height: `${(c / peak) * 100}%`, minHeight: c > 0 ? 2 : 0 }} />
          );
          const title = `${scoreBucketLabel(i)}: ${c} (${formatMetric(total ? (c / total) * 100 : null, "percent")})`;
          return onOpen ? (
            <button key={i} type="button" title={title} onClick={() => onOpen(i)} className="flex h-full flex-1 items-end hover:opacity-80">
              {bar}
            </button>
          ) : (
            <div key={i} title={title} className="flex h-full flex-1 items-end">
              {bar}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] tabular-nums text-faint">
        {counts.map((_, i) => (
          <span key={i} className="flex-1 text-center">
            {i * 10}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FirstScoresSection({ days }: { days: MetricDays }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["admin", "metrics", "firstScores", days], queryFn: () => adminMetricsApi.firstScores(days), ...opts });
  const users = useUserList();
  const confPeak = 100;
  return (
    <Section
      id="scores"
      n={11}
      title="First test scores"
      description="How new students do on the first questions they answer, and whether that predicts coming back. Click a bar, a share or a W1 row for the students."
      error={error}
      loading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile label="First sessions" value={data.starters.current} previous={data.starters.previous} change={data.starters.change} definition={data.definitions.cohort} />
            <MetricTile
              label="Median first test"
              value={data.firstSet.current.median}
              previous={data.firstSet.previous.median}
              change={data.firstSet.change.median}
              unit="percent"
              definition={data.definitions.firstSet}
            />
            <MetricTile
              label="First test at 100%"
              value={data.firstSet.current.perfectPct}
              previous={data.firstSet.previous.perfectPct}
              change={data.firstSet.change.perfectPct}
              unit="percent"
              definition="Share of scored students who got every answered question right."
              onOpen={() => users.open({ list: "firstScore", key: "perfect", title: "First test at 100%" })}
            />
            <MetricTile
              label="First test under 40%"
              value={data.firstSet.current.under40Pct}
              previous={data.firstSet.previous.under40Pct}
              change={data.firstSet.change.under40Pct}
              unit="percent"
              better="down"
              definition="Share of scored students who got under 40% right."
              onOpen={() => users.open({ list: "firstScore", key: "under40", title: "First test under 40%" })}
            />
            <MetricTile
              label="Median whole first session"
              value={data.session.current.median}
              previous={data.session.previous.median}
              change={data.session.change.median}
              unit="percent"
              definition={data.definitions.session}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card
              title="First test: students per 10% bucket"
              note={[`${data.firstSet.current.n.toLocaleString()} scored`, quartileNote(data.firstSet.current.p25, data.firstSet.current.p75), "click a bar"].filter(Boolean).join(" · ")}
            >
              <div className="px-3 py-3">
                <Histogram
                  counts={data.firstSet.current.histogram}
                  label="First test score distribution"
                  onOpen={(i) => users.open({ list: "firstScore", key: `b${i}`, title: `First test ${scoreBucketLabel(i)}` })}
                />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Whole first session
                  {quartileNote(data.session.current.p25, data.session.current.p75) && (
                    <span className="ml-2 font-normal normal-case tracking-normal">{quartileNote(data.session.current.p25, data.session.current.p75)}</span>
                  )}
                </p>
                <div className="mt-1">
                  <Histogram counts={data.session.current.histogram} label="Whole first session score distribution" muted />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">% correct; the last bucket includes 100%. Before: median {pctText(data.firstSet.previous.median)} of {data.firstSet.previous.n} scored.</p>
              </div>
            </Card>

            <Card title="Came back W1, by first test score" note={`${data.w1Eligible.students} eligible · ${pctText(data.w1Eligible.pct)} came back`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH}>First test</th>
                    <th className={`${TH} text-right`}>Eligible</th>
                    <th className={`${TH} w-[40%]`}>Came back</th>
                    <th className={`${TH} text-right`}>Did not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.w1ByBand.map((b) => (
                    <tr key={b.key}>
                      <td className={TD}>{b.label}</td>
                      <td className={`${TD} text-right`}>{b.eligible}</td>
                      <td className={TD}>
                        {b.eligible === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 hover:text-accent"
                            onClick={() => users.open({ list: "firstScore", key: `w1_${b.key}`, title: `First test ${b.label}: came back W1` })}
                          >
                            <Bar width={b.pct ?? 0} />
                            <span className="w-20 shrink-0 text-right">
                              {pctText(b.pct)} ({b.returned})
                            </span>
                          </button>
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        {b.eligible - b.returned > 0 ? (
                          <button
                            type="button"
                            className="hover:text-accent"
                            onClick={() => users.open({ list: "firstScore", key: `w1_${b.key}`, missed: true, title: `First test ${b.label}: did not come back` })}
                          >
                            {b.eligible - b.returned}
                          </button>
                        ) : (
                          <span className="text-faint">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{data.definitions.w1} Bars are on a 0–100% scale.</p>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
            <Card title="By material type, board and format" note="first test unless marked">
              <SplitTable
                groups={[
                  { title: "Material type", rows: data.byType },
                  { title: "Catalog board", rows: data.byBoard },
                  { title: "Format", rows: data.byFormat },
                ]}
              />
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Type of the first session&rsquo;s subject, as in What students study. Scored: students with a first test. Hover a median for the middle half.
              </p>
            </Card>

            <Card title="Confidence vs first test" note={trackingNote(data.confidence.trackingSince, data.previousFrom) ?? `since ${shortDate(data.confidence.trackingSince)}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH}>Confidence</th>
                    <th className={`${TH} text-right`}>Scored</th>
                    <th className={`${TH} text-right`}>Median</th>
                    <th className={`${TH} text-right`}>100%</th>
                    <th className={`${TH} text-right`}>&lt;40%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.confidence.bands.map((b) => (
                    <tr key={b.key}>
                      <td className={TD}>{b.label}</td>
                      <ScoreCells line={b} />
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Median first test by rating</p>
                <div role="img" aria-label="Median first test score by confidence rating" className="mt-2 flex h-16 items-end gap-1">
                  {data.confidence.byValue.map((v) => (
                    <div key={v.confidence} title={`${v.confidence}: ${v.n ? `${pctText(v.median)} median of ${v.n}` : "nobody"}`} className="flex h-full flex-1 items-end">
                      <div className="w-full rounded-t-sm bg-accent" style={{ height: `${((v.median ?? 0) / confPeak) * 100}%`, minHeight: v.n ? 2 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1 text-[10px] tabular-nums text-faint">
                  {data.confidence.byValue.map((v) => (
                    <span key={v.confidence} className="flex-1 text-center">
                      {v.confidence}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {data.definitions.confidence} Asked in {data.confidence.firstSessionsAsked.toLocaleString()} of {data.starters.current.toLocaleString()} first sessions.
                </p>
              </div>
              {data.byDifficulty && data.byDifficulty.some((d) => d.answered > 0) && (
                <div className="border-t border-border px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">First test by question difficulty</p>
                  <table className="mt-1 w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {data.byDifficulty.map((d) => (
                        <tr key={d.key}>
                          <td className={TD}>{d.key === "easy" ? "Warm-up (easy)" : d.key === "medium" ? "Exam level (medium)" : "Exam level (hard)"}</td>
                          <td className={`${TD} text-right tabular-nums`}>{d.answered ? `${d.correct.toLocaleString()} / ${d.answered.toLocaleString()}` : "–"}</td>
                          <td className={`${TD} text-right tabular-nums`}>{pctText(d.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.definitions.difficulty && <p className="mt-2 text-[11px] text-muted-foreground">{data.definitions.difficulty}</p>}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </Section>
  );
}
