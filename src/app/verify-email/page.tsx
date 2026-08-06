"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/auth";
import { api } from "@/lib/api/trpc-client";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        throw new Error("This verification link is missing a token.");
      }

      await verifyEmail(token);
      setStatus("success");
      setMessage("Your email has been verified.");

      let next = "/login";
      try {
        const session = await api.auth.getSession.query();
        if (session?.user) next = "/";
      } catch {
        // not logged in
      }
      window.location.href = next;
    };

    void run().catch((err: unknown) => {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Email verification failed.",
      );
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {status === "error" ? "Verification failed" : "Verifying your email"}
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {status === "verifying" && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-center text-sm text-muted-foreground">
              Redirecting you now…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <XCircle className="h-10 w-10 text-rose-500" />
              <p className="text-center text-sm text-muted-foreground">
                The link may have expired or already been used.
              </p>
            </div>
            <Link href="/login">
              <Button size="md" className="w-full gap-2">
                Back to sign in
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
