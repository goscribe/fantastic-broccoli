"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { signUp, signIn } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  GoogleSignInButton,
  AuthDivider,
} from "@/components/auth/google-sign-in-button";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp(name, email, password);
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("misc.signUpFailed"));
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
          <h1 className="text-2xl font-bold tracking-tight">
            {t("misc.createYourAccount")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("misc.signupSubtitle")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-[13px] font-medium text-foreground">
              {t("misc.name")}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("misc.yourName")}
              required
              autoComplete="name"
              autoFocus
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-foreground">
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
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-foreground"
            >
              {t("misc.password")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("misc.atLeast8Chars")}
                required
                minLength={8}
                autoComplete="new-password"
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
            {busy ? t("misc.creatingAccount") : t("misc.createAccount")}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
          <p className="text-center text-xs text-faint">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy policy
            </Link>
            .
          </p>
        </form>

        <AuthDivider />

        <GoogleSignInButton label={t("misc.signUpWithGoogle")} />

        <p className="text-center text-sm text-muted-foreground">
          {t("misc.alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            {t("misc.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
