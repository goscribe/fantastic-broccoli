"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { requestPasswordReset } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { AuthFigure, AuthScene } from "@/components/auth/auth-scene";
import { ArrowRight } from "lucide-react";

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("misc.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScene mood="mail">
      <div className="flex justify-center">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
      </div>

      <AuthFigure
        src={
          sent
            ? "/illustrations/welcome.png"
            : "/illustrations/search.png"
        }
      />

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("misc.resetPassword")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("misc.resetSubtitle")}
          </p>
        </div>

        {sent ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
            {t("misc.resetSent").split("{email}")[0]}
            <span className="font-medium text-foreground">{email}</span>
            {t("misc.resetSent").split("{email}")[1]}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[13px] font-medium text-foreground"
              >
                {t("misc.email")}
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
              {busy ? t("misc.sending") : t("misc.sendResetLink")}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {t("misc.rememberedIt")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            {t("misc.backToSignIn")}
          </Link>
        </p>
    </AuthScene>
  );
}
