"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { AuthScene } from "@/components/auth/auth-scene";
import { api } from "@/lib/api/trpc-client";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Holds either a translation key ("misc.…") or raw server error text.
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("misc.passwordsDontMatch");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("misc.linkMissingToken");
      return;
    }
    setBusy(true);
    try {
      await api.auth.resetPassword.mutate({ token, newPassword: password });
      setDone(true);
      window.location.href = "/login";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "misc.passwordResetFailed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScene>
      <div className="flex justify-center">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
      </div>

      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("misc.resetPassword")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("misc.chooseNewPassword")}
        </p>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-center text-sm text-muted-foreground">
            {t("misc.redirecting")}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("misc.newPassword")}
              required
              minLength={8}
              className={inputClasses}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={
                showPassword ? t("misc.hidePassword") : t("misc.showPassword")
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("misc.confirmNewPassword")}
            required
            minLength={8}
            className={inputClasses}
          />
          {error && (
            <p className="text-sm text-destructive">
              {error.startsWith("misc.") ? t(error) : error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("common.loading") : t("misc.resetPassword")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-accent hover:underline">
              {t("misc.backToLogin")}
            </Link>
          </p>
        </form>
      )}
    </AuthScene>
  );
}
