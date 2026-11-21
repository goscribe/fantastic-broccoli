"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { signUp, signIn } from "@/lib/api/auth";
import { reportSignupConversion } from "@/lib/gtag";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  GoogleSignInButton,
  AuthDivider,
} from "@/components/auth/google-sign-in-button";
import { AuthScene } from "@/components/auth/auth-scene";
import { Input } from "@/components/ui/input";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { safeRedirect } from "@/lib/try";
import "@/lib/i18n/try";

/** Where to go after signup (`?redirect=`), and whether they came to save an anonymous Quick 5. */
function signupTarget(search: string): { redirect: string | null; fromTry: boolean } {
  const params = new URLSearchParams(search);
  const raw = params.get("redirect");
  return { redirect: raw ? safeRedirect(raw) : null, fromTry: params.get("from") === "try" };
}

const noSubscribe = () => () => {};
/** The query string, read after hydration (empty on the server) so the markup matches. */
const useSearch = () => useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const search = useSearch();
  const target = signupTarget(search);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp(name, email, password);
      reportSignupConversion();
      await signIn(email, password);
      // A full load so the new session is read fresh (e.g. back on the
      // anonymous Quick 5's results, which then claims it).
      if (target.redirect) window.location.assign(target.redirect);
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("misc.signUpFailed"));
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

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("misc.createYourAccount")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("misc.signupSubtitle")}
          </p>
        </div>

        {target.fromTry && (
          <p className="rounded-[12px] bg-muted px-3.5 py-2.5 text-center text-[13.5px] font-semibold leading-snug text-foreground" role="note">
            {t("try.signupBanner")}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-[13px] font-medium text-foreground">
              {t("misc.name")}
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("misc.yourName")}
              required
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-foreground">
              {t("misc.email")}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu"
              required
              autoComplete="email"
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
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("misc.atLeast8Chars")}
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
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

        <GoogleSignInButton newAccount label={t("misc.signUpWithGoogle")} />

        <p className="text-center text-sm text-muted-foreground">
          {t("misc.alreadyHaveAccount")}{" "}
          <Link
            href={`/login${search}`}
            className="font-medium text-foreground hover:underline"
          >
            {t("misc.signIn")}
          </Link>
        </p>
    </AuthScene>
  );
}
