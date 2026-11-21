"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { AuthScene } from "@/components/auth/auth-scene";
import { ScribeLogo } from "@/components/graphics/logo";
import { Mascot } from "@/components/rewards/mascot";
import { Button } from "@/components/ui/button";
import { lookupReferral, signupHref } from "@/lib/api/referrals";
import { rememberReferral } from "@/lib/attribution";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/growth";

/**
 * Invite landing (/i/<code>): who invited you, what Scribe is, and the
 * reward, then the normal signup with the code attached.
 */
export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toLowerCase();
  const { t } = useI18n();

  useEffect(() => {
    rememberReferral(code);
  }, [code]);

  const { data, isLoading } = useQuery({
    queryKey: ["referral-lookup", code],
    queryFn: () => lookupReferral(code),
    retry: 1,
  });
  const valid = data !== null && data !== undefined;
  const name = data?.firstName;

  return (
    <AuthScene>
      <div className="flex justify-center">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
      </div>

      <div className="flex flex-col items-center text-center">
        <Mascot pose="wave" className="h-[104px]" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {isLoading ? (
            <span className="inline-block h-7 w-64 animate-pulse rounded-full bg-muted align-middle" />
          ) : name ? (
            t("growth.landingTitleNamed").replace("{name}", name)
          ) : (
            t("growth.landingTitle")
          )}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("growth.landingBody")}</p>
      </div>

      {!isLoading && !valid ? (
        <p className="border-y border-border py-3 text-center text-[14px] text-muted-foreground">
          {t("growth.landingInvalid")}
        </p>
      ) : (
        <p className="border-y border-border py-3.5 text-[14.5px] font-bold leading-snug text-foreground">{t("growth.landingReward")}</p>
      )}

      <ul className="space-y-2.5">
        {(["growth.landingPoint1", "growth.landingPoint2", "growth.landingPoint3"] as const).map((k) => (
          <li key={k} className="flex items-start gap-2.5 text-[14px] text-foreground">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            {t(k)}
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <Link href={signupHref(valid ? code : null)} className="block">
          <Button size="lg" className="w-full gap-2 text-[15px]">
            {t("growth.landingCta")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/login" className="block text-center text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          {t("growth.landingLogin")}
        </Link>
      </div>
    </AuthScene>
  );
}
