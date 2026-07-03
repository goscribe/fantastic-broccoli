"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScribeLogo } from "@/components/graphics/logo";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/api/auth";
import { isLiveApi } from "@/lib/api/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="flex justify-center mb-6">
          <ScribeLogo />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-center mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Sign in to continue studying
        </p>
        {!isLiveApi && (
          <p className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Demo mode — no backend configured. Continue to explore with sample
            data.
          </p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.edu"
            required={isLiveApi}
            className="w-full h-10 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required={isLiveApi}
            className="w-full h-10 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
          />
          {error && <p className="text-xs text-rose">{error}</p>}
          <Button type="submit" size="md" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : isLiveApi ? "Sign in" : "Continue in demo mode"}
          </Button>
        </form>
      </div>
    </div>
  );
}
