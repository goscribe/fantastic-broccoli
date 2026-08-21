"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { AuthScene } from "@/components/auth/auth-scene";
import { verifyEmail } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { api } from "@/lib/api/trpc-client";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  // Holds either a translation key ("misc.…") or raw server error text.
  const [message, setMessage] = useState("misc.verifyingEmailProgress");

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        throw new Error("misc.linkMissingToken");
      }

      await verifyEmail(token);
      setStatus("success");
      setMessage("misc.emailVerified");

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
        err instanceof Error ? err.message : "misc.emailVerificationFailed",
      );
    });
  }, []);

  return (
    <AuthScene>
      <div className="flex justify-center">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
      </div>

      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {status === "error"
            ? t("misc.verificationFailed")
            : t("misc.verifyingEmail")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {message.startsWith("misc.") ? t(message) : message}
        </p>
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
            {t("misc.redirecting")}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-10 w-10 text-rose-500" />
            <p className="text-center text-sm text-muted-foreground">
              {t("misc.linkExpired")}
            </p>
          </div>
          <Link href="/login">
            <Button size="md" className="w-full gap-2">
              {t("misc.backToSignIn")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </AuthScene>
  );
}
