"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { AuthFigure, AuthScene } from "@/components/auth/auth-scene";
import { api } from "@/lib/api/trpc-client";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

export default function RestoreAccountPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"working" | "success" | "error">(
    "working",
  );
  // Holds either a translation key ("misc.…") or raw server error text.
  const [message, setMessage] = useState("misc.restoringAccount");

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        throw new Error("misc.linkMissingToken");
      }

      await api.auth.restoreAccount.mutate({ token });
      setStatus("success");
      setMessage("misc.accountRestored");
      window.location.href = "/login";
    };

    void run().catch((err: unknown) => {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "misc.accountRestoreFailed",
      );
    });
  }, []);

  return (
    <AuthScene mood="mail">
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
            ? t("misc.accountRestoreFailed")
            : t("misc.restoreAccount")}
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
        <div className="flex flex-col items-center gap-4">
          <Link href="/login">
            <Button variant="outline" size="sm">
              {t("misc.signIn")}
            </Button>
          </Link>
        </div>
      )}
    </AuthScene>
  );
}
