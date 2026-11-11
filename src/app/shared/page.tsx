"use client";

import "@/lib/i18n/flashcards";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { fetchSharedWorkspaces } from "@/lib/api/workspace";
import { Workspace } from "@/types";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { EmptyScene } from "@/components/graphics/floating-decor";

export default function SharedPage() {
  const { t } = useI18n();
  const [shared, setShared] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedWorkspaces()
      .then(setShared)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex-1 px-6 py-6 md:px-10"><div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {t("fc.sharedTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fc.sharedSubtitle")}
          </p>
        </div>
      </div>

      {loading && <CardGridSkeleton count={6} />}

      {!loading && shared.length === 0 && (
        <EmptyScene image="/illustrations/shared.png">
          <p className="text-base font-semibold">{t("fc.nothingShared")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("fc.nothingSharedBody")}
          </p>
        </EmptyScene>
      )}

      <div className="flex flex-col gap-2.5">
        {shared.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspace/${ws.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent/40"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft/60">
              <WorkspaceIcon icon={ws.icon} className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">{ws.title}</p>
              <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                {[ws.course, t("fc.sharedBy").replace("{name}", ws.sharedBy ?? "")].filter(Boolean).join(" · ")}
              </p>
            </div>
            {ws.members && <AvatarStack members={ws.members} />}
          </Link>
        ))}
      </div>
    </div></main>
  );
}
