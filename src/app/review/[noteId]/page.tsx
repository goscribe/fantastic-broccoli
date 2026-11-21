"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { reviewApi, type CheckedClaim, type ReviewNote, type TopicNoteContent } from "@/lib/api/notes";
import { NoteBody } from "@/components/notes/note-body";
import { blockKey, flagsByBlock, sortClaims } from "@/lib/notes";
import { InlineMarkdown } from "@/components/ui/markdown-text";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/notes/status-pill";

type Tab = "checks" | "claims" | "history";

/**
 * One note under review: the note (inline-editable) beside its fact-check
 * report, lint, figure QA thumbnails and the review trail. Approve / request
 * changes record who reviewed what and when (the basis for paying reviewers).
 */
export default function ReviewNotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<ReviewNote | null>(null);
  const [draft, setDraft] = useState<TopicNoteContent | null>(null);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("checks");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    reviewApi
      .note(noteId)
      .then((n) => {
        setNote(n);
        setDraft(n.content);
      })
      .catch((e) => setError((e as Error).message));
  }, [noteId]);
  useEffect(load, [load]);

  const flags = useMemo(() => (note ? flagsByBlock(note.factCheck.claims, note.lint) : undefined), [note]);
  const dirty = !!note && !!draft && JSON.stringify(draft) !== JSON.stringify(note.content);

  if (error) return <Frame><p className="text-[15px] text-muted-foreground">{error}</p></Frame>;
  if (!note || !draft) return <Frame><div className="h-60 animate-pulse rounded-2xl bg-muted" /></Frame>;

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try {
      await fn();
      setComment("");
      setEditing(false);
      load();
    } catch (e) {
      toastError(e, "That didn't work");
    } finally {
      setBusy(null);
    }
  };
  const lintErrors = note.lint.filter((l) => l.severity === "error");
  const open = note.factCheck.claims.filter((c) => c.verdict !== "ok" && !c.applied);
  const fixed = note.factCheck.claims.filter((c) => c.applied);

  return (
    <Frame>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/review?course=${note.courseId}`} className="text-[13px] font-semibold text-faint hover:text-accent">
          ← {note.courseTitle}
        </Link>
        <span className="flex-1" />
        <StatusPill status={note.status} />
        <span className="text-[12.5px] text-muted-foreground">v{note.version} · risk {note.risk}</span>
      </div>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">
        <span className="text-faint">{note.content.topicCode}</span> {note.content.topicName}
      </h1>

      <div className="sticky top-[var(--app-top,0px)] z-20 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        {!note.assignedToMe ? (
          <Btn onClick={() => act("claim", () => reviewApi.claim(note.id))} busy={busy === "claim"}>
            {note.assigned ? "Take over" : "Claim for review"}
          </Btn>
        ) : (
          <Btn onClick={() => act("release", () => reviewApi.release(note.id))} busy={busy === "release"}>
            Release
          </Btn>
        )}
        <Btn onClick={() => (editing ? (setEditing(false), setDraft(note.content)) : setEditing(true))}>
          {editing ? "Cancel edit" : "Edit text"}
        </Btn>
        {dirty && (
          <Btn primary onClick={() => act("save", () => reviewApi.save({ noteId: note.id, version: note.version, content: draft, comment: comment || undefined }))} busy={busy === "save"}>
            Save edits
          </Btn>
        )}
        <span className="flex-1" />
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (required to request changes)"
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 text-[13px]"
        />
        <Btn
          disabled={dirty}
          onClick={() => act("changes", () => reviewApi.requestChanges({ noteId: note.id, version: note.version, comment }))}
          busy={busy === "changes"}
        >
          Request changes
        </Btn>
        <Btn
          primary
          disabled={dirty}
          onClick={() =>
            act("approve", () =>
              reviewApi.approve({ noteId: note.id, version: note.version, comment: comment || undefined, overrideLint: lintErrors.length > 0 && !!comment }),
            )
          }
          busy={busy === "approve"}
        >
          Approve
        </Btn>
        {(note.status === "REVIEWED" || note.status === "PUBLISHED") && (
          <Btn onClick={() => act("publish", () => reviewApi.setPublished(note.id, note.status !== "PUBLISHED"))} busy={busy === "publish"}>
            {note.status === "PUBLISHED" ? "Unpublish" : "Publish (staff)"}
          </Btn>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <NoteBody
            note={draft}
            onChange={editing ? setDraft : undefined}
            flags={flags}
            figureExtra={(f) => {
              const thumbs = note.figureThumbs[f.id];
              const qa = note.factCheck.figureQa.find((q) => q.figureId === f.id);
              return (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-[12.5px] text-muted-foreground">
                  <p>
                    <span className="font-semibold">Brief:</span> {f.brief}
                  </p>
                  {qa && <p className="mt-1">Visual QA: {qa.ok ? "passed" : "failed"}{qa.issues.length ? ` · ${qa.issues.join("; ")}` : ""}</p>}
                  {thumbs && (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      {Object.entries(thumbs).map(([w, src]) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={w} src={src} alt={`QA render at ${w}px`} className="max-h-48 rounded border border-border bg-white" style={{ width: Number(w) / 2.5 }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--app-top,0px)+4rem)] lg:max-h-[calc(100vh-5rem-var(--app-top,0px))] lg:overflow-y-auto">
          <div className="flex gap-1 rounded-xl bg-muted p-1 text-[13px] font-semibold">
            {(["checks", "claims", "history"] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-pressed={tab === k}
                className={cn("flex-1 rounded-lg py-1.5", tab === k ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {k === "checks" ? `To check (${open.length + fixed.length + lintErrors.length})` : k === "claims" ? `All claims (${note.factCheck.stats.claims})` : "History"}
              </button>
            ))}
          </div>

          {tab === "checks" && (
            <div className="mt-3 flex flex-col gap-3 text-[13.5px] leading-snug">
              {note.factCheck.reviewReasons.length > 0 && (
                <ul className="rounded-xl bg-amber/10 px-3 py-2 text-[13px]">
                  {note.factCheck.reviewReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              {open.map((c) => <ClaimCard key={c.id} c={c} />)}
              {fixed.map((c) => <ClaimCard key={c.id} c={c} />)}
              {note.lint.map((l, i) => (
                <button key={i} type="button" onClick={() => jump(l.where)} className="rounded-xl border border-border bg-card px-3 py-2 text-left">
                  <span className={cn("font-semibold", l.severity === "error" ? "text-[#b91c1c]" : "text-muted-foreground")}>
                    {l.severity === "error" ? "Style error" : "Style note"} · {l.rule}
                  </span>
                  <span className="block text-muted-foreground">
                    [{l.where}] {l.message}
                  </span>
                </button>
              ))}
              {!open.length && !fixed.length && !note.lint.length && (
                <p className="text-muted-foreground">No flags. Read the note in full and check each fact before approving.</p>
              )}
              <p className="text-[12px] text-faint">
                Command terms for this course: {note.commandTerms.join(", ")}.
              </p>
            </div>
          )}

          {tab === "claims" && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[13px] leading-snug">
              {sortClaims(note.factCheck.claims).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => jump(c.where)} className="flex w-full gap-2 text-left">
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        c.verdict === "ok" ? "bg-[#10B981]" : c.applied ? "bg-sky" : "bg-amber",
                      )}
                    />
                    <span>
                      <span className="text-faint">[{c.where}]</span> <InlineMarkdown text={c.claim} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab === "history" && (
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              {note.reviews.length === 0 && <li className="text-muted-foreground">No review actions yet.</li>}
              {note.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card px-3 py-2">
                  <span className="font-semibold">{r.action.replace("_", " ").toLowerCase()}</span> · v{r.version} · {new Date(r.createdAt).toLocaleString()}
                  {r.mine ? " · you" : ""}
                  {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                  {r.changes?.slice(0, 6).map((ch, i) => (
                    <p key={i} className="mt-1 text-[12px] text-muted-foreground">
                      [{ch.where}] <s>{ch.before.slice(0, 80)}</s> → {ch.after.slice(0, 80)}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </Frame>
  );
}

function jump(where: string) {
  document.getElementById(`loc-${blockKey(where)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ClaimCard({ c }: { c: CheckedClaim }) {
  return (
    <button
      type="button"
      onClick={() => jump(c.where)}
      className={cn("rounded-xl border px-3 py-2 text-left", c.applied ? "border-sky/40 bg-sky/5" : "border-amber/50 bg-amber/5")}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
        {c.applied ? "Auto-fixed, confirm" : c.verdict === "wrong" ? "Likely wrong" : "Check"} · {c.where}
      </span>
      <span className="mt-0.5 block font-semibold">
        <InlineMarkdown text={c.claim} />
      </span>
      {c.reason && (
        <span className="mt-0.5 block text-muted-foreground">
          <InlineMarkdown text={c.reason} />
        </span>
      )}
      {c.applied && /^f\d/.test(c.where) ? (
        <span className="mt-1 block text-[12.5px] text-muted-foreground">Figure regenerated to fix this: check it agrees with the text.</span>
      ) : (
        c.fix && (
          <span className="mt-1 block text-[12.5px] text-muted-foreground">
            {c.applied ? "Changed" : "Suggested"}:{" "}
            <s>
              <InlineMarkdown text={c.fix.find} />
            </s>{" "}
            → <InlineMarkdown text={c.fix.replace} />
          </span>
        )
      )}
    </button>
  );
}

function Btn({
  children,
  onClick,
  busy,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-50",
        primary ? "bg-accent text-white hover:bg-accent-dim" : "border border-border bg-card hover:border-border-strong",
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-5 sm:px-6">{children}</div>
    </div>
  );
}
