"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { reviewApi, type NoteReviewer, type NoteStatus, type PayoutRow, type QueueRow, type ReviewCourse } from "@/lib/api/notes";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { StatusPill, STATUS_LABEL } from "@/components/notes/status-pill";

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Review queue for Scribe topic notes: staff and invited subject reviewers.
 * Per course, highest fact-check risk first; offline bundle export/import;
 * staff also manage reviewers and see the payout report. English-only UI
 * (reviewers work on English notes).
 */
export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewQueue />
    </Suspense>
  );
}

function ReviewQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<{ admin: boolean; courseIds: string[] | null } | null | undefined>(undefined);
  const [courses, setCourses] = useState<ReviewCourse[]>([]);
  const courseId = params.get("course") ?? courses.find((c) => Object.values(c.counts).some(Boolean))?.courseId ?? courses[0]?.courseId;
  const [status, setStatus] = useState<NoteStatus | "">("");
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string[] | null>(null);

  useEffect(() => {
    reviewApi
      .me()
      .then((m) => {
        setMe(m);
        if (m) return reviewApi.courses().then(setCourses);
      })
      .catch(() => setMe(null));
  }, []);

  const loadQueue = useCallback(() => {
    if (!courseId) return;
    reviewApi
      .queue(courseId, status || undefined)
      .then(setRows)
      .catch((e) => toastError(e, "Couldn't load the queue"));
  }, [courseId, status]);
  useEffect(loadQueue, [loadQueue]);

  if (me === undefined) return <Shell><div className="h-40 animate-pulse rounded-2xl bg-muted" /></Shell>;
  if (me === null)
    return (
      <Shell>
        <p className="text-[15px] text-muted-foreground">
          This page is for Scribe note reviewers. If you were invited, sign in with the invited email address and verify it.
        </p>
      </Shell>
    );

  const exportAs = async (format: "bundle" | "csv") => {
    if (!courseId) return;
    setBusy(format);
    try {
      const r = await reviewApi.exportCourse(courseId, format);
      download(r.filename, r.text, format === "csv" ? "text/csv" : "text/plain");
    } catch (e) {
      toastError(e, "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy("import");
    try {
      const r = await reviewApi.importBundle(await file.text());
      setImportResult(r.results.map((x) => `${x.courseId}/${x.topicId}: ${x.result}`));
      loadQueue();
    } catch (e) {
      toastError(e, "Import failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => {
          const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
          return (
            <button
              key={c.courseId}
              type="button"
              onClick={() => router.replace(`/review?course=${c.courseId}`)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-[13px]",
                c.courseId === courseId ? "border-accent bg-accent-soft/50" : "border-border bg-card hover:border-border-strong",
              )}
            >
              <span className="block font-semibold">{c.title}</span>
              <span className="text-muted-foreground">
                {c.counts.REVIEWED + c.counts.PUBLISHED}/{total} reviewed · {c.counts.CHANGES_REQUESTED} changes · {c.topicCount} topics
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as NoteStatus | "")}
          className="h-9 rounded-lg border border-border bg-card px-2 text-[13px]"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as NoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button type="button" onClick={() => void exportAs("bundle")} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold hover:border-border-strong">
          {busy === "bundle" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Bundle (.txt)
        </button>
        <button type="button" onClick={() => void exportAs("csv")} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold hover:border-border-strong">
          {busy === "csv" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Summary (.csv)
        </button>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold hover:border-border-strong">
          {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload corrections
          <input type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        </label>
      </div>
      {importResult && (
        <ul className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-[13px]">
          {importResult.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {!rows ? (
          <div className="h-40 animate-pulse bg-muted/40" />
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-[14px] text-muted-foreground">No notes here yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/review/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/40">
                  <span className="min-w-14 shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-faint">{r.topicCode}</span>
                  {/* The name keeps a readable width: on a phone the badges drop to their own line instead of squeezing it to a word per line. */}
                  <span className="min-w-[9rem] flex-1 text-[14px] font-semibold">{r.topicName}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                    {r.stats.flagged > 0 && <span className="rounded-full bg-amber/15 px-2 py-0.5 font-semibold text-[#92400e]">{r.stats.flagged} to check</span>}
                    {r.stats.autoFixed > 0 && <span className="rounded-full bg-sky/15 px-2 py-0.5 font-semibold text-[#075985]">{r.stats.autoFixed} auto-fixed</span>}
                    {r.lintErrors > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{r.lintErrors} style</span>}
                    <span className="tabular-nums">risk {r.risk}</span>
                    {r.assigned && <span>{r.assignedToMe ? "· yours" : "· taken"}</span>}
                    <StatusPill status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {me.admin && <AdminPanel courses={courses} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-[22px] font-bold">Note review</h1>
          <a href="https://github.com/goscribe/server/blob/main/docs/topic-notes-reviewer-guide.md" target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-accent">
            Reviewer guide
          </a>
        </div>
        <p className="mb-5 mt-1 text-[14px] text-muted-foreground">
          Notes with the most fact-check flags come first. Check every flag, fix what is wrong, then approve or request changes.
        </p>
        {children}
      </div>
    </div>
  );
}

function monthRange(offset = 0) {
  const d = new Date();
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 1));
  return { from: from.toISOString(), to: to.toISOString(), label: from.toISOString().slice(0, 7) };
}

function AdminPanel({ courses }: { courses: ReviewCourse[] }) {
  const [reviewers, setReviewers] = useState<NoteReviewer[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [month, setMonth] = useState(0);
  const [form, setForm] = useState({ email: "", name: "", rate: "", courseIds: [] as string[] });
  const [sending, setSending] = useState(false);
  const range = monthRange(month);

  const load = useCallback(() => {
    reviewApi.reviewers().then(setReviewers).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    reviewApi.payouts(range.from, range.to).then(setPayouts).catch(() => {});
  }, [range.from, range.to]);

  const invite = async () => {
    setSending(true);
    try {
      const r = await reviewApi.invite({
        email: form.email,
        ...(form.name ? { name: form.name } : {}),
        courseIds: form.courseIds,
        ...(form.rate ? { ratePerNoteCents: Math.round(Number(form.rate) * 100) } : {}),
      });
      setForm({ email: "", name: "", rate: "", courseIds: [] });
      if (!r.sent) toastError(new Error("Invite saved but the email could not be sent"), "Email not sent");
      load();
    } catch (e) {
      toastError(e, "Invite failed");
    } finally {
      setSending(false);
    }
  };

  const titleOf = (id: string) => courses.find((c) => c.courseId === id)?.title ?? id;
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-[17px] font-semibold">Reviewers (staff only)</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        Invited reviewers see only this queue for their courses: no student data, billing or admin pages.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="h-10 rounded-lg border border-border bg-card px-3 text-[14px]" />
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (optional)" className="h-10 rounded-lg border border-border bg-card px-3 text-[14px]" />
        <input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="$ per note" inputMode="decimal" className="h-10 rounded-lg border border-border bg-card px-3 text-[14px]" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {courses.map((c) => {
          const on = form.courseIds.includes(c.courseId);
          return (
            <button
              key={c.courseId}
              type="button"
              aria-pressed={on}
              onClick={() => setForm({ ...form, courseIds: on ? form.courseIds.filter((x) => x !== c.courseId) : [...form.courseIds, c.courseId] })}
              className={cn("rounded-full border px-2.5 py-1 text-[12.5px] font-semibold", on ? "border-accent bg-accent text-white" : "border-border")}
            >
              {c.title}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => void invite()} disabled={sending || !form.email || !form.courseIds.length} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white disabled:opacity-50">
        {sending && <Loader2 className="size-4 animate-spin" />} Invite reviewer
      </button>

      <ul className="mt-5 divide-y divide-border text-[13.5px]">
        {reviewers.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="font-semibold">{r.name ?? r.email}</span>
            <span className="text-muted-foreground">{r.name ? r.email : ""}</span>
            <span className="min-w-0 flex-1 text-muted-foreground">{r.courseIds.map(titleOf).join(", ")}</span>
            <span className="tabular-nums text-muted-foreground">{r.ratePerNoteCents != null ? `$${(r.ratePerNoteCents / 100).toFixed(2)}/note` : "no rate"}</span>
            <span className="text-muted-foreground">{r.revokedAt ? "revoked" : r.userId ? "active" : "invited"}</span>
            {!r.revokedAt && (
              <button type="button" onClick={() => void reviewApi.revoke(r.id).then(load)} className="font-semibold text-[#b91c1c]">
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-2">
        <h3 className="text-[15px] font-semibold">Payouts {range.label}</h3>
        <button type="button" onClick={() => setMonth(month - 1)} className="rounded-lg border border-border px-2 text-[13px]">←</button>
        <button type="button" onClick={() => setMonth(Math.min(0, month + 1))} className="rounded-lg border border-border px-2 text-[13px]">→</button>
      </div>
      <table className="mt-2 w-full text-left text-[13px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1.5 font-semibold">Reviewer</th>
            <th className="font-semibold">Approved</th>
            <th className="font-semibold">Changes</th>
            <th className="font-semibold">Edited</th>
            <th className="font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.userId} className="border-t border-border">
              <td className="py-1.5">{p.name ?? p.email ?? p.userId}{p.staff ? " (staff)" : ""}</td>
              <td className="tabular-nums">{p.notesApproved}</td>
              <td className="tabular-nums">{p.changesRequested}</td>
              <td className="tabular-nums">{p.notesEdited}</td>
              <td className="tabular-nums">{p.amountCents != null ? `$${(p.amountCents / 100).toFixed(2)}` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
