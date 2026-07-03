"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Workspace } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Library, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceShellProps {
  workspace: Workspace | undefined;
  children: React.ReactNode;
}

export function WorkspaceShell({ workspace, children }: WorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();

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
        <div className="w-full max-w-3xl mx-auto px-6 pt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3 w-3" />
            Workspaces
          </button>

          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none" aria-hidden>
              {workspace.icon}
            </span>
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

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
