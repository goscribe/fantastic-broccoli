"use client";

import "@/lib/i18n/flashcards";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, pageShellClass } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { fetchSharedWorkspaces } from "@/lib/api/workspace";
import { Workspace } from "@/types";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

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
    <main className={pageShellClass}>
      <PageHeader title={t("fc.sharedTitle")} subtitle={t("fc.sharedSubtitle")} />

      {loading && <CardGridSkeleton count={6} />}

      {!loading && shared.length === 0 && (
        <EmptyState cat="wave" title={t("fc.nothingShared")} body={t("fc.nothingSharedBody")} />
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
    </main>
  );
}
