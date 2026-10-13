"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { useAuthUser } from "@/lib/api/auth";
import {
  CANCEL_REASONS,
  feedbackApi,
  type FeedbackContext,
  type FeedbackKind,
} from "@/lib/api/feedback";
import { cn } from "@/lib/utils";

const textareaClasses =
  "w-full resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

const QUESTIONS: Record<
  FeedbackKind,
  { key: string; label: string; placeholder: string }[]
> = {
  GENERAL: [
    {
      key: "fix",
      label: "What's the one thing we should fix or build next?",
      placeholder:
        "A wrong quiz question, an upload that failed, a feature you keep wishing for…",
    },
    {
      key: "useMore",
      label: "What would make you use Scribe more often?",
      placeholder: "Be blunt — this goes straight to the founder.",
    },
  ],
  CANCEL: [
    {
      key: "keep",
      label: "What would have kept you?",
      placeholder: "Price, quality, a missing feature, something that broke…",
    },
    {
      key: "comeBack",
      label: "Anything that would bring you back?",
      placeholder: "Optional",
    },
  ],
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function FeedbackForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? undefined;
  const kindParam = params.get("kind") === "cancel" ? "CANCEL" : undefined;
  const { user, loading: authLoading } = useAuthUser();

  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<string | undefined>();
  const [contactOk, setContactOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token && authLoading) return;
    let cancelled = false;
    feedbackApi
      .getContext({ token, kind: kindParam })
      .then((ctx) => {
        if (!cancelled) setContext(ctx);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "This link isn't valid.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token, kindParam, authLoading]);

  const kind = context?.kind ?? kindParam ?? "GENERAL";
  const questions = QUESTIONS[kind];
  const firstName = (context?.name ?? "").trim().split(/\s+/)[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await feedbackApi.submit({ token, kind, reason, answers, contactOk });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setBusy(false);
    }
  };

  if (!token && !authLoading && !user) {
    return (
      <p className="text-sm text-muted-foreground">
        Open the link from your email, or{" "}
        <Link href="/login?next=/feedback" className="text-accent underline">
          sign in
        </Link>{" "}
        to send feedback.
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Thanks{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Read by a human, not a dashboard. If you asked for a reply you&apos;ll
          get one.
        </p>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-accent">
          Back to Scribe <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          {kind === "CANCEL"
            ? "What should we have done better?"
            : "What can we do better?"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {firstName ? `${firstName}, two` : "Two"} questions, about a minute.
          Blunt is good.
        </p>
      </div>

      {kind === "CANCEL" && (
        <Field label="Main reason you cancelled">
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                  reason === r.value
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground hover:border-accent/60",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {questions.map((q) => (
        <Field key={q.key} label={q.label}>
          <textarea
            value={answers[q.key] ?? ""}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [q.key]: e.target.value }))
            }
            placeholder={q.placeholder}
            rows={3}
            maxLength={2000}
            className={textareaClasses}
          />
        </Field>
      ))}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={contactOk}
          onChange={(e) => setContactOk(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[var(--accent)]"
        />
        OK to reply to me about this
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={
          busy ||
          (!reason && !Object.values(answers).some((v) => v.trim()))
        }
        className="h-10 px-5"
      >
        {busy ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-10 sm:py-16">
        <Link href="/landing" aria-label="Scribe home" className="inline-block">
          <ScribeLogo />
        </Link>
        <div className="mt-8">
          <Suspense fallback={null}>
            <FeedbackForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
