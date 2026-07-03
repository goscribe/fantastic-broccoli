"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { mockFolders } from "@/lib/mock-data";
import { Folder as FolderType } from "@/types";
import { cn } from "@/lib/utils";
import { Home, ChevronRight, Plus, Search } from "lucide-react";

function FolderNode({
  folder,
  depth,
  expanded,
  toggle,
}: {
  folder: FolderType;
  depth: number;
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isOpen = expanded[folder.id] ?? true;
  const active = pathname === `/folder/${folder.id}`;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-2 text-[13px] font-medium",
          active
            ? "bg-accent-soft text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          onClick={() => toggle(folder.id)}
          className="p-0.5 -m-0.5 rounded hover:bg-border"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-faint transition-transform",
              isOpen && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/folder/${folder.id}`)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill={folder.color}
            aria-hidden
          >
            <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2c.4 0 .8.16 1.06.44l.9.92c.19.19.45.3.72.3H13A1.5 1.5 0 0 1 14.5 5.7v6.3A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4z" />
          </svg>
          <span className="truncate">{folder.name}</span>
        </button>
        <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
      </div>

      {isOpen && (
        <div>
          {folder.folders?.map((sub) => (
            <FolderNode
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
          {folder.workspaces.map((ws) => {
            const active = pathname.startsWith(`/workspace/${ws.id}`);
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => router.push(`/workspace/${ws.id}`)}
                className={cn(
                  "w-full flex items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] text-left",
                  active
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
              >
                <span className="text-sm leading-none" aria-hidden>
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
}

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  return (
    <aside className="hidden md:flex w-72 shrink-0 flex-col bg-card border-r border-border">
      <div className="flex items-center gap-2 px-4 h-14">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground text-xs font-bold">
          S
        </span>
        <span className="font-bold text-sm tracking-tight">Scribe</span>
      </div>

      <div className="px-3">
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-faint hover:border-border-strong"
        >
          <Search className="h-3.5 w-3.5" />
          Search…
          <kbd className="ml-auto text-[10px] text-faint border border-border rounded px-1">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium",
            pathname === "/"
              ? "bg-accent-soft text-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>

        <div>
          <div className="flex items-center justify-between px-1.5 pb-1">
            <span className="text-[11px] font-semibold text-faint">
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
          <div className="space-y-px">
            {mockFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                depth={0}
                expanded={expanded}
                toggle={toggle}
              />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
