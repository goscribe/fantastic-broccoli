"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/api/auth";
import {
  GoogleSignInButton,
  AuthDivider,
} from "@/components/auth/google-sign-in-button";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

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
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className={`${inputClasses} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            {busy ? "Signing in…" : "Sign in"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <AuthDivider />

        <GoogleSignInButton label="Continue with Google" />

        <p className="text-center text-sm text-muted-foreground">
          New to Scribe?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
