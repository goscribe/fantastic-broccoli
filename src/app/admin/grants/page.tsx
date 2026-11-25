"use client";

import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyRow,
  PageHeader,
  SearchInput,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { adminApi, type BilledPlan, type GrantCandidate, type PlanGrant } from "@/lib/api/admin";
import { planDisplayName } from "@/lib/plan-display";
import { UNLIMITED_GRANT_LABEL } from "@/lib/plan-access";
import { toast, toastError } from "@/lib/toast";
import { useDebounced } from "@/lib/use-debounced";
import { formatRelativeDate } from "@/lib/utils";

const NOTE_MAX = 500;
const MIN_SEARCH = 2;

type Pending =
  | { kind: "give"; userId: string; name: string | null; email: string | null; stillBilled: BilledPlan | null }
  | { kind: "remove"; userId: string; name: string | null; email: string | null; stillBilled: BilledPlan | null };

function day(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "Pro · renews 21 Dec 2026", in the words the billing pages use. */
function billedLine(b: BilledPlan): string {
  const plan = planDisplayName(b.planName);
  if (b.cancelAt) return `${plan} · ends ${day(b.cancelAt)}`;
  if (b.status === "trialing") return `${plan} trial · first charge ${day(b.currentPeriodEnd)}`;
  if (b.status === "active") return `${plan} · renews ${day(b.currentPeriodEnd)}`;
  return `${plan} · ${b.status.replace(/_/g, " ")}`;
}

function Person({ name, email }: { name: string | null; email: string | null }) {
  return (
    <>
      <p className="font-medium">{name ?? "—"}</p>
      <p className="text-[12px] text-muted-foreground">{email ?? "—"}</p>
    </>
  );
}

/** The confirm step for giving or removing: who, an optional note, and what happens to their billing. */
function ConfirmDialog({
  pending,
  busy,
  onConfirm,
  onClose,
}: {
  pending: Pending;
  busy: boolean;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const give = pending.kind === "give";
  useEffect(() => {
    noteRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  const who = pending.name ?? pending.email ?? "this user";
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/40 px-4"
      onClick={() => !busy && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-dialog-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(note);
        }}
      >
        <h2 id="grant-dialog-title" className="text-lg font-bold tracking-tight">
          {give ? `Give ${who} free unlimited?` : `Remove free unlimited from ${who}?`}
        </h2>
        {pending.name && pending.email && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{pending.email}</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {give
            ? "They get the top tier with every limit at its highest, for free, with no end date. Nothing is charged and it does not count as revenue."
            : pending.stillBilled
              ? `They go back to the plan they pay for (${billedLine(pending.stillBilled)}).`
              : "They go back to the free plan, or to any plan of their own. Nothing they made is deleted."}
        </p>
        {give && pending.stillBilled && (
          <p role="alert" className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="font-semibold">They are still paying.</span> {billedLine(pending.stillBilled)}. Giving free
            unlimited does not cancel it: they keep being billed until they cancel in Settings.
          </p>
        )}
        <label htmlFor="grant-note" className="mt-4 block text-[12px] font-semibold uppercase tracking-wide text-faint">
          Note (optional)
        </label>
        <textarea
          id="grant-note"
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={2}
          maxLength={NOTE_MAX}
          placeholder={give ? "Why, e.g. friend of the founder" : "Why it is being removed"}
          className="mt-1 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={give ? "primary" : "danger"} size="sm" disabled={busy}>
            {busy ? "Saving…" : give ? "Give free unlimited" : "Remove"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminGrantsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim(), 300);
  const [pending, setPending] = useState<Pending | null>(null);
  /** The server's "still being billed" warning from the last grant; stays until dismissed. */
  const [warning, setWarning] = useState<string | null>(null);
  const searching = debounced.length >= MIN_SEARCH;

  const found = useQuery({
    queryKey: ["admin", "grants", "search", debounced],
    queryFn: () => adminApi.searchUsersForGrant(debounced),
    enabled: searching,
    placeholderData: keepPreviousData,
  });
  const grants = useQuery({
    queryKey: ["admin", "grants", "list"],
    queryFn: adminApi.listPlanGrants,
  });

  const change = useMutation({
    mutationFn: async ({ target, note }: { target: Pending; note: string }) => {
      const input = { userId: target.userId, note: note.trim() || undefined };
      return target.kind === "give"
        ? { kind: "give" as const, target, result: await adminApi.grantTopTier(input) }
        : { kind: "remove" as const, target, result: await adminApi.revokeTopTier(input) };
    },
    onSuccess: (done) => {
      const who = done.target.name ?? done.target.email ?? "User";
      if (done.kind === "give") {
        toast.success(done.result.changed ? `${who} now has free unlimited` : `${who} already had free unlimited`);
        setWarning(done.result.warning ? `${who}: ${done.result.warning}` : null);
      } else {
        toast.success(
          done.result.changed
            ? `Removed. ${who} is now on ${planDisplayName(done.result.planNow)}`
            : `${who} did not have free unlimited`,
        );
      }
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "grants"] });
    },
    onError: (err) => toastError(err, "Couldn't save that change"),
  });

  const users: GrantCandidate[] = searching ? (found.data?.users ?? []) : [];
  const list: PlanGrant[] = grants.data?.grants ?? [];

  return (
    <>
      <PageHeader
        title="Free access"
        description="Give someone the top tier for free with no end date, or take it away. Nothing is charged, and it never counts as revenue or as a paying user."
      />

      {warning && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p>{warning}</p>
          <button type="button" onClick={() => setWarning(null)} className="shrink-0 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-faint">Find someone</h2>
      <SearchInput value={search} onChange={setSearch} placeholder="Search by email or name…" className="mb-3 max-w-md" />
      <Table headers={["User", "Current plan", "Joined", ""]}>
        {!searching ? (
          <EmptyRow colSpan={4}>Type at least {MIN_SEARCH} letters of an email or name.</EmptyRow>
        ) : found.isLoading ? (
          <TableSkeletonRows cols={4} rows={3} />
        ) : found.isError ? (
          <EmptyRow colSpan={4}>Couldn&apos;t search. Try again.</EmptyRow>
        ) : users.length === 0 ? (
          <EmptyRow colSpan={4}>No one matches “{debounced}”.</EmptyRow>
        ) : (
          users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/40" data-user-id={user.id}>
              <Td>
                <Person name={user.name} email={user.email} />
              </Td>
              <Td>
                {user.granted ? (
                  <Badge variant="muted">{UNLIMITED_GRANT_LABEL}</Badge>
                ) : (
                  <span className="text-muted-foreground">{planDisplayName(user.plan)}</span>
                )}
                {user.stillBilled && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Paying: {billedLine(user.stillBilled)}</p>
                )}
              </Td>
              <Td className="text-muted-foreground">{formatRelativeDate(user.joinedAt)}</Td>
              <Td className="text-right">
                {user.granted ? (
                  <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "remove", userId: user.id, name: user.name, email: user.email, stillBilled: user.stillBilled })}>
                    Remove
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setPending({ kind: "give", userId: user.id, name: user.name, email: user.email, stillBilled: user.stillBilled })}>
                    Give free unlimited
                  </Button>
                )}
              </Td>
            </tr>
          ))
        )}
      </Table>

      <h2 className="mb-2 mt-8 text-[13px] font-semibold uppercase tracking-wide text-faint">
        Has free unlimited now{grants.data ? ` · ${list.length}` : ""}
      </h2>
      <Table headers={["User", "Given by", "When", "Note", ""]}>
        {grants.isLoading ? (
          <TableSkeletonRows cols={5} rows={3} />
        ) : grants.isError ? (
          <EmptyRow colSpan={5}>Couldn&apos;t load the list. Reload to try again.</EmptyRow>
        ) : list.length === 0 ? (
          <EmptyRow colSpan={5}>No one has free unlimited yet.</EmptyRow>
        ) : (
          list.map((grant) => (
            <tr key={grant.userId} className="hover:bg-muted/40" data-grant-user-id={grant.userId}>
              <Td>
                <Person name={grant.name} email={grant.email} />
                {grant.accountDeleted && <p className="text-[12px] text-muted-foreground">Account scheduled for deletion</p>}
                {grant.stillBilled && (
                  <p className="text-[12px] text-muted-foreground">Still paying: {billedLine(grant.stillBilled)}</p>
                )}
              </Td>
              <Td className="text-muted-foreground">{grant.grantedBy?.name ?? grant.grantedBy?.email ?? "—"}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{day(grant.grantedAt)}</Td>
              <Td className="max-w-[280px] text-muted-foreground">{grant.note ?? "—"}</Td>
              <Td className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "remove", userId: grant.userId, name: grant.name, email: grant.email, stillBilled: grant.stillBilled })}>
                  Remove
                </Button>
              </Td>
            </tr>
          ))
        )}
      </Table>

      {pending && (
        <ConfirmDialog
          key={`${pending.kind}:${pending.userId}`}
          pending={pending}
          busy={change.isPending}
          onConfirm={(note) => change.mutate({ target: pending, note })}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
