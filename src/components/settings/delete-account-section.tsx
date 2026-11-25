"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { api } from "@/lib/api/trpc-client";
import {
  DELETE_CONFIRM_WORD,
  DELETION_GRACE_DAYS,
  deletionDate,
  isDeletionConfirmed,
} from "@/lib/account-deletion";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/delete-account";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * "Delete account" at the bottom of Settings. The server
 * (`auth.requestAccountDeletion`) soft-deletes the account, clears the
 * session cookie and emails a restore link; the account is purged after
 * DELETION_GRACE_DAYS. Billing is not cancelled by the server, so the
 * dialog says so.
 */
export function DeleteAccountSection({ email }: { email?: string | null }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const days = String(DELETION_GRACE_DAYS);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  if (scheduledFor) {
    return <DeletionScheduled date={scheduledFor} email={email} locale={locale} />;
  }

  return (
    <section id="delete-account" aria-labelledby="delete-account-title" className="mt-12 border-t border-border pt-8">
      <h2 id="delete-account-title" className="page-h2">
        {t("del.title")}
      </h2>
      <p className="mt-0.5 max-w-xl text-small text-muted-foreground">
        {t("del.hint").replace("{days}", days)}
      </p>
      <Button
        ref={triggerRef}
        type="button"
        variant="danger"
        className="mt-3"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t("del.open")}
      </Button>
      {open && (
        <DeleteAccountDialog
          email={email}
          locale={locale}
          onCancel={close}
          onDeleted={(at) => {
            setOpen(false);
            setScheduledFor(at);
          }}
        />
      )}
    </section>
  );
}

function longDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function DeleteAccountDialog({
  email,
  locale,
  onCancel,
  onDeleted,
}: {
  email?: string | null;
  locale: string;
  onCancel: () => void;
  onDeleted: (deletesOn: Date) => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const errorId = useId();

  const confirmed = isDeletionConfirmed(typed, email);
  const date = longDate(deletionDate(), locale);
  const days = String(DELETION_GRACE_DAYS);

  // Cancel is the default focus; the page behind does not scroll.
  useEffect(() => {
    cancelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!working) onCancel();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || working) return;
    setWorking(true);
    setError(null);
    try {
      const requestedAt = new Date();
      // The server clears the auth cookie in this response: the user is
      // signed out once it returns, so no separate logout call.
      await api.auth.requestAccountDeletion.mutate();
      onDeleted(deletionDate(requestedAt));
    } catch (err) {
      const code = (err as { data?: { code?: string } | null }).data?.code;
      setError(code === "UNAUTHORIZED" ? t("del.errorSession") : t("del.errorGeneric"));
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/40 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !working) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-xl font-bold tracking-tight">
          {t("del.dialogTitle")}
        </h2>
        <ul id={descId} className="mt-3 list-disc space-y-2 pl-5 text-ui text-foreground">
          <li>{t("del.signedOut")}</li>
          <li>{t("del.permanent").replace("{date}", date).replace("{days}", days)}</li>
          <li>{t("del.restore").replace("{date}", date)}</li>
          <li>{t("del.billing")}</li>
        </ul>
        <form onSubmit={submit} className="mt-5">
          <label htmlFor={inputId} className="block text-small font-semibold">
            {t("del.typeLabel").replace("{word}", DELETE_CONFIRM_WORD)}
          </label>
          <input
            id={inputId}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={working}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(inputClass, "mt-1.5 h-11")}
          />
          {error && (
            <p id={errorId} role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-small text-rose-700">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={cancelRef} type="button" variant="secondary" disabled={working} onClick={onCancel}>
              {t("del.cancel")}
            </Button>
            <Button type="submit" variant="danger" disabled={!confirmed || working}>
              {working ? t("del.deleting") : t("del.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Shown in place of Settings once the request succeeds; the user is signed out. */
function DeletionScheduled({ date, email, locale }: { date: Date; email?: string | null; locale: string }) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-white px-4 py-10">
      <div role="status" className="w-full max-w-md text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
          {t("del.doneTitle")}
        </h1>
        <p className="mt-3 text-ui text-foreground">
          {t("del.doneBody").replace("{date}", longDate(date, locale))}
        </p>
        <p className="mt-2 text-ui text-muted-foreground">
          {email ? t("del.doneEmail").replace("{email}", email) : t("del.doneEmailNoAddress")}
        </p>
        {/* A full navigation: the cached session in memory is no longer valid. */}
        <a href="/landing" className={buttonClass({ variant: "secondary", className: "mt-6" })}>
          {t("del.doneHome")}
        </a>
      </div>
    </div>
  );
}
