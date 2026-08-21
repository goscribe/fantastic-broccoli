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
import {
  EmptyScene,
  HeaderDecor,
} from "@/components/graphics/floating-decor";

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
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {t("fc.sharedTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fc.sharedSubtitle")}
          </p>
        </div>
        {shared.length > 0 && (
          <HeaderDecor image="/illustrations/shared.png" />
        )}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspace/${ws.id}/study`}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
          >
            <div className="flex items-center gap-3">
              <WorkspaceIcon icon={ws.icon} className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ws.title}</p>
                {ws.course && (
                  <p className="text-[12px] text-muted-foreground">{ws.course}</p>
                )}
              </div>
            </div>
            {ws.description && (
              <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">
                {ws.description}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] text-faint">
                {t("fc.sharedBy").replace("{name}", ws.sharedBy ?? "")}
              </p>
              {ws.members && <AvatarStack members={ws.members} />}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
