"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { fetchSharedWorkspaces } from "@/lib/api/workspace";
import { Workspace } from "@/types";
import { Users } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar-stack";

export default function SharedPage() {
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
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Shared with me</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspaces others have shared with you. Materials are shared — study
          plans stay personal.
        </p>
      </div>

      {!loading && shared.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Users className="mx-auto h-6 w-6 text-faint" />
          <p className="mt-3 text-sm font-medium">Nothing shared with you yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When a classmate shares a workspace, it will show up here.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspace/${ws.id}/materials`}
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
              <p className="text-[12px] text-faint">Shared by {ws.sharedBy}</p>
              {ws.members && <AvatarStack members={ws.members} />}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
