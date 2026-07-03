"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { mockFolders } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Home, Folder, FolderOpen, ChevronRight, Plus } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
            S
          </span>
          <span className="font-bold tracking-tight">Scribe</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium",
            pathname === "/"
              ? "bg-accent-soft text-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Folders
            </span>
            <button
              type="button"
              aria-label="New folder"
              className="p-0.5 rounded text-faint hover:text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {mockFolders.map((folder) => {
            const isCollapsed = collapsed[folder.id];
            const FolderIcon = isCollapsed ? Folder : FolderOpen;
            return (
              <div key={folder.id}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [folder.id]: !prev[folder.id],
                    }))
                  }
                  className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 text-faint transition-transform",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                  <FolderIcon
                    className="h-4 w-4"
                    style={{ color: folder.color }}
                  />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <span className="text-[11px] text-faint">
                    {folder.workspaces.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="ml-[1.15rem] border-l border-border pl-2 space-y-0.5 py-0.5">
                    {folder.workspaces.map((ws) => {
                      const active = pathname.startsWith(`/workspace/${ws.id}`);
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => router.push(`/workspace/${ws.id}`)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left",
                            active
                              ? "bg-accent-soft text-accent font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {ws.icon}
                          </span>
                          <span className="truncate">{ws.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
