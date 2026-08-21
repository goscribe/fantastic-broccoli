"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { AuthFigure, AuthScene } from "@/components/auth/auth-scene";
import { verifyEmail } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { api } from "@/lib/api/trpc-client";
import { ArrowRight } from "lucide-react";

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
    <AuthScene mood="celebrate">
      <div className="flex justify-center">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
      </div>

      <AuthFigure
        src={
          status === "success"
            ? "/illustrations/props/trophy.png"
            : status === "error"
              ? "/illustrations/flag.png"
              : "/illustrations/bot.png"
        }
      />

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

      {status === "success" && (
        <p className="text-center text-sm text-muted-foreground">
          {t("misc.redirecting")}
        </p>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {t("misc.linkExpired")}
          </p>
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
