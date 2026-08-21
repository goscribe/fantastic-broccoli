"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { AuthFigure, AuthScene } from "@/components/auth/auth-scene";
import { api } from "@/lib/api/trpc-client";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

export default function AcceptInvitePage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"working" | "success" | "error">(
    "working",
  );
  // Holds either a translation key ("misc.…") or raw server error text.
  const [message, setMessage] = useState("misc.acceptingInvite");

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        throw new Error("misc.linkMissingToken");
      }

      try {
        const session = await api.auth.getSession.query();
        if (!session?.user) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            `/accept-invite?token=${token}`,
          )}`;
          return;
        }
      } catch {
        window.location.href = `/login?redirect=${encodeURIComponent(
          `/accept-invite?token=${token}`,
        )}`;
        return;
      }

      const result = await api.member.acceptInvite.mutate({ token });
      setStatus("success");
      setMessage("misc.inviteAccepted");
      window.location.href = `/workspace/${result.workspaceId}`;
    };

    void run().catch((err: unknown) => {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "misc.inviteAcceptFailed",
      );
    });
  }, []);

  return (
    <AuthScene mood="invite">
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
            ? t("misc.inviteAcceptFailed")
            : t("misc.workspaceInvite")}
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
          <Link href="/">
            <Button variant="outline" size="sm">
              {t("misc.backHome")}
            </Button>
          </Link>
        </div>
      )}
    </AuthScene>
  );
}
