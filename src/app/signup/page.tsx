"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScribeLogo } from "@/components/graphics/logo";
import { Button } from "@/components/ui/button";
import { signUp, signIn } from "@/lib/api/auth";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

const inputClasses =
  "w-full h-10 rounded-lg border border-border bg-card px-3.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-faint";

export default function SignupPage() {
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : "Sign up failed");
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
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Start studying smarter in minutes
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-[13px] font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              autoFocus
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-foreground">
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
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
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
            {busy ? "Creating account…" : "Create account"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
