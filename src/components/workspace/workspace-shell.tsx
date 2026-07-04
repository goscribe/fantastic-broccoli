"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Workspace } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Library, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (!workspace && loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card">
          <div className="w-full px-4 sm:px-8 pt-6">
            <Skeleton className="h-3.5 w-24 mb-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            </div>
            <div className="flex gap-1 mt-5 pb-3">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
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
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="w-full px-4 sm:px-8 pt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3 w-3" />
            Workspaces
          </button>

          <div className="flex items-center gap-3">
            <WorkspaceIcon
              icon={workspace.icon}
              className="h-10 w-10 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">
                  {workspace.title}
                </h1>
                {workspace.course && (
                  <Badge variant="accent">{workspace.course}</Badge>
                )}
              </div>
              {workspace.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {workspace.description}
                </p>
              )}
            </div>
          </div>

          <nav className="flex gap-1 mt-5 -mb-px">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
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
          </nav>
        </div>
      </div>

      <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
