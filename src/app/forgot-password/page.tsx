"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { requestPasswordReset } from "@/lib/api/auth";
import { ArrowRight } from "lucide-react";

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Link href="/landing" aria-label="Scribe home">
            <ScribeLogo />
          </Link>
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a link to reset it
          </p>
        </div>

        {sent ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            If an account exists for <span className="font-medium">{email}</span>,
            a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[13px] font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu"
                required
                autoComplete="email"
                autoFocus
                className={inputClasses}
              />
            </div>

            {error && <p className="text-xs text-rose">{error}</p>}

            <Button type="submit" size="md" className="w-full gap-2" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
