"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Workspace } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Library,
  GraduationCap,
  Layers,
  BookOpen,
  Headphones,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceMembersDialog } from "@/components/workspace/workspace-members-dialog";

interface WorkspaceShellProps {
  workspace: Workspace | undefined;
  loading?: boolean;
  children: React.ReactNode;
}

export function WorkspaceShell({
  workspace,
  loading,
  children,
}: WorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [membersOpen, setMembersOpen] = useState(false);

  if (!workspace && loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card">
          <div className="w-full px-4 sm:px-8 py-2.5">
            <div className="flex gap-1">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
        <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mt-2"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      href: `/workspace/${workspace.id}/materials`,
      label: "Materials",
      icon: Library,
    },
    {
      href: `/workspace/${workspace.id}/study`,
      label: "Study",
      icon: GraduationCap,
    },
    {
      href: `/workspace/${workspace.id}/bank`,
      label: "Bank",
      icon: Layers,
    },
    {
      href: `/workspace/${workspace.id}/guide`,
      label: "Study Guide",
      icon: BookOpen,
    },
    {
      href: `/workspace/${workspace.id}/recall`,
      label: "Passive Recall",
      icon: Headphones,
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="sticky top-14 z-30 border-b border-border bg-card">
        <div className="w-full px-4 sm:px-8">
          <nav
            className="flex items-center gap-1 -mb-px"
            data-tour="workspace-tabs"
          >
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  data-tour={`tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    active
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px text-muted-foreground transition-colors hover:text-foreground"
            >
              <UserPlus className="h-4 w-4" />
              Members
            </button>
          </nav>
        </div>
      </div>

      <WorkspaceMembersDialog
        workspaceId={workspace.id}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />

      <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
