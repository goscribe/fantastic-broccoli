"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { signIn } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  GoogleSignInButton,
  AuthDivider,
} from "@/components/auth/google-sign-in-button";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

function safeRedirect(): string {
  const target = new URLSearchParams(window.location.search).get("redirect");
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return "/";
}

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Surface Google OAuth errors passed back as /login?error=...
  const [error, setError] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("error"),
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.push(safeRedirect());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("misc.signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      <Image
        src="/illustrations/marketing/mkt-hero.png"
        alt=""
        width={420}
        height={420}
        unoptimized
        className="pointer-events-none absolute -bottom-16 -right-10 hidden w-72 select-none animate-bob sm:block lg:w-96"
      />
      <Image
        src="/illustrations/props/star-gold.png"
        alt=""
        width={80}
        height={80}
        unoptimized
        className="pointer-events-none absolute left-[12%] top-16 hidden w-12 rotate-12 select-none animate-wiggle sm:block"
      />
      <div className="relative w-full max-w-sm space-y-8 rounded-[1.75rem] bg-card/80 p-6 shadow-[0_6px_0_0_var(--border)] backdrop-blur-sm sm:p-8">
        <div className="flex justify-center">
          <Link href="/landing" aria-label="Scribe home">
            <ScribeLogo />
          </Link>
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("misc.welcomeBack")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("misc.signInSubtitle")}
          </p>
        </div>

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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground"
              >
                {t("misc.password")}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("misc.forgotPassword")}
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("misc.enterPassword")}
                required
                autoComplete="current-password"
                className={`${inputClasses} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? t("misc.hidePassword") : t("misc.showPassword")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose">{error}</p>}

          <Button type="submit" size="md" className="w-full gap-2" disabled={busy}>
            {busy ? t("misc.signingIn") : t("misc.signIn")}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <AuthDivider />

        <GoogleSignInButton label={t("misc.continueWithGoogle")} />

        <p className="text-center text-sm text-muted-foreground">
          {t("misc.newToScribe")}{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground hover:underline"
          >
            {t("misc.createAnAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
