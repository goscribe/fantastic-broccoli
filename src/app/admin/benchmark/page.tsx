"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyRow, PageHeader, StatCard, Table, TableSkeletonRows, Td } from "@/components/admin/admin-ui";
import { adminApi, type BenchmarkCell, type BenchmarkModelLine } from "@/lib/api/admin";
import { formatRelativeDate } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** "production" = the models the app runs today. */
const PRODUCTION = "production";
/** Suggestions only: any OpenRouter id can be typed in. */
const PRESETS = [
  PRODUCTION,
  "deepseek/deepseek-v4.1-flash",
  "z-ai/glm-5.3-flash",
  "qwen/qwen3.8-flash",
  "qwen/qwen4-max",
  "anthropic/claude-sonnet-5.5",
  "google/gemini-4-carbon",
];
const MAX_MODELS = 8;
const OPENROUTER_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/;
/** About how long one session takes to generate and judge, for the estimate. */
const MINUTES_PER_SESSION = 6;

const label = (model: string | null) => model ?? "Production (current models)";
/** "claude-sonnet-5.5" for "anthropic/claude-sonnet-5.5": fits a stat card. */
const shortLabel = (model: string | null) => (model ? model.split("/").pop()! : "Production");
const keyOf = (model: string | null) => model ?? PRODUCTION;
/** The ranking score (failures count as 0); an older server only sends the finished-only average. */
const rankScore = (m: BenchmarkModelLine) => (m.score === undefined ? m.overall : m.score);

function scoreTone(score: number | null) {
  if (score === null) return "text-faint";
  if (score >= 7) return "text-emerald-600";
  if (score >= 4) return "text-amber-600";
  return "text-red-600";
}

const score = (v: number | null) => (v === null ? "–" : v.toFixed(1));
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const usd = (v: number | null) => (v === null ? "–" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);
const secs = (v: number | null) => (v === null ? "–" : v >= 90 ? `${(v / 60).toFixed(1)} min` : `${Math.round(v)} s`);

export default function AdminBenchmarkPage() {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | undefined>();
  const [models, setModels] = useState<string[]>([PRODUCTION]);
  const [draft, setDraft] = useState("");
  const [subset, setSubset] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "benchmark", runId ?? "latest"],
    queryFn: () => adminApi.benchmark(runId),
    // A run takes a while; keep the table fresh while one is going.
    refetchInterval: (q) => (q.state.data?.running ? 20_000 : false),
  });

  const run = useMutation({
    mutationFn: () => adminApi.runBenchmark({ models, materialKeys: subset ?? undefined }),
    onSuccess: (r) => {
      if (r.started) toast.success("Benchmark started. Results appear here as each session is judged.");
      else toast.error("A generation run is already in progress. Try again when it finishes.");
      setRunId(undefined);
      void queryClient.invalidateQueries({ queryKey: ["admin", "benchmark"] });
    },
    onError: (e) => toastError(e, "Could not start the benchmark"),
  });

  const add = (raw: string) => {
    const id = raw.trim().toLowerCase();
    if (!id) return;
    if (id !== PRODUCTION && !OPENROUTER_ID.test(id)) {
      toast.error(`"${raw}" is not an OpenRouter model id (vendor/model)`);
      return;
    }
    setModels((m) => (m.includes(id) || m.length >= MAX_MODELS ? m : [...m, id]));
    setDraft("");
  };

  const pool = data?.pool ?? [];
  const materialCount = subset?.length ?? pool.length;
  const sessions = materialCount * models.length;
  const report = data?.report;
  const best = report?.models[0];
  const cheapestGood = report?.models
    .filter((m) => (rankScore(m) ?? 0) >= 7 && m.avgCostUsd !== null)
    .sort((a, b) => (a.avgCostUsd ?? 0) - (b.avgCostUsd ?? 0))[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scribe benchmark"
        description="Generates the same sessions from the assessment pool's materials with each model (through OpenRouter), then scores every session with the same judge: does it fit the material, is it good, can it be done on a laptop and a phone."
      />

      {/* ---------------- New run ---------------- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-bold">New run</h2>
        <p className="mt-1 text-small text-muted-foreground">
          Each material is analysed once, then generated once per model. Everything after the plan (checks, repairs, the judge) is the same for every model, so the scores compare the generators.
        </p>

        <div className="mt-4">
          <p className="text-small font-semibold">Models ({models.length}/{MAX_MODELS})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {models.map((m) => (
              <span key={m} className="flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pl-3 pr-1.5 text-[13px] font-semibold text-accent">
                {m === PRODUCTION ? "Production (current)" : m}
                <button type="button" aria-label={`Remove ${m}`} onClick={() => setModels((xs) => xs.filter((x) => x !== m))} className="grid size-5 place-items-center rounded-full hover:bg-accent/15">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="OpenRouter model id, e.g. deepseek/deepseek-v4.1-flash"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[13.5px] outline-none focus:border-accent"
              aria-label="OpenRouter model id"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!draft.trim() || models.length >= MAX_MODELS}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.filter((p) => !models.includes(p)).map((p) => (
              <button key={p} type="button" onClick={() => add(p)} className="rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-accent hover:text-accent">
                + {p === PRODUCTION ? "Production (current)" : p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-small font-semibold">Materials</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={subset === null} onChange={() => setSubset(null)} /> All {pool.length}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={subset !== null} onChange={() => setSubset(pool.slice(0, 3).map((m) => m.key))} /> Pick
            </label>
          </div>
          {subset !== null && (
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {pool.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={subset.includes(m.key)}
                    onChange={(e) => setSubset((s) => (e.target.checked ? [...(s ?? []), m.key] : (s ?? []).filter((k) => k !== m.key)))}
                  />
                  <span className="truncate">{m.title}</span>
                  <span className="shrink-0 text-faint">{m.kind}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={() => run.mutate()} disabled={run.isPending || data?.running || models.length === 0 || materialCount === 0}>
            {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run benchmark
          </Button>
          <span className="text-small text-muted-foreground">
            {sessions} sessions · about {Math.max(1, Math.round((sessions * MINUTES_PER_SESSION) / 2 / 60 * 10) / 10)} h (two materials at a time)
          </span>
          {data?.running && (
            <span className="flex items-center gap-1.5 text-small font-semibold text-accent">
              <Loader2 className="size-3.5 animate-spin" /> A run is in progress
            </span>
          )}
        </div>
      </section>

      {/* ---------------- Results ---------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">Leaderboard</h2>
          {(data?.runs.length ?? 0) > 0 && (
            <select
              value={data?.runId ?? ""}
              onChange={(e) => setRunId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]"
              aria-label="Benchmark run"
            >
              {data!.runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.finishedAt ? formatRelativeDate(r.finishedAt) : "–"} · {r.models.length} models · {r.rows} sessions
                </option>
              ))}
            </select>
          )}
        </div>

        {report && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Best overall" value={best ? shortLabel(best.model) : "–"} hint={best ? `${label(best.model)} · ${score(rankScore(best))}/10 · ${pct(best.passRate)} pass` : undefined} />
            <StatCard label="Cheapest at 7+" value={cheapestGood ? shortLabel(cheapestGood.model) : "–"} hint={cheapestGood ? `${label(cheapestGood.model)} · ${usd(cheapestGood.avgCostUsd)} a session` : "No OpenRouter model scored 7+"} />
            <StatCard label="Materials" value={String(report.materials.length)} hint={report.skippedMaterials ? `${report.skippedMaterials} could not be fetched or analysed` : "All reached generation"} />
          </div>
        )}

        <p className="text-[13px] text-muted-foreground">
          Score counts a session that failed to generate as 0, so a model that finishes few materials cannot rank high. The next four columns average the finished sessions only.
        </p>

        <Table headers={["#", "Model", "Score", "When finished", "Fits material", "Quality", "Device fit", "Pass (7+)", "Failed", "Time", "Cost / session"]}>
          {isLoading ? (
            <TableSkeletonRows cols={11} rows={4} />
          ) : !report || report.models.length === 0 ? (
            <EmptyRow colSpan={11}>No benchmark yet. Pick models above and run one.</EmptyRow>
          ) : (
            report.models.map((m: BenchmarkModelLine, i) => (
              <tr key={keyOf(m.model)} className="border-t border-border">
                <Td className="tabular-nums text-faint">{i + 1}</Td>
                <Td className="font-semibold">{label(m.model)}</Td>
                <Td className={cn("font-bold tabular-nums", scoreTone(rankScore(m)))}>{score(rankScore(m))}</Td>
                <Td className="tabular-nums">{score(m.overall)}</Td>
                <Td className="tabular-nums">{score(m.materialFit)}</Td>
                <Td className="tabular-nums">{score(m.quality)}</Td>
                <Td className="tabular-nums" title={`Laptop ${score(m.laptopFit)} · phone ${score(m.phoneFit)}`}>{score(m.mediumFit)}</Td>
                <Td className="tabular-nums">{pct(m.passRate)}</Td>
                <Td className={cn("tabular-nums", m.failed > 0 && "font-semibold text-red-600")}>
                  {m.failed}/{m.attempted}
                  {m.tooSlow ? <span className="font-normal text-muted-foreground"> ({m.tooSlow} too slow)</span> : null}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{secs(m.avgSeconds)}</Td>
                <Td className="tabular-nums" title={m.totalCostUsd !== null ? `Total ${usd(m.totalCostUsd)}` : "Production models are not billed through OpenRouter"}>
                  {usd(m.avgCostUsd)}
                </Td>
              </tr>
            ))
          )}
        </Table>

        {report && report.materials.length > 0 && (
          <>
            <h3 className="pt-2 text-[14px] font-bold">By material</h3>
            <p className="-mt-2 text-small text-muted-foreground">Overall score per session. Select a score for the judge&apos;s summary or the error.</p>
            <Table headers={["Material", ...report.models.map((m) => label(m.model))]}>
              {report.materials.map((mat) => (
                <Fragment key={mat.key}>
                  <tr className="border-t border-border">
                    <Td>
                      <span className="font-semibold">{mat.title}</span>
                      <span className="block text-[12px] text-faint">{mat.kind}</span>
                    </Td>
                    {report.models.map((m) => {
                      const cell: BenchmarkCell | undefined = mat.cells[keyOf(m.model)];
                      const id = `${mat.key}|${keyOf(m.model)}`;
                      return (
                        <Td key={id}>
                          {!cell ? (
                            <span className="text-faint">–</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOpen(open === id ? null : id)}
                              className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 font-bold tabular-nums hover:bg-muted", cell.status === "ASSESSED" ? scoreTone(cell.overall) : "text-red-600")}
                              aria-expanded={open === id}
                            >
                              {cell.status === "ASSESSED" ? `${cell.overall ?? "–"}/10` : cell.status.replace(/_/g, " ").toLowerCase()}
                            </button>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                  {report.models.map((m) => {
                    const id = `${mat.key}|${keyOf(m.model)}`;
                    const cell = mat.cells[keyOf(m.model)];
                    if (open !== id || !cell) return null;
                    return (
                      <tr key={`${id}-detail`} className="bg-muted/40">
                        <Td colSpan={report.models.length + 1} className="text-[13px]">
                          <span className="font-semibold">{label(m.model)}</span>
                          <span className="ml-2 text-faint">
                            {secs(cell.seconds)} · {usd(cell.costUsd)}
                          </span>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{cell.summary ?? cell.error ?? "No summary."}</p>
                        </Td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </Table>
          </>
        )}
      </section>
    </div>
  );
}
